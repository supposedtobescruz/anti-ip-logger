import { DEFAULT_SETTINGS, DEFAULT_STATS, EVENT_LIMIT } from "./constants.js";

const SETTINGS_KEY = "settings";
const STATS_KEY = "stats";
const EVENTS_KEY = "events";
const REMOTE_KEY = "remoteCache";
const TAB_PREFIX = "tab:";
const NAV_PREFIX = "nav:";
const TAB_ALLOW_PREFIX = "tabAllow:";

let writeChain = Promise.resolve();

function serialize(task) {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => {});
  return next;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item))].sort();
}

function normalizeSyncTier(fallback, value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    ...fallback,
    ...raw,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
  };
}

export function mergeSettings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const tiers = value.tiers && typeof value.tiers === "object" ? value.tiers : {};
  const sync = value.sync && typeof value.sync === "object" ? value.sync : {};
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    version: DEFAULT_SETTINGS.version,
    enabled: value.enabled !== false,
    tiers: {
      core: tiers.core !== false,
      extended: tiers.extended === true,
    },
    showBlockedPage: value.showBlockedPage !== false,
    warnings: value.warnings !== false,
    webrtcPolicy: ["default", "disable_non_proxied_udp", "disable_udp"].includes(value.webrtcPolicy)
      ? value.webrtcPolicy
      : "default",
    theme: ["system", "light", "dark"].includes(value.theme) ? value.theme : "system",
    allowlist: asStringArray(value.allowlist),
    customBlocks: asStringArray(value.customBlocks),
    onboardingSeen: value.onboardingSeen === true,
    lastSync: Number.isFinite(value.lastSync) ? value.lastSync : 0,
    sync: {
      core: normalizeSyncTier(DEFAULT_SETTINGS.sync.core, sync.core),
      extended: normalizeSyncTier(DEFAULT_SETTINGS.sync.extended, sync.extended),
    },
  };
}

export async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return mergeSettings(data[SETTINGS_KEY]);
}

export async function saveSettings(settings) {
  const merged = mergeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export function updateSettings(patch) {
  return serialize(async () => {
    const current = await getSettings();
    const next = mergeSettings({ ...current, ...patch, tiers: { ...current.tiers, ...(patch.tiers || {}) }, sync: { ...current.sync, ...(patch.sync || {}) } });
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  });
}

export async function getStats() {
  const data = await chrome.storage.local.get(STATS_KEY);
  return { ...DEFAULT_STATS, ...(data[STATS_KEY] && typeof data[STATS_KEY] === "object" ? data[STATS_KEY] : {}) };
}

export async function getEvents() {
  const data = await chrome.storage.local.get(EVENTS_KEY);
  return Array.isArray(data[EVENTS_KEY]) ? data[EVENTS_KEY] : [];
}

export function appendEvent(event) {
  return serialize(async () => {
    const [events, stats] = await Promise.all([getEvents(), getStats()]);
    const now = Date.now();
    const entry = {
      id: event.id || (crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(16).slice(2)}`),
      ts: Number.isFinite(event.ts) ? event.ts : now,
      type: event.type || "info",
      host: event.host || "",
      detail: event.detail || "",
      tabId: Number.isFinite(event.tabId) ? event.tabId : null,
    };
    events.unshift(entry);
    if (events.length > EVENT_LIMIT) events.length = EVENT_LIMIT;
    const nextStats = { ...stats };
    if (entry.type === "blocked") nextStats.blocked += 1;
    if (entry.type === "detected") nextStats.detected += 1;
    if (!nextStats.firstEventAt) nextStats.firstEventAt = entry.ts;
    nextStats.lastEventAt = entry.ts;
    await chrome.storage.local.set({ [EVENTS_KEY]: events, [STATS_KEY]: nextStats });
    return entry;
  });
}

export function clearEvents() {
  return serialize(async () => {
    await chrome.storage.local.set({ [EVENTS_KEY]: [], [STATS_KEY]: { ...DEFAULT_STATS } });
    return { ok: true };
  });
}

export async function getRemoteCache(tier) {
  const data = await chrome.storage.local.get(REMOTE_KEY);
  const cache = data[REMOTE_KEY];
  if (!cache || typeof cache !== "object") return null;
  const value = cache[tier];
  if (!value || !Array.isArray(value.domains)) return null;
  return value;
}

export async function setRemoteCache(tier, value) {
  return serialize(async () => {
    const data = await chrome.storage.local.get(REMOTE_KEY);
    const cache = data[REMOTE_KEY] && typeof data[REMOTE_KEY] === "object" ? data[REMOTE_KEY] : {};
    cache[tier] = value;
    await chrome.storage.local.set({ [REMOTE_KEY]: cache });
    return value;
  });
}

async function getSession(key) {
  const data = await chrome.storage.session.get(key);
  return data[key] ?? null;
}

async function setSession(key, value) {
  await chrome.storage.session.set({ [key]: value });
}

async function removeSession(key) {
  await chrome.storage.session.remove(key);
}

export function getTabState(tabId) {
  return getSession(`${TAB_PREFIX}${tabId}`);
}

export function setTabState(tabId, value) {
  return setSession(`${TAB_PREFIX}${tabId}`, value);
}

export function clearTabState(tabId) {
  return removeSession(`${TAB_PREFIX}${tabId}`);
}

export function getPendingNav(tabId) {
  return getSession(`${NAV_PREFIX}${tabId}`);
}

export function setPendingNav(tabId, value) {
  return setSession(`${NAV_PREFIX}${tabId}`, value);
}

export function clearPendingNav(tabId) {
  return removeSession(`${NAV_PREFIX}${tabId}`);
}

export function getTabAllow(tabId) {
  return getSession(`${TAB_ALLOW_PREFIX}${tabId}`);
}

export function setTabAllow(tabId, value) {
  return setSession(`${TAB_ALLOW_PREFIX}${tabId}`, value);
}

export function clearTabAllow(tabId) {
  return removeSession(`${TAB_ALLOW_PREFIX}${tabId}`);
}

export async function pruneSession() {
  const all = await chrome.storage.session.get(null);
  const keys = Object.keys(all);
  const now = Date.now();
  const removals = [];
  for (const key of keys) {
    if (key.startsWith(NAV_PREFIX)) {
      const value = all[key];
      if (!value || !value.at || now - value.at > 120_000) removals.push(key);
    }
  }
  if (removals.length > 0) await chrome.storage.session.remove(removals);
}

export async function resetAll() {
  return serialize(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    return { ok: true };
  });
}
