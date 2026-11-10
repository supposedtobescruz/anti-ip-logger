const LEVEL_WEIGHT = { danger: 3, warn: 2, info: 1, none: 0 };

const FINDINGS = {
  knownLogger: {
    id: "known-logger",
    level: "danger",
    score: 50,
    title: "Bilinen IP logger alan adı",
    detail: "Bu alan adı IP toplama veya link grabber listesinde.",
  },
  webrtc: {
    id: "webrtc",
    level: "danger",
    score: 45,
    title: "WebRTC ile IP adresi paylaşıldı",
    detail: "Sayfa, yerel ağ adresini açığa çıkarabilecek bir WebRTC bağlantısı kurdu.",
  },
  autoForm: {
    id: "auto-form",
    level: "danger",
    score: 40,
    title: "Tıklamadan form gönderildi",
    detail: "Kullanıcı etkileşimi olmadan bir form gönderimi yakalandı.",
  },
  hiddenFrame: {
    id: "hidden-frame",
    level: "danger",
    score: 30,
    title: "Gizli çerçeve yüklendi",
    detail: "Görünmeyen bir iframe başka bir alan adına bağlandı.",
  },
  metaRefresh: {
    id: "meta-refresh",
    level: "warn",
    score: 30,
    title: "Otomatik yönlendirme",
    detail: "Sayfa, tıklama olmadan başka bir alan adına yönlendiriyor.",
  },
  pixel: {
    id: "hidden-pixel",
    level: "warn",
    score: 15,
    title: "Gizli takip pikseli",
    detail: "Görünmeyen bir görsel başka bir alan adına istek gönderiyor.",
  },
  earlyRequests: {
    id: "early-requests",
    level: "info",
    score: 8,
    title: "Tıklama öncesi dış istekler",
    detail: "Sayfa, herhangi bir etkileşimden önce üçüncü taraf istekleri gönderdi.",
  },
  media: {
    id: "media",
    level: "info",
    score: 5,
    title: "Kamera veya mikrofon isteği",
    detail: "Sayfa medya cihazlarına erişim istedi.",
  },
  geolocation: {
    id: "geolocation",
    level: "info",
    score: 5,
    title: "Konum isteği",
    detail: "Sayfa tarayıcıdan konum bilgisi istedi.",
  },
};

export function emptySignals() {
  return {
    webrtcPublic: [],
    webrtcPrivate: 0,
    webrtcCreated: 0,
    mdns: 0,
    autoForm: false,
    hiddenPixels: [],
    hiddenFrames: [],
    metaRefresh: [],
    preGestureRequests: 0,
    thirdPartyHosts: [],
    media: 0,
    geolocation: 0,
    requestTotal: 0,
  };
}

function maxNumber(a, b) {
  const value = Math.max(Number(a) || 0, Number(b) || 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), 1_000_000);
}

function union(a, b, limit = 30) {
  const items = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  const clean = [];
  for (const item of items) {
    if (typeof item !== "string" || item.length === 0 || item.length >= 300) continue;
    if (clean.includes(item)) continue;
    clean.push(item);
  }
  return clean.slice(0, limit);
}

export function mergeSignals(current, patch) {
  const base = { ...emptySignals(), ...(current || {}) };
  const next = { ...base, ...(patch || {}) };
  next.webrtcPublic = union(base.webrtcPublic, patch && patch.webrtcPublic, 5);
  next.hiddenPixels = union(base.hiddenPixels, patch && patch.hiddenPixels, 20);
  next.hiddenFrames = union(base.hiddenFrames, patch && patch.hiddenFrames, 20);
  next.metaRefresh = union(base.metaRefresh, patch && patch.metaRefresh, 10);
  next.thirdPartyHosts = union(base.thirdPartyHosts, patch && patch.thirdPartyHosts, 20);
  next.webrtcPrivate = maxNumber(base.webrtcPrivate, patch && patch.webrtcPrivate);
  next.webrtcCreated = maxNumber(base.webrtcCreated, patch && patch.webrtcCreated);
  next.mdns = maxNumber(base.mdns, patch && patch.mdns);
  next.preGestureRequests = maxNumber(base.preGestureRequests, patch && patch.preGestureRequests);
  next.media = maxNumber(base.media, patch && patch.media);
  next.geolocation = maxNumber(base.geolocation, patch && patch.geolocation);
  next.requestTotal = maxNumber(base.requestTotal, patch && patch.requestTotal);
  next.autoForm = Boolean(base.autoForm || (patch && patch.autoForm));
  return next;
}

