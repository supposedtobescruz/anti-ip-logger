import {
  applyTheme,
  badge,
  clear,
  el,
  formatClock,
  formatNumber,
  formatRelative,
  onThemeChange,
  resolvedTheme,
  send,
  setBusy,
  toast,
  toggleTheme,
} from "../assets/ui.js";
import { t, applyI18n } from "../assets/i18n.js";

const nodes = {
  app: document.getElementById("app"),
  loading: document.getElementById("loading"),
  content: document.getElementById("content"),
  error: document.getElementById("error-state"),
  errorText: document.getElementById("error-text"),
  retry: document.getElementById("retry"),
  hero: document.getElementById("hero"),
  verdictBadge: document.getElementById("verdict-badge"),
  host: document.getElementById("hero-host"),
  headline: document.getElementById("verdict-headline"),
  detail: document.getElementById("verdict-detail"),
  block: document.getElementById("block-site"),
  allow: document.getElementById("allow-site"),
  allowTab: document.getElementById("allow-tab"),
  findingsSection: document.getElementById("findings-section"),
  findings: document.getElementById("findings"),
  findingsCount: document.getElementById("findings-count"),
  statBlocked: document.getElementById("stat-blocked"),
  statDetected: document.getElementById("stat-detected"),
  statDomains: document.getElementById("stat-domains"),
  statRules: document.getElementById("stat-rules"),
  events: document.getElementById("events"),
  eventsEmpty: document.getElementById("events-empty"),
  noHostHint: document.getElementById("no-host-hint"),
  liveStatus: document.getElementById("live-status"),
  syncLine: document.getElementById("sync-line"),
  versionLine: document.getElementById("version-line"),
  themeToggle: document.getElementById("theme-toggle"),
  themeGlyph: document.getElementById("theme-glyph"),
  dashboard: document.getElementById("open-dashboard"),
};

const BADGE_TONE = { danger: "danger", warn: "warn", info: "plain", safe: "safe", muted: "muted" };
const FINDING_TONE = { danger: "danger", warn: "warn", info: "muted" };
const FINDING_LEVEL_KEY = { danger: "findingLevelDanger", warn: "findingLevelWarn", info: "findingLevelInfo" };

let view = null;
let theme = "system";
let busy = false;
let loading = false;
let reloadQueued = false;

function syncThemeButton() {
  const resolved = resolvedTheme();
  nodes.themeGlyph.textContent = resolved === "dark" ? "☾" : "☀";
  const labelKey = resolved === "dark" ? "themeSwitchToLight" : "themeSwitchToDark";
  nodes.themeToggle.setAttribute("aria-label", t(labelKey));
  nodes.themeToggle.title = t(labelKey);
}

function setTheme(themeValue) {
  theme = themeValue;
  applyTheme(themeValue);
  syncThemeButton();
}

function showLoading() {
  nodes.app.setAttribute("aria-busy", "true");
  nodes.loading.hidden = false;
  nodes.content.hidden = true;
  nodes.error.hidden = true;
}

function showError(message) {
  nodes.app.setAttribute("aria-busy", "false");
  nodes.loading.hidden = true;
  nodes.content.hidden = true;
  nodes.error.hidden = false;
  nodes.errorText.textContent = message;
  nodes.retry.focus();
}

function showContent() {
  nodes.app.setAttribute("aria-busy", "false");
  nodes.loading.hidden = true;
  nodes.error.hidden = true;
  nodes.content.hidden = false;
}

function renderHero(data) {
  const copy = data.copy || {};
  const tone = copy.tone || "muted";
  nodes.hero.className = `hero hero--${tone}`;
  nodes.verdictBadge.className = `badge badge--${BADGE_TONE[tone] || "muted"}`;
  nodes.verdictBadge.textContent = copy.label || t("verdictIdleLabel");
  nodes.headline.textContent = copy.headline || t("statusUnreadable");
  nodes.detail.textContent = copy.detail || "";
  nodes.host.textContent = data.host || "";
  nodes.host.hidden = !data.host;
  nodes.host.title = data.url || "";
  nodes.liveStatus.textContent = `${copy.label || t("verdictIdleLabel")}: ${copy.headline || ""}${data.host ? ` ${data.host}` : ""}`;
}

function renderActions(data) {
  const hasHost = Boolean(data.host);
  const allowed = Boolean(data.allowed);
  const known = Boolean(data.known && data.known.known);
  const protectionOff = data.settings && data.settings.enabled === false;

  nodes.block.disabled = !hasHost || busy;
  nodes.allow.disabled = !hasHost || busy;
  nodes.allow.textContent = allowed ? t("allowRemoveButton") : t("allowAddButton");
  nodes.allowTab.hidden = !(hasHost && known && !allowed && !protectionOff);
  nodes.allowTab.disabled = busy;
  nodes.allow.hidden = !hasHost;
  nodes.block.hidden = !hasHost;
  nodes.noHostHint.hidden = hasHost;
}

