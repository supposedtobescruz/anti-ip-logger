import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_DETAILS = 5;

const checks = [];
const failures = [];

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

function summarize(items) {
  const shown = items.slice(0, MAX_DETAILS).join(", ");
  const rest = items.length - MAX_DETAILS;
  return rest > 0 ? `${shown} (+${rest} more)` : shown;
}

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;
const zipName = `anti-ip-logger-${version}-cws.zip`;
const zipPath = join(ROOT, "dist", zipName);

const build = spawnSync(process.execPath, [join(ROOT, "tools", "package.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
});
check(
  "package.mjs builds the zip",
  build.status === 0,
  build.status === 0 ? "" : (build.stderr || build.stdout || "").split("\n").filter(Boolean).slice(-1)[0] || `exit ${build.status}`,
);

let names = [];
let zipBytes = 0;
let parsed = false;

if (build.status === 0 && existsSync(zipPath)) {
  const buffer = readFileSync(zipPath);
  zipBytes = buffer.length;

  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;
  const EOCD_MIN_SIZE = 22;
  const MAX_COMMENT = 0xffff;

  let eocdOffset = -1;
  const scanFrom = Math.max(0, buffer.length - (EOCD_MIN_SIZE + MAX_COMMENT));
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= scanFrom; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    check("zip end of central directory found", false, "EOCD signature not present");
  } else {
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralSize = buffer.readUInt32LE(eocdOffset + 12);
    const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
    if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      check("zip end of central directory found", false, "Zip64 archives are not supported");
    } else {
      try {
        let ptr = centralOffset;
        const collected = [];
        for (let i = 0; i < entryCount; i += 1) {
          if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== CENTRAL_SIGNATURE) {
            throw new Error(`central directory entry ${i} has an invalid signature`);
          }
          const nameLength = buffer.readUInt16LE(ptr + 28);
          const extraLength = buffer.readUInt16LE(ptr + 30);
          const commentLength = buffer.readUInt16LE(ptr + 32);
          collected.push(buffer.toString("utf8", ptr + 46, ptr + 46 + nameLength));
          ptr += 46 + nameLength + extraLength + commentLength;
        }
        names = collected;
        parsed = true;
        check("zip central directory parsed", true);
      } catch (error) {
        check("zip central directory parsed", false, error.message);
      }
    }
  }
} else if (build.status === 0) {
  check("zip end of central directory found", false, `${zipPath} not found after build`);
}

if (parsed) {
  const nameSet = new Set(names);

  const required = new Set([
    "manifest.json",
    "background.js",
    "popup/popup.html",
    "dashboard/dashboard.html",
    "blocked/blocked.html",
    "welcome/welcome.html",
    "rules/core.json",
    "_locales/en/messages.json",
    "_locales/tr/messages.json",
  ]);
  for (const group of [manifest.icons, manifest.action && manifest.action.default_icon]) {
    if (!group) continue;
    for (const value of Object.values(group)) {
      if (typeof value === "string") required.add(value);
    }
  }
  if (manifest.background && typeof manifest.background.service_worker === "string") {
    required.add(manifest.background.service_worker);
  }
  if (manifest.action && typeof manifest.action.default_popup === "string") {
    required.add(manifest.action.default_popup);
  }
  if (manifest.options_ui && typeof manifest.options_ui.page === "string") {
    required.add(manifest.options_ui.page);
  }
  for (const resource of (manifest.declarative_net_request && manifest.declarative_net_request.rule_resources) || []) {
    if (resource && typeof resource.path === "string") required.add(resource.path);
  }
  for (const script of manifest.content_scripts || []) {
    for (const file of script.js || []) required.add(file);
  }

  for (const file of [...required].sort()) {
    check(`zip contains: ${file}`, nameSet.has(file));
  }

  const forbiddenPrefixes = ["tests/", "tools/", ".github/", ".opencode/", "docs/", "store/", "dist/"];
  for (const prefix of forbiddenPrefixes) {
    const hits = names.filter((name) => name.startsWith(prefix));
    check(`zip excludes: ${prefix}*`, hits.length === 0, summarize(hits));
  }
  const forbiddenRoot = ["antislop.md", "AGENTS.md", "package.json", "PRIVACY.md", "DESIGN.md"];
  for (const file of forbiddenRoot) {
    check(`zip excludes: ${file}`, !nameSet.has(file));
  }
}

for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${!item.ok && item.detail ? `  (${item.detail})` : ""}\n`);
}

if (parsed) {
  process.stdout.write(`\nArchive: dist/${zipName} (${names.length} files, ${zipBytes} bytes)\n`);
}

process.stdout.write(`${checks.length - failures.length}/${checks.length} checks passed.\n`);
if (failures.length > 0) {
  process.stdout.write(`\nFAILED:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
}
