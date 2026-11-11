import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, DEFAULT_STATS, EVENT_LIMIT, EVENT_TEXT_LIMIT, MAX_LIST_ENTRIES } from "../lib/constants.js";

function createStorageArea() {
  const map = new Map();
  return {
    map,
    async get(key) {
      if (key === null || key === undefined) return Object.fromEntries(map);
      if (Array.isArray(key)) {
        const out = {};
        for (const item of key) if (map.has(item)) out[item] = map.get(item);
        return out;
      }
      return map.has(key) ? { [key]: map.get(key) } : {};
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) map.set(key, value);
    },
    async remove(key) {
      const keys = Array.isArray(key) ? key : [key];
      for (const item of keys) map.delete(item);
    },
    async clear() {
      map.clear();
    },
  };
}

const localArea = createStorageArea();
const sessionArea = createStorageArea();

globalThis.chrome = {
  storage: {
    local: localArea,
    session: sessionArea,
  },
};

const {
  mergeSettings,
  getSettings,
  saveSettings,
  updateSettings,
  getStats,
  getEvents,
  appendEvent,
  clearEvents,
  getRemoteCache,
  setRemoteCache,
  getTabState,
  setTabState,
  clearTabState,
  getPendingNav,
  setPendingNav,
  pruneSession,
  resetAll,
} = await import("../lib/store.js");

beforeEach(() => {
  localArea.map.clear();
  sessionArea.map.clear();
});

