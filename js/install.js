import { currentPlatform } from './detect.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// detectPlatform() result -> guide panel + human label
const GUIDE = {
  'ios-safari': ['ios', 'iPhone / iPad · Safari'],
  'ios-other': ['ios', 'iPhone / iPad · not Safari'],
  'android-chrome': ['android-chrome', 'Android · Chrome'],
  'android-edge': ['android-edge', 'Android · Edge'],
  'android-samsung': ['android-edge', 'Android · Samsung Internet'],
  'desktop-chromium': ['desktop', 'Desktop · Chrome / Edge'],
  'desktop-other': ['desktop', 'Desktop browser'],
};

const platform = currentPlatform();
const tabs = $$('[data-guide]');
const panels = $$('[data-panel]');
const guidesWrap = $('.guides');

function selectGuide(key, { mine = false } = {}) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.guide === key)));
  panels.forEach((p) => {
    const on = p.dataset.panel === key;
    p.classList.toggle('active', on);
    if (mine) p.classList.toggle('mine', on);
  });
  guidesWrap.classList.add('has-active');
}

tabs.forEach((t) => t.addEventListener('click', () => selectGuide(t.dataset.guide)));
// Arrow-key navigation between tabs (WAI-ARIA tabs pattern)
$('.guide-tabs').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  next.focus();
  next.click();
});

if (platform === 'installed') {
  $('#installedNote').hidden = false;
} else {
  const [key, label] = GUIDE[platform];
  selectGuide(key, { mine: true });
  $('#detected').hidden = false;
  $('#detectedName').textContent = label;
  if (platform === 'ios-other') $('#iosWarning').hidden = false;
}

$('#copyLink')?.addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(location.href.split('#')[0]);
    e.target.textContent = 'Link copied ✓';
  } catch {
    e.target.textContent = location.href.split('#')[0];
  }
});

// --- Native install prompt (Chromium: Android Chrome/Edge/Samsung, desktop Chrome/Edge) ---
let deferredPrompt = null;
const nativeBtn = $('#nativeInstall');

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep the mini-infobar quiet; we show our own button
  deferredPrompt = e;
  nativeBtn.hidden = false;
});

async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  nativeBtn.hidden = true;
  return outcome === 'accepted';
}

nativeBtn.addEventListener('click', promptInstall);

// Every "Install App" CTA: native prompt when available, otherwise scroll to the matching guide.
$$('[data-install-trigger]').forEach((el) => {
  el.addEventListener('click', async (e) => {
    if (deferredPrompt) {
      e.preventDefault();
      await promptInstall();
    }
  });
});

addEventListener('appinstalled', () => {
  $('#detected').hidden = true;
  $('#installedNote').hidden = false;
  $('#iosSheet').hidden = true;
});

// --- iOS Safari: gentle bottom-sheet hint pointing at the Share button ---
const SHEET_KEY = 'zaf:ios-sheet-dismissed';
const sheet = $('#iosSheet');
const dismissed = (() => { try { return localStorage.getItem(SHEET_KEY) === '1'; } catch { return false; } })();

if (platform === 'ios-safari' && !dismissed) {
  setTimeout(() => { sheet.hidden = false; }, 4000);
  sheet.querySelector('.sheet-close').addEventListener('click', () => {
    sheet.hidden = true;
    try { localStorage.setItem(SHEET_KEY, '1'); } catch { /* private mode: just hide for now */ }
  });
}
