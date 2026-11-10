import { normalizeHost } from "./parser.js";

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk", "net.uk", "sch.uk", "ltd.uk", "plc.uk",
  "com.tr", "net.tr", "org.tr", "gov.tr", "edu.tr", "bel.tr", "web.tr",
  "com.br", "net.br", "org.br", "gov.br", "edu.br",
  "com.ar", "net.ar", "org.ar", "gob.ar", "edu.ar",
  "com.mx", "org.mx", "net.mx", "gob.mx",
  "com.co", "net.co", "org.co", "gov.co",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz", "school.nz",
  "co.za", "org.za", "net.za", "gov.za", "ac.za",
  "com.pl", "net.pl", "org.pl", "gov.pl", "edu.pl",
  "com.ua", "net.ua", "org.ua", "gov.ua", "edu.ua", "in.ua",
  "com.ru", "net.ru", "org.ru", "edu.ru", "gov.ru",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn",
  "com.hk", "org.hk", "net.hk", "edu.hk", "gov.hk",
  "com.tw", "org.tw", "net.tw", "edu.tw", "gov.tw",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.kr", "or.kr", "ne.kr", "go.kr", "re.kr",
  "com.sg", "net.sg", "org.sg", "edu.sg", "gov.sg",
  "com.my", "net.my", "org.my", "edu.my", "gov.my",
  "com.vn", "net.vn", "org.vn", "edu.vn", "gov.vn",
  "com.id", "co.id", "or.id", "ac.id", "go.id",
  "com.ph", "net.ph", "org.ph", "edu.ph", "gov.ph",
  "com.pk", "net.pk", "org.pk", "edu.pk", "gov.pk",
  "com.bd", "com.ng", "com.gh", "com.eg", "com.sa", "com.qa", "com.kw", "com.om", "com.jo",
  "com.pe", "com.ve", "com.ec", "com.uy", "com.py", "com.bo", "com.do", "com.gt",
  "co.il", "org.il", "net.il", "ac.il", "gov.il",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in",
  "co.th", "in.th", "ac.th", "go.th", "or.th", "net.th",
  "com.es", "org.es", "nom.es", "gob.es", "edu.es",
  "com.pt", "org.pt", "net.pt", "gov.pt", "edu.pt",
  "com.gr", "net.gr", "org.gr", "gov.gr", "edu.gr",
  "com.cy", "net.cy", "org.cy", "gov.cy", "ac.cy",
  "com.ee", "org.ee", "fie.ee", "pri.ee",
  "com.lv", "edu.lv", "gov.lv", "org.lv",
  "com.lt", "gov.lt", "edu.lt",
  "com.hr", "iz.hr", "from.hr", "name.hr",
]);

export function registrableDomain(host) {
  if (typeof host !== "string" || !host) return null;
  const clean = host.toLowerCase().replace(/\.$/, "");
  const labels = clean.split(".");
  if (labels.length < 2) return clean;
  const lastTwo = labels.slice(-2).join(".");
  if (labels.length >= 3 && MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

export function isSameSite(a, b) {
  const regA = registrableDomain(a);
  const regB = registrableDomain(b);
  return Boolean(regA && regB && regA === regB);
}

export function hostMatchesDomain(host, domain) {
  if (!host || !domain) return false;
  const cleanHost = host.toLowerCase();
  const cleanDomain = domain.toLowerCase();
  return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
}

export function matchDomain(host, domainSet) {
  if (!host) return null;
  const labels = host.toLowerCase().split(".");
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join(".");
    if (domainSet.has(candidate)) return candidate;
  }
  return null;
}

export function urlToHost(url) {
  return normalizeHost(url);
}

const KNOWN_TRACKER_SUFFIXES = [
  "doubleclick.net", "googlesyndication.com", "google-analytics.com", "googletagmanager.com",
  "facebook.net", "connect.facebook.net", "analytics.tiktok.com", "hotjar.com", "hotjar.io",
  "clarity.ms", "mixpanel.com", "segment.com", "segment.io", "amplitude.com", "heap.io",
  "fullstory.com", "inspectlet.com", "mouseflow.com", "crazyegg.com", "optimizely.com",
  "newrelic.com", "nr-data.net", "sentry.io", "bugsnag.com", "datadoghq.com",
  "intercom.io", "intercomcdn.com", "zendesk.com", "driftt.com", "hubspot.com",
  "branch.io", "appsflyer.com", "adjust.com", "kochava.com", "singular.net", "tapad.com",
  "scorecardresearch.com", "quantserve.com", "quantcast.com", "bluekai.com", "krxd.net",
  "demdex.net", "everesttech.net", "omtrdc.net", "2o7.net", "adsrvr.org", "adnxs.com",
  "rubiconproject.com", "pubmatic.com", "openx.net", "criteo.com", "casalemedia.com",
  "yandex.ru", "mail.ru", "vk.com", "t.me", "telegram.org", "discord.com", "discordapp.com",
];

export function isKnownNoisyDomain(domain) {
  return KNOWN_TRACKER_SUFFIXES.some((suffix) => hostMatchesDomain(domain, suffix));
}
