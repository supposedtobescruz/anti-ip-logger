const LEVEL_WEIGHT = { danger: 3, warn: 2, info: 1, none: 0 };

const FINDINGS = {
  knownLogger: {
    id: "known-logger",
    level: "danger",
    score: 50,
    titleKey: "findingKnownLoggerTitle",
    detailKey: "findingKnownLoggerDetail",
  },
  webrtc: {
    id: "webrtc",
    level: "danger",
    score: 45,
    titleKey: "findingWebrtcTitle",
    detailKey: "findingWebrtcDetail",
  },
  autoForm: {
    id: "auto-form",
    level: "danger",
    score: 40,
    titleKey: "findingAutoFormTitle",
    detailKey: "findingAutoFormDetail",
  },
  hiddenFrame: {
    id: "hidden-frame",
    level: "warn",
    score: 18,
    titleKey: "findingHiddenFrameTitle",
    detailKey: "findingHiddenFrameDetail",
  },
  metaRefresh: {
    id: "meta-refresh",
    level: "warn",
    score: 30,
    titleKey: "findingMetaRefreshTitle",
    detailKey: "findingMetaRefreshDetail",
  },
  pixel: {
    id: "hidden-pixel",
    level: "info",
    score: 8,
    titleKey: "findingHiddenPixelTitle",
    detailKey: "findingHiddenPixelDetail",
  },
  earlyRequests: {
    id: "early-requests",
    level: "info",
    score: 8,
    titleKey: "findingEarlyRequestsTitle",
    detailKey: "findingEarlyRequestsDetail",
  },
  media: {
    id: "media",
    level: "info",
    score: 5,
    titleKey: "findingMediaTitle",
    detailKey: "findingMediaDetail",
  },
  geolocation: {
    id: "geolocation",
    level: "info",
    score: 5,
    titleKey: "findingGeolocationTitle",
    detailKey: "findingGeolocationDetail",
  },
};

export function emptySignals() {
  return {
    webrtcPublic: [],
    webrtcPrivate: 0,
    webrtcCreated: 0,
    mdns: 0,
    autoForm: false,
    hiddenPixels: [],
    hiddenFrames: [],
    metaRefresh: [],
    preGestureRequests: 0,
    thirdPartyHosts: [],
    media: 0,
    geolocation: 0,
    requestTotal: 0,
  };
}

function maxNumber(a, b) {
  const value = Math.max(Number(a) || 0, Number(b) || 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), 1_000_000);
}

function union(a, b, limit = 30) {
  const items = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const clean = [];
  for (const item of items) {
    if (typeof item !== "string" || item.length === 0 || item.length >= 300) continue;
    if (clean.includes(item)) continue;
    clean.push(item);
  }
  return clean.slice(0, limit);
}

export function mergeSignals(current, patch) {
  const base = { ...emptySignals(), ...(current || {}) };
  const next = { ...base, ...(patch || {}) };
  next.webrtcPublic = union(base.webrtcPublic, patch && patch.webrtcPublic, 5);
  next.hiddenPixels = union(base.hiddenPixels, patch && patch.hiddenPixels, 20);
  next.hiddenFrames = union(base.hiddenFrames, patch && patch.hiddenFrames, 20);
  next.metaRefresh = union(base.metaRefresh, patch && patch.metaRefresh, 10);
  next.thirdPartyHosts = union(base.thirdPartyHosts, patch && patch.thirdPartyHosts, 20);
  next.webrtcPrivate = maxNumber(base.webrtcPrivate, patch && patch.webrtcPrivate);
  next.webrtcCreated = maxNumber(base.webrtcCreated, patch && patch.webrtcCreated);
  next.mdns = maxNumber(base.mdns, patch && patch.mdns);
  next.preGestureRequests = maxNumber(base.preGestureRequests, patch && patch.preGestureRequests);
  next.media = maxNumber(base.media, patch && patch.media);
  next.geolocation = maxNumber(base.geolocation, patch && patch.geolocation);
  next.requestTotal = maxNumber(base.requestTotal, patch && patch.requestTotal);
  next.autoForm = Boolean(base.autoForm || (patch && patch.autoForm));
  return next;
}

