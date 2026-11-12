import { existsSync } from "node:fs";
import { basename, posix, win32 } from "node:path";

export const BROWSERS = [
  {
    id: "chrome",
    name: "Google Chrome",
    paths: {
      win32: [
        "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
        "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe",
        "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe",
      ],
      darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      ],
      linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
      ],
    },
  },
  {
    id: "edge",
    name: "Microsoft Edge",
    paths: {
      win32: [
        "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe",
        "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
        "%LOCALAPPDATA%\\Microsoft\\Edge\\Application\\msedge.exe",
      ],
      darwin: [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      ],
      linux: [
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
      ],
    },
  },
  {
    id: "brave",
    name: "Brave",
    paths: {
      win32: [
        "%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "%ProgramFiles(x86)%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      ],
      darwin: [
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      ],
      linux: [
        "/usr/bin/brave-browser",
        "/opt/brave.com/brave/brave-browser",
      ],
    },
  },
  {
    id: "opera",
    name: "Opera",
    paths: {
      win32: [
        "%LOCALAPPDATA%\\Programs\\Opera\\opera.exe",
      ],
      darwin: [
        "/Applications/Opera.app/Contents/MacOS/Opera",
      ],
      linux: [
        "/usr/bin/opera",
      ],
    },
  },
  {
    id: "opera-gx",
    name: "Opera GX",
    paths: {
      win32: [
        "%LOCALAPPDATA%\\Programs\\Opera GX\\opera.exe",
      ],
      darwin: [
        "/Applications/Opera GX.app/Contents/MacOS/Opera",
      ],
      linux: [],
    },
  },
  {
    id: "vivaldi",
    name: "Vivaldi",
    paths: {
      win32: [
        "%LOCALAPPDATA%\\Vivaldi\\Application\\vivaldi.exe",
      ],
      darwin: [
        "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
      ],
      linux: [
        "/usr/bin/vivaldi",
      ],
    },
  },
  {
    id: "yandex",
    name: "Yandex Browser",
    paths: {
      win32: [
        "%LOCALAPPDATA%\\Yandex\\YandexBrowser\\Application\\browser.exe",
      ],
      darwin: [
        "/Applications/Yandex Browser.app/Contents/MacOS/Yandex Browser",
        "/Applications/Yandex.app/Contents/MacOS/Yandex",
      ],
      linux: [
        "/usr/bin/yandex-browser",
      ],
    },
  },
  {
    id: "chromium",
    name: "Chromium",
    paths: {
      win32: [
        "%LOCALAPPDATA%\\Chromium\\Application\\chrome.exe",
      ],
      darwin: [
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ],
      linux: [
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium",
      ],
    },
  },
];

const WIN_TOKEN = /%([^%]+)%/g;

const ALIASES = {
  msedge: "edge",
  browser: "yandex",
  googlechrome: "chrome",
};

function normalizeKey(path, platform) {
  const normalized = platform === "win32" ? win32.normalize(path) : posix.normalize(path);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function platformOf(platform) {
  if (platform === "win32" || platform === "darwin" || platform === "linux") return platform;
  return "linux";
}

function expandWin32(template, env) {
  let valid = true;
  const expanded = template.replace(WIN_TOKEN, (match, name) => {
    const value = env[name];
    if (typeof value !== "string" || value.length === 0) {
      valid = false;
      return match;
    }
    return value;
  });
  return valid ? expanded : null;
}

function expandPath(template, env, platform) {
  if (platform !== "win32") return template;
  return expandWin32(template, env);
}

function guessBrowserFromPath(overridePath) {
  const raw = basename(String(overridePath)).replace(/\.[^.]+$/, "").toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]/g, "");
  if (!normalized) return { id: "custom", name: "Custom Chromium browser" };
  if (ALIASES[normalized]) {
    const hit = BROWSERS.find((entry) => entry.id === ALIASES[normalized]);
    if (hit) return { id: hit.id, name: hit.name };
  }
  const byLength = [...BROWSERS].sort(
    (a, b) => b.id.replace(/-/g, "").length - a.id.replace(/-/g, "").length,
  );
  for (const entry of byLength) {
    if (normalized.includes(entry.id.replace(/-/g, ""))) {
      return { id: entry.id, name: entry.name };
    }
  }
  return { id: "custom", name: "Custom Chromium browser" };
}

export function candidatePaths(options = {}) {
  const env = options.env ?? process.env;
  const platform = platformOf(options.platform ?? process.platform);
  const candidates = [];
  if (typeof env.BROWSER_PATH === "string" && env.BROWSER_PATH.trim().length > 0) {
    const guessed = guessBrowserFromPath(env.BROWSER_PATH);
    candidates.push({ id: guessed.id, name: guessed.name, path: env.BROWSER_PATH });
  }
  if (typeof env.BRAVE_PATH === "string" && env.BRAVE_PATH.trim().length > 0) {
    const brave = BROWSERS.find((entry) => entry.id === "brave");
    candidates.push({ id: brave.id, name: brave.name, path: env.BRAVE_PATH });
  }
  for (const entry of BROWSERS) {
    for (const template of entry.paths[platform]) {
      const expanded = expandPath(template, env, platform);
      if (expanded) candidates.push({ id: entry.id, name: entry.name, path: expanded });
    }
  }
  return candidates;
}

export function detectBrowsers(options = {}) {
  const env = options.env ?? process.env;
  const platform = platformOf(options.platform ?? process.platform);
  const exists = options.exists ?? existsSync;
  const seen = new Set();
  const found = [];
  for (const candidate of candidatePaths({ env, platform })) {
    const key = normalizeKey(candidate.path, platform);
    if (seen.has(key)) continue;
    seen.add(key);
    if (exists(candidate.path)) found.push(candidate);
  }
  return found;
}

function firstExisting(matches, exists) {
  return matches.find((candidate) => exists(candidate.path)) || matches[0];
}

export function resolveBrowser(selector, options = {}) {
  if (selector === undefined || selector === null) return null;
  const raw = String(selector).trim();
  const needle = raw.toLowerCase();
  if (!needle) return null;
  const env = options.env ?? process.env;
  const platform = platformOf(options.platform ?? process.platform);
  const exists = options.exists ?? existsSync;
  const candidates = candidatePaths({ env, platform });
  const byId = candidates.filter((candidate) => candidate.id.toLowerCase() === needle);
  if (byId.length > 0) return firstExisting(byId, exists);
  const byName = candidates.filter((candidate) => candidate.name.toLowerCase() === needle);
  if (byName.length > 0) return firstExisting(byName, exists);
  const byPath = candidates.filter(
    (candidate) =>
      normalizeKey(candidate.path, platform).toLowerCase() ===
      normalizeKey(needle, platform).toLowerCase(),
  );
  if (byPath.length > 0) return firstExisting(byPath, exists);
  if (exists(raw)) {
    const guessed = guessBrowserFromPath(raw);
    return { id: guessed.id, name: "Custom Chromium browser", path: raw };
  }
  return null;
}
