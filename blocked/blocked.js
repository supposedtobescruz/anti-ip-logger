import { send, setBusy, toast } from "../assets/ui.js";

const nodes = {
  sheet: document.getElementById("sheet"),
  caseNumber: document.getElementById("case-number"),
  stamp: document.getElementById("stamp"),
  title: document.getElementById("title"),
  lead: document.getElementById("lead"),
  target: document.getElementById("target-url"),
  meta: document.getElementById("target-meta"),
  allowTab: document.getElementById("allow-tab"),
  allowSite: document.getElementById("allow-site"),
  goBack: document.getElementById("go-back"),
  feedback: document.getElementById("feedback"),
  fineprint: document.getElementById("fineprint"),
};

const CATEGORY_LABELS = {
  grabify: "Grabify benzeri link grabber",
  iplogger: "IPLogger ailesi",
  other: "IP toplama veya kısa bağlantı servisi",
  tracker: "İzleyici altyapısı",
  threat: "Tehdit listesi kaydı",
  custom: "Özel engel kuralı",
};

let target = "";
let host = "";
let busy = false;

function setFeedback(message, tone) {
  nodes.feedback.textContent = message;
  if (tone) nodes.feedback.dataset.tone = tone;
  else delete nodes.feedback.dataset.tone;
}

function caseNumberFor(date) {
  const parts = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")];
  const time = [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")];
  return `DOSYA: ${parts.join("-")} / ${time.join(":")}`;
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderTarget() {
  if (!target) {
    nodes.stamp.textContent = "ENGELLENDİ";
    nodes.title.textContent = "Engellenen adres okunamadı.";
    nodes.lead.textContent =
      "Kural çalıştı ancak hedef adres bu sayfaya taşınamadı. Adresi tarayıcı geçmişinden kontrol edebilirsin.";
    nodes.target.textContent = "Bilinmiyor";
    nodes.meta.textContent = "";
    nodes.allowTab.disabled = true;
    nodes.allowSite.disabled = true;
    return;
  }

  nodes.target.textContent = target;
  nodes.target.title = target;
  nodes.allowTab.disabled = false;
  nodes.allowSite.disabled = false;

  nodes.lead.textContent = "Gezinme durduruldu ve hedef sunucuya istek gönderilmedi. Adresi aşağıda görebilirsin.";
}

async function describeHost() {
  if (!host) return;
  const result = await send({ type: "checkUrl", url: host });
  if (!result || !result.ok) {
    nodes.meta.textContent = "";
    return;
  }
  const known = result.known || {};
  const parts = [];
  if (known.category && CATEGORY_LABELS[known.category]) parts.push(CATEGORY_LABELS[known.category]);
  if (known.confidence === "confirmed") parts.push("iki veya daha fazla kaynakla doğrulandı");
  else if (known.confidence === "single") parts.push("tek kaynak kaydı");
  if (known.origin === "remote") parts.push("uzak güncelleme");
  if (!result.wouldBlock && result.allowed) parts.push("izin listesinde");
  nodes.meta.textContent = parts.length > 0 ? parts.join(" · ") : "Alan adı listede bulundu.";
}

async function init() {
  nodes.caseNumber.textContent = caseNumberFor(new Date());
  nodes.sheet.setAttribute("aria-busy", "true");

  const pending = await send({ type: "getBlockedTarget" });
  target = pending && pending.ok ? pending.target : "";
  host = hostFromUrl(target);
  renderTarget();

  if (target) {
    await send({ type: "reportBlock", url: target, host, reason: "Üst düzey gezinme engellendi" });
    await describeHost();
    nodes.fineprint.textContent = "Engel kaydı panelde tutulur. İzin kararı bu tarayıcıda saklanır, hiçbir sunucuya gönderilmez.";
  }

  nodes.sheet.setAttribute("aria-busy", "false");
  if (target) nodes.allowTab.focus();
}

async function decide(message, successText) {
  if (busy || !target) return;
  busy = true;
  setBusy(nodes.allowTab, true, "İzin veriliyor");
  setBusy(nodes.allowSite, true, "İzin veriliyor");
  setFeedback("");
  const result = await send(message);
  busy = false;
  setBusy(nodes.allowTab, false);
  setBusy(nodes.allowSite, false);
  if (!result || !result.ok) {
    const text = (result && result.error) || "İzin kaydedilemedi.";
    setFeedback(text, "error");
    toast(text, "error");
    return;
  }
  setFeedback(successText);
  location.replace(target);
}

nodes.allowTab.addEventListener("click", () => {
  if (!host) return;
  decide({ type: "allowOnce", domain: host }, "Bu sekme için izin verildi, sayfa açılıyor.");
});

nodes.allowSite.addEventListener("click", () => {
  if (!host) return;
  decide({ type: "allowDomain", domain: host }, "Alan adı izin listesine eklendi, sayfa açılıyor.");
});

nodes.goBack.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "../dashboard/dashboard.html#listeler";
});

init().catch((error) => {
  nodes.sheet.setAttribute("aria-busy", "false");
  setFeedback(error instanceof Error ? error.message : String(error), "error");
});
