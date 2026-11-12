import test from "node:test";
import assert from "node:assert/strict";
import { applySessionRules, buildTabAllowRules, isOwnRule } from "../lib/dnr.js";
import { RULE_BASE } from "../lib/constants.js";

function fakeDeclarativeNetRequest({ dynamic = [], session = [] } = {}) {
  const state = {
    dynamic: dynamic.map((rule) => ({ ...rule })),
    session: session.map((rule) => ({ ...rule })),
    calls: [],
  };
  globalThis.chrome = {
    declarativeNetRequest: {
      async getDynamicRules() {
        return state.dynamic.map((rule) => ({ ...rule }));
      },
      async getSessionRules() {
        return state.session.map((rule) => ({ ...rule }));
      },
      async updateDynamicRules({ removeRuleIds = [], addRules = [] }) {
        state.calls.push({ target: "dynamic", removeRuleIds, addRules });
        state.dynamic = state.dynamic.filter((rule) => !removeRuleIds.includes(rule.id));
        state.dynamic.push(...addRules);
      },
      async updateSessionRules({ removeRuleIds = [], addRules = [] }) {
        state.calls.push({ target: "session", removeRuleIds, addRules });
        state.session = state.session.filter((rule) => !removeRuleIds.includes(rule.id));
        state.session.push(...addRules);
      },
    },
  };
  return state;
}

function ownRule(id, domain) {
  return {
    id,
    priority: 50,
    action: { type: "block" },
    condition: { requestDomains: [domain], resourceTypes: ["script"] },
  };
}

function foreignRule(id, domain) {
  return {
    id,
    priority: 1,
    action: { type: "block" },
    condition: { requestDomains: [domain], resourceTypes: ["script"] },
  };
}

test("isOwnRule recognizes extension rule id ranges and rejects foreign ids", () => {
  assert.equal(isOwnRule({ id: RULE_BASE.tabAllow }), true);
  assert.equal(isOwnRule({ id: RULE_BASE.tabAllow + 5 }), true);
  assert.equal(isOwnRule({ id: RULE_BASE.custom + 10 }), true);
  assert.equal(isOwnRule({ id: 42 }), false);
  assert.equal(isOwnRule({ id: RULE_BASE.tabAllow + 900_000 }), false);
});

test("applySessionRules adds and removes only own rule ids", async () => {
  const stale = ownRule(RULE_BASE.custom + 10, "stale.example.com");
  const foreign = foreignRule(42, "foreign.example.com");
  const state = fakeDeclarativeNetRequest({ session: [stale, foreign] });
  const tabRules = buildTabAllowRules({ "7": { domain: "allow.example.com", at: 1 } });

  const result = await applySessionRules(tabRules);

  assert.deepEqual(result, { removed: 1, added: 1 });
  const ids = state.session.map((rule) => rule.id);
  assert.ok(!ids.includes(stale.id), "own stale rule is removed");
  assert.ok(ids.includes(foreign.id), "foreign rule is kept");
  assert.ok(ids.includes(tabRules[0].id), "tab allow rule is added");
  const sessionCall = state.calls.find((call) => call.target === "session");
  assert.deepEqual(sessionCall.removeRuleIds, [stale.id]);
});

test("tab allow rules survive the session call", async () => {
  const state = fakeDeclarativeNetRequest();
  const tabRules = buildTabAllowRules({
    "11": { domain: "a.example.com", at: 1 },
    "23": { domain: "b.example.com", at: 2 },
  });

  await applySessionRules(tabRules);

  assert.equal(state.session.length, 2);
  assert.deepEqual(
    state.session.map((rule) => rule.id),
    tabRules.map((rule) => rule.id),
  );
  assert.deepEqual(
    state.session.map((rule) => rule.condition.tabIds),
    tabRules.map((rule) => rule.condition.tabIds),
  );
});

test("applySessionRules with an empty list clears own session rules and keeps foreign ones", async () => {
  const own = ownRule(RULE_BASE.tabAllow, "old.example.com");
  const foreign = foreignRule(99, "foreign.example.com");
  const state = fakeDeclarativeNetRequest({ session: [own, foreign] });

  const result = await applySessionRules([]);

  assert.deepEqual(result, { removed: 1, added: 0 });
  assert.deepEqual(state.session.map((rule) => rule.id), [foreign.id]);
});

test("the session call rejects nothing in normal shape", async () => {
  const state = fakeDeclarativeNetRequest();
  const tabRules = buildTabAllowRules({ "5": { domain: "once.example.com", at: 1 } });

  await assert.doesNotReject(() => applySessionRules(tabRules));

  const sessionCall = state.calls.find((call) => call.target === "session");
  assert.ok(sessionCall, "updateSessionRules was called");
  for (const rule of sessionCall.addRules) {
    assert.ok(Number.isFinite(rule.id));
    assert.ok(Number.isFinite(rule.priority));
    assert.equal(rule.action.type, "allow");
    assert.ok(Array.isArray(rule.condition.requestDomains) && rule.condition.requestDomains.length > 0);
    assert.ok(Array.isArray(rule.condition.tabIds) && rule.condition.tabIds.length > 0);
  }
  assert.equal(state.dynamic.length, 0, "session rules never go to the dynamic store");
});