export function assessRisk({ signals, knownLogger = false, gesture = false, protectionEnabled = true }) {
  const s = { ...emptySignals(), ...(signals || {}) };
  const findings = [];

  if (knownLogger) findings.push(FINDINGS.knownLogger);
  if (s.webrtcPublic.length > 0) findings.push(FINDINGS.webrtc);
  if (s.autoForm && !gesture) findings.push(FINDINGS.autoForm);
  if (s.hiddenFrames.length > 0) {
    findings.push({ ...FINDINGS.hiddenFrame, level: gesture ? "warn" : "danger", score: gesture ? 18 : 30 });
  }
  if (s.metaRefresh.length > 0) findings.push(FINDINGS.metaRefresh);
  if (s.hiddenPixels.length > 0) findings.push(FINDINGS.pixel);
  if (s.preGestureRequests >= 3 && !gesture) findings.push(FINDINGS.earlyRequests);
  if (s.media > 0) findings.push(FINDINGS.media);
  if (s.geolocation > 0) findings.push(FINDINGS.geolocation);

  const score = Math.min(100, findings.reduce((total, item) => total + item.score, 0));
  let level = "none";
  for (const finding of findings) {
    if (LEVEL_WEIGHT[finding.level] > LEVEL_WEIGHT[level]) level = finding.level;
  }
  if (score >= 40 && level === "info") level = "warn";
  if (!protectionEnabled) level = "none";

  findings.sort((a, b) => LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level] || b.score - a.score);

  return {
    level,
    score,
    findings,
    signalCount: findings.length,
    protectionEnabled,
  };
}

export function verdictFor({ enabled, allowed, host, knownLogger, risk, blockedThisNavigation }) {
  if (!enabled) return "off";
  if (allowed) return "allowed";
  if (knownLogger) return "logger";
  if (blockedThisNavigation) return "blocked";
  if (risk.level === "danger") return "danger";
  if (risk.level === "warn") return "warn";
  if (risk.level === "info") return "info";
  return host ? "clean" : "idle";
}

export const VERDICT_COPY = {
  off: {
    label: "Koruma kapalı",
    headline: "Koruma şu anda kapalı.",
    detail: "IP logger alan adları engellenmiyor ve sayfa sinyalleri izlenmiyor.",
    tone: "muted",
  },
  allowed: {
    label: "İzin verildi",
    headline: "Bu site izin listesinde.",
    detail: "Alan adı engel listesinde olsa bile bu sitede koruma devre dışı.",
    tone: "info",
  },
  logger: {
    label: "IP logger",
    headline: "Bu alan adı IP logger listesinde.",
    detail: "Bağlantı engellenmediyse sayfa IP adresini toplamaya çalışıyor olabilir.",
    tone: "danger",
  },
  blocked: {
    label: "Engellendi",
    headline: "Bu sekmede bir bağlantı engellendi.",
    detail: "Engellenen adres olay kaydında. Sayfayı yenilemeden önce kontrol et.",
    tone: "danger",
  },
  danger: {
    label: "Yüksek risk",
    headline: "Sayfa IP adresini sızdırmayı denedi.",
    detail: "Aşağıdaki sinyaller bu sekmede yakalandı.",
    tone: "danger",
  },
  warn: {
    label: "Şüpheli",
    headline: "Sayfada şüpheli davranış var.",
    detail: "Kesin bir IP logger değil, ancak sinyaller takip edilmeli.",
    tone: "warn",
  },
  info: {
    label: "Düşük risk",
    headline: "Sayfa düşük riskli sinyaller gönderdi.",
    detail: "Medya, konum veya erken istek gibi tek bir sinyal var.",
    tone: "info",
  },
  clean: {
    label: "Temiz",
    headline: "Bu sekmede sızıntı sinyali yok.",
    detail: "Sayfa açıldığından beri IP toplama davranışı yakalanmadı.",
    tone: "safe",
  },
  idle: {
    label: "Bekliyor",
    headline: "Bu sekme izlenmiyor.",
    detail: "Normal bir web sayfası açtığında durum burada görünür.",
    tone: "muted",
  },
};

export function describeVerdict(verdict) {
  return VERDICT_COPY[verdict] || VERDICT_COPY.idle;
}
