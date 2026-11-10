(() => {
  const CHANNEL = "__anti_ip_logger__";
  const FLAG = "__antiIpLoggerGuard";
  if (window[FLAG]) return;
  window[FLAG] = true;
  const IS_TOP = window.top === window;

  const local = {
    gesture: false,
    disabled: false,
    bannerDismissed: false,
    autoForm: false,
    hiddenPixels: [],
    hiddenFrames: [],
    metaRefresh: [],
    lastReport: 0,
    reportTimer: null,
    scanTimer: null,
    observer: null,
  };

  const probe = {
    webrtcPublic: [],
    webrtcPrivate: 0,
    webrtcCreated: 0,
    mdns: 0,
    media: 0,
    geolocation: 0,
    preGestureRequests: 0,
    requestTotal: 0,
    thirdPartyHosts: [],
  };

  const MULTI_SUFFIXES = new Set([
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.tr", "net.tr", "org.tr", "gov.tr",
    "com.br", "com.au", "co.nz", "co.za", "com.cn", "co.jp", "co.kr", "co.in",
    "com.mx", "com.ar", "com.co", "com.sg", "com.hk", "com.tw",
  ]);

  const NOISY = [
    // Analytics and product telemetry
    "google-analytics.com", "googletagmanager.com", "stats.wp.com", "hotjar.com",
    "mixpanel.com", "segment.com", "amplitude.com", "clarity.ms", "chartbeat.com",
    "getclicky.com", "umami.is", "simpleanalytics.com", "matomo.cloud", "plausible.io",
    "usefathom.com", "posthog.com", "heap.io", "mouseflow.com", "inspectlet.com",
    "smartlook.com", "crazyegg.com", "luckyorange.com", "scorecardresearch.com",
    "quantserve.com", "fullstory.com", "logrocket.com", "newrelic.com", "nr-data.net",
    "datadoghq.com", "sentry.io", "fathom.com", "cloudflareinsights.com", "comscore.com",
    // Ad tech, SSPs, DSP and verification
    "doubleclick.net", "googlesyndication.net", "googleadservices.com", "googletagservices.com",
    "adservice.google.com", "2mdn.net", "gstatic.com",
    "casalemedia.com", "pubmatic.com", "rubiconproject.com", "criteo.com", "criteo.net",
    "adform.net", "smartadserver.com", "adnxs.com", "adsrvr.org", "amazon-adsystem.com",
    "advertising.com", "openx.net", "sharethrough.com", "media.net", "outbrain.com",
    "taboola.com", "mgid.com", "bidswitch.net", "freewheel.tv", "teads.tv", "gumgum.com",
    "adsafeprotected.com", "doubleverify.com", "moatads.com", "demdex.net", "krxd.net",
    "krxd.net", "bluekai.com", "agkn.com", "rlcdn.com", "lotame.com", "omtrdc.net",
    "2o7.net", "tealium.com", "tiqcdn.com", "adobedtm.com",
    // Consent management platforms
    "trustarc.com", "onetrust.com", "cookielaw.org", "cookiebot.com", "sourcepoint.com",
    "privacymanager.io", "didomi.io", "youronlinechoices.com", "osano.com",
    "usercentrics.com", "consentmanager.net", "iubenda.com", "termly.io",
    // Tag managers and CDNs
    "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com", "fonts.gstatic.com",
    "fonts.googleapis.com", "ajax.googleapis.com", "googleusercontent.com", "cdn.tailwindcss.com",
    "cdn.polyfill.io", "use.typekit.net",
    // Social and player embeds
    "platform.twitter.com", "syndication.twitter.com", "twimg.com", "connect.facebook.net",
    "fbcdn.net", "platform.instagram.com", "cdninstagram.com", "platform.linkedin.com",
    "licdn.com", "widgets.pinterest.com", "pinimg.com", "platform.tiktok.com",
    "tiktokcdn.com", "embed.reddit.com", "redditstatic.com", "redditmedia.com",
    "youtube.com", "ytimg.com", "googlevideo.com", "youtube-nocookie.com",
    "disqus.com", "brid.gy", "addthis.com", "sharethis.com", "githubassets.com",
    "githubusercontent.com", "discord.com", "discordapp.com", "cdn.discord.com",
    "telegram.org", "t.me",
    // Media and player CDNs of large platforms (recognized legit embeds)
    "sndcdn.com", "w.soundcloud.com", "widget.sndcdn.com", "bcbits.com", "mixcloud.com",
    "bandcamp.com", "open.spotify.com", "player.vimeo.com", "vimeocdn.com",
    "cdn.jwplayer.com",
  ];

  function registrable(host) {
    const labels = String(host || "").toLowerCase().split(".");
    if (labels.length < 2) return host;
    const lastTwo = labels.slice(-2).join(".");
    if (labels.length >= 3 && MULTI_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
    return lastTwo;
  }

  function sameSite(a, b) {
    return registrable(a) === registrable(b);
  }

  function hostOf(url) {
    try {
      return new URL(url, location.href).hostname;
    } catch {
      return "";
    }
  }

  function noisy(host) {
    return NOISY.some((item) => host === item || host.endsWith(`.${item}`));
  }

  function union(a, b, limit = 20) {
    return [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])].slice(0, limit);
  }

  function number(value, max = 1_000_000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(Math.floor(parsed), max);
  }

  function textList(value, limit = 20) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string" && item.length < 300))].slice(0, limit);
  }

  function mergeProbe(payload) {
    if (!payload || typeof payload !== "object") return;
    probe.webrtcPublic = union(probe.webrtcPublic, textList(payload.webrtcPublic, 5), 5);
    probe.webrtcPrivate = Math.max(probe.webrtcPrivate, number(payload.webrtcPrivate));
    probe.webrtcCreated = Math.max(probe.webrtcCreated, number(payload.webrtcCreated));
    probe.mdns = Math.max(probe.mdns, number(payload.mdns));
    probe.media = Math.max(probe.media, number(payload.media));
    probe.geolocation = Math.max(probe.geolocation, number(payload.geolocation));
    probe.preGestureRequests = Math.max(probe.preGestureRequests, number(payload.preGestureRequests));
    probe.requestTotal = Math.max(probe.requestTotal, number(payload.requestTotal));
    probe.thirdPartyHosts = union(probe.thirdPartyHosts, textList(payload.thirdPartyHosts), 20);
  }

  function isSuspiciousElement(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const width = Number(element.getAttribute("width")) || rect.width;
    const height = Number(element.getAttribute("height")) || rect.height;
    const sizeSuspicious = width <= 2 && height <= 2;
    if (element.tagName === "IMG" && element.loading === "lazy") return sizeSuspicious;
    if (element.hidden) return true;
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return true;
    return sizeSuspicious;
  }

  function scanDom() {
    if (!document.documentElement) return;
    const pageHost = location.hostname;

    for (const img of document.images) {
      if (!img.src || !/^https?:/i.test(img.src)) continue;
      const host = hostOf(img.src);
      if (!host || sameSite(host, pageHost) || noisy(host)) continue;
      if (!isSuspiciousElement(img)) continue;
      if (!local.hiddenPixels.includes(img.src) && local.hiddenPixels.length < 20) {
        local.hiddenPixels.push(img.src);
      }
    }

    for (const frame of document.querySelectorAll("iframe[src]")) {
      const src = frame.src;
      if (!src || !/^https?:/i.test(src)) continue;
      const host = hostOf(src);
      if (!host || sameSite(host, pageHost) || noisy(host)) continue;
      if (!isSuspiciousElement(frame)) continue;
      if (!local.hiddenFrames.includes(src) && local.hiddenFrames.length < 20) {
        local.hiddenFrames.push(src);
      }
    }

    for (const meta of document.querySelectorAll('meta[http-equiv="refresh" i]')) {
      const content = meta.getAttribute("content") || "";
      const match = content.match(/url\s*=\s*([^;]+)/i);
      if (!match) continue;
      const host = hostOf(match[1].trim().replace(/^['"]|['"]$/g, ""));
      if (!host || sameSite(host, pageHost) || noisy(host)) continue;
      if (!local.metaRefresh.includes(host) && local.metaRefresh.length < 10) {
        local.metaRefresh.push(host);
      }
    }
  }

  function signals() {
    return {
      webrtcPublic: probe.webrtcPublic,
      webrtcPrivate: probe.webrtcPrivate,
      webrtcCreated: probe.webrtcCreated,
      mdns: probe.mdns,
      media: probe.media,
      geolocation: probe.geolocation,
      preGestureRequests: probe.preGestureRequests,
      requestTotal: probe.requestTotal,
      thirdPartyHosts: probe.thirdPartyHosts,
      autoForm: local.autoForm,
      hiddenPixels: local.hiddenPixels,
      hiddenFrames: local.hiddenFrames,
      metaRefresh: local.metaRefresh,
    };
  }

  function sendReport() {
    if (local.disabled) return;
    const now = Date.now();
    if (now - local.lastReport < 800) return;
    local.lastReport = now;
    const host = location.hostname;
    if (!host) return;
    try {
      chrome.runtime.sendMessage(
        {
          type: "reportSignals",
          host,
          page: location.href,
          signals: signals(),
          gesture: local.gesture,
        },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (!response || !response.ok) return;
          if (response.enabled === false) {
            local.disabled = true;
            return;
          }
          if (response.showBanner && !local.bannerDismissed && IS_TOP) {
            showBanner(response);
          }
        },
      );
    } catch {
      local.disabled = true;
    }
  }

  function scheduleReport(force = false) {
    if (local.disabled) return;
    if (force) {
      local.lastReport = 0;
      sendReport();
      return;
    }
    if (local.reportTimer) return;
    local.reportTimer = setTimeout(() => {
      local.reportTimer = null;
      sendReport();
    }, 900);
  }

  function bannerStyles() {
    return [
      "all: initial",
      "position: fixed",
      "left: 16px",
      "bottom: 16px",
      "z-index: 2147483647",
      "width: min(380px, calc(100vw - 32px))",
      "box-sizing: border-box",
      "font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif",
      "color: #171512",
      "background: #fbf8f1",
      "border: 1px solid #171512",
      "border-left: 6px solid #a51f1f",
      "padding: 16px",
      "box-shadow: 0 12px 28px rgba(23, 21, 18, 0.18)",
      "border-radius: 2px",
      "display: block",
    ].join(";");
  }

  function element(tag, style, text) {
    const node = document.createElement(tag);
    if (style) node.setAttribute("style", style);
    if (text) node.textContent = text;
    return node;
  }

  function dismissBanner(hostElement) {
    local.bannerDismissed = true;
    hostElement.remove();
  }

  function showBanner(response) {
    if (!document.documentElement || document.getElementById("anti-ip-logger-banner")) return;
    const host = location.hostname;
    if (!host) return;

    const hostElement = document.createElement("div");
    hostElement.id = "anti-ip-logger-banner";
    hostElement.setAttribute("style", bannerStyles());
    hostElement.setAttribute("role", "dialog");
    hostElement.setAttribute("aria-label", "Anti IP Logger uyarısı");

    const shadow = hostElement.attachShadow({ mode: "closed" });
    const wrap = element("div", "all: initial; display: block; color: #171512; font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;");

    const label = element(
      "div",
      "font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6152; margin: 0 0 8px;",
      "ANTI IP LOGGER",
    );

    const title = element(
      "div",
      "font-size: 18px; line-height: 1.25; font-weight: 600; margin: 0 0 6px; color: #171512;",
      response.copy && response.copy.headline ? response.copy.headline : "Bu sayfa IP adresini istemeye çalıştı.",
    );

    const detail = element(
      "div",
      "font-size: 13px; line-height: 1.45; color: #4c463b; margin: 0 0 14px;",
      response.copy && response.copy.detail ? response.copy.detail : "Sayfa, IP adresini toplayabilecek davranışlar gösterdi.",
    );

    const actions = element("div", "display: flex; flex-wrap: wrap; gap: 8px; align-items: center;");

    const block = element(
      "button",
      "appearance: none; border: 1px solid #171512; background: #171512; color: #fbf8f1; font: 500 13px 'IBM Plex Sans', 'Segoe UI', sans-serif; padding: 9px 12px; border-radius: 2px; cursor: pointer;",
      "Siteyi engelle",
    );
    block.type = "button";
    block.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "addCustomDomain", domain: host }, () => void chrome.runtime.lastError);
      } catch {
        // The extension may have been reloaded.
      }
      dismissBanner(hostElement);
    });

    const allow = element(
      "button",
      "appearance: none; border: 1px solid #8f8572; background: transparent; color: #171512; font: 500 13px 'IBM Plex Sans', 'Segoe UI', sans-serif; padding: 9px 12px; border-radius: 2px; cursor: pointer;",
      "Bu siteye izin ver",
    );
    allow.type = "button";
    allow.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ type: "allowDomain", domain: host }, () => void chrome.runtime.lastError);
      } catch {
        // The extension may have been reloaded.
      }
      dismissBanner(hostElement);
    });

    const close = element(
      "button",
      "appearance: none; border: 1px solid transparent; background: transparent; color: #6b6152; font: 500 13px 'IBM Plex Sans', 'Segoe UI', sans-serif; padding: 9px 8px; border-radius: 2px; cursor: pointer;",
      "Kapat",
    );
    close.type = "button";
    close.addEventListener("click", () => dismissBanner(hostElement));

    actions.append(block, allow, close);
    wrap.append(label, title, detail, actions);
    shadow.append(wrap);
    document.documentElement.appendChild(hostElement);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.type !== "signals") return;
    mergeProbe(data.payload);
    scheduleReport();
  });

  for (const eventName of ["pointerdown", "keydown", "touchstart", "mousedown", "wheel"]) {
    window.addEventListener(
      eventName,
      (event) => {
        if (!event.isTrusted) return;
        if (!local.gesture) {
          local.gesture = true;
          scheduleReport(true);
        }
      },
      { capture: true, passive: true },
    );
  }

  document.addEventListener(
    "submit",
    (event) => {
      if (event.isTrusted || local.gesture || !IS_TOP) return;
      const form = event.target;
      const action = form && typeof form.action === "string" ? form.action : "";
      const actionHost = action ? hostOf(action) : "";
      if (actionHost && sameSite(actionHost, location.hostname)) return;
      local.autoForm = true;
      scheduleReport(true);
    },
    true,
  );

  const scanState = { pending: false };
  function debouncedScan() {
    if (scanState.pending) return;
    scanState.pending = true;
    requestAnimationFrame(() => {
      scanState.pending = false;
      scanDom();
    });
  }

  function startScanning() {
    if (!IS_TOP) return;
    scanDom();
    scheduleReport(true);
    local.observer = new MutationObserver(() => {
      debouncedScan();
      scheduleReport();
    });
    if (document.documentElement) {
      local.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "hidden", "width", "height", "loading"],
      });
    }
    local.scanTimer = setInterval(debouncedScan, 2000);
    setTimeout(() => {
      scanDom();
      scheduleReport(true);
    }, 6000);
    setTimeout(() => {
      scanDom();
      scheduleReport(true);
    }, 15000);
    setTimeout(() => {
      scanDom();
      scheduleReport(true);
    }, 30000);
    setTimeout(() => {
      if (local.scanTimer) clearInterval(local.scanTimer);
      local.scanTimer = null;
      if (local.observer) local.observer.disconnect();
      local.observer = null;
    }, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startScanning, { once: true });
  } else {
    startScanning();
  }
})();
