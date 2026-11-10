import {
  applyTheme,
  clear,
  el,
  formatRelative,
  formatNumber,
  onThemeChange,
  send,
  setBusy,
  toast,
  toggleTheme,
  resolvedTheme,
} from "../assets/ui.js";
import { t, applyI18n, initLanguage } from "../assets/i18n.js";

const ROUTES = {
  overview: { titleKey: "routeOverviewTitle", eyebrowKey: "routeOverviewEyebrow" },
  lists: { titleKey: "routeListsTitle", eyebrowKey: "routeListsEyebrow" },
  events: { titleKey: "routeEventsTitle", eyebrowKey: "routeEventsEyebrow" },
  sources: { titleKey: "routeSourcesTitle", eyebrowKey: "routeSourcesEyebrow" },
  settings: { titleKey: "routeSettingsTitle", eyebrowKey: "routeSettingsEyebrow" },
};

const CATEGORY_LABEL_KEYS = {
  grabify: "categoryGrabify",
  iplogger: "categoryIplogger",
  other: "categoryOther",
  tracker: "categoryTracker",
  threat: "categoryThreat",
  custom: "categoryCustom",
};

const CONFIDENCE_LABEL_KEYS = { confirmed: "confidenceConfirmed", single: "confidenceSingle" };

const EVENT_TONES = {
  blocked: "danger",
  detected: "warn",
  allowed: "safe",
  custom: "plain",
  sync: "muted",
  info: "muted",
};

const EVENT_LABEL_KEYS = {
  blocked: "typeBlocked",
  detected: "typeDetected",
  allowed: "typeAllowed",
  custom: "typeCustom",
  sync: "typeSync",
  info: "typeInfo",
};

const PAGE_SIZE = 40;

const nodes = {
  railStatus: document.getElementById("rail-status"),
  railDot: document.getElementById("rail-dot"),
  railVersion: document.getElementById("rail-version"),
  pageTitle: document.getElementById("page-title"),
  pageEyebrow: document.getElementById("page-eyebrow"),
  updateNotice: document.getElementById("update-notice"),
  updateNoticeBody: document.getElementById("update-notice-body"),
  updateDismiss: document.getElementById("update-notice-dismiss"),
  globalError: document.getElementById("global-error"),
  syncButton: document.getElementById("sync-button"),
  themeButton: document.getElementById("theme-button"),
  views: [...document.querySelectorAll(".view")],
  navLinks: [...document.querySelectorAll(".rail__link")],
  statusBand: document.getElementById("status-band"),
  statusLine: document.getElementById("status-line"),
  statusDetail: document.getElementById("status-detail"),
  enabledToggle: document.getElementById("enabled-toggle"),
  enabledLabel: document.getElementById("enabled-label"),
  tileBlocked: document.getElementById("tile-blocked"),
  tileDetected: document.getElementById("tile-detected"),
  tileDomains: document.getElementById("tile-domains"),
  tileDomainsNote: document.getElementById("tile-domains-note"),
  tileRules: document.getElementById("tile-rules"),
  tileRulesNote: document.getElementById("tile-rules-note"),
  overviewEvents: document.getElementById("overview-events"),
  overviewEventsEmpty: document.getElementById("overview-events-empty"),
  coverageCore: document.getElementById("coverage-core"),
  coverageRemote: document.getElementById("coverage-remote"),
  coverageExtended: document.getElementById("coverage-extended"),
  coverageAllow: document.getElementById("coverage-allow"),
  coverageTab: document.getElementById("coverage-tab"),
  coverageNote: document.getElementById("coverage-note"),
  syncNotice: document.getElementById("sync-notice"),
  syncNoticeText: document.getElementById("sync-notice-text"),
  coreSearch: document.getElementById("core-search"),
  coreCategory: document.getElementById("core-category"),
  coreCount: document.getElementById("core-count"),
  coreSummary: document.getElementById("core-summary"),
  coreRows: document.getElementById("core-rows"),
  coreEmpty: document.getElementById("core-empty"),
  coreMore: document.getElementById("core-more"),
  allowForm: document.getElementById("allow-form"),
  allowInput: document.getElementById("allow-input"),
  allowError: document.getElementById("allow-error"),
  allowList: document.getElementById("allow-list"),
  allowEmpty: document.getElementById("allow-empty"),
  allowCount: document.getElementById("allow-count"),
  customForm: document.getElementById("custom-form"),
  customInput: document.getElementById("custom-input"),
  customError: document.getElementById("custom-error"),
  customList: document.getElementById("custom-list"),
  customEmpty: document.getElementById("custom-empty"),
  customCount: document.getElementById("custom-count"),
  eventsSearch: document.getElementById("events-search"),
  eventsType: document.getElementById("events-type"),
  eventsClear: document.getElementById("events-clear"),
  eventsList: document.getElementById("events-list"),
  eventsEmpty: document.getElementById("events-empty"),
  eventsCount: document.getElementById("events-count"),
  sourceRows: document.getElementById("source-rows"),
  sourcesCount: document.getElementById("sources-count"),
  sourcesNote: document.getElementById("sources-note"),
  syncCore: document.getElementById("sync-core"),
  syncCoreResult: document.getElementById("sync-core-result"),
  syncExtended: document.getElementById("sync-extended"),
  syncExtendedResult: document.getElementById("sync-extended-result"),
  extendedBadge: document.getElementById("extended-badge"),
  setEnabled: document.getElementById("set-enabled"),
  setCore: document.getElementById("set-core"),
  setExtended: document.getElementById("set-extended"),
  setBlockedPage: document.getElementById("set-blocked-page"),
  setWarnings: document.getElementById("set-warnings"),
  setWebrtc: document.getElementById("set-webrtc"),
  setTheme: document.getElementById("set-theme"),
  setLanguage: document.getElementById("set-language"),
  languageNote: document.getElementById("language-note"),
  replayTour: document.getElementById("replay-tour"),
  mascotCorner: document.getElementById("mascot-corner"),
  webrtcNote: document.getElementById("webrtc-note"),
  exportButton: document.getElementById("export-button"),
  importButton: document.getElementById("import-button"),
  importFile: document.getElementById("import-file"),
  resetButton: document.getElementById("reset-button"),
  resetConfirm: document.getElementById("reset-confirm"),
  resetConfirmButton: document.getElementById("reset-confirm-button"),
  resetCancel: document.getElementById("reset-cancel"),
  dataNote: document.getElementById("data-note"),
  aboutVersion: document.getElementById("about-version"),
};

