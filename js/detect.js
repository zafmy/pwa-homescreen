/**
 * Classify the visitor so the install guide can open the right instructions.
 * Pure function (no DOM access) so it can be tested in Node.
 *
 * @param {string} ua navigator.userAgent
 * @param {{ standalone?: boolean, touchPoints?: number }} [opts]
 * @returns {'installed'|'ios-safari'|'ios-other'|'android-chrome'|'android-edge'|'android-samsung'|'desktop-chromium'|'desktop-other'}
 */
export function detectPlatform(ua = '', { standalone = false, touchPoints = 0 } = {}) {
  if (standalone) return 'installed';

  // iPadOS 13+ reports a Macintosh UA; touch support gives it away.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (isIOS) {
    // Only real Safari can "Add to Home Screen" reliably; in-app and third-party browsers carry extra tokens.
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\/|Twitter/.test(ua);
    return otherBrowser || !/Safari/.test(ua) ? 'ios-other' : 'ios-safari';
  }

  if (/Android/.test(ua)) {
    if (/EdgA/.test(ua)) return 'android-edge';
    if (/SamsungBrowser/.test(ua)) return 'android-samsung';
    return 'android-chrome';
  }

  if (/Chrome|Chromium|Edg\//.test(ua) && !/OPR|Firefox/.test(ua)) return 'desktop-chromium';
  return 'desktop-other';
}

/** Browser wrapper: reads the live environment. */
export function currentPlatform() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return detectPlatform(navigator.userAgent, { standalone, touchPoints: navigator.maxTouchPoints || 0 });
}
