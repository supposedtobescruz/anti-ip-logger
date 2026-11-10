import { send, setBusy, toast } from "../assets/ui.js";
import { t, applyI18n, initLanguage } from "../assets/i18n.js";

const nodes = {
  sheet: document.getElementById("sheet"),
  caseNumber: document.getElementById("case-number"),
  stamp: document.getElementById("stamp"),
  title: document.getElementById("title"),
  lead: document.getElementById("lead"),
  target: document.getElementById("target-url"),
  meta: document.getElementById("target-meta"),
  allowTab: document.getElementById("allow-tab"),
  allowSite: document.getElementById("allow-site"),
  goBack: document.getElementById("go-back"),
  feedback: document.getElementById("feedback"),
  fineprint: document.getElementById("fineprint"),
};

const CATEGORY_KEYS = {
  grabify: "categoryGrabifyLong",
  iplogger: "categoryIploggerLong",
  other: "categoryOtherLong",
  tracker: "categoryTrackerLong",
  threat: "categoryThreatLong",
  custom: "categoryCustomLong",
};

let target = "";
let host = "";
let busy = false;

function setFeedback(message, tone) {
  nodes.feedback.textContent = message;
  if (tone) nodes.feedback.dataset.tone = tone;
  else delete nodes.feedback.dataset.tone;
}

function caseNumberFor(date) {
  const parts = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")];
  const time = [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")];
  return t("blockedCaseNumber", [parts.join("-"), time.join(":")]);
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderTarget() {
  if (!target) {
    nodes.stamp.textContent = t("blockedStamp");
    nodes.title.textContent = t("blockedUnreadableTitle");
    nodes.lead.textContent = t("blockedUnreadableLead");
    nodes.target.textContent = t("blockedUnknownUrl");
    nodes.meta.textContent = "";
    nodes.allowTab.disabled = true;
    nodes.allowSite.disabled = true;
    return;
  }

  nodes.target.textContent = target;
  nodes.target.title = target;
  nodes.allowTab.disabled = false;
  nodes.allowSite.disabled = false;

  nodes.lead.textContent = t("blockedPageLead");
}

async function describeHost() {
  if (!host) return;
  const result = await send({ type: "checkUrl", url: host });
  if (!result || !result.ok) {
    nodes.meta.textContent = "";
    return;
  }
  const known = result.known || {};
  const parts = [];
  if (known.category && CATEGORY_KEYS[known.category]) parts.push(t(CATEGORY_KEYS[known.category]));
  if (known.confidence === "confirmed") parts.push(t("confidenceConfirmedDetail"));
  else if (known.confidence === "single") parts.push(t("confidenceSingleDetail"));
  if (known.origin === "remote") parts.push(t("originRemote"));
  if (!result.wouldBlock && result.allowed) parts.push(t("originAllowlist"));
  nodes.meta.textContent = parts.length > 0 ? parts.join(" · ") : t("knownOnList");
}

async function init() {
  nodes.caseNumber.textContent = caseNumberFor(new Date());
  nodes.sheet.setAttribute("aria-busy", "true");

  const pending = await send({ type: "getBlockedTarget" });
  target = pending && pending.ok ? pending.target : "";
  host = hostFromUrl(target);
  renderTarget();

  if (target) {
    const reported = await send({ type: "reportBlock", url: target, host, reason: t("eventNavBlocked") });
    if (!reported || !reported.ok) {
      setFeedback(t("blockedRecordFailed"), "error");
    }
    await describeHost();
    nodes.fineprint.textContent = t("blockedFineprint");
  }

  nodes.sheet.setAttribute("aria-busy", "false");
  if (target) nodes.allowTab.focus();
}

async function decide(message, successText) {
  if (busy || !target) return;
  busy = true;
  setBusy(nodes.allowTab, true, t("allowingButton"));
  setBusy(nodes.allowSite, true, t("allowingButton"));
  setFeedback("");
  const result = await send(message);
  busy = false;
  setBusy(nodes.allowTab, false);
  setBusy(nodes.allowSite, false);
  if (!result || !result.ok) {
    const text = (result && result.error) || t("blockedAllowFailed");
    setFeedback(text, "error");
    toast(text, "error");
    return;
  }
  setFeedback(successText);
  location.replace(target);
}

nodes.allowTab.addEventListener("click", () => {
  if (!host) return;
  decide({ type: "allowOnce", domain: host }, t("blockedAllowTabDone"));
});

nodes.allowSite.addEventListener("click", () => {
  if (!host) return;
  decide({ type: "allowDomain", domain: host }, t("blockedAllowSiteDone"));
});

nodes.goBack.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "../dashboard/dashboard.html#lists";
});

initLanguage().then(() => {
  applyI18n();
  init().catch((error) => {
    nodes.sheet.setAttribute("aria-busy", "false");
    setFeedback(error instanceof Error ? error.message : String(error), "error");
  });
});
