const MINUTE_MS = 60_000;

export const PAUSE_MINUTES = [15, 60];

export function isPaused(settings, now = Date.now()) {
  const pauseUntil = settings ? settings.pauseUntil : undefined;
  return typeof pauseUntil === "number" && Number.isFinite(pauseUntil) && pauseUntil > now;
}

export function isProtectionActive(settings, now = Date.now()) {
  return Boolean(settings) && settings.enabled === true && !isPaused(settings, now);
}

export function computePauseUntil(minutes, now = Date.now()) {
  return PAUSE_MINUTES.includes(minutes) ? now + minutes * MINUTE_MS : 0;
}
