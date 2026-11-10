import {
  SYNC_ALARM_MINUTES,
  CLEANUP_ALARM_MINUTES,
  PAGE_STATE_TTL_MS,
} from "./lib/constants.js";
import { normalizeHost, parseList, parseDnrJson, dedupeSubdomains } from "./lib/parser.js";
import { t } from "./assets/i18n.js";
import { hostMatchesDomain, matchDomain, urlToHost } from "./lib/domains.js";
import { buildDynamicRuleSetDetailed } from "./lib/rules.js";
import {
  applyDynamicRules,
  applyStaticRuleset,
  applyWebRtcPolicy,
  buildTabAllowRules,
  dnrStatus,
  setActionBadge,
} from "./lib/dnr.js";
import { assessRisk, describeVerdict, emptySignals, mergeSignals, verdictFor } from "./lib/risk.js";
import {
  appendEvent,
  clearEvents,
  clearPendingNav,
  clearTabAllow,
  clearTabState,
  getEvents,
  getPendingNav,
  getRemoteCache,
  getSettings,
  getStats,
  getTabAllow,
  getTabState,
  pruneSession,
  resetAll,
  setPendingNav,
  setRemoteCache,
  setTabAllow,
  setTabState,
  serializeTabState,
  updateSettings,
} from "./lib/store.js";

const state = {
  initialized: false,
  loading: null,
  settings: null,
  meta: null,
  packagedEntries: [],
  packagedDomains: [],
  packagedSet: new Set(),
  exceptionDomains: [],
  sourceConfig: [],
  remoteCore: [],
  remoteCoreSet: new Set(),
  remoteCoreAt: 0,
  extended: [],
  extendedSet: new Set(),
  extendedAt: 0,
  tabAllows: {},
  dnr: null,
  appliedSignature: "",
  syncing: null,
  recentBlocks: new Map(),
};

const SYNC_ALARM = "sync-sources";
const CLEANUP_ALARM = "cleanup-state";
const APPLIED_SIGNATURE_KEY = "appliedSignature";
const WEBRTC_MARKER_KEY = "appliedWebrtcPolicy";

function runtimeUrl(path) {
  return chrome.runtime.getURL(path);
}

