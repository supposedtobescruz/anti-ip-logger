import { MAX_LIST_ENTRIES } from "./constants.js";
import { normalizeHost } from "./parser.js";

export const RESTORE_MODES = ["replace", "merge"];

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
