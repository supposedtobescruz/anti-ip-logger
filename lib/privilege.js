export const PRIVILEGED_MESSAGE_TYPES = new Set([
  "getState",
  "getPopup",
  "getDashboard",
  "getTabInfo",
  "getEvents",
  "checkUrl",
  "getBlockedTarget",
  "clearEvents",
  "setSetting",
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
]);

export function requiresPrivilege(type) {
  return PRIVILEGED_MESSAGE_TYPES.has(type);
}

export function isExtensionPageSender(senderUrl, runtimeBaseUrl) {
  return (
    typeof senderUrl === "string" &&
    typeof runtimeBaseUrl === "string" &&
    runtimeBaseUrl !== "" &&
    senderUrl.startsWith(runtimeBaseUrl)
  );
}
