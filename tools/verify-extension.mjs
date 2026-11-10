import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function listFiles(dir, extension) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".") || entry.name === "graphify-out") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(full, extension)));
    else if (entry.name.endsWith(extension)) found.push(full);
  }
  return found;
}

const manifest = await readJson(join(ROOT, "manifest.json"));

check("manifest_version 3", manifest.manifest_version === 3);
check("name and version defined", typeof manifest.name === "string" && /^\d+\.\d+\.\d+$/.test(manifest.version));
check("service worker is a module", manifest.background && manifest.background.type === "module");

const requiredFiles = new Set([
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...manifest.declarative_net_request.rule_resources.map((resource) => resource.path),
]);

for (const file of requiredFiles) {
  check(`file exists: ${file}`, existsSync(join(ROOT, file)));
}

const permissions = new Set(manifest.permissions || []);
for (const permission of ["storage", "declarativeNetRequest", "alarms", "webNavigation", "privacy", "tabs"]) {
  check(`izin: ${permission}`, permissions.has(permission));
}
check("host_permissions <all_urls>", (manifest.host_permissions || []).includes("<all_urls>"));
check(
  "content script runs in the main world",
  manifest.content_scripts.some((script) => script.world === "MAIN" && script.run_at === "document_start"),
);

const jsFiles = [
  ...(await listFiles(join(ROOT, "lib"), ".js")),
  ...(await listFiles(join(ROOT, "popup"), ".js")),
  ...(await listFiles(join(ROOT, "dashboard"), ".js")),
  ...(await listFiles(join(ROOT, "blocked"), ".js")),
  ...(await listFiles(join(ROOT, "assets"), ".js")),
  ...(await listFiles(join(ROOT, "content"), ".js")),
  ...(await listFiles(join(ROOT, "tools"), ".mjs")),
  ...(await listFiles(join(ROOT, "tests"), ".mjs")),
  join(ROOT, "background.js"),
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  check(`syntax: ${relative(ROOT, file)}`, result.status === 0, (result.stderr || "").split("\n")[0]);
}

const rules = await readJson(join(ROOT, "rules", "core.json"));
check("static rule list is an array", Array.isArray(rules) && rules.length > 0);
check("static rule count within limit", rules.length <= 30_000, `${rules.length}`);

const ids = new Set();
let domainTotal = 0;
let schemaOk = true;
for (const rule of rules) {
  if (ids.has(rule.id)) schemaOk = false;
  ids.add(rule.id);
  if (!rule.action || rule.action.type !== "block") schemaOk = false;
  if (!rule.condition || !Array.isArray(rule.condition.requestDomains)) schemaOk = false;
  if (!Array.isArray(rule.condition.resourceTypes) || rule.condition.resourceTypes.length === 0) schemaOk = false;
  if (rule.condition.requestDomains.length > 100) schemaOk = false;
  for (const domain of rule.condition.requestDomains) {
    domainTotal += 1;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) schemaOk = false;
  }
}
check("static rule schema is valid", schemaOk);
check("static rule ids are unique", ids.size === rules.length);

const coreData = await readJson(join(ROOT, "data", "core-domains.json"));
const exceptions = await readJson(join(ROOT, "data", "core-exceptions.json"));
const meta = await readJson(join(ROOT, "data", "meta.json"));

check("core data count matches meta", coreData.domains.length === meta.counts.domains, `${coreData.domains.length} / ${meta.counts.domains}`);
check("rule domain total matches data", domainTotal === meta.counts.domains, `${domainTotal} / ${meta.counts.domains}`);
check("exception count matches meta", exceptions.length === meta.counts.exceptions);

const coreSet = new Set(coreData.domains.map((entry) => entry.domain));
check("no duplicates in the core list", coreSet.size === coreData.domains.length);
const overlap = exceptions.filter((domain) => coreSet.has(domain));
check("exceptions are not on the blocklist", overlap.length === 0, overlap.join(","));
check("every entry has category and trust", coreData.domains.every((entry) => entry.category && ["confirmed", "single"].includes(entry.confidence)));
check("every entry has at least one source", coreData.domains.every((entry) => Array.isArray(entry.sources) && entry.sources.length > 0));

const htmlFiles = [
  join(ROOT, "popup", "popup.html"),
  join(ROOT, "dashboard", "dashboard.html"),
  join(ROOT, "blocked", "blocked.html"),
];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const label = relative(ROOT, file);
  check(`lang attribute: ${label}`, /<html lang="en">/.test(html));
  check(`viewport: ${label}`, /name="viewport"/.test(html));
  check(`single h1: ${label}`, (html.match(/<h1[\s>]/g) || []).length === 1);
  check(`no external script: ${label}`, !/<script[^>]+src="https?:/.test(html));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  check(`unique ids: ${label}`, new Set(ids).size === ids.length);

  const assetRefs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((match) => match[1]);
  for (const ref of assetRefs) {
    if (ref.startsWith("data:")) continue;
    const target = join(dirname(file), ref);
    check(`asset exists: ${label} -> ${ref}`, existsSync(target));
  }
}

const textExtensions = [".html", ".js", ".css", ".md", ".json"];
const sourceFiles = [];
for (const extension of textExtensions) {
  sourceFiles.push(...(await listFiles(ROOT, extension)));
}
const VENDORED = new Set([join(ROOT, "antislop.md")]);
const emDash = [];
for (const file of sourceFiles) {
  if (VENDORED.has(file)) continue;
  const text = await readFile(file, "utf8");
  if (text.includes("\u2014")) emDash.push(relative(ROOT, file));
}
check("no em dash", emDash.length === 0, emDash.join(", "));

const manifestKeys = Object.keys(manifest);
const KNOWN_MANIFEST_KEYS = new Set([
  "manifest_version", "name", "short_name", "version", "description", "default_locale",
  "minimum_chrome_version", "permissions", "host_permissions", "background", "action",
  "icons", "options_ui", "declarative_net_request", "content_scripts",
]);
check("no unknown manifest keys", manifestKeys.every((key) => KNOWN_MANIFEST_KEYS.has(key)));
check("default_locale is en", manifest.default_locale === "en");
check("en and tr locales exist", existsSync(join(ROOT, "_locales", "en", "messages.json")) && existsSync(join(ROOT, "_locales", "tr", "messages.json")));

const fonts = await readdir(join(ROOT, "assets", "fonts"));
check("embedded fonts present", fonts.filter((name) => name.endsWith(".woff2")).length >= 6, `${fonts.length}`);

const totalBytes = await (async () => {
  let sum = 0;
  for (const file of [...jsFiles, ...htmlFiles]) sum += (await stat(file)).size;
  return sum;
})();
check("source size is reasonable", totalBytes < 400_000, `${Math.round(totalBytes / 1024)} KB`);

for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? `  (${item.detail})` : ""}\n`);
}

process.stdout.write(`\n${checks.length - failures.length}/${checks.length} checks passed.\n`);
if (failures.length > 0) {
  process.stdout.write(`\nFAILED:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
}
