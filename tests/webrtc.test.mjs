import test from "node:test";
import assert from "node:assert/strict";
import { chooseWebRtcAction } from "../lib/dnr.js";

test("default policy with no marker skips", () => {
  assert.equal(chooseWebRtcAction({ policy: "default", last: "", currentValue: "disable_udp" }), "skip");
  assert.equal(chooseWebRtcAction({ policy: "default", last: "", currentValue: "default" }), "skip");
});

test("default policy with a non-default marker clears", () => {
  assert.equal(chooseWebRtcAction({ policy: "default", last: "disable_udp", currentValue: "disable_udp" }), "clear");
  assert.equal(chooseWebRtcAction({ policy: "default", last: "disable_non_proxied_udp", currentValue: "default" }), "clear");
});

test("default policy with marker \"default\" skips", () => {
  assert.equal(chooseWebRtcAction({ policy: "default", last: "default", currentValue: "default" }), "skip");
});

test("non-default policy skips when marker and browser agree", () => {
  assert.equal(
    chooseWebRtcAction({ policy: "disable_udp", last: "disable_udp", currentValue: "disable_udp" }),
    "skip",
  );
  assert.equal(
    chooseWebRtcAction({ policy: "disable_non_proxied_udp", last: "disable_non_proxied_udp", currentValue: "disable_non_proxied_udp" }),
    "skip",
  );
});

test("non-default policy applies when marker agrees but browser was reset", () => {
  assert.equal(
    chooseWebRtcAction({ policy: "disable_udp", last: "disable_udp", currentValue: "default" }),
    "apply",
  );
});

test("non-default policy applies when marker differs", () => {
  assert.equal(
    chooseWebRtcAction({ policy: "disable_udp", last: "", currentValue: "disable_udp" }),
    "apply",
  );
  assert.equal(
    chooseWebRtcAction({ policy: "disable_udp", last: "disable_non_proxied_udp", currentValue: "disable_udp" }),
    "apply",
  );
});

test("non-default policy applies when currentValue is missing", () => {
  assert.equal(chooseWebRtcAction({ policy: "disable_udp", last: "disable_udp" }), "apply");
  assert.equal(chooseWebRtcAction({ policy: "disable_udp", last: "disable_udp", currentValue: undefined }), "apply");
});

test("empty policy skips", () => {
  assert.equal(chooseWebRtcAction({ policy: "", last: "disable_udp", currentValue: "disable_udp" }), "skip");
  assert.equal(chooseWebRtcAction({ policy: "", last: "", currentValue: "" }), "skip");
});
