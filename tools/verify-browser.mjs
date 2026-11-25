import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { detectBrowsers, resolveBrowser } from "./browser-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_PATH = process.env.EXTENSION_PATH || ROOT;

function printUsage() {
  process.stderr.write(
    "Usage: node tools/verify-browser.mjs [--browser <id|name|path>] [--list] [--out <dir>]\n" +
      "Environment: BROWSER_PATH, BRAVE_PATH (legacy), VERIFY_OUT, EXTENSION_PATH, BROWSER_LANG\n",
  );
}

function parseArgs(argv) {
  const args = { browser: null, list: false, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") {
      args.list = true;
      continue;
    }
    if (arg === "--browser" || arg === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        printUsage();
        process.exit(2);
      }
      if (arg === "--browser") args.browser = value;
      else args.out = value;
      index += 1;
      continue;
    }
    printUsage();
    process.exit(2);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const OUT = process.env.VERIFY_OUT || args.out || join(ROOT, "verify-output");

if (args.list) {
  const detected = detectBrowsers();
  if (detected.length === 0) {
    process.stderr.write("No supported Chromium browser detected. Set BROWSER_PATH to a browser binary.\n");
    process.exit(1);
  }
  for (const entry of detected) {
    process.stdout.write(`${entry.id}  ${entry.name}  ${entry.path}\n`);
  }
  process.stdout.write(`${detected.length} browser${detected.length === 1 ? "" : "s"} detected\n`);
  process.exit(0);
}

const failures = [];
const passed = [];
const consoleErrors = [];
let stage = "startup";

function check(name, ok, detail = "") {
  if (ok) passed.push(name);
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}\n`);
}

function finalSummary() {
  const rel = relative(ROOT, OUT);
  const insideRepo = rel && !rel.startsWith("..") && !isAbsolute(rel);
  const shown = insideRepo ? `${rel}/` : OUT;
  process.stdout.write(`\n${passed.length}/${passed.length + failures.length} browser checks passed. Screenshots: ${shown}\n`);
  if (failures.length > 0) {
    process.stdout.write(`\nFAILED:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
    process.exitCode = 1;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(task, timeoutMs, label) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await task();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ""}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.contexts = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve);
      this.socket.addEventListener("error", reject);
    });
    this.socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
        return;
      }
      const handlers = this.events.get(data.method) || [];
      for (const handler of handlers) handler(data.params);
    });
  }

  send(method, params = {}, timeoutMs = 15_000) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    const list = this.events.get(method) || [];
    list.push(handler);
    this.events.set(method, list);
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // Already closed.
    }
  }
}

async function connect(target, { page = true } = {}) {
  const client = new Cdp(target.webSocketDebuggerUrl);
  await client.ready;
  client.on("Runtime.executionContextCreated", (params) => {
    if (params && params.context) client.contexts.push(params.context);
  });
  await waitFor(
    () => client.send("Runtime.enable").then(() => true).catch(() => false),
    10_000,
    "Runtime.enable",
  );
  if (page) {
    await waitFor(
      () => client.send("Page.enable").then(() => true).catch(() => false),
      10_000,
      "Page.enable",
    );
    await client.send("Log.enable").catch(() => {});
  }
  client.on("Runtime.exceptionThrown", (params) => {
    consoleErrors.push(`${target.type}: ${params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || "exception"}`);
  });
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error") return;
    const text = params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
    consoleErrors.push(`${target.type}: ${text}`);
  });
  client.on("Log.entryAdded", (params) => {
    if (params.entry.level === "error" && !/favicon/i.test(params.entry.text || "")) {
      consoleErrors.push(`${target.type}: ${params.entry.text}`);
    }
  });
  return client;
}

// Edge ships built-in extension workers whose URLs also end with "/background.js",
// so the suffix alone cannot identify our worker. Probe each candidate's manifest.
let ourIdentity = null;
async function ourManifestIdentity() {
  if (ourIdentity) return ourIdentity;
  const manifest = JSON.parse(await readFile(join(EXTENSION_PATH, "manifest.json"), "utf8"));
  let name = manifest.name;
  const match = /^__MSG_(.+)__$/.exec(name);
  if (match) {
    try {
      const locale = manifest.default_locale || "en";
      const messages = JSON.parse(await readFile(join(EXTENSION_PATH, "_locales", locale, "messages.json"), "utf8"));
      name = messages[match[1]]?.message || name;
    } catch {
      // Locale unreadable; keep the raw manifest name.
    }
  }
  ourIdentity = { name, version: manifest.version };
  return ourIdentity;
}