export function assessRisk({ signals, knownLogger = false, gesture = false, protectionEnabled = true }) {
  const s = { ...emptySignals(), ...(signals || {}) };
  const findings = [];

  if (knownLogger) findings.push(FINDINGS.knownLogger);
  if (s.webrtcPublic.length > 0) findings.push(FINDINGS.webrtc);
  if (s.autoForm && !gesture) findings.push(FINDINGS.autoForm);
  if (s.hiddenFrames.length > 0) {
    findings.push({ ...FINDINGS.hiddenFrame, score: gesture ? 12 : 18 });
  }
  if (s.metaRefresh.length > 0) findings.push(FINDINGS.metaRefresh);
  if (s.hiddenPixels.length > 0) findings.push(FINDINGS.pixel);
  if (s.preGestureRequests >= 5 && !gesture) findings.push(FINDINGS.earlyRequests);
  if (s.media > 0) findings.push(FINDINGS.media);
  if (s.geolocation > 0) findings.push(FINDINGS.geolocation);

  const score = Math.min(100, findings.reduce((total, item) => total + item.score, 0));
  let level = "none";
  for (const finding of findings) {
    if (LEVEL_WEIGHT[finding.level] > LEVEL_WEIGHT[level]) level = finding.level;
  }
  const strong = findings.some((finding) => finding.level === "danger");
  const warnCount = findings.filter((finding) => finding.level === "warn").length;
  const banner = Boolean(protectionEnabled) && (strong || warnCount >= 2);
  if (!protectionEnabled) level = "none";

  findings.sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] || b.score - a.score);

  return {
    level,
    score,
    findings,
    signalCount: findings.length,
    banner,
    protectionEnabled,
  };
}

export function verdictFor({ enabled, paused = false, allowed, host, knownLogger, risk, blockedThisNavigation }) {
  if (paused) return "paused";
  if (!enabled) return "off";
  if (allowed) return "allowed";
  if (knownLogger) return "logger";
  if (blockedThisNavigation) return "blocked";
  if (risk.level === "danger") return "danger";
  if (risk.level === "warn") return "warn";
  if (risk.level === "info") return "info";
  return host ? "clean" : "idle";
}

export const VERDICT_COPY = {
  off: { labelKey: "verdictOffLabel", headlineKey: "verdictOffHeadline", detailKey: "verdictOffDetail", tone: "muted" },
  paused: { labelKey: "verdictPausedLabel", headlineKey: "verdictPausedHeadline", detailKey: "verdictPausedDetail", tone: "muted" },
  allowed: { labelKey: "verdictAllowedLabel", headlineKey: "verdictAllowedHeadline", detailKey: "verdictAllowedDetail", tone: "info" },
  logger: { labelKey: "verdictLoggerLabel", headlineKey: "verdictLoggerHeadline", detailKey: "verdictLoggerDetail", tone: "danger" },
  blocked: { labelKey: "verdictBlockedLabel", headlineKey: "verdictBlockedHeadline", detailKey: "verdictBlockedDetail", tone: "danger" },
  danger: { labelKey: "verdictDangerLabel", headlineKey: "verdictDangerHeadline", detailKey: "verdictDangerDetail", tone: "danger" },
  warn: { labelKey: "verdictWarnLabel", headlineKey: "verdictWarnHeadline", detailKey: "verdictWarnDetail", tone: "warn" },
  info: { labelKey: "verdictInfoLabel", headlineKey: "verdictInfoHeadline", detailKey: "verdictInfoDetail", tone: "info" },
  clean: { labelKey: "verdictCleanLabel", headlineKey: "verdictCleanHeadline", detailKey: "verdictCleanDetail", tone: "safe" },
  idle: { labelKey: "verdictIdleLabel", headlineKey: "verdictIdleHeadline", detailKey: "verdictIdleDetail", tone: "muted" },
};

export function describeVerdict(verdict, translate) {
  if (typeof translate !== "function") throw new Error("translate is required");
  const copy = VERDICT_COPY[verdict] || VERDICT_COPY.idle;
  return {
    label: translate(copy.labelKey),
    headline: translate(copy.headlineKey),
    detail: translate(copy.detailKey),
    tone: copy.tone,
  };
}

