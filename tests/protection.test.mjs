import test from "node:test";
import assert from "node:assert/strict";
import { PAUSE_MINUTES, isPaused, isProtectionActive, computePauseUntil } from "../lib/protection.js";

const NOW = 1_000_000;

test("PAUSE_MINUTES holds the two allowed durations", () => {
  assert.deepEqual(PAUSE_MINUTES, [15, 60]);
});

test("never paused when pauseUntil is 0", () => {
  assert.equal(isPaused({ enabled: true, pauseUntil: 0 }, NOW), false);
});

test("paused while pauseUntil is in the future", () => {
  assert.equal(isPaused({ enabled: true, pauseUntil: NOW + 1 }, NOW), true);
});

test("not paused once the deadline has passed", () => {
  assert.equal(isPaused({ enabled: true, pauseUntil: NOW }, NOW), false);
  assert.equal(isPaused({ enabled: true, pauseUntil: NOW - 1 }, NOW), false);
});

test("pauseUntil must be a finite number", () => {
  assert.equal(isPaused({ enabled: true, pauseUntil: Number.NaN }, NOW), false);
  assert.equal(isPaused({ enabled: true, pauseUntil: Number.POSITIVE_INFINITY }, NOW), false);
  assert.equal(isPaused({ enabled: true, pauseUntil: String(NOW + 1000) }, NOW), false);
  assert.equal(isPaused({ enabled: true }, NOW), false);
  assert.equal(isPaused(null, NOW), false);
});

test("protection active requires the master toggle on", () => {
  assert.equal(isProtectionActive({ enabled: true, pauseUntil: 0 }, NOW), true);
  assert.equal(isProtectionActive({ enabled: false, pauseUntil: 0 }, NOW), false);
  assert.equal(isProtectionActive({ enabled: "true", pauseUntil: 0 }, NOW), false);
  assert.equal(isProtectionActive(null, NOW), false);
});

test("protection inactive while paused, active again after expiry", () => {
  assert.equal(isProtectionActive({ enabled: true, pauseUntil: NOW + 1 }, NOW), false);
  assert.equal(isProtectionActive({ enabled: true, pauseUntil: NOW }, NOW), true);
});

test("computePauseUntil adds the allowed durations in milliseconds", () => {
  assert.equal(computePauseUntil(15, NOW), NOW + 15 * 60_000);
  assert.equal(computePauseUntil(60, NOW), NOW + 60 * 60_000);
});

test("computePauseUntil rejects invalid durations", () => {
  assert.equal(computePauseUntil(0, NOW), 0);
  assert.equal(computePauseUntil(30, NOW), 0);
  assert.equal(computePauseUntil(-15, NOW), 0);
  assert.equal(computePauseUntil("15", NOW), 0);
  assert.equal(computePauseUntil(Number.NaN, NOW), 0);
});
