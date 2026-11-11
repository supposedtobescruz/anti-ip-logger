import test from "node:test";
import assert from "node:assert/strict";
import {
  RESTORE_MODES,
  normalizeRestoreMode,
  normalizeBackupList,
  mergeLists,
  restoreLists,
} from "../lib/backup.js";
import { MAX_LIST_ENTRIES } from "../lib/constants.js";

test("RESTORE_MODES lists replace and merge", () => {
  assert.deepEqual(RESTORE_MODES, ["replace", "merge"]);
});

test("normalizeRestoreMode maps missing values to replace", () => {
  assert.equal(normalizeRestoreMode(undefined), "replace");
  assert.equal(normalizeRestoreMode(null), "replace");
  assert.equal(normalizeRestoreMode(""), "replace");
});

test("normalizeRestoreMode passes valid modes through", () => {
  assert.equal(normalizeRestoreMode("replace"), "replace");
  assert.equal(normalizeRestoreMode("merge"), "merge");
});

test("normalizeRestoreMode rejects invalid modes", () => {
  assert.equal(normalizeRestoreMode("REPLACE"), null);
  assert.equal(normalizeRestoreMode("merge "), null);
  assert.equal(normalizeRestoreMode("append"), null);
  assert.equal(normalizeRestoreMode(0), null);
  assert.equal(normalizeRestoreMode(false), null);
  assert.equal(normalizeRestoreMode({}), null);
});

test("normalizeBackupList returns null for non-array input", () => {
  assert.equal(normalizeBackupList(undefined), null);
  assert.equal(normalizeBackupList(null), null);
  assert.equal(normalizeBackupList("a.example.com"), null);
  assert.equal(normalizeBackupList(42), null);
  assert.equal(normalizeBackupList({ 0: "a.example.com" }), null);
});

test("normalizeBackupList normalizes, drops invalid entries, dedupes and sorts", () => {
  const input = [
    "AAA.Example.COM",
    "aaa.example.com",
    "www.aaa.example.com",
    "bbb.example.com.",
    "not a domain",
    "-bad-.example.com",
    "",
  ];
  assert.deepEqual(normalizeBackupList(input), ["aaa.example.com", "bbb.example.com"]);
});

test("normalizeBackupList strips scheme and keeps valid hosts", () => {
  assert.deepEqual(normalizeBackupList(["https://cdn.example.com/path?q=1"]), ["cdn.example.com"]);
});

test("normalizeBackupList caps the result at MAX_LIST_ENTRIES", () => {
  const input = Array.from({ length: MAX_LIST_ENTRIES + 25 }, (_, index) => `d${index}.example.com`);
  const result = normalizeBackupList(input);
  assert.equal(result.length, MAX_LIST_ENTRIES);
  assert.deepEqual(result, [...result].sort());
});

test("mergeLists unions, dedupes, sorts and caps", () => {
  const existing = ["b.example.com", "a.example.com", "c.example.com"];
  const incoming = ["c.example.com", "d.example.com"];
  assert.deepEqual(mergeLists(existing, incoming), ["a.example.com", "b.example.com", "c.example.com", "d.example.com"]);
});

test("mergeLists tolerates missing sides", () => {
  assert.deepEqual(mergeLists(undefined, ["b.example.com", "a.example.com"]), ["a.example.com", "b.example.com"]);
  assert.deepEqual(mergeLists(["b.example.com", "a.example.com"], null), ["a.example.com", "b.example.com"]);
  assert.deepEqual(mergeLists(undefined, null), []);
});

test("mergeLists caps the union at MAX_LIST_ENTRIES", () => {
  const existing = Array.from({ length: MAX_LIST_ENTRIES }, (_, index) => `a${String(index).padStart(5, "0")}.example.com`);
  const incoming = Array.from({ length: 10 }, (_, index) => `zz${index}.example.com`);
  const result = mergeLists(existing, incoming);
  assert.equal(result.length, MAX_LIST_ENTRIES);
  assert.deepEqual(result, [...result].sort());
});

