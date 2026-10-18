import { createFeed, makeCandles, applyTick, fmt, SPREAD } from './price.js';
import { drawChart, animateIn } from './chart.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('#year').textContent = new Date().getFullYear();

// --- Split eyebrow into letters for a staggered type-in ---
$$('[data-split]').forEach((el) => {
  el.innerHTML = [...el.textContent].map((ch, i) => `<span class="ch" style="--i:${i}">${ch}</span>`).join('');
});

// --- Sticky nav state + active link ---
const nav = $('.nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });
const links = $$('.nav-links a');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.hash === `#${e.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
$$('main section[id]').forEach((s) => sectionObserver.observe(s));

// --- Scroll reveals (staggered within the same parent) ---
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    obs.unobserve(e.target);
  });
}, { threshold: 0.15 });
$$('.reveal').forEach((el) => {
  const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.setProperty('--rd', `${siblings.indexOf(el) * 0.09}s`);
  revealObserver.observe(el);
});

// --- Count-up stats ---
function countUp(el) {
  const target = parseFloat(el.dataset.count);
  const decimals = +(el.dataset.decimals || 0);
  const { prefix = '', suffix = '' } = el.dataset;
  const t0 = performance.now();
  const dur = reduceMotion ? 0 : 1400;
  const frame = (now) => {
    const p = dur ? Math.min(1, (now - t0) / dur) : 1;
    el.textContent = prefix + (target * (1 - (1 - p) ** 3)).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
setTimeout(() => $$('[data-count]').forEach(countUp), 900);

// --- Feature card spotlight follows pointer ---
$$('.feature').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

// --- 3D tilt on the hero phone ---
const phone = $('#heroPhone');
if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
  const hero = $('.hero');
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    phone.style.transform = `rotateY(${-18 + x * 16}deg) rotateX(${8 - y * 12}deg) rotateZ(4deg)`;
  });
  hero.addEventListener('pointerleave', () => { phone.style.transform = ''; });
}

// --- Live price: hero phone + ticker ---
const feed = createFeed();
const heroCanvas = $('#heroChart');
let candles = makeCandles('M15', 48);
let chartReady = false;
animateIn(heroCanvas, candles, { axis: true }, 1600).then(() => { chartReady = true; });
addEventListener('resize', () => chartReady && drawChart(heroCanvas, candles));

const priceEl = $('.ps-price');
const tickerTrack = $('#tickerTrack');
let lastBid = feed.price.bid;
let high = Math.max(...candles.map((c) => c.h));
let low = Math.min(...candles.map((c) => c.l));

feed.subscribe((q) => {
  $$('[data-live="bid"]').forEach((el) => { el.textContent = fmt(q.bid); });
  $$('[data-live="ask"]').forEach((el) => { el.textContent = fmt(q.ask); });
  $$('[data-live="change"]').forEach((el) => {
    const sign = q.change >= 0 ? '+' : '';
    el.textContent = `${sign}${fmt(q.change)} (${sign}${q.changePct.toFixed(2)}%)`;
    el.className = `ps-chg ${q.change >= 0 ? 'up' : 'down'}`;
  });
  if (q.bid !== lastBid) {
    priceEl.classList.remove('flash-up', 'flash-down');
    void priceEl.offsetWidth; // restart the transition
    priceEl.classList.add(q.bid > lastBid ? 'flash-up' : 'flash-down');
    setTimeout(() => priceEl.classList.remove('flash-up', 'flash-down'), 400);
  }
  lastBid = q.bid;
  high = Math.max(high, q.bid);
  low = Math.min(low, q.bid);

  candles = applyTick(candles, 'M15', q.bid);
  if (chartReady) drawChart(heroCanvas, candles);
  renderTicker(q);
});

function renderTicker(q) {
  const chg = `<span class="${q.change >= 0 ? 'up' : 'down'}">${q.change >= 0 ? '▲' : '▼'} ${fmt(Math.abs(q.change))} (${q.changePct.toFixed(2)}%)</span>`;
  const items = [
    `<span><b>XAUUSD</b>${fmt(q.bid)} ${chg}</span>`,
    `<span><b>BID</b>${fmt(q.bid)}</span>`,
    `<span><b>ASK</b>${fmt(q.ask)}</span>`,
    `<span><b>SPREAD</b>${SPREAD.toFixed(2)}</span>`,
    `<span><b>DAY HIGH</b>${fmt(high)}</span>`,
    `<span><b>DAY LOW</b>${fmt(low)}</span>`,
    `<span><b>OPEN</b>${fmt(q.open)}</span>`,
    `<span><b>MODE</b>Demo · Simulated</span>`,
  ].join('');
  tickerTrack.innerHTML = items + items; // duplicated for a seamless -50% loop
}

// --- Gold dust background ---
const sparkles = $('#sparkles');
if (!reduceMotion) {
  const ctx = sparkles.getContext('2d');
  let w, h, dots;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    sparkles.width = w * dpr; sparkles.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: Math.min(70, Math.floor(w / 18)) }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.3,
      vy: -(Math.random() * 0.25 + 0.05), tw: Math.random() * Math.PI * 2,
    }));
  };
  resize();
  addEventListener('resize', resize);
  const loop = () => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y += d.vy; d.tw += 0.03;
      if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
      ctx.globalAlpha = 0.25 + Math.sin(d.tw) * 0.25 + 0.2;
      ctx.fillStyle = '#F5C451';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!document.hidden) requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', () => !document.hidden && requestAnimationFrame(loop));
  requestAnimationFrame(loop);
}