async function fetchJson(path) {
  const response = await fetch(runtimeUrl(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function filterExceptions(domains, exceptionSet) {
  const keep = [];
  for (const domain of domains) {
    const labels = domain.split(".");
    let matched = false;
    for (let i = 0; i < labels.length - 1; i += 1) {
      if (exceptionSet.has(labels.slice(i).join("."))) {
        matched = true;
        break;
      }
    }
    if (!matched) keep.push(domain);
  }
  return keep;
}

function loadTabAllows(sessionData) {
  const allows = {};
  for (const [key, value] of Object.entries(sessionData || {})) {
    if (!key.startsWith("tabAllow:") || !value || !value.domain) continue;
    const tabId = Number(key.slice("tabAllow:".length));
    if (Number.isFinite(tabId)) allows[tabId] = value;
  }
  return allows;
}

async function loadState() {
  const [settings, meta, coreData, exceptions, sourceConfig, remoteCore, extended, sessionData] = await Promise.all([
    getSettings(),
    fetchJson("data/meta.json"),
    fetchJson("data/core-domains.json"),
    fetchJson("data/core-exceptions.json"),
    fetchJson("data/sources.json"),
    getRemoteCache("core"),
    getRemoteCache("extended"),
    chrome.storage.session.get(null),
  ]);

  state.settings = settings;
  state.meta = meta;
  state.packagedEntries = Array.isArray(coreData.domains) ? coreData.domains : [];
  state.packagedDomains = state.packagedEntries.map((entry) => entry.domain);
  state.packagedSet = new Set(state.packagedDomains);
  state.exceptionDomains = Array.isArray(exceptions) ? exceptions : [];
  state.sourceConfig = Array.isArray(sourceConfig.sources) ? sourceConfig.sources : [];
  state.remoteCore = remoteCore && Array.isArray(remoteCore.domains) ? remoteCore.domains : [];
  state.remoteCoreSet = new Set(state.remoteCore);
  state.remoteCoreAt = remoteCore && Number.isFinite(remoteCore.at) ? remoteCore.at : 0;
  state.extended = extended && Array.isArray(extended.domains) ? extended.domains : [];
  state.extendedSet = new Set(state.extended);
  state.extendedAt = extended && Number.isFinite(extended.at) ? extended.at : 0;
  state.tabAllows = loadTabAllows(sessionData);
  state.appliedSignature = typeof sessionData[APPLIED_SIGNATURE_KEY] === "string" ? sessionData[APPLIED_SIGNATURE_KEY] : "";
  state.initialized = true;
}

function signatureFor() {
  return JSON.stringify({
    enabled: state.settings.enabled,
    tiers: state.settings.tiers,
    showBlockedPage: state.settings.showBlockedPage,
    webrtcPolicy: state.settings.webrtcPolicy,
    allowlist: state.settings.allowlist,
    customBlocks: state.settings.customBlocks,
    packaged: state.packagedDomains.length,
    remote: state.remoteCore.length,
    remoteAt: state.remoteCoreAt,
    extended: state.extended.length,
    extendedAt: state.extendedAt,
    tabAllows: Object.entries(state.tabAllows)
      .map(([tabId, value]) => `${tabId}:${value ? value.domain : ""}`)
      .sort(),
  });
}

async function applyWebRtcSetting() {
  const policy = state.settings.webrtcPolicy;
  const data = await chrome.storage.local.get(WEBRTC_MARKER_KEY);
  const last = typeof data[WEBRTC_MARKER_KEY] === "string" ? data[WEBRTC_MARKER_KEY] : "";

  if (policy === "default") {
    if (last && last !== "default") {
      const result = await applyWebRtcPolicy("default");
      if (result.ok) await chrome.storage.local.set({ [WEBRTC_MARKER_KEY]: "default" });
    }
    return;
  }

  if (last === policy) return;
  const result = await applyWebRtcPolicy(policy);
  if (result.ok) await chrome.storage.local.set({ [WEBRTC_MARKER_KEY]: policy });
}

async function applyState(force = false) {
  const signature = signatureFor();
  if (!force && signature === state.appliedSignature && state.dnr) return { skipped: true, ...state.dnr };

  const settings = state.settings;
  const detailed = settings.enabled
    ? buildDynamicRuleSetDetailed(
        {
          packagedCore: state.packagedDomains,
          remoteCore: state.remoteCore,
          extended: state.extended,
        },
        settings,
      )
    : { rules: [], dropped: null, maxRules: 0 };
  const rules = settings.enabled
    ? [
        ...detailed.rules,
        ...buildTabAllowRules(state.tabAllows),
      ]
    : [];

  await applyStaticRuleset(settings.enabled && settings.tiers.core);
  const applied = await applyDynamicRules(rules);
  if (detailed.dropped) {
    const drops = detailed.dropped;
    const total = drops.customDomains + drops.redirectDomains + drops.remoteCoreDomains + drops.extendedDomains;
    if (total > 0) {
      await appendEvent({
        type: "sync",
        host: "",
        detail: t("rulesClipped", [
          String(total),
          String(drops.remoteCoreDomains),
          String(drops.extendedDomains),
          String(detailed.maxRules),
        ]),
      });
    }
  }
  await applyWebRtcSetting();
  state.dnr = await dnrStatus();
  state.appliedSignature = signature;
  await chrome.storage.session.set({ [APPLIED_SIGNATURE_KEY]: signature });
  return { ...applied, ...state.dnr };
}

async function ensureInit(force = false) {
  if (state.loading) return state.loading;
  if (state.initialized && !force) return state;
  state.loading = (async () => {
    await loadState();
    await applyState(force);
    return state;
  })().finally(() => {
    state.loading = null;
  });
  return state.loading;
}

function publicSettings() {
  const s = state.settings;
  return {
    enabled: s.enabled,
    tiers: s.tiers,
    showBlockedPage: s.showBlockedPage,
    warnings: s.warnings,
    webrtcPolicy: s.webrtcPolicy,
    theme: s.theme,
    allowlist: s.allowlist,
    customBlocks: s.customBlocks,
    onboardingSeen: s.onboardingSeen,
    lastSync: s.lastSync,
    sync: s.sync,
  };
}

function classifyHost(host) {
  const clean = normalizeHost(host);
  if (!clean) return { known: false, allowed: false, domain: "" };

  const allowMatch = matchDomain(clean, new Set(state.settings.allowlist));
  if (allowMatch) return { known: false, allowed: true, domain: allowMatch, category: "allowed", confidence: "user", sources: ["user"] };

  const customMatch = matchDomain(clean, new Set(state.settings.customBlocks));
  if (customMatch) {
    return { known: true, allowed: false, domain: customMatch, category: "custom", confidence: "user", sources: ["user"] };
  }

  const packagedMatch = matchDomain(clean, state.packagedSet);
  if (packagedMatch) {
    const entry = state.packagedEntries.find((item) => item.domain === packagedMatch);
    return {
      known: true,
      allowed: false,
      domain: packagedMatch,
      category: entry ? entry.category : "other",
      confidence: entry ? entry.confidence : "single",
      sources: entry ? entry.sources : ["packaged"],
      origin: "packaged",
    };
  }

  const remoteMatch = matchDomain(clean, state.remoteCoreSet);
  if (remoteMatch) {
    return { known: true, allowed: false, domain: remoteMatch, category: "other", confidence: "feed", sources: ["remote"], origin: "remote" };
  }

  if (state.settings.tiers.extended) {
    const extendedMatch = matchDomain(clean, state.extendedSet);
    if (extendedMatch) {
      return { known: true, allowed: false, domain: extendedMatch, category: "threat", confidence: "feed", sources: ["extended"], origin: "extended" };
    }
  }

  return { known: false, allowed: false, domain: "" };
}

async function getActiveTab(tabId) {
  if (Number.isFinite(tabId)) {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function emptyPageState(tabId, host, url) {
  return {
    tabId,
    host,
    url,
    signals: emptySignals(),
    gesture: false,
    bannerShown: false,
    blockedThisNavigation: false,
    blockedDomain: "",
    blockedLoggedFor: "",
    lastLoggedLevel: "none",
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function getTabInfo(tabId) {
  const tab = await getActiveTab(tabId);
  const settings = state.settings;
  if (!tab || !tab.url) {
    return {
      tabId: tab ? tab.id : null,
      url: "",
      host: "",
      verdict: settings.enabled ? "idle" : "off",
      copy: describeVerdict(settings.enabled ? "idle" : "off", t),
      risk: assessRisk({ signals: emptySignals(), protectionEnabled: settings.enabled }),
      signals: emptySignals(),
      allowed: false,
      known: { known: false },
      blockedThisNavigation: false,
      blockedDomain: "",
      settings: publicSettings(),
    };
  }
  const url = tab.url;
  const host = urlToHost(url) || "";
  const tabState = host ? await getTabState(tab.id) : null;
  const cls = host ? classifyHost(host) : { known: false, allowed: false };
  const allowed = Boolean(cls.allowed);
  const gesture = Boolean(tabState && tabState.gesture);
  const risk = assessRisk({
    signals: tabState ? tabState.signals : emptySignals(),
    knownLogger: cls.known && !allowed,
    gesture,
    protectionEnabled: settings.enabled,
  });
  const verdict = verdictFor({
    enabled: settings.enabled,
    allowed,
    host,
    knownLogger: cls.known,
    risk,
    blockedThisNavigation: Boolean(tabState && tabState.blockedThisNavigation),
  });
  return {
    tabId: tab.id,
    url,
    host,
    verdict,
    copy: describeVerdict(verdict, t),
    risk,
    signals: tabState ? tabState.signals : emptySignals(),
    allowed,
    known: cls,
    blockedThisNavigation: Boolean(tabState && tabState.blockedThisNavigation),
    blockedDomain: tabState ? tabState.blockedDomain : "",
    startedAt: tabState ? tabState.startedAt : 0,
    settings: publicSettings(),
  };
}

async function getPopupData(tabId) {
  const [tabInfo, stats, events, dnr] = await Promise.all([
    getTabInfo(tabId),
    getStats(),
    getEvents(),
    dnrStatus(),
  ]);
  const recent = events.filter((event) => event.tabId === tabInfo.tabId).slice(0, 4);
  return {
    ...tabInfo,
    stats,
    events: recent,
    dnr,
    meta: {
      counts: state.meta ? state.meta.counts : {},
      version: chrome.runtime.getManifest().version,
    },
  };
}

async function getDashboardData() {
  const [settings, stats, events, dnr] = await Promise.all([getSettings(), getStats(), getEvents(), dnrStatus()]);
  const health = new Map();
  for (const tier of ["core", "extended"]) {
    for (const source of settings.sync[tier].sources || []) health.set(source.id, source);
  }
  return {
    settings: publicSettings(),
    stats,
    events,
    dnr,
    meta: state.meta,
    lists: {
      packaged: state.packagedEntries,
      allowlist: settings.allowlist,
      custom: settings.customBlocks,
      remoteCoreCount: state.remoteCore.length,
      extendedCount: state.extended.length,
    },
    sources: state.sourceConfig.map((source) => ({
      ...source,
      health: health.get(source.id) || null,
    })),
    version: chrome.runtime.getManifest().version,
    tabAllowCount: Object.keys(state.tabAllows).length,
  };
}

async function fetchSource(source) {
  const MAX_BYTES = source.maxBytes || 12 * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "anti-ip-logger/2.0" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new Error("response too large");

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BYTES) {
        await reader.cancel();
        throw new Error("response too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunkBytes of chunks) {
      bytes.set(chunkBytes, offset);
      offset += chunkBytes.byteLength;
    }
    const text = new TextDecoder().decode(bytes);
    return source.format === "dnr-json" ? parseDnrJson(text) : parseList(text);
  } finally {
    clearTimeout(timer);
  }
}

async function syncTier(tier) {
  const sources = state.sourceConfig.filter((source) => source.tier === tier);
  const remoteExceptions = new Set(state.exceptionDomains);
  const reports = [];
  const all = new Set();
  for (const source of sources) {
    const report = { id: source.id, name: source.name, ok: false, count: 0, error: "" };
    try {
      const parsed = await fetchSource(source);
      for (const domain of parsed.domains) all.add(domain);
      for (const exception of parsed.exceptions || []) remoteExceptions.add(exception);
      report.ok = true;
      report.count = parsed.domains.length;
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
    reports.push(report);
  }

  const allowSet = new Set(state.settings.allowlist);
  let cleaned = filterExceptions(dedupeSubdomains([...all]), remoteExceptions).filter((domain) => !allowSet.has(domain));
  const anyOk = reports.some((report) => report.ok);
  const allOk = reports.every((report) => report.ok);
  const now = Date.now();

  if (anyOk && !allOk) {
    const previous = tier === "core" ? state.remoteCore : state.extended;
    const previousKept = filterExceptions(previous || [], remoteExceptions).filter((domain) => !allowSet.has(domain));
    cleaned = dedupeSubdomains([...cleaned, ...previousKept]);
  }

  let count = 0;
  if (anyOk) {
    const previous = tier === "core"
      ? { tier, domains: state.remoteCore, set: state.remoteCoreSet, at: state.remoteCoreAt, settings: state.settings }
      : { tier, domains: state.extended, set: state.extendedSet, at: state.extendedAt, settings: state.settings };

    if (tier === "core") {
      const packaged = new Set(state.packagedDomains);
      const delta = cleaned.filter((domain) => !packaged.has(domain));
      state.remoteCore = delta;
      state.remoteCoreSet = new Set(delta);
      state.remoteCoreAt = now;
      count = delta.length;
    } else {
      state.extended = cleaned;
      state.extendedSet = new Set(cleaned);
      state.extendedAt = now;
      count = cleaned.length;
    }

    try {
      await applyState(true);
    } catch (error) {
      // A failed apply must not poison in-memory state or the on-disk cache.
      if (previous.tier === "core") {
        state.remoteCore = previous.domains;
        state.remoteCoreSet = previous.set;
        state.remoteCoreAt = previous.at;
      } else {
        state.extended = previous.domains;
        state.extendedSet = previous.set;
        state.extendedAt = previous.at;
      }
      state.settings = previous.settings;
      throw error;
    }

    if (tier === "core") {
      await setRemoteCache("core", { domains: state.remoteCore, at: now, reports });
    } else {
      await setRemoteCache("extended", { domains: state.extended, at: now, reports });
    }
    state.settings = await updateSettings({
      lastSync: now,
      sync: {
        ...state.settings.sync,
        [tier]: {
          ok: tier === "core" ? allOk : anyOk,
          count,
          at: now,
          error: allOk ? "" : t("syncPartialError"),
          sources: reports,
        },
      },
    });
    await appendEvent({
      type: "sync",
      host: "",
      detail: t(tier === "core" ? "eventCoreUpdated" : "eventExtendedUpdated", [String(count)]),
    });
  } else {
    state.settings = await updateSettings({
      sync: {
        ...state.settings.sync,
        [tier]: {
          ok: false,
          count: 0,
          at: 0,
          error: t("syncAllFailedError"),
          sources: reports,
        },
      },
    });
  }

  return {
    ok: anyOk,
    allOk,
    tier,
    count,
    reports,
    error: anyOk ? "" : t("syncAllFailedShort"),
  };
}

async function syncNow(tier = "core") {
  if (state.syncing) return state.syncing;
  state.syncing = syncTier(tier).finally(() => {
    state.syncing = null;
  });
  return state.syncing;
}

function normalizeDomainInput(input) {
  return normalizeHost(input);
}

async function addCustomDomain(input) {
  const domain = normalizeDomainInput(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain") };
  const allowlist = state.settings.allowlist.filter((item) => !hostMatchesDomain(domain, item) && !hostMatchesDomain(item, domain));
  const customBlocks = [...new Set([...state.settings.customBlocks, domain])].sort();
  state.settings = await updateSettings({ customBlocks, allowlist });
  await applyState(true);
  await appendEvent({ type: "custom", host: domain, detail: t("eventCustomAdded") });
  return { ok: true, domain, settings: publicSettings() };
}

async function removeCustomDomain(input) {
  const domain = normalizeDomainInput(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain") };
  const customBlocks = state.settings.customBlocks.filter((item) => item !== domain);
  state.settings = await updateSettings({ customBlocks });
  await applyState(true);
  await appendEvent({ type: "custom", host: domain, detail: t("eventCustomRemoved") });
  return { ok: true, domain, settings: publicSettings() };
}

async function allowDomain(input) {
  const domain = normalizeDomainInput(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain") };
  const customBlocks = state.settings.customBlocks.filter((item) => item !== domain);
  const allowlist = [...new Set([...state.settings.allowlist, domain])].sort();
  state.settings = await updateSettings({ customBlocks, allowlist });
  await applyState(true);
  await appendEvent({ type: "allowed", host: domain, detail: t("eventAllowedAdded") });
  return { ok: true, domain, settings: publicSettings() };
}

async function removeAllowedDomain(input) {
  const domain = normalizeDomainInput(input);
  if (!domain) return { ok: false, error: t("errorInvalidDomain") };
  const allowlist = state.settings.allowlist.filter((item) => item !== domain);
  state.settings = await updateSettings({ allowlist });
  await applyState(true);
  await appendEvent({ type: "allowed", host: domain, detail: t("eventAllowedRemoved") });
  return { ok: true, domain, settings: publicSettings() };
}

async function allowForTab(tabId, input) {
  const domain = normalizeDomainInput(input);
  if (!Number.isFinite(tabId) || !domain) return { ok: false, error: t("errorInvalidTabOrDomain") };
  const value = { domain, at: Date.now() };
  state.tabAllows[tabId] = value;
  await setTabAllow(tabId, value);
  await applyState(true);
  await appendEvent({ type: "allowed", host: domain, detail: t("eventTabAllowed"), tabId });
  return { ok: true, domain, tabId };
}

async function reportBlock(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : message.tabId;
  if (!Number.isFinite(tabId)) return { ok: false, error: t("errorTabNotFound") };
  const pending = await getPendingNav(tabId);
  const target = message.url || (pending && pending.url) || "";
  const host = normalizeHost(target) || normalizeHost(message.host) || "";
  const current = (await getTabState(tabId)) || emptyPageState(tabId, host, target);
  const blockKey = target || host || "unknown";
  if (current.blockedLoggedFor === blockKey) {
    return { ok: true, duplicate: true, target, host };
  }
  current.blockedThisNavigation = true;
  current.blockedDomain = host;
  current.blockedLoggedFor = blockKey;
  current.updatedAt = Date.now();
  await setTabState(tabId, current);
  await appendEvent({
    type: "blocked",
    host,
    detail: message.reason || t("eventNavBlocked"),
    tabId,
  });
  setActionBadge(tabId, "1");
  return { ok: true, target, host };
}

async function reportSignals(message, sender) {
  const tabId = sender && sender.tab ? sender.tab.id : message.tabId;
  if (!Number.isFinite(tabId)) return { ok: false, enabled: state.settings.enabled };

  const pageUrl = (sender && sender.tab && sender.tab.url) || message.page || "";
  const host = urlToHost(pageUrl) || normalizeHost(message.host) || "";
  if (!host) return { ok: false, enabled: state.settings.enabled };

  const current = (await getTabState(tabId)) || emptyPageState(tabId, host, pageUrl);
  const samePage = current.url === pageUrl;
  const base = samePage ? current : emptyPageState(tabId, host, pageUrl);
  const merged = mergeSignals(base.signals, message.signals || {});
  const gesture = Boolean(base.gesture || message.gesture);
  const cls = classifyHost(host);
  const allowed = Boolean(cls.allowed);
  const risk = assessRisk({
    signals: merged,
    knownLogger: cls.known && !allowed,
    gesture,
    protectionEnabled: state.settings.enabled,
  });

  const next = {
    ...base,
    host,
    url: pageUrl,
    signals: merged,
    gesture,
    updatedAt: Date.now(),
  };

  let showBanner = false;
  const isTopFrame = !sender || sender.frameId === undefined || sender.frameId === 0;
  if (
    isTopFrame &&
    state.settings.enabled &&
    state.settings.warnings &&
    !allowed &&
    !next.bannerShown &&
    risk.banner
  ) {
    showBanner = true;
    next.bannerShown = true;
  }

  if (risk.level === "danger" && next.lastLoggedLevel !== "danger" && !allowed) {
    next.lastLoggedLevel = "danger";
    await appendEvent({
      type: "detected",
      host,
      detail: risk.findings[0] ? t(risk.findings[0].titleKey) : t("findingLeakSignal"),
      tabId,
    });
  }

  await setTabState(tabId, next);
  const verdict = verdictFor({
    enabled: state.settings.enabled,
    allowed,
    host,
    knownLogger: cls.known,
    risk,
    blockedThisNavigation: Boolean(next.blockedThisNavigation),
  });
  return {
    ok: true,
    enabled: state.settings.enabled,
    showBanner,
    risk,
    verdict,
    copy: describeVerdict(verdict, t),
    known: cls,
  };
}

async function setSetting(key, value) {
  if (key === "tiers") {
    if (!value || typeof value !== "object") return { ok: false, error: t("errorInvalidTier") };
    const tiers = { ...state.settings.tiers };
    if (typeof value.core === "boolean") tiers.core = value.core;
    if (typeof value.extended === "boolean") tiers.extended = value.extended;
    state.settings = await updateSettings({ tiers });
    if (tiers.extended && state.extended.length === 0) {
      const result = await syncNow("extended");
      return { ok: result.ok, settings: publicSettings(), sync: result };
    }
    await applyState(true);
    return { ok: true, settings: publicSettings() };
  }

  const allowed = {
    enabled: (v) => typeof v === "boolean",
    showBlockedPage: (v) => typeof v === "boolean",
    warnings: (v) => typeof v === "boolean",
    webrtcPolicy: (v) => ["default", "disable_non_proxied_udp", "disable_udp"].includes(v),
    theme: (v) => ["system", "light", "dark"].includes(v),
    onboardingSeen: (v) => typeof v === "boolean",
  };
  if (!allowed[key] || !allowed[key](value)) return { ok: false, error: t("errorInvalidSetting") };

  state.settings = await updateSettings({ [key]: value });
  if (key !== "theme" && key !== "onboardingSeen" && key !== "warnings") {
    await applyState(true);
  }
  return { ok: true, settings: publicSettings() };
}

async function resetEverything() {
  const markerData = await chrome.storage.local.get(WEBRTC_MARKER_KEY);
  const appliedPolicy = typeof markerData[WEBRTC_MARKER_KEY] === "string" ? markerData[WEBRTC_MARKER_KEY] : "";
  await resetAll();
  if (appliedPolicy && appliedPolicy !== "default") {
    await applyWebRtcPolicy("default");
  }
  state.initialized = false;
  state.dnr = null;
  state.appliedSignature = "";
  await loadState();
  state.settings = await updateSettings({});
  await applyState(true);
  return { ok: true, settings: publicSettings() };
}

async function exportData() {
  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    version: chrome.runtime.getManifest().version,
    settings: state.settings,
    stats: await getStats(),
    events: await getEvents(),
  };
}

async function importData(payload) {
  if (!payload || typeof payload !== "object" || !payload.settings) {
    return { ok: false, error: t("errorInvalidBackup") };
  }
  const incoming = payload.settings;
  state.settings = await updateSettings({
    enabled: incoming.enabled,
    tiers: incoming.tiers,
    showBlockedPage: incoming.showBlockedPage,
    warnings: incoming.warnings,
    webrtcPolicy: incoming.webrtcPolicy,
    theme: incoming.theme,
    allowlist: Array.isArray(incoming.allowlist) ? incoming.allowlist.map(normalizeDomainInput).filter(Boolean) : state.settings.allowlist,
    customBlocks: Array.isArray(incoming.customBlocks) ? incoming.customBlocks.map(normalizeDomainInput).filter(Boolean) : state.settings.customBlocks,
  });
  await applyState(true);
  return { ok: true, settings: publicSettings() };
}

function publicSyncState() {
  return {
    syncing: Boolean(state.syncing),
    lastSync: state.settings.lastSync,
    sync: state.settings.sync,
  };
}

function reportBackgroundError(scope, error) {
  const text = error instanceof Error ? error.message : String(error);
  console.error(`[anti-ip-logger] ${scope}:`, text);
  appendEvent({ type: "info", host: "", detail: `${scope}: ${text}` }).catch(() => {});
}

async function handleMessage(message, sender) {
  if (!sender || sender.id !== chrome.runtime.id) {
    return { ok: false, error: t("errorInvalidSender") };
  }
  const type = message && message.type;
  const isExtensionPage = typeof sender.url === "string" && sender.url.startsWith(chrome.runtime.getURL(""));
  const PRIVILEGED = new Set([
    "clearEvents",
    "setSetting",
    "syncNow",
    "allowOnce",
    "removeTabAllow",
    "panic",
    "restore",
    "resetAll",
    "importData",
    "exportData",
  ]);
  const SELF_ONLY = new Set(["addCustomDomain", "removeCustomDomain", "allowDomain", "removeAllowedDomain"]);
  if (PRIVILEGED.has(type) && !isExtensionPage) {
    return { ok: false, error: t("errorInvalidSender") };
  }
  if (SELF_ONLY.has(type) && !isExtensionPage) {
    const tabHost = sender.tab && typeof sender.tab.url === "string" ? urlToHost(sender.tab.url) : "";
    const domain = normalizeDomainInput(message && message.domain) || "";
    if (!tabHost || !domain || (tabHost !== domain && !tabHost.endsWith(`.${domain}`))) {
      return { ok: false, error: t("errorInvalidSender") };
    }
  }
  await ensureInit();
  switch (type) {
    case "getState":
      return { ok: true, settings: publicSettings(), meta: state.meta, dnr: state.dnr, ...publicSyncState() };
    case "getPopup":
      return { ok: true, ...(await getPopupData(message.tabId)) };
    case "getDashboard":
      return { ok: true, ...(await getDashboardData()) };
    case "getTabInfo":
      return { ok: true, ...(await getTabInfo(message.tabId)) };
    case "getEvents":
      return { ok: true, events: await getEvents() };
    case "clearEvents":
      return { ok: true, ...(await clearEvents()) };
    case "setSetting":
      return setSetting(message.key, message.value);
    case "syncNow":
      return { ok: true, result: await syncNow(message.tier === "extended" ? "extended" : "core") };
    case "addCustomDomain":
      return addCustomDomain(message.domain);
    case "removeCustomDomain":
      return removeCustomDomain(message.domain);
    case "allowDomain":
      return allowDomain(message.domain);
    case "removeAllowedDomain":
      return removeAllowedDomain(message.domain);
    case "allowOnce":
      return allowForTab(sender && sender.tab ? sender.tab.id : message.tabId, message.domain);
    case "removeTabAllow": {
      const tabId = sender && sender.tab ? sender.tab.id : message.tabId;
      if (Number.isFinite(tabId)) {
        delete state.tabAllows[tabId];
        await clearTabAllow(tabId);
        await applyState(true);
      }
      return { ok: true };
    }
    case "checkUrl": {
      const host = normalizeDomainInput(message.url);
      if (!host) return { ok: false, error: t("errorInvalidUrl") };
      const cls = classifyHost(host);
      const allowed = Boolean(cls.allowed);
      const wouldBlock = state.settings.enabled && cls.known && !allowed;
      return {
        ok: true,
        host,
        wouldBlock,
        allowed,
        known: cls,
        protectionOff: !state.settings.enabled,
      };
    }
    case "reportSignals":
      return serializeTabState(() => reportSignals(message, sender));
    case "reportBlock":
      return serializeTabState(() => reportBlock(message, sender));
    case "getBlockedTarget": {
      const tabId = sender && sender.tab ? sender.tab.id : message.tabId;
      const pending = Number.isFinite(tabId) ? await getPendingNav(tabId) : null;
      if (!pending || Date.now() - pending.at > 120_000) return { ok: false, target: "" };
      return { ok: true, target: pending.url };
    }
    case "panic":
      state.settings = await updateSettings({ enabled: false });
      await applyState(true);
      return { ok: true, settings: publicSettings() };
    case "restore":
      state.settings = await updateSettings({ enabled: true });
      await applyState(true);
      return { ok: true, settings: publicSettings() };
    case "resetAll":
      return resetEverything();
    case "exportData":
      return exportData();
    case "importData":
      return importData(message.payload);
    case "openDashboard":
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    default:
      return { ok: false, error: t("errorUnknownMessage") };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) => {
      const text = error instanceof Error ? error.message : String(error);
      console.error("[anti-ip-logger]", text);
      sendResponse({ ok: false, error: text });
    });
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  (async () => {
    await ensureInit(true);
    state.settings = await updateSettings({});
    await applyState(true);
    chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_ALARM_MINUTES });
    chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: CLEANUP_ALARM_MINUTES });
    if (details.reason === "install") {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html?welcome=1") });
    }
  })().catch((error) => reportBackgroundError("install", error));
});

chrome.runtime.onStartup.addListener(() => {
  (async () => {
    await ensureInit(true);
    const [syncAlarm, cleanupAlarm] = await Promise.all([
      chrome.alarms.get(SYNC_ALARM),
      chrome.alarms.get(CLEANUP_ALARM),
    ]);
    if (!syncAlarm) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_ALARM_MINUTES });
    if (!cleanupAlarm) chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: CLEANUP_ALARM_MINUTES });
  })().catch((error) => reportBackgroundError("startup", error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  serializeTabState(async () => {
    await ensureInit();
    if (alarm.name === SYNC_ALARM) {
      await syncNow("core");
      if (state.settings.tiers.extended) await syncNow("extended");
    }
    if (alarm.name === CLEANUP_ALARM) {
      await pruneSession();
      const tabs = await chrome.tabs.query({});
      const live = new Set(tabs.map((tab) => tab.id));
      const session = await chrome.storage.session.get(null);
      const removals = [];
      for (const key of Object.keys(session)) {
        const match = key.match(/^(tab|nav|tabAllow):(\d+)$/);
        if (match && !live.has(Number(match[2]))) removals.push(key);
      }
      if (removals.length > 0) await chrome.storage.session.remove(removals);
      const now = Date.now();
      for (const [tabId, value] of Object.entries(state.tabAllows)) {
        if (!value || now - value.at > PAGE_STATE_TTL_MS * 4) {
          delete state.tabAllows[tabId];
          await clearTabAllow(Number(tabId));
        }
      }
      await applyState(true);
    }
  }).catch((error) => reportBackgroundError("alarm", error));
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !/^https?:/i.test(details.url)) return;
  serializeTabState(async () => {
    await ensureInit();
    const tabAllow = await getTabAllow(details.tabId);
    const host = urlToHost(details.url);
    if (tabAllow && (!host || !hostMatchesDomain(host, tabAllow.domain))) {
      delete state.tabAllows[details.tabId];
      await clearTabAllow(details.tabId);
      await applyState(true);
    }
    await setPendingNav(details.tabId, { url: details.url, at: Date.now() });
    await clearTabState(details.tabId);
    setActionBadge(details.tabId, "");
  }).catch((error) => reportBackgroundError("navigation", error));
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0 || !/^https?:/i.test(details.url)) return;
  serializeTabState(async () => {
    await ensureInit();
    const tabAllow = await getTabAllow(details.tabId);
    const host = urlToHost(details.url);
    if (tabAllow && (!host || !hostMatchesDomain(host, tabAllow.domain))) {
      delete state.tabAllows[details.tabId];
      await clearTabAllow(details.tabId);
      await applyState(true);
    }
  }).catch((error) => reportBackgroundError("navigation-commit", error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  serializeTabState(async () => {
    delete state.tabAllows[tabId];
    await Promise.all([clearTabState(tabId), clearPendingNav(tabId), clearTabAllow(tabId)]);
    await applyState(true);
  }).catch((error) => reportBackgroundError("tab-cleanup", error));
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (!info || !info.request || info.request.type === "main_frame") return;
    const url = info.request.url || "";
    const host = urlToHost(url);
    if (!host) return;
    const key = `${info.request.tabId}:${host}`;
    const now = Date.now();
    const last = state.recentBlocks.get(key) || 0;
    if (now - last < 2_000) return;
    state.recentBlocks.set(key, now);
    if (state.recentBlocks.size > 200) {
      for (const [item, ts] of state.recentBlocks) {
        if (now - ts > 60_000) state.recentBlocks.delete(item);
      }
    }
    await appendEvent({ type: "blocked", host, detail: t("eventSubresourceBlocked"), tabId: info.request.tabId });
  });
}

ensureInit().catch((error) => console.error("[anti-ip-logger] init failed", error));
