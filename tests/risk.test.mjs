import test from "node:test";
import assert from "node:assert/strict";
import { assessRisk, describeVerdict, emptySignals, mergeSignals, verdictFor } from "../lib/risk.js";

test("sinyal yoksa risk none döner", () => {
  const risk = assessRisk({ signals: emptySignals() });
  assert.equal(risk.level, "none");
  assert.equal(risk.score, 0);
  assert.deepEqual(risk.findings, []);
});

test("bilinen IP logger tek başına danger üretir", () => {
  const risk = assessRisk({ signals: emptySignals(), knownLogger: true });
  assert.equal(risk.level, "danger");
  assert.equal(risk.findings[0].id, "known-logger");
});

test("WebRTC ortak IP sızıntısı danger sayılır", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["203.0.113.9"] } });
  assert.equal(risk.level, "danger");
  assert.ok(risk.score >= 45);
});

test("kullanıcı etkileşimi otomatik form bulgusunu düşürür", () => {
  const signals = { ...emptySignals(), autoForm: true };
  const withoutGesture = assessRisk({ signals, gesture: false });
  const withGesture = assessRisk({ signals, gesture: true });
  assert.equal(withoutGesture.level, "danger");
  assert.equal(withGesture.level, "none");
});

test("koruma kapalıyken risk none olur", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["203.0.113.9"] }, protectionEnabled: false });
  assert.equal(risk.level, "none");
  assert.equal(risk.protectionEnabled, false);
});

test("mergeSignals listeleri birleştirir, sayaçları monoton tutar", () => {
  const first = mergeSignals(emptySignals(), { webrtcPublic: ["1.1.1.1"], media: 2, hiddenPixels: ["https://a/p.gif"] });
  const second = mergeSignals(first, { webrtcPublic: ["1.1.1.1", "2.2.2.2"], media: 1, hiddenPixels: ["https://b/p.gif"] });
  assert.deepEqual(second.webrtcPublic, ["1.1.1.1", "2.2.2.2"]);
  assert.equal(second.media, 2);
  assert.equal(second.hiddenPixels.length, 2);
});

test("verdict sırası izin, logger ve riski doğru önceler", () => {
  const risk = assessRisk({ signals: { ...emptySignals(), webrtcPublic: ["1.1.1.1"] } });
  assert.equal(verdictFor({ enabled: false, allowed: false, host: "a.com", knownLogger: true, risk }), "off");
  assert.equal(verdictFor({ enabled: true, allowed: true, host: "a.com", knownLogger: true, risk }), "allowed");
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "a.com", knownLogger: true, risk }), "logger");
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "a.com", knownLogger: false, risk }), "danger");
  const calm = assessRisk({ signals: emptySignals() });
  assert.equal(verdictFor({ enabled: true, allowed: false, host: "", knownLogger: false, risk: calm }), "idle");
});

test("her verdict için Türkçe metin var", () => {
  for (const verdict of ["off", "allowed", "logger", "blocked", "danger", "warn", "info", "clean", "idle"]) {
    const copy = describeVerdict(verdict);
    assert.ok(copy.headline.length > 5);
    assert.ok(["muted", "info", "danger", "warn", "safe"].includes(copy.tone));
  }
});
