import test from "node:test";
import assert from "node:assert/strict";
import { buildDynamicRuleSet, buildDynamicRuleSetDetailed, summarizeRules } from "../lib/rules.js";
import { DEFAULT_SETTINGS, MAX_DOMAINS_PER_RULE, MAX_DYNAMIC_RULES, PRIORITY, RULE_BASE } from "../lib/constants.js";

function settings(overrides = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    tiers: { ...DEFAULT_SETTINGS.tiers, ...(overrides.tiers || {}) },
    allowlist: overrides.allowlist || [],
    customBlocks: overrides.customBlocks || [],
  };
}

function lists(overrides = {}) {
  return {
    packagedCore: overrides.packagedCore || [],
    remoteCore: overrides.remoteCore || [],
    extended: overrides.extended || [],
  };
}

test("core domains are split into chunks of 100", () => {
  const domains = Array.from({ length: MAX_DOMAINS_PER_RULE + 20 }, (_, i) => `d${i}.example.com`);
  const rules = buildDynamicRuleSet(lists({ remoteCore: domains }), settings({ showBlockedPage: false }));
  const blockRules = rules.filter((rule) => rule.id >= RULE_BASE.remoteCore && rule.id < RULE_BASE.remoteCore + 900_000);
  assert.equal(blockRules.length, 2);
  assert.equal(blockRules[0].condition.requestDomains.length, MAX_DOMAINS_PER_RULE);
  assert.equal(blockRules[0].priority, PRIORITY.core);
  assert.deepEqual(blockRules[0].action, { type: "block" });
});

test("the allowlist is removed from block rules and gets an allow rule", () => {
  const rules = buildDynamicRuleSet(
    lists({ remoteCore: ["a.example.com", "b.example.com"] }),
    settings({ allowlist: ["b.example.com"], showBlockedPage: false }),
  );
  const coreBlocks = rules.filter((rule) => rule.priority === PRIORITY.core);
  const allowRules = rules.filter((rule) => rule.priority === PRIORITY.allow);
  const blockedDomains = coreBlocks.flatMap((rule) => rule.condition.requestDomains);
  assert.deepEqual(blockedDomains, ["a.example.com"]);
  assert.deepEqual(allowRules[0].condition.requestDomains, ["b.example.com"]);
});

test("blocked page redirect is only emitted when the setting is on", () => {
  const on = buildDynamicRuleSet(lists({ packagedCore: ["grabify.link"] }), settings({ showBlockedPage: true }));
  const generated = on.filter((rule) => rule.action.type === "redirect");
  assert.equal(generated.length, 1);
  assert.equal(generated[0].priority, PRIORITY.blockedPage);
  assert.equal(generated[0].action.redirect.extensionPath, "/blocked/blocked.html");

  const off = buildDynamicRuleSet(lists({ packagedCore: ["grabify.link"] }), settings({ showBlockedPage: false }));
  assert.equal(off.filter((rule) => rule.action.type === "redirect").length, 0);
});

test("the threat tier produces no rules when disabled", () => {
  const off = buildDynamicRuleSet(
    lists({ extended: ["threat.example.com"] }),
    settings({ tiers: { core: true, extended: false } }),
  );
  assert.equal(off.filter((rule) => rule.priority === PRIORITY.extended).length, 0);

  const on = buildDynamicRuleSet(
    lists({ extended: ["threat.example.com"] }),
    settings({ tiers: { core: true, extended: true } }),
  );
  assert.equal(on.filter((rule) => rule.priority === PRIORITY.extended).length, 1);
});

test("custom blocks outrank the core rule", () => {
  const rules = buildDynamicRuleSet(
    lists({ remoteCore: ["custom.example.com"] }),
    settings({ customBlocks: ["custom.example.com"], showBlockedPage: false }),
  );
  const custom = rules.filter((rule) => rule.priority === PRIORITY.custom);
  assert.equal(custom.length, 1);
  assert.ok(custom[0].priority > PRIORITY.core);
});

test("detailed builder clips to a small budget without throwing", () => {
  const remoteCore = Array.from({ length: 40 * MAX_DOMAINS_PER_RULE }, (_, i) => `d${i}.example.com`);
  const deep = buildDynamicRuleSetDetailed(
    lists({ packagedCore: ["packaged.example.com"], remoteCore, extended: ["threat-1.example.com"] }),
    settings({
      allowlist: ["keep.example.com"],
      customBlocks: ["mine.example.com"],
      tiers: { core: true, extended: true },
      showBlockedPage: true,
    }),
    12,
  );
  assert.equal(deep.rules.length, 12);
  assert.equal(deep.dropped.remoteCoreDomains, 3000);
  assert.equal(deep.dropped.redirectDomains, 4003);
  assert.equal(deep.dropped.extendedDomains, 1);
  const allowRule = deep.rules.find((rule) => rule.priority === PRIORITY.allow);
  assert.ok(allowRule, "allow rule is always kept");
  const customRule = deep.rules.find((rule) => rule.priority === PRIORITY.custom);
  assert.ok(customRule, "custom rule is kept when it fits");
});

test("under the budget the detailed builder drops nothing", () => {
  const deep = buildDynamicRuleSetDetailed(
    lists({ packagedCore: ["packaged.example.com"], remoteCore: ["b.com"], extended: ["c.com"] }),
    settings({ allowlist: ["keep.example.com"], customBlocks: ["mine.example.com"], tiers: { core: true, extended: true } }),
    MAX_DYNAMIC_RULES,
  );
  const total = deep.dropped.customDomains + deep.dropped.redirectDomains + deep.dropped.remoteCoreDomains + deep.dropped.extendedDomains;
  assert.equal(total, 0);
});

test("summary counts rule identities by base range", () => {
  const rules = buildDynamicRuleSet(
    lists({ packagedCore: ["a.com"], remoteCore: ["b.com"], extended: ["c.com"] }),
    settings({ allowlist: ["d.com"], customBlocks: ["e.com"], tiers: { core: true, extended: true } }),
  );
  const summary = summarizeRules(rules);
  assert.equal(summary.total, rules.length);
  assert.equal(summary.remoteCore, 1);
  assert.equal(summary.allow, 1);
  assert.equal(summary.custom, 1);
  assert.equal(summary.extended, 1);
  assert.equal(summary.blockedPage, 2);
});

test("a disabled core tier removes remote core blocks and redirects", () => {
  const rules = buildDynamicRuleSet(
    lists({ packagedCore: ["packaged.example.com"], remoteCore: ["remote.example.com"] }),
    settings({ tiers: { core: false, extended: false }, showBlockedPage: true }),
  );
  assert.equal(rules.filter((rule) => rule.priority === PRIORITY.core).length, 0);
  assert.equal(rules.filter((rule) => rule.action.type === "redirect").length, 0);
});

test("threat block rules are reserved before threat redirect rules", () => {
  const extended = Array.from({ length: 300 }, (_, i) => `t${i}.example.net`);
  const deep = buildDynamicRuleSetDetailed(
    lists({ extended }),
    settings({ tiers: { core: true, extended: true }, showBlockedPage: true }),
    5,
  );
  const summary = summarizeRules(deep.rules);
  assert.equal(summary.extended, 3);
  assert.equal(summary.blockedPage, 2);
  assert.equal(deep.dropped.extendedDomains, 0);
  assert.equal(deep.dropped.redirectDomains, 100);
});
