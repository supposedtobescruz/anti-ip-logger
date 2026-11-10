import test from "node:test";
import assert from "node:assert/strict";
import { dedupeSubdomains, mergeLists, normalizeHost, parseDnrJson, parseList } from "../lib/parser.js";

test("normalizeHost kabul edilen girdileri sadeleştirir", () => {
  assert.equal(normalizeHost("HTTPS://WWW.Example.COM/path?x=1"), "example.com");
  assert.equal(normalizeHost("example.com:8443"), "example.com");
  assert.equal(normalizeHost("  grabify.link.  "), "grabify.link");
  assert.equal(normalizeHost("user:pass@iplogger.org/x"), "iplogger.org");
});

test("normalizeHost yerel ve geçersiz adları reddeder", () => {
  assert.equal(normalizeHost("localhost"), null);
  assert.equal(normalizeHost("127.0.0.1"), null);
  assert.equal(normalizeHost("router.local"), null);
  assert.equal(normalizeHost("http://[::1]/"), null);
  assert.equal(normalizeHost("tek-kelime"), null);
  assert.equal(normalizeHost("bad..domain.com"), null);
  assert.equal(normalizeHost(""), null);
  assert.equal(normalizeHost(null), null);
});

test("parseList hosts ve düz liste satırlarını okur", () => {
  const text = [
    "# yorum",
    "0.0.0.0 ads.example.com",
    "127.0.0.1 tracker.example.net",
    "plain.example.org",
    "! adblock yorumu",
    "||slash.example.com^",
  ].join("\n");
  const parsed = parseList(text);
  assert.deepEqual(parsed.domains, ["ads.example.com", "plain.example.org", "slash.example.com", "tracker.example.net"]);
  assert.equal(parsed.stats.blocked, 4);
});

test("parseList adblock istisnalarını ayırır", () => {
  const parsed = parseList("@@||example.com^\nexample.com\n||blocked.example.net^");
  assert.deepEqual(parsed.exceptions, ["example.com"]);
  assert.deepEqual(parsed.domains, ["blocked.example.net"]);
});

test("parseList kozmetik ve yol kapsamlı kuralları atlar", () => {
  const parsed = parseList("example.com##.ad\nexample.com##+js(nowebrtc)\n@@||example.com/path$xhr");
  assert.equal(parsed.domains.length, 0);
  assert.equal(parsed.stats.skipped, 3);
});

test("parseDnrJson urlFilter ve requestDomains alanlarını okur", () => {
  const text = JSON.stringify([
    { id: 1, action: { type: "block" }, condition: { urlFilter: "||grabify.link/*" } },
    { id: 2, action: { type: "block" }, condition: { requestDomains: ["iplogger.org"] } },
    { id: 3, action: { type: "allow" }, condition: { requestDomains: ["example.com"] } },
  ]);
  const parsed = parseDnrJson(text);
  assert.deepEqual(parsed.domains, ["grabify.link", "iplogger.org"]);
  assert.deepEqual(parsed.exceptions, ["example.com"]);
});

test("parseDnrJson bozuk JSON için hata fırlatır", () => {
  assert.throws(() => parseDnrJson("{bozuk"), /Invalid DNR JSON/);
});

test("mergeLists istisnaları engel listesinden çıkarır", () => {
  const merged = mergeLists([
    { domains: ["a.com", "b.com"], exceptions: [] },
    { domains: ["b.com", "c.com"], exceptions: ["c.com"] },
  ]);
  assert.deepEqual(merged.domains, ["a.com", "b.com"]);
  assert.deepEqual(merged.exceptions, ["c.com"]);
});

test("dedupeSubdomains üst alan adı varken alt alan adını atar", () => {
  assert.deepEqual(dedupeSubdomains(["sub.example.com", "example.com", "other.net"]), ["example.com", "other.net"]);
  assert.deepEqual(dedupeSubdomains(["a.example.com", "b.example.com"]), ["a.example.com", "b.example.com"]);
});
