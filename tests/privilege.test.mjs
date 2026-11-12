import test from "node:test";
import assert from "node:assert/strict";
import { PRIVILEGED_MESSAGE_TYPES, requiresPrivilege, isExtensionPageSender } from "../lib/privilege.js";

const CURRENT_PRIVILEGED_TYPES = [
  "getState",
  "getPopup",
  "getDashboard",
  "getTabInfo",
  "getEvents",
  "checkUrl",
  "getBlockedTarget",
  "clearEvents",
  "setSetting",
  "pauseProtection",
  "resumeProtection",
  "syncNow",
  "allowOnce",
  "removeTabAllow",
  "panic",
  "restore",
  "resetAll",
  "importData",
  "exportData",
  "openWelcome",
  "dismissUpdate",
];

test("PRIVILEGED_MESSAGE_TYPES contains exactly the current privileged names", () => {
  assert.equal(PRIVILEGED_MESSAGE_TYPES.size, CURRENT_PRIVILEGED_TYPES.length);
  assert.deepEqual([...PRIVILEGED_MESSAGE_TYPES].sort(), [...CURRENT_PRIVILEGED_TYPES].sort());
});

test("requiresPrivilege is true for every current privileged message type", () => {
  for (const type of CURRENT_PRIVILEGED_TYPES) {
    assert.equal(requiresPrivilege(type), true, type);
  }
});

test("requiresPrivilege is false for unprivileged message types", () => {
  assert.equal(requiresPrivilege("reportSignals"), false);
  assert.equal(requiresPrivilege("getTabAllow"), false);
  assert.equal(requiresPrivilege("blockSite"), false);
  assert.equal(requiresPrivilege("addCustomDomain"), false);
  assert.equal(requiresPrivilege("openDashboard"), false);
  assert.equal(requiresPrivilege("reportBlock"), false);
});

test("requiresPrivilege is false for unknown and non-string types", () => {
  assert.equal(requiresPrivilege(""), false);
  assert.equal(requiresPrivilege("getstate"), false);
  assert.equal(requiresPrivilege(undefined), false);
  assert.equal(requiresPrivilege(null), false);
});

test("isExtensionPageSender accepts extension pages under the runtime base URL", () => {
  const base = "chrome-extension://abc123def456/";
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/dashboard/dashboard.html", base), true);
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/popup/popup.html", base), true);
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/", base), true);
});

test("isExtensionPageSender rejects http and https URLs", () => {
  const base = "chrome-extension://abc123def456/";
  assert.equal(isExtensionPageSender("https://abc123def456.example.com/dashboard/dashboard.html", base), false);
  assert.equal(isExtensionPageSender("http://example.com/", base), false);
  assert.equal(isExtensionPageSender("https://example.com/chrome-extension://abc123def456/", base), false);
});

test("isExtensionPageSender rejects non-string sender URLs", () => {
  const base = "chrome-extension://abc123def456/";
  assert.equal(isExtensionPageSender(null, base), false);
  assert.equal(isExtensionPageSender(undefined, base), false);
  assert.equal(isExtensionPageSender(42, base), false);
  assert.equal(isExtensionPageSender({}, base), false);
});

test("isExtensionPageSender rejects a string that merely contains the runtime URL", () => {
  const base = "chrome-extension://abc123def456/";
  assert.equal(isExtensionPageSender("https://evil.example.com/?next=chrome-extension://abc123def456/popup/popup.html", base), false);
  assert.equal(isExtensionPageSender("data:text/html,chrome-extension://abc123def456/", base), false);
});

test("isExtensionPageSender rejects a different extension id", () => {
  const base = "chrome-extension://abc123def456/";
  assert.equal(isExtensionPageSender("chrome-extension://zzz999zzz999/dashboard/dashboard.html", base), false);
});

test("isExtensionPageSender rejects an empty runtime base URL", () => {
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/popup/popup.html", ""), false);
  assert.equal(isExtensionPageSender("/popup/popup.html", ""), false);
});

test("isExtensionPageSender rejects non-string runtime base URLs", () => {
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/", null), false);
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/", undefined), false);
  assert.equal(isExtensionPageSender("chrome-extension://abc123def456/", 42), false);
});
