import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFallback } from "./build-i18n-fallback.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_DETAILS = 5;

const checks = [];
const failures = [];

function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

function summarize(keys) {
  const shown = keys.slice(0, MAX_DETAILS).join(", ");
  const rest = keys.length - MAX_DETAILS;
  return rest > 0 ? `${shown} (+${rest} more)` : shown;
}

function placeholders(message) {
  const found = new Set();
  for (const match of String(message).matchAll(/\$([1-9])/g)) found.add(match[1]);
  return found;
}

const locales = {};
for (const locale of ["en", "tr"]) {
  const path = join(ROOT, "_locales", locale, "messages.json");
  try {
    locales[locale] = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    check(`${locale} messages.json parses`, false, error.message);
    locales[locale] = null;
  }
}

if (locales.en && locales.tr) {
  const en = locales.en;
  const tr = locales.tr;
  const enKeys = Object.keys(en);
  const trKeys = new Set(Object.keys(tr));
  const enKeySet = new Set(enKeys);
  const onlyEn = enKeys.filter((key) => !trKeys.has(key));
  const onlyTr = Object.keys(tr).filter((key) => !enKeySet.has(key));
  check(
    "key sets match between en and tr",
    onlyEn.length === 0 && onlyTr.length === 0,
    [onlyEn.length ? `en only: ${summarize(onlyEn)}` : "", onlyTr.length ? `tr only: ${summarize(onlyTr)}` : ""]
      .filter(Boolean)
      .join("; "),
  );

  const empty = [];
  for (const locale of ["en", "tr"]) {
    for (const [key, value] of Object.entries(locales[locale])) {
      const message = value && typeof value.message === "string" ? value.message : "";
      const description = value && typeof value.description === "string" ? value.description : "";
      if (message.trim() === "") empty.push(`${locale}:${key} message`);
      if (description.trim() === "") empty.push(`${locale}:${key} description`);
    }
  }
  check("no empty or whitespace messages or descriptions", empty.length === 0, summarize(empty));

  const mismatched = [];
  for (const key of enKeys) {
    if (!trKeys.has(key)) continue;
    const a = placeholders(en[key].message);
    const b = placeholders(tr[key].message);
    const same = a.size === b.size && [...a].every((n) => b.has(n));
    if (!same) {
      mismatched.push(`${key} (en: ${[...a].sort().map((n) => "$" + n).join(" ") || "none"} vs tr: ${[...b].sort().map((n) => "$" + n).join(" ") || "none"})`);
    }
  }
  check("placeholder sets match per key", mismatched.length === 0, summarize(mismatched));

  for (const locale of ["en", "tr"]) {
    const { text } = buildFallback(locale);
    const assetPath = join(ROOT, "assets", `i18n-${locale}.js`);
    let committed = null;
    try {
      committed = readFileSync(assetPath);
    } catch (error) {
      check(`assets/i18n-${locale}.js matches generator output`, false, error.message);
      continue;
    }
    const expected = Buffer.from(text, "utf8");
    check(
      `assets/i18n-${locale}.js matches generator output`,
      committed.equals(expected),
      committed.equals(expected) ? "" : "committed file differs from tools/build-i18n-fallback.mjs output",
    );
  }
}

for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${!item.ok && item.detail ? `  (${item.detail})` : ""}\n`);
}

process.stdout.write(`\n${checks.length - failures.length}/${checks.length} checks passed.\n`);
if (failures.length > 0) {
  process.stdout.write(`\nFAILED:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
}
