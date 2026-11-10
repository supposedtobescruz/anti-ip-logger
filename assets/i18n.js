import { EN_FALLBACK } from "./i18n-en.js";
import { TR_FALLBACK } from "./i18n-tr.js";

let override = "system";

export async function initLanguage() {
  override = "system";
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get("settings");
      const lang = data && data.settings && data.settings.language;
      if (lang === "en" || lang === "tr" || lang === "system") override = lang;
    }
  } catch {
    override = "system";
  }
  return override;
}

export function getLanguageOverride() {
  return override;
}

export function setLanguageOverride(value) {
  override = value === "en" || value === "tr" || value === "system" ? value : "system";
}

const TABLES = { en: EN_FALLBACK, tr: TR_FALLBACK };

function interpolate(message, substitutions) {
  if (!substitutions || substitutions.length === 0) return message;
  return message.replace(/\$(\d)/g, (match, index) => {
    const value = substitutions[Number(index) - 1];
    return value === undefined ? match : String(value);
  });
}

function chromeMessage(key, substitutions) {
  if (typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getMessage === "function") {
    const value = chrome.i18n.getMessage(key, substitutions || []);
    if (value) return value;
  }
  return null;
}

export function t(key, substitutions) {
  const table = override === "system" ? null : TABLES[override];
  if (table) {
    const value = table[key];
    if (value !== undefined) return interpolate(value, substitutions);
  } else {
    const value = chromeMessage(key, substitutions);
    if (value) return value;
  }
  const fallback = (override === "tr" ? TR_FALLBACK[key] : EN_FALLBACK[key]) ?? EN_FALLBACK[key] ?? TR_FALLBACK[key];
  return fallback !== undefined ? interpolate(fallback, substitutions) : key;
}

export function uiLanguage() {
  if (override === "en" || override === "tr") return override;
  if (typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getUILanguage === "function") {
    return chrome.i18n.getUILanguage() || "en";
  }
  return "en";
}

export function isTurkish() {
  return uiLanguage().toLowerCase().startsWith("tr");
}

export function applyI18n(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  document.documentElement.lang = isTurkish() ? "tr" : "en";
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll("[data-i18n-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  }
  for (const node of root.querySelectorAll("[data-i18n-title]")) {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  }
  for (const node of root.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }
  for (const node of root.querySelectorAll("[data-i18n-alt]")) {
    node.setAttribute("alt", t(node.dataset.i18nAlt));
  }
}
