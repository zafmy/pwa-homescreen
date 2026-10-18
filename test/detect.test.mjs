import assert from 'node:assert/strict';
import { detectPlatform } from '../js/detect.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  androidEdge: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 EdgA/126.0',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0',
};

const cases = [
  [UA.iphoneSafari, {}, 'ios-safari'],
  [UA.iphoneChrome, {}, 'ios-other'],
  [UA.iphoneFacebook, {}, 'ios-other'],
  [UA.ipadOS, { touchPoints: 5 }, 'ios-safari'], // iPadOS pretends to be a Mac
  [UA.ipadOS, { touchPoints: 0 }, 'desktop-other'], // real Mac Safari
  [UA.androidChrome, {}, 'android-chrome'],
  [UA.androidEdge, {}, 'android-edge'],
  [UA.androidSamsung, {}, 'android-samsung'],
  [UA.macChrome, {}, 'desktop-chromium'],
  [UA.winEdge, {}, 'desktop-chromium'],
  [UA.macFirefox, {}, 'desktop-other'],
  [UA.androidChrome, { standalone: true }, 'installed'],
  ['', {}, 'desktop-other'],
];

for (const [ua, opts, expected] of cases) {
  assert.equal(detectPlatform(ua, opts), expected, `${expected} <- ${ua.slice(0, 60)} ${JSON.stringify(opts)}`);
}
console.log(`detectPlatform: ${cases.length} cases passed`);
