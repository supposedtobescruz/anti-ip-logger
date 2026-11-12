import test from "node:test";
import assert from "node:assert/strict";
import {
  BROWSERS,
  candidatePaths,
  detectBrowsers,
  resolveBrowser,
} from "../tools/browser-paths.mjs";

function fakeEnv(extra = {}) {
  return {
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
    ...extra,
  };
}

function pathsFor(options) {
  return candidatePaths(options).map((candidate) => candidate.path);
}

test("win32 candidates include the per-user Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Yandex and Chromium paths", () => {
  const paths = pathsFor({ env: fakeEnv(), platform: "win32" });
  const expected = [
    "C:\\Users\\test\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\test\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Users\\test\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Users\\test\\AppData\\Local\\Programs\\Opera\\opera.exe",
    "C:\\Users\\test\\AppData\\Local\\Programs\\Opera GX\\opera.exe",
    "C:\\Users\\test\\AppData\\Local\\Vivaldi\\Application\\vivaldi.exe",
    "C:\\Users\\test\\AppData\\Local\\Yandex\\YandexBrowser\\Application\\browser.exe",
    "C:\\Users\\test\\AppData\\Local\\Chromium\\Application\\chrome.exe",
  ];
  for (const path of expected) {
    assert.ok(paths.includes(path), `missing per-user path: ${path}`);
  }
});

test("win32 candidates expand the Program Files locations from the injected env", () => {
  const paths = pathsFor({ env: fakeEnv(), platform: "win32" });
  assert.ok(paths.includes("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"));
  assert.ok(paths.includes("C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"));
  assert.ok(paths.includes("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"));
  assert.ok(paths.includes("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"));
  assert.ok(paths.includes("C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"));
  assert.ok(paths.includes("C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"));
  for (const path of paths) {
    assert.ok(!path.includes("%"), `unexpanded token in: ${path}`);
  }
});

test("win32 candidates skip entries when the injected env lacks a variable", () => {
  const paths = pathsFor({ env: { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, platform: "win32" });
  assert.ok(!paths.some((path) => path.includes("Program Files")));
  assert.ok(paths.includes("C:\\Users\\test\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"));
});

test("darwin candidates use .app paths and never win32 paths", () => {
  const paths = pathsFor({ env: {}, platform: "darwin" });
  assert.ok(paths.includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
  assert.ok(paths.includes("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"));
  assert.ok(paths.includes("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"));
  assert.ok(paths.includes("/Applications/Opera.app/Contents/MacOS/Opera"));
  assert.ok(paths.includes("/Applications/Opera GX.app/Contents/MacOS/Opera"));
  assert.ok(paths.includes("/Applications/Vivaldi.app/Contents/MacOS/Vivaldi"));
  assert.ok(paths.some((path) => path.startsWith("/Applications/Yandex")));
  assert.ok(paths.includes("/Applications/Chromium.app/Contents/MacOS/Chromium"));
  for (const path of paths) {
    assert.ok(!path.includes("C:"), `win32 path leaked into darwin candidates: ${path}`);
    assert.ok(!path.includes("%"), `unexpanded token in: ${path}`);
  }
});

test("linux candidates use their own paths and never win32 or darwin paths", () => {
  const paths = pathsFor({ env: {}, platform: "linux" });
  const expected = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/microsoft-edge",
    "/usr/bin/brave-browser",
    "/opt/brave.com/brave/brave-browser",
    "/usr/bin/vivaldi",
    "/usr/bin/opera",
    "/usr/bin/yandex-browser",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  for (const path of expected) {
    assert.ok(paths.includes(path), `missing linux path: ${path}`);
  }
  for (const path of paths) {
    assert.ok(!path.includes("C:"), `win32 path leaked into linux candidates: ${path}`);
    assert.ok(!path.includes("/Applications/"), `darwin path leaked into linux candidates: ${path}`);
  }
});

test("BROWSER_PATH wins over everything and falls back to a custom id", () => {
  const env = fakeEnv({
    BROWSER_PATH: "D:\\Tools\\CoolBrowser.exe",
    BRAVE_PATH: "D:\\Tools\\Brave.exe",
  });
  const candidates = candidatePaths({ env, platform: "win32" });
  assert.deepEqual(candidates[0], {
    id: "custom",
    name: "Custom Chromium browser",
    path: "D:\\Tools\\CoolBrowser.exe",
  });
  assert.equal(candidates[1].id, "brave");
  assert.equal(candidates[1].path, "D:\\Tools\\Brave.exe");
});

test("BROWSER_PATH guesses the browser id from the basename", () => {
  const candidates = candidatePaths({
    env: fakeEnv({ BROWSER_PATH: "D:\\Tools\\msedge.exe" }),
    platform: "win32",
  });
  assert.equal(candidates[0].id, "edge");
  assert.equal(candidates[0].name, "Microsoft Edge");
});

test("BRAVE_PATH works as a legacy override", () => {
  const candidates = candidatePaths({
    env: fakeEnv({ BRAVE_PATH: "D:\\Legacy\\brave.exe" }),
    platform: "win32",
  });
  assert.equal(candidates[0].id, "brave");
  assert.equal(candidates[0].name, "Brave");
  assert.equal(candidates[0].path, "D:\\Legacy\\brave.exe");
});

test("detectBrowsers filters missing files and preserves order", () => {
  const env = fakeEnv();
  const existing = new Set([
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ]);
  const detected = detectBrowsers({ env, platform: "win32", exists: (path) => existing.has(path) });
  assert.deepEqual(
    detected.map((entry) => entry.path),
    [
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    ],
  );
});

test("detectBrowsers dedupes case-insensitively on win32", () => {
  const env = fakeEnv({
    BROWSER_PATH: "C:\\Fake\\App.EXE",
    BRAVE_PATH: "c:\\fake\\app.exe",
  });
  const detected = detectBrowsers({ env, platform: "win32", exists: () => true });
  const matches = detected.filter((entry) => entry.path.toLowerCase() === "c:\\fake\\app.exe");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].path, "C:\\Fake\\App.EXE");
});

