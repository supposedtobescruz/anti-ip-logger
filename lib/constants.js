export const EXTENSION_NAME = "Anti IP Logger";
export const STORAGE_VERSION = 1;

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

export const PRIORITY = {
  core: 10,
  extended: 20,
  blockedPage: 40,
  custom: 50,
  allow: 100,
  tabAllow: 110,
};

export const RULE_BASE = {
  remoteCore: 1_000_000,
  blockedPage: 2_000_000,
  custom: 3_000_000,
  allow: 4_000_000,
  extended: 5_000_000,
  tabAllow: 6_000_000,
};

export const BASE_SPAN = 900_000;
export const MAX_DOMAINS_PER_RULE = 100;
export const MAX_DYNAMIC_RULES = 5_000;
export const MAX_STATIC_RULES_PER_RULESET = 30_000;

export const ARTICLE = "core";
export const ALL_TIERS = ["core", "extended"];
export const CATEGORIES = ["grabify", "iplogger", "other", "tracker", "threat", "custom"];

export const CATEGORY_LABELS = {
  grabify: "Grabify",
  iplogger: "IPLogger",
  other: "Diğer servis",
  tracker: "İzleyici",
  threat: "Tehdit listesi",
  custom: "Özel kural",
};

export const DEFAULT_SETTINGS = {
  version: STORAGE_VERSION,
  enabled: true,
  tiers: { core: true, extended: false },
  showBlockedPage: true,
  warnings: true,
  webrtcPolicy: "default",
  theme: "system",
  allowlist: [],
  customBlocks: [],
  onboardingSeen: false,
  lastSync: 0,
  sync: {
    core: { ok: false, count: 0, at: 0, error: "", sources: [] },
    extended: { ok: false, count: 0, at: 0, error: "", sources: [] },
  },
};

export const DEFAULT_STATS = {
  blocked: 0,
  detected: 0,
  firstEventAt: 0,
  lastEventAt: 0,
};

export const EVENT_LIMIT = 500;
export const TAB_STATE_LIMIT = 30;
export const SYNC_ALARM_MINUTES = 360;
export const CLEANUP_ALARM_MINUTES = 60;
export const PAGE_STATE_TTL_MS = 30 * 60 * 1000;
