import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ""}`);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function parseTokens(css, selector) {
  const index = css.indexOf(selector);
  if (index === -1) return {};
  const start = css.indexOf("{", index);
  const end = css.indexOf("}", start);
  const block = css.slice(start + 1, end);
  const tokens = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

const baseCss = await readFile(join(ROOT, "assets", "base.css"), "utf8");
const light = parseTokens(baseCss, ":root {");
const dark = parseTokens(baseCss, ':root[data-theme="dark"]');

const PAIRS = [
  ["ink", "paper", "gövde metni"],
  ["ink-soft", "paper", "ikincil metin"],
  ["ink-faint", "paper", "üçüncül metin"],
  ["ink-faint", "paper-sunken", "üçüncül metin, çukur zemin"],
  ["accent", "paper", "vurgu metni"],
  ["accent-ink", "accent", "vurgu düğmesi"],
  ["danger", "danger-wash", "tehlike etiketi"],
  ["warn", "warn-wash", "uyarı etiketi"],
  ["safe", "safe-wash", "güvenli etiket"],
  ["ink", "paper-raised", "kart metni"],
];

for (const [themeName, tokens] of [["açık", light], ["koyu", dark]]) {
  check(`${themeName} tema tokenları eksiksiz`, Object.keys(tokens).length > 15, `${Object.keys(tokens).length} token`);
  for (const [fg, bg, label] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      check(`${themeName}: ${label} tokenı var`, false, `${fg} / ${bg}`);
      continue;
    }
    const ratio = contrast(tokens[fg], tokens[bg]);
    check(`${themeName}: ${label} WCAG AA`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  }
}

const html = [
  ["popup", join(ROOT, "popup", "popup.html")],
  ["dashboard", join(ROOT, "dashboard", "dashboard.html")],
  ["blocked", join(ROOT, "blocked", "blocked.html")],
];

for (const [name, file] of html) {
  const text = await readFile(file, "utf8");
  check(`${name}: dil tr`, /<html lang="tr">/.test(text));
  check(`${name}: tek h1`, (text.match(/<h1[\s>]/g) || []).length === 1);
  check(`${name}: düğmelerde type`, [...text.matchAll(/<button\b[^>]*>/g)].every((match) => /type="(button|submit)"/.test(match[0])));
  check(`${name}: görsel yok`, !/<img\b/.test(text));
  check(`${name}: satır içi stil yok`, !/<(div|p|span|main|section|header|footer)[^>]+style="/.test(text));

  const controls = [...text.matchAll(/<(input|select|textarea)\b[^>]*>/g)];
  let unlabeled = 0;
  for (const control of controls) {
    const tag = control[0];
    const index = control.index || 0;
    const before = text.slice(Math.max(0, index - 420), index);
    const idMatch = tag.match(/id="([^"]+)"/);
    const hasAria = /aria-label=/.test(tag);
    const hasFor = idMatch ? text.includes(`for="${idMatch[1]}"`) : false;
    const wrapped = before.lastIndexOf("<label") > before.lastIndexOf("</label>");
    if (!hasAria && !hasFor && !wrapped) unlabeled += 1;
  }
  check(`${name}: form alanları etiketli`, unlabeled === 0, `${unlabeled} etiketsiz`);

  check(`${name}: canlı bölge var`, /aria-live=|role="status"|role="alert"/.test(text) || name !== "popup");
}

const blockedCss = await readFile(join(ROOT, "blocked", "blocked.css"), "utf8");
check("engel sayfası mobilde tam genişlik", /@media \(max-width: 520px\)/.test(blockedCss));

const popupCss = await readFile(join(ROOT, "popup", "popup.css"), "utf8");
check("popup sabit genişlik", /width: 384px/.test(popupCss));

const dashboardCss = await readFile(join(ROOT, "dashboard", "dashboard.css"), "utf8");
check("panel mobil kırılımı", /@media \(max-width: 980px\)/.test(dashboardCss) && /@media \(max-width: 760px\)/.test(dashboardCss));

check("odak halkası tanımlı", /:focus-visible\s*\{[^}]*outline: 2px solid var\(--accent\)/s.test(baseCss));
check("hareket azaltma desteği", /prefers-reduced-motion: reduce/.test(baseCss));
check("koyu tema desteği", /prefers-color-scheme: dark/.test(baseCss));
check("yazı tipi yerel", /@font-face/.test(await readFile(join(ROOT, "assets", "fonts.css"), "utf8")));

const uiSource = await readFile(join(ROOT, "assets", "ui.js"), "utf8");
check("ortak tema yardımcısı", /export function applyTheme/.test(uiSource));
check("mesaj sarmalayıcı hata yakalar", /catch \(error\)/.test(uiSource));

for (const item of checks) {
  process.stdout.write(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? `  (${item.detail})` : ""}\n`);
}

process.stdout.write(`\n${checks.length - failures.length}/${checks.length} arayüz kontrolü geçti.\n`);
if (failures.length > 0) {
  process.stdout.write(`\nBaşarısız:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
}
