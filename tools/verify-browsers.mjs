import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { detectBrowsers, resolveBrowser } from "./browser-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY_SCRIPT = join(ROOT, "tools", "verify-browser.mjs");
const OUT_ROOT = join(ROOT, "verify-output");

function sanitizeId(value) {
  const cleaned = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "custom";
}

function tableRow(name, checks, failures, exitCode) {
  return `${String(name).padEnd(28)}${String(checks).padStart(8)}${String(failures).padStart(10)}${String(exitCode).padStart(6)}`;
}

const selectors = process.argv.slice(2);

function normalizeExecutable(path) {
  const normalized = process.platform === "win32" ? win32.normalize(path) : posix.normalize(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function dedupeTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = normalizeExecutable(target.path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let targets;
if (selectors.length > 0) {
  targets = selectors.map((selector) => {
    const resolved = resolveBrowser(selector);
    if (resolved) return { ...resolved, selector };
    return { id: sanitizeId(selector), name: selector, path: selector, selector };
  });
} else {
  targets = detectBrowsers();
}
targets = dedupeTargets(targets);

await mkdir(OUT_ROOT, { recursive: true });

if (targets.length === 0) {
  process.stderr.write("No supported Chromium browser detected. Set BROWSER_PATH or pass selectors as arguments.\n");
  await writeFile(join(OUT_ROOT, "browsers.json"), "[]\n", "utf8");
  process.exit(1);
}

const matrix = [];

for (const target of targets) {
  const outDir = join(OUT_ROOT, target.id);
  await mkdir(outDir, { recursive: true });
  // A failed child must never surface an older report as a pass.
  await rm(join(outDir, "report.json"), { force: true });
  process.stdout.write(`\n=== Verifying ${target.name} (${target.id}) ===\n`);
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, [VERIFY_SCRIPT, "--browser", target.selector || target.path], {
      stdio: "inherit",
      env: { ...process.env, VERIFY_OUT: outDir },
    });
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code ?? 1));
  });

  let report = null;
  try {
    report = JSON.parse(await readFile(join(outDir, "report.json"), "utf8"));
  } catch {
    report = null;
  }

  const reportBrowser = report?.browser || {};
  const passed = Array.isArray(report?.passed) ? report.passed : [];
  const failures = Array.isArray(report?.failures)
    ? report.failures
    : [`report.json missing or unreadable (exit code ${exitCode})`];

  matrix.push({
    id: target.id,
    name: reportBrowser.name || target.name,
    path: reportBrowser.path || target.path,
    version: reportBrowser.version ?? null,
    product: reportBrowser.product ?? null,
    passed,
    failures,
    exitCode,
  });
}

await writeFile(join(OUT_ROOT, "browsers.json"), `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

process.stdout.write("\n");
process.stdout.write(tableRow("Browser", "Checks", "Failures", "Exit") + "\n");
for (const row of matrix) {
  const total = row.passed.length + row.failures.length;
  process.stdout.write(
    tableRow(row.name, `${row.passed.length}/${total}`, row.failures.length, row.exitCode) + "\n",
  );
}

const anyFailed = matrix.some((row) => row.exitCode !== 0 || row.failures.length > 0);
process.exit(anyFailed ? 1 : 0);
