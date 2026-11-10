export function t(key, substitutions) {
  if (typeof chrome !== "undefined" && chrome.i18n && typeof chrome.i18n.getMessage === "function") {
    const value = chrome.i18n.getMessage(key, substitutions || []);
    if (value) return value;
  }
  return key;
}

export function uiLanguage() {
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
}
