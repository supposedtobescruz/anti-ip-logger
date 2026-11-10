import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessRisk, describeVerdict, emptySignals, mergeSignals, verdictFor } from "../lib/risk.js";

test("no signal returns risk none", () => {
  const risk = assessRisk({ signals: emptySignals() });
  assert.equal(risk.level, "none");
  assert.equal(risk.score, 0);
  assert.deepEqual(risk.findings, []);
});

test("a known IP logger alone produces danger", () => {
  const risk = assessRisk({ signals: emptySignals(), knownLogger: true });
  assert.equal(risk.level, "danger");
  assert.equal(risk.findings[0].id, "known-logger");
});

test("WebRTC shared IP leak counts as danger", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["203.0.113.9"] } });
  assert.equal(risk.level, "danger");
  assert.ok(risk.score >= 45);
});

test("user interaction downgrades the auto-form finding", () => {
  const signals = { ...emptySignals(), autoForm: true };
  const withoutGesture = assessRisk({ signals, gesture: false });
  const withGesture = assessRisk({ signals, gesture: true });
  assert.equal(withoutGesture.level, "danger");
  assert.equal(withGesture.level, "none");
});

test("risk is none when protection is off", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["203.0.113.9"] }, protectionEnabled: false });
  assert.equal(risk.level, "none");
  assert.equal(risk.protectionEnabled, false);
});

test("mergeSignals merges lists and keeps counters monotonic", () => {
  const first = mergeSignals(emptySignals(), { webrtcPublic: ["1.1.1.1"], media: 2, hiddenPixels: ["https://a/p.gif"] });
  const second = mergeSignals(first, { webrtcPublic: ["1.1.1.1", "2.2.2.2"], media: 1, hiddenPixels: ["https://b/p.gif"] });
  assert.deepEqual(second.webrtcPublic, ["1.1.1.1", "2.2.2.2"]);
  assert.equal(second.media, 2);
  assert.equal(second.hiddenPixels.length, 2);
});

test("a single hidden pixel stays info and never banners", () => {
  const signals = { ...emptySignals(), hiddenPixels: ["https://tracker.example.com/p.gif"] };
  const risk = assessRisk({ signals });
  assert.equal(risk.level, "info");
  assert.equal(risk.banner, false);
});

test("a single meta refresh stays warn and never banners", () => {
  const signals = { ...emptySignals(), metaRefresh: ["example.com"] };
  const risk = assessRisk({ signals });
  assert.equal(risk.level, "warn");
  assert.equal(risk.banner, false);
});

test("two distinct warn categories open the banner", () => {
  const signals = { ...emptySignals(), metaRefresh: ["example.com"], hiddenFrames: ["https://hidden.example.net/frame"] };
  const risk = assessRisk({ signals });
  assert.equal(risk.level, "warn");
  assert.equal(risk.banner, true);
});

test("hidden frame is warn without gesture, never danger", () => {
  const signals = { ...emptySignals(), hiddenFrames: ["https://hidden.example.net/frame"] };
  const risk = assessRisk({ signals, gesture: false });
  assert.equal(risk.level, "warn");
});

test("danger level opens the banner", () => {
  const risk = assessRisk({ signals: emptySignals(), knownLogger: true });
  assert.equal(risk.banner, true);
});

test("early requests need at least five third party requests", () => {
  const four = assessRisk({ signals: { ...emptySignals(), preGestureRequests: 4 } });
  assert.equal(four.findings.find((finding) => finding.id === "early-requests"), undefined);
  const five = assessRisk({ signals: { ...emptySignals(), preGestureRequests: 5 } });
  assert.equal(five.findings.find((finding) => finding.id === "early-requests").id, "early-requests");
});

test("the sum of weak findings does not escalate to danger", () => {
  const signals = { ...emptySignals(), metaRefresh: ["example.com"], hiddenPixels: ["https://tracker.example.com/p.gif"], preGestureRequests: 5 };
  const risk = assessRisk({ signals });
  assert.equal(risk.level, "warn");
});

test("verdict order prioritizes allow, logger and risk", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["1.1.1.1"] } });
  assert.equal(verdictFor({ enabled: false, allowed: false, host: "a.com", knownLogger: true, risk }), "off");
  assert.equal(verdictFor({ enabled: true, allowed: true, host: "a.com", knownLogger: true, risk }), "allowed");
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "a.com", knownLogger: true, risk }), "logger");
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "a.com", knownLogger: false, risk }), "danger");
  const calm = assessRisk({ signals: emptySignals() });
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "", knownLogger: false, risk: calm }), "idle");
});

test("every verdict has localized text", () => {
  const en = JSON.parse(readFileSync(new URL("../_locales/en/messages.json", import.meta.url), "utf8"));
  const tEn = (key) => en[key] && en[key].message;
  const required = [
    "verdictOffLabel", "verdictOffHeadline", "verdictOffDetail",
    "verdictAllowedLabel", "verdictAllowedHeadline", "verdictAllowedDetail",
    "verdictLoggerLabel", "verdictLoggerHeadline", "verdictLoggerDetail",
    "verdictBlockedLabel", "verdictBlockedHeadline", "verdictBlockedDetail",
    "verdictDangerLabel", "verdictDangerHeadline", "verdictDangerDetail",
    "verdictWarnLabel", "verdictWarnHeadline", "verdictWarnDetail",
    "verdictInfoLabel", "verdictInfoHeadline", "verdictInfoDetail",
    "verdictCleanLabel", "verdictCleanHeadline", "verdictCleanDetail",
    "verdictIdleLabel", "verdictIdleHeadline", "verdictIdleDetail",
  ];
  for (const key of required) assert.ok(tEn(key) && tEn(key).length > 0, `missing ${key}`);
  for (const verdict of ["off", "allowed", "logger", "blocked", "danger", "warn", "info", "clean", "idle"]) {
    const copy = describeVerdict(verdict, tEn);
    assert.ok(copy.label.length > 0);
    assert.ok(copy.headline.length > 5);
    assert.ok(["muted", "info", "danger", "warn", "safe"].includes(copy.tone));
  }
});

test("translate is required for describeVerdict", () => {
  assert.throws(() => describeVerdict("idle"), /translate/);
});