const state = {
  data: null,
  route: "overview",
  corePage: 1,
  coreQuery: "",
  coreCategory: "",
  eventsQuery: "",
  eventsType: "",
  loading: false,
  reloadQueued: false,
};

function currentRoute() {
  const hash = location.hash.replace(/^#/, "");
  return Object.prototype.hasOwnProperty.call(ROUTES, hash) ? hash : "overview";
}

function navigate(route, push = true) {
  state.route = route;
  if (push && location.hash !== `#${route}`) {
    history.pushState(null, "", `#${route}`);
  }
  for (const view of nodes.views) {
    view.hidden = view.id !== `section-${route}`;
  }
  for (const link of nodes.navLinks) {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  nodes.pageTitle.textContent = t(ROUTES[route].titleKey);
  nodes.pageEyebrow.textContent = t(ROUTES[route].eyebrowKey);
  document.title = `Anti IP Logger · ${t(ROUTES[route].titleKey)}`;
  document.getElementById("view").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function showError(message) {
  nodes.globalError.hidden = false;
  nodes.globalError.textContent = message;
}

function hideError() {
  nodes.globalError.hidden = true;
  nodes.globalError.textContent = "";
}

function setRailStatus(settings) {
  if (!settings) {
    nodes.railStatus.textContent = t("loadingText");
    nodes.railDot.dataset.tone = "muted";
    return;
  }
  if (!settings.enabled) {
    nodes.railStatus.textContent = t("protectionOff");
    nodes.railDot.dataset.tone = "muted";
    return;
  }
  const core = settings.sync && settings.sync.core ? settings.sync.core : {};
  if (core.error) {
    nodes.railStatus.textContent = t("listPartiallyUpdated");
    nodes.railDot.dataset.tone = "warn";
    return;
  }
  nodes.railStatus.textContent = t("protectionOn");
  nodes.railDot.dataset.tone = "safe";
}

function syncThemeLabel() {
  const resolved = resolvedTheme();
  const dark = resolved === "dark";
  nodes.themeButton.textContent = t(dark ? "themeSwitchToLight" : "themeSwitchToDark");
  nodes.themeButton.setAttribute("aria-label", t(dark ? "themeSwitchToLight" : "themeSwitchToDark"));
}

function renderTheme(settings) {
  const themeValue = settings && settings.theme ? settings.theme : "system";
  applyTheme(themeValue);
  nodes.setTheme.value = themeValue;
  syncThemeLabel();
}

function renderOverview(data) {
  const { settings, stats, meta, dnr, lists } = data;
  const enabled = Boolean(settings.enabled);
  const coreError = Boolean(settings.sync.core && settings.sync.core.error);
  nodes.statusBand.dataset.tone = enabled ? (coreError ? "warn" : "safe") : "muted";
  nodes.statusLine.textContent = enabled ? t("protectionOn") : t("protectionOff");
  const core = settings.sync.core || {};
  nodes.statusDetail.textContent = enabled
    ? core.error
      ? t("statusPartialDetail")
      : t("statusWorkingDetail", [formatNumber(meta.counts.domains), formatNumber(dnr.dynamicRules)])
    : t("statusDisabledDetail");
  nodes.enabledToggle.checked = enabled;
  nodes.enabledLabel.textContent = enabled ? t("switchOn") : t("switchOff");

  nodes.updateNotice.hidden = !data.updateAvailable;
  if (data.updateAvailable) {
    nodes.updateNoticeBody.textContent = t("updateAvailableBody", [data.updateAvailable.latest, data.version || ""]);
  }

  nodes.tileBlocked.textContent = formatNumber(stats.blocked);
  nodes.tileDetected.textContent = formatNumber(stats.detected);
  nodes.tileDomains.textContent = formatNumber(meta.counts.domains);
  nodes.tileDomainsNote.textContent = t("tileDomainsBreakdown", [formatNumber(meta.counts.confirmed), formatNumber(meta.counts.single)]);
  nodes.tileRules.textContent = formatNumber(dnr.dynamicRules + (dnr.staticRulesetEnabled ? meta.counts.rules : 0));
  nodes.tileRulesNote.textContent = dnr.staticRulesetEnabled ? t("tileRulesStatic") : t("tileRulesDynamicOnly");

  nodes.coverageCore.textContent = formatNumber(lists.packaged.length);
  nodes.coverageRemote.textContent = formatNumber(lists.remoteCoreCount);
  nodes.coverageExtended.textContent = settings.tiers.extended ? formatNumber(lists.extendedCount) : t("offLabel");
  nodes.coverageAllow.textContent = formatNumber(lists.allowlist.length);
  nodes.coverageTab.textContent = formatNumber(data.tabAllowCount);
  const lastSync = settings.sync.core && settings.sync.core.at ? settings.sync.core.at : 0;
  nodes.coverageNote.textContent = lastSync ? t("coverageSynced", [formatRelative(lastSync)]) : t("coverageLocalOnly");

  const events = data.events.slice(0, 6);
  clear(nodes.overviewEvents);
  nodes.overviewEventsEmpty.hidden = events.length > 0;
  for (const event of events) {
    nodes.overviewEvents.append(eventRow(event));
  }

  const syncError = (settings.sync.core && settings.sync.core.error) || (settings.sync.extended && settings.sync.extended.error);
  nodes.syncNotice.hidden = !syncError;
  nodes.syncNoticeText.textContent = syncError || "";
}

function eventRow(event) {
  const row = el("li", "event-row");
  row.append(el("span", "event-row__time mono", formatRelative(event.ts)));
  const main = el("div", "event-row__main");
  main.append(el("p", "event-row__host mono truncate", event.host || t("hostUnknown")));
  main.append(el("p", "event-row__detail truncate", event.detail || ""));
  row.append(main);
  const meta = el("span", "event-row__meta");
  meta.append(el("span", `badge badge--${EVENT_TONES[event.type] || "plain"}`, t(EVENT_LABEL_KEYS[event.type] || "typeInfo")));
  row.append(meta);
  row.title = `${new Date(event.ts).toLocaleString()} - ${event.detail || ""}`;
  return row;
}

function renderCategoryOptions(entries) {
  if (nodes.coreCategory.options.length > 1) return;
  const seen = new Set(entries.map((entry) => entry.category));
  for (const key of Object.keys(CATEGORY_LABEL_KEYS)) {
    if (!seen.has(key)) continue;
    const option = document.createElement("option");
    option.value = key;
    option.textContent = t(CATEGORY_LABEL_KEYS[key]);
    nodes.coreCategory.append(option);
  }
}

function filteredCore() {
  const entries = state.data ? state.data.lists.packaged : [];
  const query = state.coreQuery.toLowerCase();
  return entries.filter((entry) => {
    if (state.coreCategory && entry.category !== state.coreCategory) return false;
    if (!query) return true;
    const haystack = [entry.domain, entry.category, ...(entry.sources || [])].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function renderCore() {
  if (!state.data) return;
  const entries = state.data.lists.packaged;
  renderCategoryOptions(entries);
  const filtered = filteredCore();
  const visible = filtered.slice(0, state.corePage * PAGE_SIZE);
  nodes.coreCount.textContent = t("coreCount", [formatNumber(entries.length)]);
  nodes.coreSummary.textContent = filtered.length === entries.length
    ? t("coreSummaryAll", [formatNumber(entries.length)])
    : t("coreSummaryFiltered", [formatNumber(filtered.length), formatNumber(entries.length)]);

  clear(nodes.coreRows);
  for (const entry of visible) {
    const row = document.createElement("tr");
    const domainCell = el("td", "mono", entry.domain);
    const categoryCell = el("td", "", t(CATEGORY_LABEL_KEYS[entry.category] || "categoryOther"));
    const confidenceCell = document.createElement("td");
    confidenceCell.append(el("span", `badge badge--${entry.confidence === "confirmed" ? "safe" : "muted"}`, t(CONFIDENCE_LABEL_KEYS[entry.confidence] || "confidenceSingle")));
    const sourceCell = el("td", "mono", (entry.sources || []).join(", "));
    row.append(domainCell, categoryCell, confidenceCell, sourceCell);
    nodes.coreRows.append(row);
  }

  nodes.coreEmpty.hidden = filtered.length > 0;
  nodes.coreMore.hidden = visible.length >= filtered.length;
}

function renderDomainList(kind) {
  const settings = state.data.settings;
  const items = kind === "allow" ? settings.allowlist : settings.customBlocks;
  const list = kind === "allow" ? nodes.allowList : nodes.customList;
  const empty = kind === "allow" ? nodes.allowEmpty : nodes.customEmpty;
  const count = kind === "allow" ? nodes.allowCount : nodes.customCount;

  clear(list);
  count.textContent = t("recordCount", [formatNumber(items.length)]);
  empty.hidden = items.length > 0;

  for (const domain of items) {
    const item = el("li", "domain-item");
    item.append(el("span", "domain-item__name mono", domain));
    const action = el("button", "btn btn--quiet btn--small", t("removeButton"));
    action.type = "button";
    action.dataset.kind = kind;
    action.dataset.domain = domain;
    action.setAttribute("aria-label", t(kind === "allow" ? "removeAllowAria" : "removeCustomAria", [domain]));
    item.append(action);
    list.append(item);
  }
}

function filteredEvents() {
  const query = state.eventsQuery.toLowerCase();
  return (state.data ? state.data.events : []).filter((event) => {
    if (state.eventsType && event.type !== state.eventsType) return false;
    if (!query) return true;
    return `${event.host || ""} ${event.detail || ""}`.toLowerCase().includes(query);
  });
}

function renderEvents() {
  if (!state.data) return;
  const events = filteredEvents();
  clear(nodes.eventsList);
  nodes.eventsCount.textContent = t("eventCount", [formatNumber(events.length)]);
  nodes.eventsEmpty.hidden = events.length > 0;
  for (const event of events.slice(0, 300)) {
    nodes.eventsList.append(eventRow(event));
  }
  nodes.eventsClear.disabled = state.data.events.length === 0;
}

function renderSources(data) {
  clear(nodes.sourceRows);
  const health = new Map();
  for (const tier of ["core", "extended"]) {
    for (const report of (data.settings.sync[tier] && data.settings.sync[tier].sources) || []) {
      health.set(report.id, report);
    }
  }

  for (const source of data.sources) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.append(el("span", "", source.name));
    row.append(nameCell);
    row.append(el("td", "", source.tier === "core" ? t("tierCore") : t("tierThreat")));
    row.append(el("td", "mono", source.license || t("licenseUnspecified")));

    const statusCell = document.createElement("td");
    const report = health.get(source.id);
    if (report) {
      statusCell.append(el("span", `badge badge--${report.ok ? "safe" : "danger"}`, report.ok ? t("sourceOk") : t("sourceError")));
      if (!report.ok && report.error) statusCell.append(el("p", "hint", report.error));
    } else {
      statusCell.append(el("span", "badge badge--muted", t("sourcePending")));
    }
    row.append(statusCell);
    row.append(el("td", "mono", report ? formatNumber(report.count) : "-"));
    nodes.sourceRows.append(row);
  }

  nodes.sourcesCount.textContent = t("sourceCount", [formatNumber(data.sources.length)]);
  const coreCount = data.sources.filter((source) => source.tier === "core").length;
  nodes.sourcesNote.textContent = t("sourcesNote", [formatNumber(coreCount)]);

  const extendedOn = Boolean(data.settings.tiers.extended);
  nodes.extendedBadge.textContent = extendedOn ? t("badgeOn") : t("badgeOff");
  nodes.extendedBadge.className = `badge badge--${extendedOn ? "safe" : "muted"}`;
  nodes.syncCoreResult.textContent = data.settings.sync.core && data.settings.sync.core.at
    ? t("lastRefresh", [formatRelative(data.settings.sync.core.at)])
    : "";
  nodes.syncExtendedResult.textContent = data.settings.sync.extended && data.settings.sync.extended.at
    ? t("lastRefresh", [formatRelative(data.settings.sync.extended.at)])
    : "";
}

function renderSettings(data) {
  const settings = data.settings;
  nodes.setEnabled.checked = Boolean(settings.enabled);
  nodes.setCore.checked = Boolean(settings.tiers.core);
  nodes.setExtended.checked = Boolean(settings.tiers.extended);
  nodes.setBlockedPage.checked = Boolean(settings.showBlockedPage);
  nodes.setWarnings.checked = Boolean(settings.warnings);
  nodes.setWebrtc.value = settings.webrtcPolicy || "default";
  nodes.setTheme.value = settings.theme || "system";
  nodes.setLanguage.value = settings.language || "system";
  nodes.webrtcNote.textContent = settings.webrtcPolicy === "default" ? t("webrtcNoteDefault") : t("webrtcNoteCustom");

  nodes.aboutVersion.textContent = t("versionLine", [data.version]);
  nodes.railVersion.textContent = `v${data.version}`;
  nodes.dataNote.textContent = t("dataNote", [formatNumber(data.events.length)]);
}

function render() {
  if (!state.data) return;
  const data = state.data;
  renderTheme(data.settings);
  setRailStatus(data.settings);
  renderOverview(data);
  renderCore();
  renderDomainList("allow");
  renderDomainList("custom");
  renderEvents();
  renderSources(data);
  renderSettings(data);
}

async function load() {
  if (state.loading) {
    state.reloadQueued = true;
    return;
  }
  state.loading = true;
  hideError();
  try {
    const result = await send({ type: "getDashboard" });
    if (!result || !result.ok) {
      showError(result && result.error ? result.error : t("panelReadFailed"));
      return;
    }
    state.data = result;
    render();
  } finally {
    state.loading = false;
    if (state.reloadQueued) {
      state.reloadQueued = false;
      await load();
    }
  }
}

async function applySetting(key, value) {
  const result = await send({ type: "setSetting", key, value });
  if (!result || !result.ok) {
    toast(result && result.error ? result.error : t("toastSettingFailed"), "error");
    await load();
    return false;
  }
  await load();
  return true;
}

async function syncTier(tier, button, resultNode) {
  const target = tier === "extended" ? "extended" : "core";
  setBusy(button, true, t("syncingButton"));
  resultNode.textContent = t("syncingSources");
  const result = await send({ type: "syncNow", tier: target });
  setBusy(button, false);
  if (!result || !result.ok) {
    resultNode.textContent = "";
    toast(result && result.error ? result.error : t("toastSyncFailed"), "error");
    return;
  }
  const sync = result.result || {};
  if (sync.allOk) {
    resultNode.textContent = t("syncResultAdded", [formatNumber(sync.count)]);
    toast(t("toastSyncAdded", [formatNumber(sync.count)]), "ok");
  } else if (sync.ok) {
    resultNode.textContent = t("syncResultPartial");
    toast(t("toastSyncPartial"), "error");
  } else {
    resultNode.textContent = t("syncResultFailed");
    toast(t("toastSyncNothing"), "error");
  }
  await load();
}

function download(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportData() {
  const result = await send({ type: "exportData" });
  if (!result || !result.ok) {
    toast(t("toastExportFailed"), "error");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  download(`anti-ip-logger-backup-${stamp}.json`, result);
  toast(t("toastExportDone"), "ok");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    let payload;
    try {
      payload = JSON.parse(String(reader.result));
    } catch {
      toast(t("toastImportInvalid"), "error");
      return;
    }
    const result = await send({ type: "importData", payload });
    if (!result || !result.ok) {
      toast(result && result.error ? result.error : t("toastImportFailed"), "error");
      return;
    }
    toast(t("toastImportDone"), "ok");
    await load();
  };
  reader.onerror = () => toast(t("toastImportReadFailed"), "error");
  reader.readAsText(file);
}

function bind() {
  for (const link of document.querySelectorAll("[data-route]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.route);
    });
  }

  window.addEventListener("hashchange", () => navigate(currentRoute(), false));

  nodes.syncButton.addEventListener("click", () => syncTier("core", nodes.syncButton, nodes.syncCoreResult));

  nodes.themeButton.addEventListener("click", async () => {
    const next = toggleTheme(resolvedTheme());
    applyTheme(next);
    renderTheme(state.data ? { ...state.data.settings, theme: next } : { theme: next });
    await applySetting("theme", next);
  });

  nodes.enabledToggle.addEventListener("change", async () => {
    const next = nodes.enabledToggle.checked;
    const ok = await applySetting("enabled", next);
    if (!ok) nodes.enabledToggle.checked = !next;
    toast(next ? t("toastProtectionOn") : t("toastProtectionOff"), "ok");
  });

  nodes.coreSearch.addEventListener("input", () => {
    state.coreQuery = nodes.coreSearch.value.trim();
    state.corePage = 1;
    renderCore();
  });

  nodes.coreCategory.addEventListener("change", () => {
    state.coreCategory = nodes.coreCategory.value;
    state.corePage = 1;
    renderCore();
  });

  nodes.coreMore.addEventListener("click", () => {
    state.corePage += 1;
    renderCore();
  });

  nodes.allowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = nodes.allowInput.value.trim();
    nodes.allowError.hidden = true;
    if (!value) {
      nodes.allowError.hidden = false;
      nodes.allowError.textContent = t("domainRequired");
      nodes.allowInput.focus();
      return;
    }
    const result = await send({ type: "allowDomain", domain: value });
    if (!result || !result.ok) {
      nodes.allowError.hidden = false;
      nodes.allowError.textContent = (result && result.error) || t("toastAddDomainFailed");
      return;
    }
    nodes.allowInput.value = "";
    toast(t("toastDomainAllowed", [result.domain]), "ok");
    await load();
  });

  nodes.customForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = nodes.customInput.value.trim();
    nodes.customError.hidden = true;
    if (!value) {
      nodes.customError.hidden = false;
      nodes.customError.textContent = t("domainRequired");
      nodes.customInput.focus();
      return;
    }
    const result = await send({ type: "addCustomDomain", domain: value });
    if (!result || !result.ok) {
      nodes.customError.hidden = false;
      nodes.customError.textContent = (result && result.error) || t("toastAddDomainFailed");
      return;
    }
    nodes.customInput.value = "";
    toast(t("toastDomainBlocked", [result.domain]), "ok");
    await load();
  });

  for (const list of [nodes.allowList, nodes.customList]) {
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-domain]");
      if (!button) return;
      const { kind, domain } = button.dataset;
      const message = kind === "allow" ? { type: "removeAllowedDomain", domain } : { type: "removeCustomDomain", domain };
      const result = await send(message);
      if (!result || !result.ok) {
        toast((result && result.error) || t("toastRemoveDomainFailed"), "error");
        return;
      }
      toast(t("toastDomainRemoved", [domain]), "ok");
      await load();
    });
  }

  nodes.eventsSearch.addEventListener("input", () => {
    state.eventsQuery = nodes.eventsSearch.value.trim();
    renderEvents();
  });

  nodes.eventsType.addEventListener("change", () => {
    state.eventsType = nodes.eventsType.value;
    renderEvents();
  });

  nodes.eventsClear.addEventListener("click", async () => {
    const result = await send({ type: "clearEvents" });
    if (!result || !result.ok) {
      toast(t("toastClearEventsFailed"), "error");
      return;
    }
    toast(t("toastClearEventsDone"), "ok");
    await load();
  });

  nodes.syncCore.addEventListener("click", () => syncTier("core", nodes.syncCore, nodes.syncCoreResult));
  nodes.syncExtended.addEventListener("click", () => syncTier("extended", nodes.syncExtended, nodes.syncExtendedResult));

  nodes.setEnabled.addEventListener("change", () => applySetting("enabled", nodes.setEnabled.checked));
  nodes.setCore.addEventListener("change", () => applySetting("tiers", { core: nodes.setCore.checked }));
  nodes.setExtended.addEventListener("change", () => applySetting("tiers", { extended: nodes.setExtended.checked }));
  nodes.setBlockedPage.addEventListener("change", () => applySetting("showBlockedPage", nodes.setBlockedPage.checked));
  nodes.setWarnings.addEventListener("change", () => applySetting("warnings", nodes.setWarnings.checked));
  nodes.setWebrtc.addEventListener("change", () => applySetting("webrtcPolicy", nodes.setWebrtc.value));
  nodes.setTheme.addEventListener("change", () => applySetting("theme", nodes.setTheme.value));
  nodes.setLanguage.addEventListener("change", async () => {
    await applySetting("language", nodes.setLanguage.value);
    window.location.reload();
  });

  nodes.replayTour.addEventListener("click", async () => {
    await send({ type: "openWelcome" });
  });

  nodes.updateDismiss.addEventListener("click", async () => {
    await send({ type: "dismissUpdate" });
    await load();
  });

  nodes.mascotCorner.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/supposedtobescruz" });
  });

  nodes.exportButton.addEventListener("click", exportData);
  nodes.importButton.addEventListener("click", () => nodes.importFile.click());
  nodes.importFile.addEventListener("change", () => {
    const file = nodes.importFile.files && nodes.importFile.files[0];
    if (file) importData(file);
    nodes.importFile.value = "";
  });

  nodes.resetButton.addEventListener("click", () => {
    nodes.resetConfirm.hidden = false;
    nodes.resetConfirmButton.focus();
  });

  nodes.resetCancel.addEventListener("click", () => {
    nodes.resetConfirm.hidden = true;
    nodes.resetButton.focus();
  });

  nodes.resetConfirmButton.addEventListener("click", async () => {
    setBusy(nodes.resetConfirmButton, true, t("resettingButton"));
    const result = await send({ type: "resetAll" });
    setBusy(nodes.resetConfirmButton, false);
    nodes.resetConfirm.hidden = true;
    if (!result || !result.ok) {
      toast(t("toastResetFailed"), "error");
      return;
    }
    toast(t("toastResetDone"), "ok");
    await load();
  });
}

initLanguage().then(() => {
  applyI18n();
  onThemeChange(syncThemeLabel);
  navigate(currentRoute(), false);
  bind();
  load();
});

if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings || changes.events || changes.stats || changes.remoteCache) load();
  });
}
