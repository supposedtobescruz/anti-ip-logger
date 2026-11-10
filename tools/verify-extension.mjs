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
check("isim ve sürüm tanımlı", typeof manifest.name === "string" && /^\d+\.\d+\.\d+$/.test(manifest.version));
check("service worker modül", manifest.background && manifest.background.type === "module");

const requiredFiles = new Set([
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((script) => script.js),
  ...manifest.declarative_net_request.rule_resources.map((resource) => resource.path),
]);

for (const file of requiredFiles) {
  check(`dosya var: ${file}`, existsSync(join(ROOT, file)));
}

const permissions = new Set(manifest.permissions || []);
for (const permission of ["storage", "declarativeNetRequest", "alarms", "webNavigation", "privacy", "tabs"]) {
  check(`izin: ${permission}`, permissions.has(permission));
}
check("host_permissions <all_urls>", (manifest.host_permissions || []).includes("<all_urls>"));
check(
  "içerik betiği ana dünyada çalışır",
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
  check(`sözdizimi: ${relative(ROOT, file)}`, result.status === 0, (result.stderr || "").split("\n")[0]);
}

const rules = await readJson(join(ROOT, "rules", "core.json"));
check("statik kural listesi dizi", Array.isArray(rules) && rules.length > 0);
check("statik kural sayısı sınırda", rules.length <= 30_000, `${rules.length}`);

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
check("statik kural şeması geçerli", schemaOk);
check("statik kural kimlikleri tekil", ids.size === rules.length);

const coreData = await readJson(join(ROOT, "data", "core-domains.json"));
const exceptions = await readJson(join(ROOT, "data", "core-exceptions.json"));
const meta = await readJson(join(ROOT, "data", "meta.json"));

check("çekirdek veri sayısı meta ile uyumlu", coreData.domains.length === meta.counts.domains, `${coreData.domains.length} / ${meta.counts.domains}`);
check("kural alan adı toplamı veri ile uyumlu", domainTotal === meta.counts.domains, `${domainTotal} / ${meta.counts.domains}`);
check("istisna sayısı meta ile uyumlu", exceptions.length === meta.counts.exceptions);

const coreSet = new Set(coreData.domains.map((entry) => entry.domain));
check("çekirdek listede tekrar yok", coreSet.size === coreData.domains.length);
const overlap = exceptions.filter((domain) => coreSet.has(domain));
check("istisnalar engel listesinde değil", overlap.length === 0, overlap.join(","));
check("her kayıt kategori ve güven taşır", coreData.domains.every((entry) => entry.category && ["confirmed", "single"].includes(entry.confidence)));
check("her kayıt en az bir kaynak taşır", coreData.domains.every((entry) => Array.isArray(entry.sources) && entry.sources.length > 0));

const htmlFiles = [
  join(ROOT, "popup", "popup.html"),
  join(ROOT, "dashboard", "dashboard.html"),
  join(ROOT, "blocked", "blocked.html"),
];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const label = relative(ROOT, file);
  check(`dil tanımı: ${label}`, /<html lang="tr">/.test(html));
  check(`viewport: ${label}`, /name="viewport"/.test(html));
  check(`tek h1: ${label}`, (html.match(/<h1[\s>]/g) || []).length === 1);
  check(`harici script yok: ${label}`, !/<script[^>]+src="https?:/.test(html));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  check(`tekil id: ${label}`, new Set(ids).size === ids.length);

  const assetRefs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((match) => match[1]);
  for (const ref of assetRefs) {
    if (ref.startsWith("data:")) continue;
    const target = join(dirname(file), ref);
    check(`varlık var: ${label} -> ${ref}`, existsSync(target));
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
check("uzun tire (em dash) yok", emDash.length === 0, emDash.join(", "));

const manifestKeys = Object.keys(manifest);
check("bilinmeyen manifest anahtarı yok", manifestKeys.every((key) => !["default_locale"].includes(key)));

const fonts = await readdir(join(ROOT, "assets", "fonts"));
check("gömülü yazı tipleri mevcut", fonts.filter((name) => name.endsWith(".woff2")).length >= 6, `${fonts.length}`);

const totalBytes = await (async () => {
  let sum = 0;
  for (const file of [...jsFiles, ...htmlFiles]) sum += (await stat(file)).size;
  return sum;
})();
check("kaynak boyutu makul", totalBytes < 400_000, `${Math.round(totalBytes / 1024)} KB`);

for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? `  (${item.detail})` : ""}\n`);
}

process.stdout.write(`\n${checks.length - failures.length}/${checks.length} kontrol geçti.\n`);
if (failures.length > 0) {
  process.stdout.write(`\nBaşarısız:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
}
