import test from "node:test";
import assert from "node:assert/strict";
import { hostMatchesDomain, isSameSite, matchDomain, registrableDomain } from "../lib/domains.js";

test("registrableDomain handles two-level suffixes", () => {
  assert.equal(registrableDomain("a.b.example.co.uk"), "example.co.uk");
  assert.equal(registrableDomain("example.com.tr"), "example.com.tr");
  assert.equal(registrableDomain("sub.example.com"), "example.com");
  assert.equal(registrableDomain("example.com."), "example.com");
});

test("hostMatchesDomain covers subdomains but not lookalikes", () => {
  assert.equal(hostMatchesDomain("a.example.com", "example.com"), true);
  assert.equal(hostMatchesDomain("example.com", "example.com"), true);
  assert.equal(hostMatchesDomain("notexample.com", "example.com"), false);
  assert.equal(hostMatchesDomain("example.com.evil.net", "example.com"), false);
});

test("matchDomain returns the longest matching entry", () => {
  const set = new Set(["example.com", "sub.example.com"]);
  assert.equal(matchDomain("sub.example.com", set), "sub.example.com");
  assert.equal(matchDomain("x.sub.example.com", set), "sub.example.com");
  assert.equal(matchDomain("other.net", set), null);
});

test("isSameSite compares registrable domains", () => {
  assert.equal(isSameSite("a.example.co.uk", "b.example.co.uk"), true);
  assert.equal(isSameSite("a.example.com", "b.example.net"), false);
});
