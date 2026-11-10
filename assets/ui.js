import { t, isTurkish } from "./i18n.js";

export async function send(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response) return { ok: false, error: t("errorNoResponse") };
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
  return new Intl.NumberFormat(intlLocale()).format(Number(value) || 0);
}

function intlLocale() {
  return isTurkish() ? "tr-TR" : "en-US";
}

export function formatRelative(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return t("relativeNever");
  const diff = Date.now() - ts;
  if (diff < 45_000) return t("relativeJustNow");
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return t("relativeMinutes", [String(minutes)]);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("relativeHours", [String(hours)]);
  const days = Math.round(hours / 24);
  if (days < 30) return t("relativeDays", [String(days)]);
  return new Date(ts).toLocaleDateString(intlLocale());
}

export function formatClock(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  return new Date(ts).toLocaleTimeString(intlLocale(), { hour: "2-digit", minute: "2-digit" });
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
    button.textContent = label || t("commonWorking");
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