const probeCache = new Map();
async function isOurExtensionWorker(target) {
  const host = new URL(target.url).host;
  if (probeCache.has(host)) return probeCache.get(host);
  let ours = false;
  let probe = null;
  try {
    const identity = await ourManifestIdentity();
    probe = new Cdp(target.webSocketDebuggerUrl);
    await probe.ready;
    await probe.send("Runtime.enable", {}, 3000);
    const result = await probe.send("Runtime.evaluate", {
      expression: "JSON.stringify({ name: chrome.runtime.getManifest().name, version: chrome.runtime.getManifest().version })",
      returnByValue: true,
    }, 3000);
    const info = JSON.parse(result.result.value);
    ours = info.name === identity.name && info.version === identity.version;
  } catch {
    ours = false;
  } finally {
    if (probe) probe.close();
  }
  probeCache.set(host, ours);
  return ours;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function screenshot(client, name, width, height, theme = "light") {
  await client.send("Page.bringToFront").catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await evaluate(client, `document.documentElement.setAttribute('data-theme','${theme}'); return true;`).catch(() => {});
  await evaluate(client, `if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); return true;`).catch(() => {});
  await sleep(350);
  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, 30_000);
  await writeFile(join(OUT, name), Buffer.from(shot.data, "base64"));
}

async function openTab(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not open a new tab: HTTP ${response.status}`);
  return response.json();
}

// Chrome 158 on Linux navigates a debugger-created tab to a chrome-extension://
// URL and lands on chrome-error://chromewebdata/, and the install-time welcome
// tab is not guaranteed to exist (the background opens it after its init work).
// The first extension page is therefore opened by asking the background from a
// content script world, with a DNR-blocked navigation as the fallback.
async function findExtensionPage(port, extensionId) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();
  return (
    targets.find(
      (target) => target.type === "page" && target.url.startsWith(`chrome-extension://${extensionId}/`),
    ) || null
  );
}

// The isolated world of the extension content script is not labelled the same
// way across Chromium builds, so every execution context is probed for the
// extension runtime id instead of trusting origin or auxData.
async function findExtensionWorld(client, extensionId) {
  for (const context of [...client.contexts]) {
    const result = await client
      .send(
        "Runtime.evaluate",
        {
          expression:
            "typeof chrome === 'object' && chrome.runtime && chrome.runtime.id ? chrome.runtime.id : ''",
          contextId: context.id,
          returnByValue: true,
        },
        3000,
      )
      .catch(() => null);
    if (result && result.result && result.result.value === extensionId) return context;
  }
  return null;
}

async function openWelcomeThroughContentScript(port, extensionId) {
  const siteTarget = await openTab(port, "https://example.com/");
  const site = await connect(siteTarget);
  try {
    await waitForLoad(site);
    let context = await waitFor(() => findExtensionWorld(site, extensionId), 6000, "content script context").catch(() => null);
    if (!context) {
      await site.send("Page.reload");
      await waitForLoad(site);
      context = await waitFor(() => findExtensionWorld(site, extensionId), 6000, "content script context after reload").catch(async () => {
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
        const summary = {
          contexts: site.contexts.map((item) => ({
            id: item.id,
            origin: item.origin,
            name: item.name,
            aux: item.auxData && { isDefault: item.auxData.isDefault, type: item.auxData.type },
          })),
          targets: targets.map((target) => ({ type: target.type, url: target.url })),
        };
        process.stdout.write(`DIAG content world ${JSON.stringify(summary).slice(0, 4000)}\n`);
        throw new Error("content script context unavailable");
      });
    }
    await site.send(
      "Runtime.evaluate",
      {
        expression: 'chrome.runtime.sendMessage({ type: "openWelcome" }).then(() => true, () => false)',
        contextId: context.id,
        awaitPromise: true,
        returnByValue: true,
      },
      10_000,
    );
    return await waitFor(() => findExtensionPage(port, extensionId), 10_000, "extension page");
  } finally {
    await fetch(`http://127.0.0.1:${port}/json/close/${siteTarget.id}`).catch(() => {});
    site.close();
  }
}

// The static core ruleset redirects a known IP logger to the packaged blocked
// page. That navigation is issued by the browser, not by the debugger, so it
// loads the extension page even where a debugger-created tab cannot.
async function openExtensionPageThroughBlockedNavigation(port, extensionId) {
  await openTab(port, "https://grabify.link/verify-bootstrap");
  return waitFor(() => findExtensionPage(port, extensionId), 15_000, "extension page");
}

// Extension pages cannot be opened through /json/new on Chrome 158 for Linux,
// so they are opened from an extension page that is already running.
async function openExtensionTab(opener, port, pagePath) {
  const listTargets = async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    return response.json();
  };
  const before = new Set(
    (await listTargets()).filter((target) => target.type === "page" && target.url.includes(pagePath)).map((target) => target.id),
  );
  await evaluate(
    opener,
    `await chrome.tabs.create({ url: chrome.runtime.getURL(${JSON.stringify(pagePath)}) }); return true;`,
  );
  return waitFor(
    async () => {
      const targets = await listTargets();
      return (
        targets.find(
          (target) => target.type === "page" && target.url.includes(pagePath) && !before.has(target.id),
        ) || null
      );
    },
    10_000,
    `extension tab ${pagePath}`,
  );
}

