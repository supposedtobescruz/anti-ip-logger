(() => {
  const CHANNEL = "__anti_ip_logger__";
  const FLAG = "__antiIpLoggerProbe";
  if (window[FLAG]) return;
  window[FLAG] = true;

  const state = {
    gesture: false,
    webrtcCreated: 0,
    webrtcPublic: [],
    webrtcPrivate: 0,
    mdns: 0,
    media: 0,
    geolocation: 0,
    preGestureRequests: 0,
    requestTotal: 0,
    thirdPartyHosts: [],
    lastReport: 0,
  };

  const PRIVATE_V4 = [
    /^10\./,
    /^127\./,
    /^192\.168\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^0\./,
  ];

  const MULTI_SUFFIXES = new Set([
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.tr", "net.tr", "org.tr", "gov.tr",
    "com.br", "com.au", "co.nz", "co.za", "com.cn", "co.jp", "co.kr", "co.in",
    "com.mx", "com.ar", "com.co", "com.sg", "com.hk", "com.tw",
  ]);

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

  function isPrivateIp(ip) {
    if (!ip) return false;
    if (ip.includes(":")) {
      return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
    }
    return PRIVATE_V4.some((re) => re.test(ip));
  }

  function noteCandidate(candidate) {
    if (!candidate || typeof candidate.candidate !== "string") return;
    const text = candidate.candidate;
    if (text.includes(".local")) {
      state.mdns += 1;
      return;
    }
    for (const token of text.split(/\s+/)) {
      if (!/^([0-9a-f]{0,4}:){1,7}[0-9a-f]{0,4}$/i.test(token)) continue;
      const ip = token.toLowerCase();
      if (isPrivateIp(ip)) {
        state.webrtcPrivate += 1;
      } else if (!state.webrtcPublic.includes(ip) && state.webrtcPublic.length < 5) {
        state.webrtcPublic.push(ip);
      }
      return;
    }
    const match = text.match(/(?:^|\s)(\d{1,3}(?:\.\d{1,3}){3})(?:\s|$)/);
    if (!match) return;
    const ip = match[1];
    if (isPrivateIp(ip)) {
      state.webrtcPrivate += 1;
      return;
    }
    if (!state.webrtcPublic.includes(ip) && state.webrtcPublic.length < 5) {
      state.webrtcPublic.push(ip);
    }
  }

  function noteRequest(url) {
    if (!url) return;
    const host = hostOf(url);
    if (!host || !/^https?:/i.test(String(url))) return;
    state.requestTotal += 1;
    if (!state.gesture) {
      state.preGestureRequests += 1;
      if (!sameSite(host, location.hostname) && !state.thirdPartyHosts.includes(host) && state.thirdPartyHosts.length < 20) {
        state.thirdPartyHosts.push(host);
      }
    }
    scheduleReport("request");
  }

  function payload() {
    return {
      gesture: state.gesture,
      webrtcCreated: state.webrtcCreated,
      webrtcPublic: [...state.webrtcPublic],
      webrtcPrivate: state.webrtcPrivate,
      mdns: state.mdns,
      media: state.media,
      geolocation: state.geolocation,
      preGestureRequests: state.preGestureRequests,
      requestTotal: state.requestTotal,
      thirdPartyHosts: [...state.thirdPartyHosts],
    };
  }

  function report() {
    state.lastReport = Date.now();
    try {
      window.postMessage({ channel: CHANNEL, type: "signals", payload: payload() }, "*");
    } catch {
      // The isolated world may not be ready yet.
    }
  }

  let reportTimer = null;
  function scheduleReport() {
    if (reportTimer) return;
    const now = Date.now();
    const wait = Math.max(250, 1000 - (now - state.lastReport));
    reportTimer = setTimeout(() => {
      reportTimer = null;
      report();
    }, wait);
  }

  const OriginalRtc = window.RTCPeerConnection;
  if (typeof OriginalRtc === "function") {
    class WrappedRtc extends OriginalRtc {
      constructor(...args) {
        super(...args);
        state.webrtcCreated += 1;
        this.addEventListener("icecandidate", (event) => {
          if (event && event.candidate) {
            noteCandidate(event.candidate);
            scheduleReport();
          }
        });
        this.addEventListener("icegatheringstatechange", () => scheduleReport());
      }
    }
    try {
      window.RTCPeerConnection = WrappedRtc;
    } catch {
      // Some pages freeze the constructor; leaving it untouched is safer than breaking the page.
    }
  }

  try {
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices && typeof mediaDevices.getUserMedia === "function") {
      const original = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = function (...args) {
        try {
          state.media += 1;
          scheduleReport();
        } catch {
          // Instrumentation must not break the call.
        }
        return original(...args);
      };
    }
  } catch {
    // Frozen platform object: skip media instrumentation.
  }

  try {
    if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === "function") {
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = function (...args) {
        try {
          state.geolocation += 1;
          scheduleReport();
        } catch {
          // Instrumentation must not break the call.
        }
        return original(...args);
      };
    }
  } catch {
    // Frozen platform object: skip geolocation instrumentation.
  }

  try {
    if (navigator.geolocation && typeof navigator.geolocation.watchPosition === "function") {
      const originalWatch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = function (...args) {
        try {
          state.geolocation += 1;
          scheduleReport();
        } catch {
          // Instrumentation must not break the call.
        }
        return originalWatch(...args);
      };
    }
  } catch {
    // Frozen platform object: skip watchPosition instrumentation.
  }

  try {
    if (typeof window.fetch === "function") {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          noteRequest(typeof input === "string" ? input : input && input.url);
        } catch {
          // A malformed Request object must not break the page request.
        }
        return originalFetch(input, init);
      };
    }
  } catch {
    // Frozen window: skip fetch instrumentation.
  }

  try {
    const xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      try {
        noteRequest(url);
      } catch {
        // Ignore instrumentation errors.
      }
      return xhrOpen.call(this, method, url, ...rest);
    };
  } catch {
    // Frozen prototype: skip XHR instrumentation.
  }

  try {
    if (navigator.sendBeacon) {
      const originalBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try {
          noteRequest(url);
        } catch {
          // Ignore instrumentation errors.
        }
        return originalBeacon(url, data);
      };
    }
  } catch {
    // Frozen platform object: skip sendBeacon instrumentation.
  }

  for (const eventName of ["pointerdown", "keydown", "touchstart", "mousedown", "wheel"]) {
    window.addEventListener(
      eventName,
      (event) => {
        if (!event.isTrusted) return;
        if (!state.gesture) {
          state.gesture = true;
          report();
        }
      },
      { capture: true, passive: true },
    );
  }

  window.addEventListener("pagehide", report, { capture: true });
  setTimeout(report, 1200);
  setTimeout(report, 5000);
  setTimeout(report, 12000);
  setTimeout(report, 30000);
})();
