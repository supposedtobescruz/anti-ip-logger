import test from "node:test";
import assert from "node:assert/strict";
import { buildDynamicRuleSet, summarizeRules } from "../lib/rules.js";
import { DEFAULT_SETTINGS, MAX_DOMAINS_PER_RULE, PRIORITY, RULE_BASE } from "../lib/constants.js";

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

test("çekirdek alan adları 100'lük parçalara bölünür", () => {
  const domains = Array.from({ length: MAX_DOMAINS_PER_RULE + 20 }, (_, i) => `d${i}.example.com`);
  const rules = buildDynamicRuleSet(lists({ remoteCore: domains }), settings({ showBlockedPage: false }));
  const blockRules = rules.filter((rule) => rule.id >= RULE_BASE.remoteCore && rule.id < RULE_BASE.remoteCore + 900_000);
  assert.equal(blockRules.length, 2);
  assert.equal(blockRules[0].condition.requestDomains.length, MAX_DOMAINS_PER_RULE);
  assert.equal(blockRules[0].priority, PRIORITY.core);
  assert.deepEqual(blockRules[0].action, { type: "block" });
});

test("izin listesi engel kuralından çıkarılır ve allow kuralı eklenir", () => {
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

test("engel sayfası yönlendirmesi yalnızca ayar açıkken üretilir", () => {
  const on = buildDynamicRuleSet(lists({ packagedCore: ["grabify.link"] }), settings({ showBlockedPage: true }));
  const generated = on.filter((rule) => rule.action.type === "redirect");
  assert.equal(generated.length, 1);
  assert.equal(generated[0].priority, PRIORITY.blockedPage);
  assert.equal(generated[0].action.redirect.extensionPath, "/blocked/blocked.html");

  const off = buildDynamicRuleSet(lists({ packagedCore: ["grabify.link"] }), settings({ showBlockedPage: false }));
  assert.equal(off.filter((rule) => rule.action.type === "redirect").length, 0);
});

test("tehdit katmanı kapalıyken geniş liste kurala girmez", () => {
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

test("özel engeller çekirdek kuraldan yüksek öncelik taşır", () => {
  const rules = buildDynamicRuleSet(
    lists({ remoteCore: ["custom.example.com"] }),
    settings({ customBlocks: ["custom.example.com"], showBlockedPage: false }),
  );
  const custom = rules.filter((rule) => rule.priority === PRIORITY.custom);
  assert.equal(custom.length, 1);
  assert.ok(custom[0].priority > PRIORITY.core);
});

test("özet kural kimliklerini taban aralığına göre sayar", () => {
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
  assert.equal(summary.blockedPage, 1);
});
