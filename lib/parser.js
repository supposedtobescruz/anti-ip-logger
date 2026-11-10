const MAX_HOST_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

const RESERVED_NAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
  "ip6-allnodes",
  "ip6-allrouters",
  "allhosts",
  "local",
  "test",
  "invalid",
  "example",
  "home",
  "lan",
  "internal",
  "intranet",
  "corp",
  "private",
]);

const RESERVED_SUFFIXES = [
  ".local",
  ".localhost",
  ".localdomain",
  ".internal",
  ".lan",
  ".home.arpa",
  ".test",
  ".example",
  ".invalid",
  ".arpa",
];

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isValidLabel(label) {
  if (!label || label.length > MAX_LABEL_LENGTH) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return /^[a-z0-9-]+$/i.test(label);
}

export function isBlockableHost(host) {
  if (!host || typeof host !== "string") return false;
  if (host.length > MAX_HOST_LENGTH) return false;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return false;
  if (/[/:*?#%\\@]/.test(host)) return false;
  if (/[^\x20-\x7e]/.test(host)) return false;

  const lower = host.toLowerCase();
  if (RESERVED_NAMES.has(lower)) return false;
  if (RESERVED_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return false;
  if (IPV4_RE.test(lower)) return false;

  const labels = lower.split(".");
  if (labels.length < 2) return false;
  if (!labels.every(isValidLabel)) return false;

  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) return false;
  if (tld.length < 2) return false;
  if (!/^([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(tld)) return false;

  return true;
}

export function normalizeHost(input) {
  if (typeof input !== "string") return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      return null;
    }
  } else {
    const at = value.lastIndexOf("@");
    if (at !== -1) value = value.slice(at + 1);
    value = value.replace(/:\d+$/, "");
    try {
      value = new URL(`http://${value}`).hostname;
    } catch {
      return null;
    }
  }

  value = value.replace(/\.$/, "").replace(/^www\./, "");
  if (!isBlockableHost(value)) return null;
  return value;
}

function stripComment(line) {
  const hashIndex = line.indexOf("#");
  const cleaned = hashIndex === -1 ? line : line.slice(0, hashIndex);
  return cleaned.trim();
}

function isCommentLine(line) {
  return (
    line.startsWith("!") ||
    line.startsWith(";") ||
    line.startsWith("//") ||
    line.startsWith("[") ||
    line.startsWith("<!--")
  );
}

function isPathScopedException(line) {
  const rest = line.slice(2);
  return rest.includes("/") || rest.includes("^") && rest.indexOf("^") < rest.length - 1;
}

function parseLine(rawLine) {
  if (rawLine.includes("##") || rawLine.includes("#@#") || rawLine.includes("#?#") || rawLine.includes("#$#")) {
    return { host: null, kind: "skip", reason: "cosmetic" };
  }

  const line = stripComment(rawLine);
  if (!line) return { host: null, kind: "skip", reason: "empty" };
  if (isCommentLine(line)) return { host: null, kind: "skip", reason: "comment" };

  if (line.startsWith("@@")) {
    if (isPathScopedException(line)) {
      return { host: null, kind: "skip", reason: "path-exception" };
    }
    const target = parseLine(line.slice(2));
    if (target.host) return { host: target.host, kind: "exception" };
    return { host: null, kind: "skip", reason: "bad-exception" };
  }

  if (line.startsWith("/") && line.lastIndexOf("/") > 0) {
    return { host: null, kind: "skip", reason: "regex" };
  }

  let candidate = line;

  const dollar = candidate.indexOf("$");
  if (dollar !== -1) {
    const options = candidate.slice(dollar + 1).toLowerCase();
    candidate = candidate.slice(0, dollar);
    const skipOptions = ["removeparam", "redirect", "csp", "rewrite", "replace", "generichide", "elemhide"];
    if (skipOptions.some((name) => options.startsWith(name) || options.includes(`,${name}`))) {
      return { host: null, kind: "skip", reason: "option-only" };
    }
  }

  const hostTokens = candidate.split(/[\s,]+/).filter(Boolean);
  if (hostTokens.length > 1) {
    const first = hostTokens[0];
    const looksLikeSinkhole =
      first === "0" ||
      first === "0.0.0.0" ||
      first === "127.0.0.1" ||
      first === "::" ||
      first === "::1" ||
      first === "255.255.255.255" ||
      first === "localhost";
    if (!looksLikeSinkhole) {
      return { host: null, kind: "skip", reason: "malformed" };
    }
    candidate = hostTokens[1];
  } else {
    candidate = hostTokens[0] || "";
  }

  candidate = candidate.replace(/^\|\|?/, "").replace(/^\|/, "");
  if (candidate.includes("^")) candidate = candidate.split("^")[0];
  candidate = candidate.split("/")[0];
  candidate = candidate.replace(/[+*=%?#@,]/g, "");

  const host = normalizeHost(candidate);
  if (!host) return { host: null, kind: "skip", reason: "invalid" };
  return { host, kind: "block" };
}

export function parseList(text) {
  const domains = new Set();
  const exceptions = new Set();
  const stats = { lines: 0, blocked: 0, exceptions: 0, skipped: 0 };
  const reasons = {};

  if (typeof text !== "string") return { domains: [], exceptions: [], stats };

  for (const rawLine of text.split(/\r?\n/)) {
    stats.lines += 1;
    const result = parseLine(rawLine);
    if (result.host) {
      if (result.kind === "exception") {
        exceptions.add(result.host);
        stats.exceptions += 1;
      } else {
        domains.add(result.host);
        stats.blocked += 1;
      }
    } else {
      stats.skipped += 1;
      reasons[result.reason] = (reasons[result.reason] || 0) + 1;
    }
  }

  for (const exception of exceptions) domains.delete(exception);

  return {
    domains: [...domains].sort(),
    exceptions: [...exceptions].sort(),
    stats: { ...stats, reasons },
  };
}

export function parseDnrJson(text) {
  const domains = new Set();
  const exceptions = new Set();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { domains: [], exceptions: [], stats: { lines: 0, blocked: 0, exceptions: 0, skipped: 0 } };
  }
  const rules = Array.isArray(parsed) ? parsed : parsed.rules || [];
  let lines = 0;
  let skipped = 0;
  for (const rule of rules) {
    lines += 1;
    const condition = rule && rule.condition ? rule.condition : {};
    const filters = [];
    if (typeof condition.urlFilter === "string") filters.push(condition.urlFilter);
    if (Array.isArray(condition.requestDomains)) filters.push(...condition.requestDomains);
    const actionType = rule && rule.action ? rule.action.type : "block";
    let added = false;
    for (const filter of filters) {
      const candidate = filter
        .replace(/^\|\|?/, "")
        .replace(/\/\*$/, "")
        .replace(/\^$/, "")
        .replace(/\/.*$/, "")
        .trim();
      const host = normalizeHost(candidate);
      if (!host) {
        skipped += 1;
        continue;
      }
      if (actionType === "allow") exceptions.add(host);
      else domains.add(host);
      added = true;
    }
    if (!added) skipped += 1;
  }
  for (const exception of exceptions) domains.delete(exception);
  return {
    domains: [...domains].sort(),
    exceptions: [...exceptions].sort(),
    stats: {
      lines,
      blocked: domains.size,
      exceptions: exceptions.size,
      skipped,
      reasons: {},
    },
  };
}

export function mergeLists(results) {
  const domains = new Set();
  const exceptions = new Set();
  for (const result of results) {
    for (const domain of result.domains) domains.add(domain);
    for (const domain of result.exceptions) exceptions.add(domain);
  }
  for (const domain of exceptions) domains.delete(domain);
  return {
    domains: [...domains].sort(),
    exceptions: [...exceptions].sort(),
  };
}

export function dedupeSubdomains(domains) {
  const set = new Set(domains);
  const sorted = [...set].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const kept = [];
  for (const domain of sorted) {
    const labels = domain.split(".");
    let covered = false;
    for (let i = 1; i < labels.length - 1; i += 1) {
      if (set.has(labels.slice(i).join("."))) {
        covered = true;
        break;
      }
    }
    if (!covered) kept.push(domain);
  }
  return kept.sort();
}
