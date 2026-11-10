import {
  RESOURCE_TYPES,
  PRIORITY,
  RULE_BASE,
  BASE_SPAN,
  MAX_DYNAMIC_RULES,
} from "./constants.js";

let applyQueue = Promise.resolve();

function serialize(task) {
  const next = applyQueue.then(task, task);
  applyQueue = next.catch(() => {});
  return next;
}

export function isOwnRule(rule) {
  return Object.values(RULE_BASE).some((base) => rule.id >= base && rule.id < base + BASE_SPAN);
}

export async function getDynamicRules() {
  return chrome.declarativeNetRequest.getDynamicRules();
}

export async function applyDynamicRules(rules) {
  return serialize(async () => {
    if (rules.length > MAX_DYNAMIC_RULES) {
      throw new Error(`Dynamic rule limit exceeded: ${rules.length} > ${MAX_DYNAMIC_RULES}`);
    }
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.filter(isOwnRule).map((rule) => rule.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
    return { removed: removeRuleIds.length, added: rules.length };
  });
}

export async function applyStaticRuleset(enabled) {
  const current = await chrome.declarativeNetRequest.getEnabledRulesets();
  if (enabled && !current.includes("core")) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ["core"] });
  }
  if (!enabled && current.includes("core")) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ["core"] });
  }
  return { enabled };
}

export async function applyWebRtcPolicy(policy) {
  if (!chrome.privacy || !chrome.privacy.network || !chrome.privacy.network.webRTCIPHandlingPolicy) {
    return { ok: false, reason: "privacy-api-unavailable" };
  }
  const setting = chrome.privacy.network.webRTCIPHandlingPolicy;
  const current = await setting.get({});
  if (current.levelOfControl === "not_controllable") {
    return { ok: false, reason: "not-controllable" };
  }
  if (policy === "default") {
    await setting.clear({});
    return { ok: true, value: current.value };
  }
  await setting.set({ value: policy });
  return { ok: true, value: policy };
}

export function buildTabAllowRules(tabAllows) {
  const rules = [];
  let index = 0;
  for (const [tabIdText, value] of Object.entries(tabAllows || {})) {
    const tabId = Number(tabIdText);
    if (!Number.isFinite(tabId) || !value || !value.domain) continue;
    rules.push({
      id: RULE_BASE.tabAllow + index,
      priority: PRIORITY.tabAllow,
      action: { type: "allow" },
      condition: {
        requestDomains: [value.domain],
        resourceTypes: RESOURCE_TYPES,
        tabIds: [tabId],
      },
    });
    index += 1;
  }
  return rules;
}

export async function dnrStatus() {
  const [dynamicRules, enabledRulesets] = await Promise.all([
    chrome.declarativeNetRequest.getDynamicRules(),
    chrome.declarativeNetRequest.getEnabledRulesets(),
  ]);
  return {
    dynamicRules: dynamicRules.length,
    staticRulesetEnabled: enabledRulesets.includes("core"),
    maxDynamicRules: MAX_DYNAMIC_RULES,
  };
}

export function setActionBadge(tabId, text, color = "#a51f1f") {
  const options = tabId ? { tabId } : {};
  chrome.action.setBadgeText({ ...options, text: text || "" }).catch(() => {});
  if (text) chrome.action.setBadgeBackgroundColor({ ...options, color }).catch(() => {});
}
