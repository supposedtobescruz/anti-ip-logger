import {
  RESOURCE_TYPES,
  MAX_DOMAINS_PER_RULE,
  MAX_DYNAMIC_RULES,
  BASE_SPAN,
  RULE_BASE,
  PRIORITY,
} from "./constants.js";

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function domainRules(domains, { base, priority, action, resourceTypes = RESOURCE_TYPES, tabIds = null }) {
  const unique = [...new Set(domains)].sort();
  if (unique.length === 0) return [];
  const rules = [];
  const batches = chunk(unique, MAX_DOMAINS_PER_RULE);
  for (let i = 0; i < batches.length; i += 1) {
    const condition = {
      requestDomains: batches[i],
      resourceTypes,
    };
    if (Array.isArray(tabIds) && tabIds.length > 0) condition.tabIds = tabIds;
    rules.push({
      id: base + i,
      priority,
      action: typeof action === "string" ? { type: action } : action,
      condition,
    });
  }
  return rules;
}

export function buildBlockRules(domains, options) {
  return domainRules(domains, { ...options, action: { type: "block" } });
}

export function buildAllowRules(domains, options) {
  return domainRules(domains, { ...options, action: { type: "allow" } });
}

export function buildRedirectRules(domains, options) {
  return domainRules(domains, {
    ...options,
    resourceTypes: ["main_frame", "sub_frame"],
    action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked.html" } },
  });
}

export function buildTabAllowRules(domains, options) {
  return domainRules(domains, { ...options, action: { type: "allow" } });
}

export function buildDynamicRuleSet(lists, settings) {
  const allowSet = new Set(settings.allowlist || []);
  const custom = (settings.customBlocks || []).filter((domain) => !allowSet.has(domain));
  const remoteCore = (lists.remoteCore || []).filter((domain) => !allowSet.has(domain));
  const extended = settings.tiers.extended
    ? (lists.extended || []).filter((domain) => !allowSet.has(domain))
    : [];

  const rules = [];
  rules.push(...buildBlockRules(remoteCore, { base: RULE_BASE.remoteCore, priority: PRIORITY.core }));
  rules.push(...buildBlockRules(extended, { base: RULE_BASE.extended, priority: PRIORITY.extended }));
  rules.push(...buildBlockRules(custom, { base: RULE_BASE.custom, priority: PRIORITY.custom }));

  if (settings.enabled && settings.showBlockedPage) {
    const redirectDomains = new Set();
    if (settings.tiers.core) {
      for (const domain of lists.packagedCore || []) redirectDomains.add(domain);
    }
    for (const domain of remoteCore) redirectDomains.add(domain);
    for (const domain of custom) redirectDomains.add(domain);
    for (const domain of extended) redirectDomains.add(domain);
    for (const domain of allowSet) redirectDomains.delete(domain);
    rules.push(...buildRedirectRules([...redirectDomains], { base: RULE_BASE.blockedPage, priority: PRIORITY.blockedPage }));
  }

  rules.push(...buildAllowRules(settings.allowlist || [], { base: RULE_BASE.allow, priority: PRIORITY.allow }));

  if (rules.length > MAX_DYNAMIC_RULES) {
    throw new Error(`Dynamic rule limit exceeded: ${rules.length} > ${MAX_DYNAMIC_RULES}`);
  }
  return rules;
}

export function ruleIdsInBase(rule) {
  for (const [name, base] of Object.entries(RULE_BASE)) {
    if (rule.id >= base && rule.id < base + BASE_SPAN) return name;
  }
  return null;
}

export function summarizeRules(rules) {
  const summary = {
    total: rules.length,
    remoteCore: 0,
    blockedPage: 0,
    custom: 0,
    allow: 0,
    extended: 0,
    tabAllow: 0,
  };
  for (const rule of rules) {
    const base = ruleIdsInBase(rule);
    if (base) summary[base] += 1;
  }
  return summary;
}
