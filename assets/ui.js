export async function send(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response) return { ok: false, error: "Yanıt alınamadı." };
    return response;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") {
    root.setAttribute("data-theme", theme);
  } else {
    root.removeAttribute("data-theme");
  }
  return theme;
}

export function resolvedTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function toggleTheme(current) {
  return current === "dark" ? "light" : "dark";
}

export function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
}

export function formatRelative(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "hiç";
  const diff = Date.now() - ts;
  if (diff < 45_000) return "az önce";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return new Date(ts).toLocaleDateString("tr-TR");
}

export function formatClock(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function toast(message, kind = "ok") {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.append(region);
  }
  const node = document.createElement("div");
  node.className = `toast toast--${kind}`;
  node.textContent = message;
  region.append(node);
  setTimeout(() => node.remove(), 4200);
}

export function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = label || "Çalışıyor";
  } else if (button.dataset.idleLabel) {
    button.textContent = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function badge(kind, text) {
  return el("span", `badge badge--${kind}`, text);
}