function renderFindings(data) {
  const findings = (data.risk && data.risk.findings) || [];
  clear(nodes.findings);
  if (findings.length === 0) {
    nodes.findingsSection.hidden = true;
    return;
  }
  nodes.findingsSection.hidden = false;
  nodes.findingsCount.textContent = t("signalCount", [formatNumber(findings.length)]);
  for (const finding of findings) {
    const item = el("li", "finding");
    item.append(badge(FINDING_TONE[finding.level] || "muted", t(FINDING_LEVEL_KEY[finding.level] || "findingLevelInfo")));
    const body = el("div", "finding__body");
    body.append(el("p", "finding__title", t(finding.titleKey || "findingLeakSignal")), el("p", "finding__detail", t(finding.detailKey || "findingLeakSignal")));
    item.append(body);
    nodes.findings.append(item);
  }
}

function renderStats(data) {
  const stats = data.stats || {};
  const dnr = data.dnr || {};
  const counts = (data.meta && data.meta.counts) || {};
  nodes.statBlocked.textContent = formatNumber(stats.blocked);
  nodes.statDetected.textContent = formatNumber(stats.detected);
  nodes.statDomains.textContent = formatNumber(counts.domains);
  nodes.statRules.textContent = formatNumber((dnr.dynamicRules || 0) + (dnr.staticRulesetEnabled ? counts.rules || 0 : 0));
  nodes.versionLine.textContent = data.meta ? `v${data.meta.version}` : "";
}

function renderEvents(data) {
  const events = data.events || [];
  clear(nodes.events);
  nodes.eventsEmpty.hidden = events.length > 0;
  for (const event of events) {
    const item = el("li", "event");
    item.append(el("span", "event__time mono", formatClock(event.ts)));
    item.append(el("span", "event__host mono", event.host || t("hostUnknown")));
    item.append(el("span", "event__detail", event.detail || ""));
    item.title = `${formatRelative(event.ts)} - ${event.detail || ""}`;
    nodes.events.append(item);
  }
}

function renderSync(data) {
  const settings = data.settings || {};
  const sync = settings.sync || {};
  const core = sync.core || {};
  if (!settings.enabled) {
    nodes.syncLine.textContent = t("protectionOff");
    return;
  }
  if (sync.core && sync.core.error) {
    nodes.syncLine.textContent = t("listPartiallyUpdated");
    return;
  }
  const at = core.at || settings.lastSync;
  nodes.syncLine.textContent = at ? t("listUpdatedRelative", [formatRelative(at)]) : t("listLocal");
}

function render(data) {
  view = data;
  setTheme(data.settings && data.settings.theme ? data.settings.theme : "system");
  showContent();
  renderHero(data);
  renderActions(data);
  renderFindings(data);
  renderStats(data);
  renderEvents(data);
  renderSync(data);
}

async function load() {
  if (loading) {
    reloadQueued = true;
    return;
  }
  loading = true;
  showLoading();
  try {
    const result = await send({ type: "getPopup" });
    if (!result || !result.ok) {
      showError(result && result.error ? result.error : t("statusUnreadable"));
      return;
    }
    render(result);
  } finally {
    loading = false;
    if (reloadQueued) {
      reloadQueued = false;
      await load();
    }
  }
}

async function act(button, message, successText, failureText) {
  if (busy) return;
  busy = true;
  setBusy(button, true);
  const result = await send(message);
  if (!result || !result.ok) {
    busy = false;
    setBusy(button, false);
    toast((result && result.error) || failureText, "error");
    return;
  }
  toast(successText, "ok");
  busy = false;
  setBusy(button, false);
  await load();
}

nodes.block.addEventListener("click", () => {
  if (!view || !view.host) return;
  act(nodes.block, { type: "addCustomDomain", domain: view.host }, t("toastBlocked", [view.host]), t("toastBlockFailed"));
});

nodes.allow.addEventListener("click", () => {
  if (!view || !view.host) return;
  const allowed = Boolean(view.allowed);
  act(
    nodes.allow,
    allowed
      ? { type: "removeAllowedDomain", domain: view.known && view.known.domain ? view.known.domain : view.host }
      : { type: "allowDomain", domain: view.host },
    allowed ? t("toastAllowRemoved") : t("toastAllowAdded"),
    t("toastGenericFailed"),
  );
});

nodes.allowTab.addEventListener("click", () => {
  if (!view || !view.host) return;
  act(nodes.allowTab, { type: "allowOnce", domain: view.host, tabId: view.tabId }, t("toastTabAllowed"), t("toastTabAllowFailed"));
});

nodes.retry.addEventListener("click", load);

async function openDashboardFrom() {
  const result = await send({ type: "openDashboard" });
  if (!result || !result.ok) {
    toast((result && result.error) || t("toastDashboardFailed"), "error");
  }
}

nodes.dashboard.addEventListener("click", () => {
  openDashboardFrom();
});

nodes.themeToggle.addEventListener("click", async () => {
  const next = toggleTheme(resolvedTheme());
  setTheme(next);
  await send({ type: "setSetting", key: "theme", value: next });
});

applyI18n();
onThemeChange(syncThemeButton);
load();

if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings || changes.stats || changes.events) {
      load();
    }
  });
}