test("restoreLists replace mode replaces both lists with normalized incoming values", () => {
  const current = { allowlist: ["keep.example.com"], customBlocks: ["keepblock.example.com"] };
  const incoming = { allowlist: ["B.Example.com", "a.example.com"], customBlocks: ["block.example.com"] };
  const result = restoreLists(current, incoming, "replace");
  assert.deepEqual(result, {
    allowlist: ["a.example.com", "b.example.com"],
    customBlocks: ["block.example.com"],
  });
});

test("restoreLists replace mode keeps current lists when incoming arrays are missing", () => {
  const current = { allowlist: ["keep.example.com"], customBlocks: ["keepblock.example.com"] };
  const result = restoreLists(current, {}, "replace");
  assert.deepEqual(result, {
    allowlist: ["keep.example.com"],
    customBlocks: ["keepblock.example.com"],
  });
});

test("restoreLists replace mode keeps current list when only one incoming array is missing", () => {
  const current = { allowlist: ["keep.example.com"], customBlocks: ["keepblock.example.com"] };
  const result = restoreLists(current, { customBlocks: ["new.example.com"] }, "replace");
  assert.deepEqual(result, {
    allowlist: ["keep.example.com"],
    customBlocks: ["new.example.com"],
  });
});

test("restoreLists replace mode keeps the current list reference when incoming is not an array", () => {
  const current = { allowlist: ["keep.example.com"], customBlocks: ["keepblock.example.com"] };
  const result = restoreLists(current, { allowlist: "nope", customBlocks: 7 }, "replace");
  assert.equal(result.allowlist, current.allowlist);
  assert.equal(result.customBlocks, current.customBlocks);
});

test("restoreLists merge mode unions current and incoming lists", () => {
  const current = { allowlist: ["b.example.com", "a.example.com"], customBlocks: ["two.example.com"] };
  const incoming = { allowlist: ["c.example.com", "a.example.com"], customBlocks: ["one.example.com", "two.example.com"] };
  const result = restoreLists(current, incoming, "merge");
  assert.deepEqual(result, {
    allowlist: ["a.example.com", "b.example.com", "c.example.com"],
    customBlocks: ["one.example.com", "two.example.com"],
  });
});

test("restoreLists merge mode with missing incoming arrays keeps the current lists", () => {
  const current = { allowlist: ["b.example.com", "a.example.com"], customBlocks: ["keep.example.com"] };
  const result = restoreLists(current, {}, "merge");
  assert.deepEqual(result, {
    allowlist: ["a.example.com", "b.example.com"],
    customBlocks: ["keep.example.com"],
  });
});

test("restoreLists merge mode dedupes and caps the union", () => {
  const current = Array.from({ length: MAX_LIST_ENTRIES }, (_, index) => `a${String(index).padStart(5, "0")}.example.com`);
  const incoming = { allowlist: ["zz0.example.com", "zz1.example.com"], customBlocks: [] };
  const result = restoreLists({ allowlist: current, customBlocks: [] }, incoming, "merge");
  assert.equal(result.allowlist.length, MAX_LIST_ENTRIES);
  assert.deepEqual(result.allowlist, [...result.allowlist].sort());
});

test("restoreLists ignores non-list settings and returns only the two lists", () => {
  const current = {
    allowlist: ["keep.example.com"],
    customBlocks: ["keepblock.example.com"],
    webrtcPolicy: "disable_udp",
    enabled: false,
  };
  const incoming = {
    allowlist: ["new.example.com"],
    customBlocks: ["newblock.example.com"],
    webrtcPolicy: "disable_non_proxied_udp",
    enabled: true,
    theme: "dark",
  };
  const result = restoreLists(current, incoming, "replace");
  assert.deepEqual(Object.keys(result).sort(), ["allowlist", "customBlocks"]);
  assert.deepEqual(result, {
    allowlist: ["new.example.com"],
    customBlocks: ["newblock.example.com"],
  });
});
