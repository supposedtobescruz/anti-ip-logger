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

function domainRules(domains, { base, priority, action, resourceTypes = RESOURCE_TYPES, tabIds = null, offset = 0 }) {
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
      id: base + offset + i,
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
    resourceTypes: ["main_frame"],
    action: { type: "redirect", redirect: { extensionPath: "/blocked/blocked.html" } },
  });
}

export function buildTabAllowRules(domains, options) {
  return domainRules(domains, { ...options, action: { type: "allow" } });
}

function domainsInRules(rules) {
  return rules.reduce((total, rule) => total + (rule.condition.requestDomains ? rule.condition.requestDomains.length : 0), 0);
}

function takeWithinBudget(rules, budget, used) {
  const room = Math.max(0, budget - used);
  if (rules.length <= room) return { kept: rules, dropped: [], used: used + rules.length };
  return { kept: rules.slice(0, room), dropped: rules.slice(room), used: used + room };
}

export function buildDynamicRuleSetDetailed(lists, settings, maxRules = MAX_DYNAMIC_RULES) {
  const allowSet = new Set(settings.allowlist || []);
  const coreEnabled = Boolean(settings.tiers.core);
  const custom = (settings.customBlocks || []).filter((domain) => !allowSet.has(domain));
  const remoteCore = coreEnabled ? (lists.remoteCore || []).filter((domain) => !allowSet.has(domain)) : [];
  const extended = settings.tiers.extended
    ? (lists.extended || []).filter((domain) => !allowSet.has(domain))
    : [];

  const allowRules = buildAllowRules(settings.allowlist || [], { base: RULE_BASE.allow, priority: PRIORITY.allow });

  // Fill order: allowlist (user trust) > custom blocks (user choice) > remote core
  // (the sync feed) > core redirects > extended blocks > extended redirects. Block
  // coverage is reserved before optional redirects, so a large threat list cannot
  // spend the whole budget on the cosmetic blocked page. No group is allowed past
  // maxRules; the dropped tails are reported, never thrown.
  const customBuilt = buildBlockRules(custom, { base: RULE_BASE.custom, priority: PRIORITY.custom });
  const customSplit = takeWithinBudget(customBuilt, Math.max(0, maxRules - allowRules.length), 0);
  const customRules = customSplit.kept;
  let used = allowRules.length + customRules.length;

  const remoteBuilt = buildBlockRules(remoteCore, { base: RULE_BASE.remoteCore, priority: PRIORITY.core });
  const remote = takeWithinBudget(remoteBuilt, maxRules, used);
  used = remote.used;

  const redirectDomains = new Set();
  if (settings.enabled && settings.showBlockedPage) {
    if (coreEnabled) {
      for (const domain of lists.packagedCore || []) {
        if (!allowSet.has(domain)) redirectDomains.add(domain);
      }
    }
    for (const domain of remoteCore) {
      if (!allowSet.has(domain)) redirectDomains.add(domain);
    }
    for (const domain of custom) {
      if (!allowSet.has(domain)) redirectDomains.add(domain);
    }
  }
  const redirectBuilt = redirectDomains.size > 0
    ? buildRedirectRules([...redirectDomains], { base: RULE_BASE.blockedPage, priority: PRIORITY.blockedPage })
    : [];
  const redirect = takeWithinBudget(redirectBuilt, maxRules, used);
  used = redirect.used;

  const extendedBuilt = settings.tiers.extended
    ? buildBlockRules(extended, { base: RULE_BASE.extended, priority: PRIORITY.extended })
    : [];
  const ext = takeWithinBudget(extendedBuilt, maxRules, used);
  used = ext.used;

  const extendedRedirectDomains = [];
  if (settings.enabled && settings.showBlockedPage && settings.tiers.extended) {
    for (const domain of extended) {
      if (!allowSet.has(domain)) extendedRedirectDomains.push(domain);
    }
  }
  const extendedRedirectBuilt = extendedRedirectDomains.length > 0
    ? buildRedirectRules(extendedRedirectDomains, {
        base: RULE_BASE.blockedPage,
        priority: PRIORITY.blockedPage,
        offset: redirect.kept.length,
      })
    : [];
  const extRedirect = takeWithinBudget(extendedRedirectBuilt, maxRules, used);

  const rules = [
    ...allowRules,
    ...customRules,
    ...remote.kept,
    ...redirect.kept,
    ...ext.kept,
    ...extRedirect.kept,
  ];

  return {
    rules,
    dropped: {
      customDomains: domainsInRules(customSplit.dropped),
      redirectDomains: domainsInRules(redirect.dropped) + domainsInRules(extRedirect.dropped),
      remoteCoreDomains: domainsInRules(remote.dropped),
      extendedDomains: domainsInRules(ext.dropped),
    },
    maxRules,
  };
}

export function buildDynamicRuleSet(lists, settings) {
  return buildDynamicRuleSetDetailed(lists, settings).rules;
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
