import { MAX_LIST_ENTRIES } from "./constants.js";
import { normalizeHost } from "./parser.js";

export const RESTORE_MODES = ["replace", "merge"];

const IMPORT_WEBRTC_POLICIES = ["default", "disable_non_proxied_udp"];
const IMPORT_THEMES = ["system", "light", "dark"];
const IMPORT_LANGUAGES = ["system", "en", "tr"];

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function validateImportSettings(settings) {
  if (!isPlainObject(settings)) return "settings";
  for (const key of ["enabled", "showBlockedPage", "warnings", "onboardingSeen"]) {
    if (settings[key] !== undefined && typeof settings[key] !== "boolean") return key;
  }
  if (settings.tiers !== undefined) {
    if (!isPlainObject(settings.tiers)) return "tiers";
    for (const key of ["core", "extended"]) {
      if (settings.tiers[key] !== undefined && typeof settings.tiers[key] !== "boolean") return "tiers";
    }
  }
  if (settings.webrtcPolicy !== undefined && !IMPORT_WEBRTC_POLICIES.includes(settings.webrtcPolicy)) return "webrtcPolicy";
  if (settings.theme !== undefined && !IMPORT_THEMES.includes(settings.theme)) return "theme";
  if (settings.language !== undefined && !IMPORT_LANGUAGES.includes(settings.language)) return "language";
  return null;
}

export function normalizeRestoreMode(value) {
  if (value === undefined || value === null || value === "") return "replace";
  if (RESTORE_MODES.includes(value)) return value;
  return null;
}

export function normalizeBackupList(value) {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(normalizeHost).filter(Boolean);
  return [...new Set(normalized)].sort().slice(0, MAX_LIST_ENTRIES);
}

export function mergeLists(existing, incoming) {
  return [...new Set([...(existing || []), ...(incoming || [])])].sort().slice(0, MAX_LIST_ENTRIES);
}

export function restoreLists(current, incoming, mode) {
  const currentSettings = current && typeof current === "object" ? current : {};
  const incomingSettings = incoming && typeof incoming === "object" ? incoming : {};
  const incomingAllowlist = normalizeBackupList(incomingSettings.allowlist);
  const incomingCustomBlocks = normalizeBackupList(incomingSettings.customBlocks);
  if (mode === "merge") {
    return {
      allowlist: mergeLists(currentSettings.allowlist, incomingAllowlist),
      customBlocks: mergeLists(currentSettings.customBlocks, incomingCustomBlocks),
    };
  }
  return {
    allowlist: incomingAllowlist === null ? currentSettings.allowlist : incomingAllowlist,
    customBlocks: incomingCustomBlocks === null ? currentSettings.customBlocks : incomingCustomBlocks,
  };
}