async function waitForLoad(client, timeout = 15_000) {
  await waitFor(
    () => evaluate(client, "return document.readyState === 'complete';"),
    timeout,
    "page load",
  );
}

async function run() {
  const watchdog = setTimeout(() => {
    process.stderr.write(`\nVerification timed out, stage: ${stage}\n`);
    process.exit(1);
  }, 120_000);
  watchdog.unref();

  let selected = null;
  if (args.browser) {
    const resolved = resolveBrowser(args.browser);
    selected = resolved && existsSync(resolved.path) ? resolved : null;
    check(
      "browser found",
      Boolean(selected),
      selected ? selected.path : `${args.browser} (does not resolve to an existing file)`,
    );
  } else {
    const detected = detectBrowsers();
    selected = detected[0] || null;
    check(
      "browser found",
      Boolean(selected),
      selected ? selected.path : "No supported Chromium browser detected",
    );
  }
  if (!selected) {
    finalSummary();
    return;
  }

  const browser = selected.path;
  const PROFILE = join(tmpdir(), `anti-ip-logger-verify-${selected.id}-${Date.now()}`);
  const PORT_FILE = join(PROFILE, "DevToolsActivePort");
  let browserInfo = { id: selected.id, name: selected.name, path: selected.path, product: "", version: "" };

  await mkdir(OUT, { recursive: true });
  const child = spawn(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--user-data-dir=${PROFILE}`,
      `--load-extension=${EXTENSION_PATH}`,
      `--disable-extensions-except=${EXTENSION_PATH}`,
      "--remote-debugging-port=0",
      `--lang=${process.env.BROWSER_LANG || "en-US"}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  let port = 0;
  try {
    const lines = await waitFor(
      async () => {
        if (!existsSync(PORT_FILE)) return null;
        const text = (await readFile(PORT_FILE, "utf8")).trim().split(/\r?\n/);
        return text.length >= 1 ? text : null;
      },
      20_000,
      "DevTools portu",
    );
    port = Number(lines[0]);
    check("browser debug port opened", Number.isFinite(port) && port > 0, String(port));

    const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`).catch(() => null);
    const versionPayload = versionResponse && versionResponse.ok ? await versionResponse.json().catch(() => null) : null;
    const product = versionPayload?.Browser || "";
    const version = product.includes("/") ? product.slice(product.lastIndexOf("/") + 1) : product;
    browserInfo = { id: selected.id, name: selected.name, path: selected.path, product, version };
    process.stdout.write(`Browser: ${selected.name} ${version} (${selected.id})\n`);

    const listExtensionWorkers = async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      return targets.filter((target) => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
    };
    const worker = await waitFor(
      async () => {
        const workers = await listExtensionWorkers();
        const ordered = [
          ...workers.filter((target) => target.url.endsWith("/background.js")),
          ...workers.filter((target) => !target.url.endsWith("/background.js")),
        ];
        for (const target of ordered) {
          if (await isOurExtensionWorker(target)) return target;
        }
        return null;
      },
      20_000,
      "service worker",
    ).catch(async () => {
      const workers = await listExtensionWorkers();
      return workers.find((target) => target.url.endsWith("/background.js")) || workers[0] || null;
    });
    check("service worker loaded", Boolean(worker), worker ? worker.url : "not found");
    if (!worker) throw new Error("service worker not found");

    const extensionId = new URL(worker.url).host;
    check("extension id read", /^[a-p]{32}$/.test(extensionId), extensionId);

    // Service worker targets are not reliably scriptable across Chromium builds
    // (Chrome 158 on Linux rejects Runtime.evaluate on the worker target), so
    // privileged API checks run in the welcome page, which has the same APIs.
    let bootstrapTarget = null;
    if (process.env.VERIFY_BOOTSTRAP !== "blocked") {
      bootstrapTarget = await openWelcomeThroughContentScript(port, extensionId).catch(() => null);
    }
    if (!bootstrapTarget) {
      bootstrapTarget = await openExtensionPageThroughBlockedNavigation(port, extensionId);
    }
    const admin = await connect(bootstrapTarget);
    await waitForLoad(admin);
    const apiContext = await waitFor(
      () => evaluate(admin, "return typeof chrome === 'object' && Boolean(chrome.declarativeNetRequest);").catch(() => false),
      10_000,
      "extension page API context",
    ).catch(() => false);
    if (!apiContext) {
      const diagnostic = await evaluate(
        admin,
        `return { url: location.href, ready: document.readyState,
           chromeType: typeof chrome,
           keys: typeof chrome === "object" ? Object.keys(chrome).slice(0, 12) : [],
           title: document.title };`,
      ).catch((error) => ({ error: error.message }));
      process.stdout.write(`DIAG extension page ${JSON.stringify({ target: bootstrapTarget.url, diagnostic })}\n`);
      throw new Error("extension page API context unavailable");
    }

    const dashTarget = await openExtensionTab(admin, port, "dashboard/dashboard.html#overview");
    const dash = await connect(dashTarget);
    await waitForLoad(dash);
    // The bootstrap page exists only to open the first extension tab. Closing it
    // keeps the tab state checks from seeing a second blocked or welcome page.
    await fetch(`http://127.0.0.1:${port}/json/close/${bootstrapTarget.id}`).catch(() => {});
    admin.close();

    const ruleInfo = await waitFor(
      async () => {
        const info = await evaluate(
          dash,
          `const rules = await chrome.declarativeNetRequest.getDynamicRules();
           const staticRules = await chrome.declarativeNetRequest.getEnabledRulesets();
           return { dynamic: rules.length, staticRules };`,
        );
        return info.dynamic > 0 ? info : null;
      },
      15_000,
      "dynamic rule apply",
    ).catch(async () =>
      evaluate(
        dash,
        `const rules = await chrome.declarativeNetRequest.getDynamicRules();
         const staticRules = await chrome.declarativeNetRequest.getEnabledRulesets();
         return { dynamic: rules.length, staticRules };`,
      ),
    );
    check("dynamic rules loaded", ruleInfo.dynamic > 0, `${ruleInfo.dynamic} kural`);
    check("static ruleset enabled", ruleInfo.staticRules.includes("core"), ruleInfo.staticRules.join(","));

    const settings = await waitFor(
      async () => {
        const value = await evaluate(
          dash,
          `const data = await chrome.storage.local.get("settings");
           return data.settings || null;`,
        );
        return value && value.enabled === true ? value : null;
      },
      10_000,
      "default settings",
    ).catch(() => null);
    check("default settings written", Boolean(settings && settings.enabled === true));

    const siteTarget = await openTab(port, "https://example.com/");
    const popupTarget = await openExtensionTab(dash, port, "popup/popup.html");
    const popup = await connect(popupTarget);
    await waitForLoad(popup);
    await waitFor(() => evaluate(popup, "return document.getElementById('content') && !document.getElementById('content').hidden;"), 8000, "popup content");
    // The popup is driven by the active tab, and reloading the popup tab can
    // briefly make it the active tab in headless mode. Retry the load while the
    // site tab is active until the popup reports its host.
    let popupHost = "";
    for (let attempt = 0; attempt < 3 && !popupHost; attempt += 1) {
      await fetch(`http://127.0.0.1:${port}/json/activate/${siteTarget.id}`).catch(() => {});
      await popup.send("Page.reload");
      await waitForLoad(popup);
      await waitFor(() => evaluate(popup, "return document.getElementById('content') && !document.getElementById('content').hidden;"), 8000, "popup content");
      popupHost = await waitFor(
        () =>
          evaluate(popup, "return document.getElementById('hero-host').textContent.trim();").then((value) =>
            value ? value : null,
          ),
        3000,
        "popup host",
      ).catch(() => "");
    }
    const popupState = await evaluate(
      popup,
      `const headline = document.getElementById('verdict-headline').textContent.trim();
       const label = document.getElementById('verdict-badge').textContent.trim();
       const buttons = [...document.querySelectorAll('.hero__actions button:not([hidden])')].map((b) => b.textContent.trim());
       const host = document.getElementById('hero-host').textContent.trim();
       const hint = !document.getElementById('no-host-hint').hidden;
       return { headline, label, buttons, host, hint, error: !document.getElementById('error-state').hidden };`,
    );
    check("popup not in error state", popupState.error === false);
    check("popup headline present", popupState.headline.length > 8, popupState.headline);
    check("popup badge present", popupState.label.length > 2, popupState.label);
    check("popup action buttons present", popupState.buttons.length >= 2 || popupState.hint, popupState.buttons.join(" | ") || "empty tab hint");
    check("popup shows active tab host", popupHost.includes("example.com"), popupHost || "empty");
    await screenshot(popup, "popup-light.png", 384, 620, "light");

    await popup.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
    await evaluate(popup, "document.documentElement.setAttribute('data-theme','dark'); return true;");
    await sleep(250);
    const darkContrast = await evaluate(
      popup,
      `const style = getComputedStyle(document.body);
       return { background: style.backgroundColor, color: style.color };`,
    );
    check("dark theme applied", darkContrast.background !== darkContrast.color, `${darkContrast.background} / ${darkContrast.color}`);
    await screenshot(popup, "popup-dark.png", 384, 620, "dark");
    await evaluate(popup, "document.documentElement.removeAttribute('data-theme'); return true;");
    await popup.send("Emulation.setEmulatedMedia", { features: [] });

    await waitFor(() => evaluate(dash, "return document.getElementById('tile-domains').textContent.trim() !== '0';"), 8000, "panel data");
    const dashState = await evaluate(
      dash,
      `return {
        coreCount: document.getElementById('tile-domains').textContent.trim(),
        rules: document.getElementById('tile-rules').textContent.trim(),
        status: document.getElementById('status-line').textContent.trim(),
        error: !document.getElementById('global-error').hidden,
        activeView: [...document.querySelectorAll('.view')].filter((v) => !v.hidden).map((v) => v.id),
      };`,
    );
    check("panel data loaded", dashState.error === false && Number(dashState.coreCount.replace(/\\D/g, "")) > 0, dashState.coreCount);
    check("panel protection status", dashState.status.length > 3, dashState.status);
    check("panel single view", dashState.activeView.length === 1, dashState.activeView.join(","));
    await screenshot(dash, "dashboard-light.png", 1280, 900, "light");

    await evaluate(dash, "location.hash = '#lists'; return true;");
    await sleep(600);
    const listState = await evaluate(
      dash,
      `return {
        rows: document.querySelectorAll('#core-rows tr').length,
        allowVisible: !document.getElementById('section-lists').hidden,
        summary: document.getElementById('core-summary').textContent.trim(),
      };`,
    );
    check("list table filled", listState.rows > 10, `${listState.rows} rows`);
    check("lists section visible", listState.allowVisible);
    await screenshot(dash, "dashboard-lists.png", 1280, 900, "light");

    await evaluate(
      dash,
      `const input = document.getElementById('core-search');
       input.value = 'zzzz-yok';
       input.dispatchEvent(new Event('input', { bubbles: true }));
       return true;`,
    );
    await sleep(300);
    const searchState = await evaluate(
      dash,
      `const rows = document.querySelectorAll('#core-rows tr').length;
       const summary = document.getElementById('core-summary').textContent.trim();
       const empty = !document.getElementById('core-empty').hidden;
       return { rows, summary, empty };`,
    );
    check("list search shows empty state", searchState.rows === 0 && searchState.empty === true, searchState.summary);
    await evaluate(
      dash,
      `const input = document.getElementById('core-search');
       input.value = '';
       input.dispatchEvent(new Event('input', { bubbles: true }));
       return true;`,
    );

    await evaluate(
      dash,
      `document.getElementById('allow-input').value = 'example.com';
       document.getElementById('allow-form').requestSubmit();
       return true;`,
    );
    const allowAdded = await waitFor(
      () => evaluate(dash, "return document.querySelectorAll('#allow-list .domain-item').length === 1;").catch(() => false),
      5000,
      "allowlist add",
    );
    check("allowlist form works", allowAdded === true);
    await evaluate(dash, "document.querySelector('#allow-list .domain-item button').click(); return true;");
    const allowRemoved = await waitFor(
      () => evaluate(dash, "return document.querySelectorAll('#allow-list .domain-item').length === 0;").catch(() => false),
      5000,
      "allowlist removal",
    );
    check("allowlist entry removed", allowRemoved === true);

    await evaluate(
      dash,
      `document.getElementById('custom-input').value = 'ornek-test.com';
       document.getElementById('custom-form').requestSubmit();
       return true;`,
    );
    const customAdded = await waitFor(
      () => evaluate(dash, "return document.querySelectorAll('#custom-list .domain-item').length === 1;").catch(() => false),
      5000,
      "custom block add",
    );
    check("custom block form works", customAdded === true);
    await evaluate(dash, "document.querySelector('#custom-list .domain-item button').click(); return true;");
    const customRemoved = await waitFor(
      () => evaluate(dash, "return document.querySelectorAll('#custom-list .domain-item').length === 0;").catch(() => false),
      5000,
      "custom block removal",
    );
    check("custom block entry removed", customRemoved === true);

    await dash.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
    await sleep(400);
    const mobileDash = await evaluate(
      dash,
      `return { scroll: document.documentElement.scrollWidth, view: window.innerWidth };`,
    );
    check("panel does not overflow on mobile", mobileDash.scroll <= mobileDash.view + 1, `${mobileDash.scroll} / ${mobileDash.view}`);

    await evaluate(dash, "location.hash = '#settings'; return true;");
    await sleep(500);
    const settingsState = await evaluate(
      dash,
      `return {
        enabled: document.getElementById('set-enabled').checked,
        core: document.getElementById('set-core').checked,
        theme: document.getElementById('set-theme').value,
        webrtc: document.getElementById('set-webrtc').value,
      };`,
    );
    check("settings reflected in form", settingsState.enabled === true && settingsState.core === true, JSON.stringify(settingsState));
    await screenshot(dash, "dashboard-settings.png", 1280, 900, "light");

    await evaluate(dash, "document.getElementById('pause-15').click(); return true;");
    const pauseVisible = await waitFor(
      () => evaluate(dash, "return !document.getElementById('pause-status').hidden && !document.getElementById('pause-resume').hidden;").catch(() => false),
      8000,
      "pause state visible",
    ).catch(() => false);
    check("pause state visible after 15 minute action", pauseVisible === true);

    const readPauseState = () =>
      evaluate(
        dash,
        `const settings = (await chrome.storage.local.get('settings')).settings; const rules = await chrome.declarativeNetRequest.getDynamicRules(); const enabled = await chrome.declarativeNetRequest.getEnabledRulesets(); return { pauseUntil: settings.pauseUntil, enabled: settings.enabled, dynamic: rules.length, rulesets: enabled };`,
      );
    const pauseState = await waitFor(
      async () => {
        const value = await readPauseState();
        return value && Number.isFinite(value.pauseUntil) && value.pauseUntil > Date.now() && value.dynamic === 0 && Array.isArray(value.rulesets) && !value.rulesets.includes("core") ? value : null;
      },
      8000,
      "pause enforcement applied",
    ).catch(() => readPauseState().catch(() => ({ pauseUntil: 0, enabled: false, dynamic: "?", rulesets: [] })));
    check("pause stored with a future deadline", Number(pauseState.pauseUntil) > Date.now(), `pauseUntil ${pauseState.pauseUntil}`);
    check(
      "pause removes dynamic and static rules",
      pauseState.dynamic === 0 && !pauseState.rulesets.includes("core"),
      `dynamic ${pauseState.dynamic}, rulesets ${(pauseState.rulesets || []).join(",") || "none"}`,
    );

    await evaluate(dash, "location.hash = '#overview'; return true;");
    const overviewPaused = await waitFor(
      () => evaluate(dash, "return document.getElementById('status-line').textContent.toLowerCase().includes('paused');").catch(() => false),
      5000,
      "overview paused state",
    ).catch(() => false);
    check("overview reports the paused state", overviewPaused === true);

    await popup.send("Page.reload");
    await waitForLoad(popup);
    await waitFor(() => evaluate(popup, "return document.getElementById('content') && !document.getElementById('content').hidden;"), 8000, "popup content after reload");
    const pausedPopup = await evaluate(
      popup,
      `return { resume: !document.getElementById('resume-protection').hidden, headline: document.getElementById('verdict-headline').textContent };`,
    );
    check("popup offers resume while paused", pausedPopup.resume === true);
    check("popup shows the paused verdict", pausedPopup.headline.toLowerCase().includes("paused"), pausedPopup.headline);

    await evaluate(dash, "location.hash = '#settings'; return true;");
    await sleep(400);
    await evaluate(dash, "document.getElementById('pause-resume').click(); return true;");
    const resumeState = await waitFor(
      async () => {
        const value = await evaluate(
          dash,
          `const settings = (await chrome.storage.local.get('settings')).settings;
           const rules = await chrome.declarativeNetRequest.getDynamicRules();
           const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
           return { pauseUntil: settings.pauseUntil, dynamic: rules.length, rulesets: enabled };`,
        );
        return value && value.pauseUntil === 0 && value.dynamic > 0 && value.rulesets.includes("core") ? value : null;
      },
      8000,
      "resume restores rules",
    ).catch(() => null);
    check(
      "resume restores dynamic and static rules",
      Boolean(resumeState),
      resumeState ? `dynamic ${resumeState.dynamic}, rulesets ${resumeState.rulesets.join(",")}` : "timed out waiting for pauseUntil 0 and rules",
    );

    await evaluate(dash, "location.hash = '#overview'; return true;");
    const overviewResumed = await waitFor(
      () => evaluate(dash, "return document.getElementById('status-line').textContent.toLowerCase().includes('protection on');").catch(() => false),
      5000,
      "overview protection on",
    ).catch(() => false);
    check("overview reports protection on after resume", overviewResumed === true);

    await evaluate(dash, "document.documentElement.setAttribute('data-theme','dark'); return true;");
    await sleep(250);
    const dashDark = await evaluate(
      dash,
      `const style = getComputedStyle(document.body);
       const rail = getComputedStyle(document.querySelector('.rail')).backgroundColor;
       return { background: style.backgroundColor, color: style.color, rail };`,
    );
    check("panel readable in dark theme", dashDark.background !== dashDark.color && !dashDark.rail.includes("251, 248, 241"), JSON.stringify(dashDark));
    await screenshot(dash, "dashboard-dark.png", 1280, 900, "dark");
    await evaluate(dash, "document.documentElement.setAttribute('data-theme','light'); return true;");

    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'graphite' }, resolve));");
    await dash.send("Page.reload");
    await waitForLoad(dash);
    await waitFor(() => evaluate(dash, "return document.documentElement.getAttribute('data-theme') === 'graphite';").catch(() => false), 8000, "graphite theme");
    await waitFor(() => evaluate(dash, "return getComputedStyle(document.body).backgroundColor === 'rgb(15, 17, 21)';").catch(() => false), 5000, "graphite paint").catch(() => {});
    const graphiteDash = await evaluate(
      dash,
      `const style = getComputedStyle(document.body);
       return { theme: document.documentElement.getAttribute('data-theme'), background: style.backgroundColor, color: style.color };`,
    );
    check("graphite theme applied", graphiteDash.theme === "graphite" && graphiteDash.background === "rgb(15, 17, 21)", JSON.stringify(graphiteDash));
    await screenshot(dash, "dashboard-graphite.png", 1280, 900, "graphite");

    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'contrast' }, resolve));");
    await dash.send("Page.reload");
    await waitForLoad(dash);
    await waitFor(() => evaluate(dash, "return document.documentElement.getAttribute('data-theme') === 'contrast';").catch(() => false), 8000, "contrast theme");
    await waitFor(() => evaluate(dash, "return getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)';").catch(() => false), 5000, "contrast paint").catch(() => {});
    const contrastDash = await evaluate(
      dash,
      `const style = getComputedStyle(document.body);
       return { theme: document.documentElement.getAttribute('data-theme'), background: style.backgroundColor, color: style.color };`,
    );
    check("contrast theme applied", contrastDash.theme === "contrast" && contrastDash.background === "rgb(255, 255, 255)" && contrastDash.color === "rgb(0, 0, 0)", JSON.stringify(contrastDash));
    await screenshot(dash, "dashboard-contrast.png", 1280, 900, "contrast");

    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'system' }, resolve));");
    await dash.send("Page.reload");
    await waitForLoad(dash);

    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'graphite' }, resolve));");
    const testTarget = await openTab(port, "https://grabify.link/test-verify");
    const test = await connect(testTarget);
    try {
      await waitFor(
        () => evaluate(test, "return location.href.includes('/blocked/blocked.html');"),
        12_000,
        "blocked redirect",
      );
      await waitFor(
        () =>
          evaluate(
            test,
            `const node = document.getElementById('target-url');
             return Boolean(node) && node.textContent.trim() !== 'Reading address';`,
          ),
        8000,
        "blocked target",
      );
      const blocked = await evaluate(
        test,
        `return {
          url: location.href,
          target: document.getElementById('target-url').textContent.trim(),
          title: document.getElementById('title').textContent.trim(),
          meta: document.getElementById('target-meta').textContent.trim(),
          allowEnabled: !document.getElementById('allow-tab').disabled,
        };`,
      );
      check("grabify request redirected to blocked page", blocked.url.includes("/blocked/blocked.html"), blocked.url);
      check("blocked page shows target address", blocked.target.includes("grabify.link"), blocked.target);
      check("blocked page allow button enabled", blocked.allowEnabled === true);
      const blockedTheme = await evaluate(
        test,
        `const style = getComputedStyle(document.body);
         return { theme: document.documentElement.getAttribute('data-theme'), background: style.backgroundColor };`,
      );
      check("blocked page applies the stored theme", blockedTheme.theme === "graphite" && blockedTheme.background !== "rgb(251, 248, 241)", JSON.stringify(blockedTheme));
      await screenshot(test, "blocked.png", 900, 760, "light");
      await test.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 780, deviceScaleFactor: 2, mobile: true });
      await sleep(350);
      const blockedMobile = await evaluate(
        test,
        `return { scroll: document.documentElement.scrollWidth, view: window.innerWidth };`,
      );
      check("blocked page does not overflow on mobile", blockedMobile.scroll <= blockedMobile.view + 1, `${blockedMobile.scroll} / ${blockedMobile.view}`);
      await screenshot(test, "blocked-mobile.png", 360, 780, "light");
    } catch (error) {
      check("grabify request redirected to blocked page", false, error.message);
    }
    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'system' }, resolve));");

    // Serve the post-allow navigation offline. The allow rule points the tab at
    // the grabify URL, but the real page and its third-party scripts are not
    // part of what is being verified. Fulfill the paused request with an empty
    // 200 so the tab URL changes without any network traffic.
    test.on("Fetch.requestPaused", (params) => {
      test.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/html" }],
        body: "",
      }).catch(() => {});
    });
    await test.send("Fetch.enable", {
      patterns: [{ urlPattern: "*grabify.link*", requestStage: "Request" }],
    });

    // Regression: Chrome rejects tabIds in dynamic rules, so "allow once in this
    // tab" must install a session-scoped rule and must not touch dynamic rules.
    const tabAllowProbe = await evaluate(
      dash,
      `const tabs = await chrome.tabs.query({});
       const blocked = tabs.find((tab) => tab.url && tab.url.includes('/blocked/blocked.html'));
       const session = await chrome.declarativeNetRequest.getSessionRules();
       const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
       return { blockedTabId: blocked ? blocked.id : null, session, dynamic };`,
    );
    const tabAllowTabId = tabAllowProbe && Number.isFinite(tabAllowProbe.blockedTabId) ? tabAllowProbe.blockedTabId : null;
    const hasTabScopedRule = (rules) => Array.isArray(rules)
      && rules.some((rule) => rule.condition && Array.isArray(rule.condition.tabIds) && rule.condition.tabIds.includes(tabAllowTabId));
    check(
      "no tab-scoped rule while the blocked page is pending",
      tabAllowTabId !== null && !hasTabScopedRule(tabAllowProbe.session) && !hasTabScopedRule(tabAllowProbe.dynamic),
      tabAllowTabId === null
        ? "blocked tab not found"
        : `session ${(tabAllowProbe.session || []).length}, dynamic ${(tabAllowProbe.dynamic || []).length}`,
    );
    if (tabAllowTabId !== null) {
      await evaluate(test, "document.getElementById('allow-tab').click(); return true;").catch(() => false);
      const navigatedTo = await waitFor(
        async () => {
          const url = await evaluate(
            dash,
            `const tab = await chrome.tabs.get(${tabAllowTabId}).catch(() => null); return tab && tab.url ? tab.url : '';`,
          );
          return url && !url.includes("/blocked/blocked.html") ? url : null;
        },
        12_000,
        "navigation leaves the blocked page",
      ).catch(() => null);
      check(
        "allow once in this tab leaves the blocked page",
        Boolean(navigatedTo),
        navigatedTo || "navigation did not leave blocked.html",
      );
      const postAllow = await waitFor(
        async () => {
          const value = await evaluate(
            dash,
            `const session = await chrome.declarativeNetRequest.getSessionRules();
             const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
             return { session, dynamic };`,
          );
          return hasTabScopedRule(value.session) ? value : null;
        },
        8_000,
        "tab-scoped session rule",
      ).catch(() => null);
      check(
        "tab allow uses a session-scoped rule",
        Boolean(postAllow),
        postAllow ? `${postAllow.session.length} session rule(s) with the tab id` : "no session rule with the tab id",
      );
      check(
        "tab allow does not use a dynamic rule",
        Boolean(postAllow)
          && !hasTabScopedRule(postAllow.dynamic)
          && !postAllow.dynamic.some((rule) => rule.action && rule.action.type === "allow"
            && rule.condition && Array.isArray(rule.condition.requestDomains)
            && rule.condition.requestDomains.includes("grabify.link")),
        postAllow ? `${postAllow.dynamic.length} dynamic rule(s)` : "session rule never appeared",
      );
      await evaluate(dash, `await chrome.tabs.remove(${tabAllowTabId}).catch(() => {}); return true;`);
      const cleared = await waitFor(
        async () => {
          const session = await evaluate(
            dash,
            "const rules = await chrome.declarativeNetRequest.getSessionRules(); return rules.length;",
          );
          return session === 0 ? true : null;
        },
        8_000,
        "session rules cleared after tab close",
      ).catch(() => null);
      check(
        "session rules cleared after the tab closes",
        cleared === true,
        cleared === null ? "timed out waiting for an empty session rule set" : "empty session rule set",
      );
    }

    await test.send("Fetch.disable").catch(() => {});

    const tabState = await evaluate(
      dash,
      `const tabs = await chrome.tabs.query({});
       return tabs.map((tab) => ({ id: tab.id, url: tab.url || "" }));`,
    );
    check("tab allows cleared on tab close", Array.isArray(tabState), `${tabState.length} sekme`);

    await evaluate(dash, `location.hash = "#overview"; await new Promise((resolve) => setTimeout(resolve, 250)); return location.hash;`);
    await screenshot(dash, "dashboard-mobile.png", 360, 780, "light");

    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'contrast' }, resolve));");
    const welcomeTarget = await openExtensionTab(dash, port, "welcome/welcome.html");
    const welcome = await connect(welcomeTarget);
    await waitForLoad(welcome);
    await waitFor(() => evaluate(welcome, "return document.documentElement.getAttribute('data-theme') === 'contrast';").catch(() => false), 8000, "welcome contrast theme");
    const welcomeTheme = await evaluate(
      welcome,
      `const style = getComputedStyle(document.body);
       return { theme: document.documentElement.getAttribute('data-theme'), background: style.backgroundColor };`,
    );
    check("welcome page applies the stored theme", welcomeTheme.theme === "contrast" && welcomeTheme.background === "rgb(255, 255, 255)", JSON.stringify(welcomeTheme));
    await screenshot(welcome, "welcome.png", 1000, 760, "light");
    await screenshot(welcome, "welcome-mobile.png", 360, 780, "light");
    await fetch(`http://127.0.0.1:${port}/json/close/${welcomeTarget.id}`).catch(() => {});
    welcome.close();
    await evaluate(dash, "return new Promise((resolve) => chrome.runtime.sendMessage({ type: 'setSetting', key: 'theme', value: 'system' }, resolve));");

    const nonFaviconErrors = consoleErrors.filter((text) => !/favicon|net::ERR/i.test(text));
    check("no console errors", nonFaviconErrors.length === 0, nonFaviconErrors.slice(0, 3).join(" | "));

    await writeFile(
      join(OUT, "report.json"),
      `${JSON.stringify({ passed, failures, consoleErrors, extensionId, rules: ruleInfo, browser: browserInfo }, null, 2)}\n`,
      "utf8",
    );

    popup.close();
    dash.close();
    test.close();
  } finally {
    child.kill();
    await sleep(500);
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
  }

  finalSummary();
}

run().catch((error) => {
  process.stderr.write(`Browser verification could not run: ${error.message}\n`);
  process.exitCode = 1;
});