test("getSettings returns defaults when storage is empty", async () => {
  const settings = await getSettings();
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test("getSettings merges partial stored settings without dropping defaults", async () => {
  await chrome.storage.local.set({
    settings: {
      enabled: false,
      theme: "dark",
      tiers: { extended: true },
      sync: {
        core: { ok: true, count: 7, at: 111, error: "", sources: ["one.example.com"] },
        extended: { ok: true, sources: "not-an-array" },
      },
      lastSync: 1234,
    },
  });
  const settings = await getSettings();
  assert.equal(settings.enabled, false);
  assert.equal(settings.theme, "dark");
  assert.equal(settings.language, "system");
  assert.equal(settings.version, DEFAULT_SETTINGS.version);
  assert.deepEqual(settings.tiers, { core: true, extended: true });
  assert.deepEqual(settings.sync.core, { ok: true, count: 7, at: 111, error: "", sources: ["one.example.com"] });
  assert.deepEqual(settings.sync.extended, { ok: true, count: 0, at: 0, error: "", sources: [] });
  assert.equal(settings.lastSync, 1234);
  assert.deepEqual(settings.allowlist, []);
  assert.deepEqual(settings.customBlocks, []);
});

test("updateSettings merges a patch and persists it", async () => {
  await updateSettings({ enabled: false, tiers: { extended: true }, customBlocks: ["b.example.com", "a.example.com"] });
  const settings = await getSettings();
  assert.equal(settings.enabled, false);
  assert.deepEqual(settings.tiers, { core: true, extended: true });
  assert.deepEqual(settings.customBlocks, ["a.example.com", "b.example.com"]);
  assert.equal(localArea.map.get("settings").enabled, false);
});

test("updateSettings keeps previously stored values when patch omits them", async () => {
  await updateSettings({ enabled: false });
  await updateSettings({ theme: "dark" });
  const settings = await getSettings();
  assert.equal(settings.enabled, false);
  assert.equal(settings.theme, "dark");
});

test("allowlist normalization dedupes, drops invalid entries, sorts and caps", async () => {
  const saved = await saveSettings({ allowlist: ["b.example.com", "a.example.com", "b.example.com", 42, null, "", "a.example.com"] });
  assert.deepEqual(saved.allowlist, ["a.example.com", "b.example.com"]);

  const huge = Array.from({ length: MAX_LIST_ENTRIES + 25 }, (_, index) => `d${String(index).padStart(5, "0")}.example.com`);
  const capped = await saveSettings({ allowlist: huge });
  assert.equal(capped.allowlist.length, MAX_LIST_ENTRIES);
  assert.deepEqual(capped.allowlist, [...capped.allowlist].sort());
});

test("customBlocks normalization dedupes, drops invalid entries, sorts and caps", async () => {
  const saved = await saveSettings({ customBlocks: ["z.example.com", "y.example.com", "z.example.com", 7, ""] });
  assert.deepEqual(saved.customBlocks, ["y.example.com", "z.example.com"]);

  const huge = Array.from({ length: MAX_LIST_ENTRIES + 10 }, (_, index) => `c${String(index).padStart(5, "0")}.example.com`);
  const capped = await saveSettings({ customBlocks: huge });
  assert.equal(capped.customBlocks.length, MAX_LIST_ENTRIES);
});

test("appendEvent clamps host and detail lengths", async () => {
  const entry = await appendEvent({ type: "blocked", host: "a".repeat(300), detail: "b".repeat(400), ts: 1000 });
  assert.equal(entry.host.length, 253);
  assert.equal(entry.detail.length, EVENT_TEXT_LIMIT);
});

test("appendEvent writes a generated id when none is provided", async () => {
  const entry = await appendEvent({ type: "info", host: "x.example.com", detail: "d", ts: 1000 });
  assert.equal(typeof entry.id, "string");
  assert.ok(entry.id.length > 0);
});

test("appendEvent keeps a provided id", async () => {
  const entry = await appendEvent({ id: "keep-me", type: "info", host: "x.example.com", detail: "d", ts: 1000 });
  assert.equal(entry.id, "keep-me");
});

test("appendEvent without ts stamps an in-range timestamp", async () => {
  const before = Date.now();
  const entry = await appendEvent({ type: "info", host: "x.example.com", detail: "d" });
  const after = Date.now();
  assert.ok(entry.ts >= before && entry.ts <= after);
});

test("appendEvent keeps only EVENT_LIMIT newest entries", async () => {
  const seeded = Array.from({ length: EVENT_LIMIT }, (_, index) => ({
    id: `seed-${index}`,
    ts: index + 1,
    type: "info",
    host: "seed.example.com",
    detail: `seed ${index}`,
    tabId: null,
  }));
  await chrome.storage.local.set({ events: seeded });
  const entry = await appendEvent({ type: "blocked", host: "new.example.com", detail: "newest", ts: 9999 });
  const events = await getEvents();
  assert.equal(events.length, EVENT_LIMIT);
  assert.equal(events[0].id, entry.id);
  assert.equal(events[0].detail, "newest");
  assert.equal(events.at(-1).id, "seed-498");
});

test("clearEvents empties the log", async () => {
  await appendEvent({ type: "info", host: "a.example.com", detail: "one", ts: 1000 });
  await appendEvent({ type: "info", host: "b.example.com", detail: "two", ts: 2000 });
  const result = await clearEvents();
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(await getEvents(), []);
});

test("resetAll removes settings, stats, events and remote cache", async () => {
  await updateSettings({ enabled: false });
  await appendEvent({ type: "blocked", host: "h.example.com", detail: "d", ts: 1000 });
  await setRemoteCache("core", { domains: ["a.example.com"], at: 1 });
  await setTabState(3, { note: "tab" });
  const result = await resetAll();
  assert.deepEqual(result, { ok: true });
  assert.equal(localArea.map.size, 0);
  assert.equal(sessionArea.map.size, 0);
  assert.deepEqual(await getSettings(), mergeSettings(undefined));
  assert.deepEqual(await getStats(), DEFAULT_STATS);
  assert.deepEqual(await getEvents(), []);
  assert.equal(await getRemoteCache("core"), null);
});

test("setTabState and getTabState round-trip, clearTabState removes", async () => {
  await setTabState(7, { count: 2, at: 1000 });
  assert.deepEqual(await getTabState(7), { count: 2, at: 1000 });
  await clearTabState(7);
  assert.equal(await getTabState(7), null);
});

test("pruneSession removes stale nav entries and keeps fresh ones and tab state", async () => {
  const now = Date.now();
  await setPendingNav(1, { at: now - 200_000 });
  await setPendingNav(2, { at: now });
  await setPendingNav(3, {});
  await setTabState(9, { note: "keep" });
  await pruneSession();
  assert.equal(await getPendingNav(1), null);
  assert.equal(await getPendingNav(3), null);
  assert.deepEqual(await getPendingNav(2), { at: now });
  assert.deepEqual(await getTabState(9), { note: "keep" });
});
