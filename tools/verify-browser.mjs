import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "verify-output");
const PROFILE = join(tmpdir(), `anti-ip-logger-verify-${Date.now()}`);
const PORT_FILE = join(PROFILE, "DevToolsActivePort");
const BROWSER_CANDIDATES = [
  process.env.BRAVE_PATH,
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const failures = [];
const passed = [];
const consoleErrors = [];
let stage = "başlangıç";

function check(name, ok, detail = "") {
  if (ok) passed.push(name);
  else failures.push(`${name}${detail ? `: ${detail}` : ""}`);
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}\n`);
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
  throw new Error(`${label} zaman aşımı${lastError ? `: ${lastError.message}` : ""}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
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
        reject(new Error(`${method} zaman aşımı`));
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
  await client.send("Runtime.enable");
  if (page) {
    await client.send("Page.enable");
    await client.send("Log.enable");
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
  await sleep(350);
  const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, 30_000);
  await writeFile(join(OUT, name), Buffer.from(shot.data, "base64"));
}

async function openTab(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Yeni sekme açılamadı: HTTP ${response.status}`);
  return response.json();
}

async function waitForLoad(client, timeout = 15_000) {
  await waitFor(
    () => evaluate(client, "return document.readyState === 'complete';"),
    timeout,
    "sayfa yükleme",
  );
}

async function run() {
  const watchdog = setTimeout(() => {
    process.stderr.write(`\nDoğrulama zaman aşımı, aşama: ${stage}\n`);
    process.exit(1);
  }, 120_000);
  watchdog.unref();

  const browser = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate));
  check("tarayıcı bulundu", Boolean(browser), browser || "Brave/Chrome bulunamadı");
  if (!browser) return;

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
      `--load-extension=${ROOT}`,
      `--disable-extensions-except=${ROOT}`,
      "--remote-debugging-port=0",
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
    check("tarayıcı hata ayıklama portu açıldı", Number.isFinite(port) && port > 0, String(port));

    const worker = await waitFor(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = await response.json();
        return targets.find((target) => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
      },
      20_000,
      "servis çalışanı",
    );
    check("servis çalışanı yüklendi", Boolean(worker), worker.url);

    const extensionId = new URL(worker.url).host;
    check("uzantı kimliği okundu", /^[a-p]{32}$/.test(extensionId), extensionId);

    const workerClient = await connect(worker, { page: false });
    await waitFor(
      () => evaluate(workerClient, "return typeof chrome === 'object' && Boolean(chrome.declarativeNetRequest);").catch(() => false),
      10_000,
      "servis çalışanı API bağlamı",
    );

    const ruleInfo = await waitFor(
      async () => {
        const info = await evaluate(
          workerClient,
          `const rules = await chrome.declarativeNetRequest.getDynamicRules();
           const staticRules = await chrome.declarativeNetRequest.getEnabledRulesets();
           return { dynamic: rules.length, staticRules };`,
        );
        return info.dynamic > 0 ? info : null;
      },
      15_000,
      "dinamik kural uygulaması",
    ).catch(async () =>
      evaluate(
        workerClient,
        `const rules = await chrome.declarativeNetRequest.getDynamicRules();
         const staticRules = await chrome.declarativeNetRequest.getEnabledRulesets();
         return { dynamic: rules.length, staticRules };`,
      ),
    );
    check("dinamik kurallar yüklendi", ruleInfo.dynamic > 0, `${ruleInfo.dynamic} kural`);
    check("statik kural seti etkin", ruleInfo.staticRules.includes("core"), ruleInfo.staticRules.join(","));

    const settings = await waitFor(
      async () => {
        const value = await evaluate(
          workerClient,
          `const data = await chrome.storage.local.get("settings");
           return data.settings || null;`,
        );
        return value && value.enabled === true ? value : null;
      },
      10_000,
      "varsayılan ayarlar",
    ).catch(() => null);
    check("varsayılan ayarlar yazıldı", Boolean(settings && settings.enabled === true));

    const siteTarget = await openTab(port, "https://example.com/");
    const popupTarget = await openTab(port, `chrome-extension://${extensionId}/popup/popup.html`);
    const popup = await connect(popupTarget);
    await waitForLoad(popup);
    await waitFor(() => evaluate(popup, "return document.getElementById('content') && !document.getElementById('content').hidden;"), 8000, "popup içeriği");
    await fetch(`http://127.0.0.1:${port}/json/activate/${siteTarget.id}`);
    await popup.send("Page.reload");
    await waitForLoad(popup);
    await waitFor(() => evaluate(popup, "return document.getElementById('content') && !document.getElementById('content').hidden;"), 8000, "popup içeriği");
    const popupState = await evaluate(
      popup,
      `const headline = document.getElementById('verdict-headline').textContent.trim();
       const label = document.getElementById('verdict-badge').textContent.trim();
       const buttons = [...document.querySelectorAll('.hero__actions button:not([hidden])')].map((b) => b.textContent.trim());
       const host = document.getElementById('hero-host').textContent.trim();
       const hint = !document.getElementById('no-host-hint').hidden;
       return { headline, label, buttons, host, hint, error: !document.getElementById('error-state').hidden };`,
    );
    check("popup hata durumunda değil", popupState.error === false);
    check("popup başlık metni var", popupState.headline.length > 8, popupState.headline);
    check("popup durum etiketi var", popupState.label.length > 2, popupState.label);
    check("popup eylem düğmeleri var", popupState.buttons.length >= 2 || popupState.hint, popupState.buttons.join(" | ") || "boş sekme ipucu");
    if (popupState.host) check("popup aktif sekme alan adını gösterir", popupState.host.includes("example.com"), popupState.host);
    await screenshot(popup, "popup-light.png", 384, 620, "light");

    await popup.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
    await evaluate(popup, "document.documentElement.setAttribute('data-theme','dark'); return true;");
    await sleep(250);
    const darkContrast = await evaluate(
      popup,
      `const style = getComputedStyle(document.body);
       return { background: style.backgroundColor, color: style.color };`,
    );
    check("koyu tema uygulanabilir", darkContrast.background !== darkContrast.color, `${darkContrast.background} / ${darkContrast.color}`);
    await screenshot(popup, "popup-dark.png", 384, 620, "dark");
    await evaluate(popup, "document.documentElement.removeAttribute('data-theme'); return true;");
    await popup.send("Emulation.setEmulatedMedia", { features: [] });

    const dashTarget = await openTab(port, `chrome-extension://${extensionId}/dashboard/dashboard.html#genel`);
    const dash = await connect(dashTarget);
    await waitForLoad(dash);
    await waitFor(() => evaluate(dash, "return document.getElementById('tile-domains').textContent.trim() !== '0';"), 8000, "panel verisi");
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
    check("panel verisi yüklendi", dashState.error === false && Number(dashState.coreCount.replace(/\\D/g, "")) > 0, dashState.coreCount);
    check("panel koruma durumu", dashState.status.length > 3, dashState.status);
    check("panel tek görünüm", dashState.activeView.length === 1, dashState.activeView.join(","));
    await screenshot(dash, "dashboard-light.png", 1280, 900, "light");

    await evaluate(dash, "location.hash = '#listeler'; return true;");
    await sleep(600);
    const listState = await evaluate(
      dash,
      `return {
        rows: document.querySelectorAll('#core-rows tr').length,
        allowVisible: !document.getElementById('section-listeler').hidden,
        summary: document.getElementById('core-summary').textContent.trim(),
      };`,
    );
    check("liste tablosu dolu", listState.rows > 10, `${listState.rows} satır`);
    check("liste bölümü görünür", listState.allowVisible);
    await screenshot(dash, "dashboard-lists.png", 1280, 900, "light");

    await evaluate(dash, "location.hash = '#ayarlar'; return true;");
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
    check("ayarlar forma yansıdı", settingsState.enabled === true && settingsState.core === true, JSON.stringify(settingsState));
    await screenshot(dash, "dashboard-settings.png", 1280, 900, "light");

    const testTarget = await openTab(port, "https://grabify.link/test-verify");
    const test = await connect(testTarget);
    try {
      await waitFor(
        () => evaluate(test, "return location.href.includes('/blocked/blocked.html');"),
        12_000,
        "engel yönlendirmesi",
      );
      await waitFor(
        () =>
          evaluate(
            test,
            `const node = document.getElementById('target-url');
             return Boolean(node) && node.textContent.trim() !== 'Adres okunuyor';`,
          ),
        8000,
        "engel hedefi",
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
      check("grabify isteği engel sayfasına yönlendi", blocked.url.includes("/blocked/blocked.html"), blocked.url);
      check("engel sayfası hedef adresi gösterir", blocked.target.includes("grabify.link"), blocked.target);
      check("engel sayfası izin düğmesi etkin", blocked.allowEnabled === true);
      await screenshot(test, "blocked.png", 900, 760, "light");
    } catch (error) {
      check("grabify isteği engel sayfasına yönlendi", false, error.message);
    }

    const tabState = await evaluate(
      workerClient,
      `const tabs = await chrome.tabs.query({});
       return tabs.map((tab) => ({ id: tab.id, url: tab.url || "" }));`,
    );
    check("sekme izinleri sekme kapanınca temizlenir", Array.isArray(tabState), `${tabState.length} sekme`);

    const nonFaviconErrors = consoleErrors.filter((text) => !/favicon|net::ERR/i.test(text));
    check("konsol hatası yok", nonFaviconErrors.length === 0, nonFaviconErrors.slice(0, 3).join(" | "));

    await writeFile(
      join(OUT, "report.json"),
      `${JSON.stringify({ passed, failures, consoleErrors, extensionId, rules: ruleInfo }, null, 2)}\n`,
      "utf8",
    );

    popup.close();
    dash.close();
    test.close();
    workerClient.close();
  } finally {
    child.kill();
    await sleep(500);
    await rm(PROFILE, { recursive: true, force: true }).catch(() => {});
  }

  process.stdout.write(`\n${passed.length}/${passed.length + failures.length} tarayıcı kontrolü geçti. Görüntüler: verify-output/\n`);
  if (failures.length > 0) {
    process.stdout.write(`\nBaşarısız:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  process.stderr.write(`Tarayıcı doğrulaması çalıştırılamadı: ${error.message}\n`);
  process.exitCode = 1;
});
