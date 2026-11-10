import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseList, parseDnrJson, dedupeSubdomains, normalizeHost } from "../lib/parser.js";
import { RESOURCE_TYPES, MAX_DOMAINS_PER_RULE, MAX_STATIC_RULES_PER_RULESET } from "../lib/constants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const RULES = join(ROOT, "rules");
const ARGS = new Set(process.argv.slice(2));
const OFFLINE = ARGS.has("--offline");
const CHECK = ARGS.has("--check");
const ALLOW_PARTIAL = ARGS.has("--allow-partial") || OFFLINE;
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 12 * 1024 * 1024;
const CATEGORY_RANK = { grabify: 0, iplogger: 1, other: 2, tracker: 3, threat: 4 };

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (CHECK) {
    if (!existsSync(path)) return { changed: true, path };
    const current = await readFile(path, "utf8");
    return { changed: current !== text, path };
  }
  const current = existsSync(path) ? await readFile(path, "utf8") : null;
  if (current === text) return { changed: false, path };
  await writeFile(path, text, "utf8");
  return { changed: true, path };
}

async function fetchText(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "anti-ip-logger/2.0 (+https://github.com/supposedtobescruz/anti-ip-logger)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > (source.maxBytes || MAX_BYTES)) {
      throw new Error(`response too large: ${text.length} bytes`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function hostMatches(domain, parent) {
  return domain === parent || domain.endsWith(`.${parent}`);
}

function removeExceptions(domains, exceptions) {
  const keep = [];
  for (const domain of domains) {
    const labels = domain.split(".");
    let matched = false;
    for (let i = 0; i < labels.length - 1; i += 1) {
      if (exceptions.has(labels.slice(i).join("."))) {
        matched = true;
        break;
      }
    }
    if (!matched) keep.push(domain);
  }
  return keep;
}

async function loadSourceEntries() {
  const config = await readJson(join(DATA, "sources.json"));
  const sources = config.sources.filter((source) => source.tier === "core");
  const entries = [];
  const reports = [];

  const remoteExceptions = new Set();
  for (const source of sources) {
    const report = {
      id: source.id,
      name: source.name,
      tier: source.tier,
      category: source.category,
      license: source.license,
      project: source.project,
      url: source.url,
      ok: false,
      count: 0,
      lines: 0,
      error: "",
    };
    try {
      const text = await fetchText(source);
      const parsed = source.format === "dnr-json" ? parseDnrJson(text) : parseList(text);
      if (parsed.domains.length === 0 && text.trim().length > 0) {
        throw new Error("source parsed to zero domains");
      }
      for (const domain of parsed.domains) {
        entries.push({
          domain,
          category: source.category,
          source: source.id,
          confidence: "source",
        });
      }
      for (const exception of parsed.exceptions || []) remoteExceptions.add(exception);
      report.ok = true;
      report.count = parsed.domains.length;
      report.lines = parsed.stats.lines || 0;
      log(`  ${source.id.padEnd(22)} ${String(parsed.domains.length).padStart(5)} domains`);
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
      log(`  ${source.id.padEnd(22)} FAILED: ${report.error}`);
      if (source.required && !ALLOW_PARTIAL) {
        throw new Error(`Required source failed: ${source.id}: ${report.error}`);
      }
    } finally {
      reports.push(report);
    }
  }

  return { entries, reports, exceptions: [...remoteExceptions].sort() };
}

function validateHosts(items, label) {
  return items.map((item) => {
    const normalized = normalizeHost(item);
    if (!normalized) throw new Error(`${label}: invalid host "${item}"`);
    return normalized;
  });
}

function validateCurated(curated) {
  if (!curated || !Array.isArray(curated.domains)) throw new Error("curated.json: domains array is missing");
  for (const item of curated.domains) {
    if (!item || typeof item !== "object") throw new Error("curated.json: entry must be an object");
    const normalized = normalizeHost(item.domain);
    if (!normalized) throw new Error(`curated.json: invalid host "${item.domain}"`);
    if (!(item.category in CATEGORY_RANK) && item.category !== "custom") {
      throw new Error(`curated.json: invalid category "${item.category}" for ${item.domain}`);
    }
    if (!["confirmed", "single"].includes(item.confidence)) {
      throw new Error(`curated.json: invalid confidence "${item.confidence}" for ${item.domain}`);
    }
    item.domain = normalized;
  }
}

function mergeEntries(rawEntries, curated, exceptions) {
  const byDomain = new Map();
  for (const entry of rawEntries) {
    const existing = byDomain.get(entry.domain);
    if (!existing) {
      byDomain.set(entry.domain, {
        domain: entry.domain,
        category: entry.category,
        sources: [entry.source],
        confidence: entry.confidence,
      });
      continue;
    }
    if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);
    if (CATEGORY_RANK[entry.category] < CATEGORY_RANK[existing.category]) {
      existing.category = entry.category;
    }
  }

  for (const item of curated.domains) {
    const existing = byDomain.get(item.domain);
    if (existing) {
      existing.sources.push("curated");
      existing.confidence = item.confidence === "confirmed" ? "confirmed" : existing.confidence;
      if (CATEGORY_RANK[item.category] < CATEGORY_RANK[existing.category]) {
        existing.category = item.category;
      }
    } else {
      byDomain.set(item.domain, {
        domain: item.domain,
        category: item.category,
        sources: ["curated"],
        confidence: item.confidence,
      });
    }
  }

  for (const entry of byDomain.values()) {
    if (entry.sources.length >= 2 || entry.sources.includes("curated") && entry.confidence === "confirmed") {
      entry.confidence = "confirmed";
    } else {
      entry.confidence = "single";
    }
  }

  const domains = dedupeSubdomains([...byDomain.keys()]);
  const filtered = domains.filter((domain) => !exceptions.has(domain));
  const exceptionSet = new Set(exceptions);
  const finalDomains = removeExceptions(filtered, exceptionSet);

  return finalDomains
    .map((domain) => byDomain.get(domain))
    .filter(Boolean)
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

function buildRules(domains) {
  const batches = [];
  for (let i = 0; i < domains.length; i += MAX_DOMAINS_PER_RULE) {
    batches.push(domains.slice(i, i + MAX_DOMAINS_PER_RULE));
  }
  const rules = batches.map((batch, index) => ({
    id: index + 1,
    priority: 10,
    action: { type: "block" },
    condition: {
      requestDomains: batch,
      resourceTypes: RESOURCE_TYPES,
    },
  }));
  if (rules.length > MAX_STATIC_RULES_PER_RULESET) {
    throw new Error(`Static rule limit exceeded: ${rules.length}`);
  }
  return rules;
}

function countByCategory(entries) {
  const counts = { grabify: 0, iplogger: 0, other: 0, tracker: 0, threat: 0, custom: 0, confirmed: 0, single: 0 };
  for (const entry of entries) {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
    counts[entry.confidence] = (counts[entry.confidence] || 0) + 1;
  }
  return counts;
}

async function main() {
  log(OFFLINE ? "Building from the committed offline dataset." : "Fetching core sources.");
  const curated = await readJson(join(DATA, "curated.json"));
  const exceptionConfig = await readJson(join(DATA, "exceptions.json"));
  validateCurated(curated);
  if (!Array.isArray(exceptionConfig.domains)) {
    throw new Error("exceptions.json: domains array is missing");
  }
  const exceptions = [...new Set(validateHosts(exceptionConfig.domains, "exceptions.json"))].sort();

  let entries;
  let reports;
  if (OFFLINE) {
    const existing = await readJson(join(DATA, "core-domains.json"));
    const exceptionSet = new Set(exceptions);
    entries = (existing.domains || []).filter((entry) => removeExceptions([entry.domain], exceptionSet).length > 0);
    reports = existing.sources || [];
  } else {
    const loaded = await loadSourceEntries();
    reports = loaded.reports;
    const allExceptions = new Set([...exceptions, ...loaded.exceptions]);
    entries = mergeEntries(loaded.entries, curated, allExceptions);
  }

  const domains = entries.map((entry) => entry.domain).sort();
  const rules = buildRules(domains);
  const meta = {
    version: 2,
    counts: {
      domains: domains.length,
      rules: rules.length,
      exceptions: exceptions.length,
      ...countByCategory(entries),
    },
    categories: {
      grabify: "Grabify ve benzeri link grabber servisleri",
      iplogger: "IPLogger ailesi ve benzeri servisler",
      other: "Diğer IP toplama ve kısa bağlantı servisleri",
      tracker: "İzleyici altyapısı",
      threat: "İsteğe bağlı tehdit listesi",
      custom: "Kullanıcı kuralı",
    },
    sources: reports,
  };

  const outputs = [
    await writeJson(join(RULES, "core.json"), rules),
    await writeJson(join(DATA, "core-domains.json"), {
      version: 2,
      domains: entries,
      sources: reports,
    }),
    await writeJson(join(DATA, "core-exceptions.json"), exceptions),
    await writeJson(join(DATA, "meta.json"), meta),
  ];

  const changed = outputs.filter((item) => item.changed);
  log("");
  log(`${domains.length} domains, ${rules.length} static rules, ${exceptions.length} exceptions.`);
  log(`${countByCategory(entries).confirmed} confirmed, ${countByCategory(entries).single} single-source.`);
  if (changed.length > 0) {
    log(`Changed: ${changed.map((item) => item.path.replace(ROOT, ".")).join(", ")}`);
    if (CHECK) process.exitCode = 1;
  } else {
    log("No changes.");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