test("resolveBrowser matches by id, name, exact path and mixed case", () => {
  const env = fakeEnv();
  const options = { env, platform: "win32" };
  assert.equal(resolveBrowser("edge", options).id, "edge");
  assert.equal(resolveBrowser("EDGE", options).id, "edge");
  assert.equal(resolveBrowser("Microsoft Edge", options).id, "edge");
  assert.equal(resolveBrowser("google chrome", options).id, "chrome");
  const bravePath = candidatePaths(options).find((entry) => entry.id === "brave").path;
  assert.equal(resolveBrowser(bravePath, options).id, "brave");
  assert.equal(resolveBrowser(bravePath.toUpperCase(), options).id, "brave");
});

test("resolveBrowser returns unknown selectors as null and candidates even when the file does not exist", () => {
  const options = { env: fakeEnv(), platform: "win32" };
  assert.equal(resolveBrowser("netscape", options), null);
  assert.equal(resolveBrowser("", options), null);
  assert.equal(resolveBrowser(undefined, options), null);
  const edge = resolveBrowser("edge", options);
  assert.ok(edge);
  assert.equal(edge.id, "edge");
});

test("resolveBrowser prefers an existing candidate within the same match group", () => {
  const env = fakeEnv();
  const x86Edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const exists = (path) => path === x86Edge;
  const options = { env, platform: "win32", exists };
  assert.equal(resolveBrowser("edge", options).path, x86Edge);
  assert.equal(resolveBrowser("Microsoft Edge", options).path, x86Edge);
});

test("resolveBrowser falls back to the first match when no candidate exists", () => {
  const options = { env: fakeEnv(), platform: "win32", exists: () => false };
  assert.equal(
    resolveBrowser("edge", options).path,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  );
  assert.equal(
    resolveBrowser("Microsoft Edge", options).path,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  );
});

test("the BROWSERS table covers the eight Chromium family browsers", () => {
  assert.deepEqual(
    BROWSERS.map((entry) => entry.id),
    ["chrome", "edge", "brave", "opera", "opera-gx", "vivaldi", "yandex", "chromium"],
  );
});

test("resolveBrowser resolves an arbitrary existing path to a custom entry", () => {
  const options = {
    env: fakeEnv(),
    platform: "win32",
    exists: (path) => path === "D:\\Tools\\CoolBrowser.exe",
  };
  const resolved = resolveBrowser("D:\\Tools\\CoolBrowser.exe", options);
  assert.deepEqual(resolved, {
    id: "custom",
    name: "Custom Chromium browser",
    path: "D:\\Tools\\CoolBrowser.exe",
  });
});

test("resolveBrowser guesses the id from the basename for an arbitrary existing path", () => {
  const options = { env: fakeEnv(), platform: "win32", exists: () => true };
  const resolved = resolveBrowser("D:\\Tools\\my-opera-browser.exe", options);
  assert.equal(resolved.id, "opera");
  assert.equal(resolved.name, "Custom Chromium browser");
  assert.equal(resolved.path, "D:\\Tools\\my-opera-browser.exe");
});

test("resolveBrowser returns null for a missing arbitrary path", () => {
  const options = { env: fakeEnv(), platform: "win32", exists: () => false };
  assert.equal(resolveBrowser("D:\\Tools\\NotThere.exe", options), null);
});

test("resolveBrowser keeps a known candidate path unchanged", () => {
  const options = { env: fakeEnv(), platform: "win32", exists: () => true };
  const edgePath = candidatePaths(options).find((entry) => entry.id === "edge").path;
  const resolved = resolveBrowser(edgePath, options);
  assert.equal(resolved.id, "edge");
  assert.equal(resolved.name, "Microsoft Edge");
  assert.equal(resolved.path, edgePath);
});
