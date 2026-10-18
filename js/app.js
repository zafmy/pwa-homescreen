import { createFeed, makeCandles, applyTick, fmt, TIMEFRAMES, CONTRACT } from './price.js';
import { drawChart, animateIn } from './chart.js';
import * as Demo from './demo.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => `${n < 0 ? '-' : ''}$${fmt(Math.abs(n))}`;
// Escape strings that come back from localStorage before they touch innerHTML.
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const signed = (n) => `${n >= 0 ? '+' : '-'}$${fmt(Math.abs(n))}`;
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- Persistence ----------
const STORE = 'zaf:demo';
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && typeof s.balance === 'number' && Array.isArray(s.positions) && Array.isArray(s.pending) && Array.isArray(s.history)) {
      return { alerts: [], ...s };
    }
  } catch { /* corrupted or blocked storage: start fresh */ }
  return { ...Demo.initialState(), alerts: [] };
}
let state = load();
function setState(next) {
  state = next;
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
  renderAccount();
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  navigator.vibrate?.(30);
}

// ---------- Splash ----------
const embedded = new URLSearchParams(location.search).has('embed');
document.documentElement.style.setProperty('--splash', embedded ? '.7s' : '1.4s');
setTimeout(() => $('#splash').classList.add('done'), embedded ? 800 : 1600);
if (isStandalone) $$('[data-hide-installed]').forEach((el) => (el.hidden = true));

// ---------- Charts ----------
const candles = {}; // tf -> candles, created lazily
const getCandles = (tf) => (candles[tf] ??= makeCandles(tf, tf === 'D1' ? 60 : 70));
const view = { homeTf: 'M15', chartTf: 'M15', chartType: 'candle', screen: 'home' };
const homeCanvas = $('#homeChart');
const bigCanvas = $('#bigChart');

function buildTfChips(group, current, onPick) {
  const wrap = $(`[data-tf-group="${group}"]`);
  const tfs = group === 'home' ? ['M1', 'M5', 'M15', 'H1', 'D1'] : TIMEFRAMES;
  wrap.innerHTML = tfs.map((tf) => `<button type="button" data-tf="${tf}" aria-pressed="${tf === current}">${tf}</button>`).join('');
  wrap.addEventListener('click', (e) => {
    const tf = e.target.dataset?.tf;
    if (!tf) return;
    wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tf === tf)));
    onPick(tf);
  });
}
buildTfChips('home', view.homeTf, (tf) => { view.homeTf = tf; animateIn(homeCanvas, getCandles(tf), { type: 'line', axis: false }, 700); });
buildTfChips('chart', view.chartTf, (tf) => { view.chartTf = tf; animateIn(bigCanvas, getCandles(tf), { type: view.chartType }, 700); });

$$('[data-ctype]').forEach((b) => b.addEventListener('click', () => {
  view.chartType = b.dataset.ctype;
  $$('[data-ctype]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  drawChart(bigCanvas, getCandles(view.chartTf), { type: view.chartType });
}));

function drawVisible() {
  if (view.screen === 'home') drawChart(homeCanvas, getCandles(view.homeTf), { type: 'line', axis: false });
  if (view.screen === 'chart') {
    const c = getCandles(view.chartTf);
    drawChart(bigCanvas, c, { type: view.chartType });
    const last = c[c.length - 1];
    $('#ohlc').innerHTML = ['O', 'H', 'L', 'C'].map((k) => `<div><dt>${k}</dt><dd>${fmt(last[k.toLowerCase()])}</dd></div>`).join('');
  }
}
addEventListener('resize', drawVisible);

// ---------- Router (hash based: native back button works) ----------
const TABS = ['home', 'chart', 'trade', 'analysis', 'more'];
function show(name) {
  if (!$(`[data-screen="${name}"]`)) name = 'home';
  view.screen = name;
  $$('[data-screen]').forEach((s) => (s.hidden = s.dataset.screen !== name));
  const tab = name === 'account' ? 'more' : name;
  $$('[data-tab]').forEach((a) => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const title = $(`[data-screen="${name}"]`).dataset.title;
  $('#title').innerHTML = name === 'home' ? '<span class="gold-text">ZaF</span>' : '';
  if (name !== 'home') $('#title').textContent = title;
  $('#backBtn').hidden = name !== 'account';
  $('#view').scrollTop = 0;
  if (name === 'home') animateIn(homeCanvas, getCandles(view.homeTf), { type: 'line', axis: false }, 900);
  if (name === 'chart') animateIn(bigCanvas, getCandles(view.chartTf), { type: view.chartType }, 900).then(drawVisible);
  if (name === 'analysis') renderAnalysis();
}
addEventListener('hashchange', () => show(location.hash.slice(1)));

// ---------- Trade form ----------
const form = { mode: 'market', side: 'buy' };
const lotsInput = $('#lots');
const num = (el) => (el.value.trim() === '' ? null : Number(el.value));
const getLots = () => Demo.clampLots(Number(lotsInput.value) || Demo.MIN_LOT);

$$('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  form.mode = b.dataset.mode;
  $$('[data-mode]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $$('[data-show]').forEach((el) => (el.hidden = el.dataset.show !== form.mode));
  if (form.mode === 'pending' && !$('#pendingPrice').value) $('#pendingPrice').value = feed.price.bid.toFixed(2);
  updateTradeInfo();
}));

function pickSide(side) {
  form.side = side;
  $$('[data-side]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.side === side)));
  updateTradeInfo();
}
$$('[data-side]').forEach((b) => b.addEventListener('click', () => pickSide(b.dataset.side)));
$$('[data-quick]').forEach((a) => a.addEventListener('click', () => pickSide(a.dataset.quick)));

$$('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const lots = getLots();
  const step = lots < 1 ? 0.01 : 0.1;
  lotsInput.value = Demo.clampLots(lots + Number(b.dataset.step) * step).toFixed(2);
  updateTradeInfo();
}));
$$('[data-lot]').forEach((b) => b.addEventListener('click', () => { lotsInput.value = b.dataset.lot; updateTradeInfo(); }));
lotsInput.addEventListener('change', () => { lotsInput.value = getLots().toFixed(2); updateTradeInfo(); });
[$('#pendingPrice'), $('#slInput'), $('#tpInput')].forEach((el) => el.addEventListener('input', updateTradeInfo));
$('#clearStops').addEventListener('click', () => { $('#slInput').value = ''; $('#tpInput').value = ''; updateTradeInfo(); });

function updateTradeInfo() {
  const q = feed.price;
  const lots = getLots();
  const ref = form.mode === 'pending' ? num($('#pendingPrice')) || q.bid : form.side === 'buy' ? q.ask : q.bid;
  $('#estMargin').textContent = `USD ${fmt(Demo.marginFor(lots, ref))}`;
  $('#perDollar').textContent = `USD ${fmt(lots * CONTRACT)}`;
  $('#sltpDot').hidden = num($('#slInput')) == null && num($('#tpInput')) == null;
  const p = num($('#pendingPrice'));
  if (p) {
    const mkt = form.side === 'buy' ? q.ask : q.bid;
    const kind = (form.side === 'buy') === p < mkt ? 'Limit' : 'Stop';
    $('#pendingKind').textContent = `${form.side === 'buy' ? 'Buy' : 'Sell'} ${kind} @ ${fmt(p)}`;
  }
  $('#placeOrder').textContent = `${form.mode === 'pending' ? 'Place Pending' : form.side === 'buy' ? 'Buy' : 'Sell'} ${lots.toFixed(2)} lot (Demo)`;
}

$('#placeOrder').addEventListener('click', () => {
  const q = feed.price;
  const order = { side: form.side, lots: getLots(), sl: num($('#slInput')), tp: num($('#tpInput')) };
  const { state: next, error } = form.mode === 'pending'
    ? Demo.placePending(state, { ...order, price: num($('#pendingPrice')) }, q)
    : Demo.openMarket(state, order, q);
  $('#orderError').textContent = error;
  if (error) return;
  setState(next);
  toast(form.mode === 'pending'
    ? `Pending ${form.side.toUpperCase()} ${order.lots.toFixed(2)} placed`
    : `${form.side.toUpperCase()} ${order.lots.toFixed(2)} XAUUSD @ ${fmt(form.side === 'buy' ? q.ask : q.bid)}`);
});

// Delegated close / cancel buttons in every list
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-close], [data-cancel], [data-del-alert]');
  if (!btn) return;
  if (btn.dataset.close) {
    const pos = state.positions.find((p) => p.id === btn.dataset.close);
    setState(Demo.closePosition(state, btn.dataset.close, feed.price));
    if (pos) toast(`Closed ${pos.side.toUpperCase()} · ${signed(state.history[0].pnl)}`);
  } else if (btn.dataset.cancel) {
    setState(Demo.cancelPending(state, btn.dataset.cancel));
  } else {
    setState({ ...state, alerts: state.alerts.filter((a) => a.id !== btn.dataset.delAlert) });
  }
});

// ---------- Alerts ----------
$('#alertForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const price = num($('#alertPrice'));
  if (!(price > 0)) return;
  const dir = price >= feed.price.bid ? 'above' : 'below';
  setState({ ...state, alerts: [...state.alerts, { id: Math.random().toString(36).slice(2, 9), price, dir }] });
  $('#alertPrice').value = '';
  toast(`Alert set: XAUUSD ${dir} ${fmt(price)}`);
});

// ---------- Rendering ----------
const posItem = (p, q) => {
  const pl = Demo.pnl(p, q);
  const stops = [p.sl != null && `SL ${fmt(p.sl)}`, p.tp != null && `TP ${fmt(p.tp)}`].filter(Boolean).join(' · ');
  return `<li><span class="tag ${esc(p.side)}">${esc(p.side.toUpperCase())}</span>
    <span class="grow"><strong class="mono">${p.lots.toFixed(2)} @ ${fmt(p.entry)}</strong><small>${stops || 'No SL/TP'}</small></span>
    <strong class="mono ${pl >= 0 ? 'up' : 'down'}">${signed(pl)}</strong>
    <button class="x" data-close="${esc(p.id)}" aria-label="Close position">×</button></li>`;
};
const empty = (text) => `<li class="empty">${text}</li>`;

function renderAccount() {
  const q = feed.price;
  const eq = Demo.equity(state, q);
  const fl = Demo.floating(state, q);
  $$('[data-balance]').forEach((el) => (el.textContent = money(state.balance)));
  $$('[data-equity]').forEach((el) => (el.textContent = money(eq)));
  $$('[data-free]').forEach((el) => (el.textContent = money(Demo.freeMargin(state, q))));
  $$('[data-floating]').forEach((el) => { el.textContent = signed(fl); el.className = `mono ${fl >= 0 ? 'up' : 'down'}`; });
  $('#posCount').textContent = state.positions.length;
  $$('[data-poscount]').forEach((el) => (el.textContent = state.positions.length));

  const positions = state.positions.map((p) => posItem(p, q)).join('') || empty('No open positions');
  $('#positions').innerHTML = positions;
  $('#accPositions').innerHTML = positions;

  $('#pendingTitle').hidden = !state.pending.length;
  $('#pendingList').innerHTML = state.pending.map((o) => `<li><span class="tag ${esc(o.side)}">${esc(o.side.toUpperCase())} ${esc(o.kind.toUpperCase())}</span>
    <span class="grow"><strong class="mono">${o.lots.toFixed(2)} @ ${fmt(o.price)}</strong><small>Waiting for price</small></span>
    <button class="x" data-cancel="${esc(o.id)}" aria-label="Cancel order">×</button></li>`).join('');

  $('#history').innerHTML = state.history.slice(0, 30).map((h) => `<li><span class="tag ${esc(h.side)}">${esc(h.side.toUpperCase())}</span>
    <span class="grow"><strong class="mono">${h.lots.toFixed(2)} · ${fmt(h.entry)} → ${fmt(h.exit)}</strong><small>${new Date(h.closedAt).toLocaleString()} · ${esc(h.reason.toUpperCase())}</small></span>
    <strong class="mono ${h.pnl >= 0 ? 'up' : 'down'}">${signed(h.pnl)}</strong></li>`).join('') || empty('No history yet');

  $('#alerts').innerHTML = state.alerts.map((a) => `<li><span class="grow"><strong class="mono">${a.dir === 'above' ? '≥' : '≤'} ${fmt(a.price)}</strong></span>
    <button class="x" data-del-alert="${esc(a.id)}" aria-label="Delete alert">×</button></li>`).join('');
}

$('#resetDemo').addEventListener('click', () => {
  if (!confirm('Reset demo account to $10,000 and clear all positions and history?')) return;
  setState({ ...Demo.initialState(), alerts: state.alerts });
  toast('Demo account reset');
});

// ---------- Analysis (indicators from H1 candles) ----------
const sma = (arr, n) => arr.slice(-n).reduce((s, c) => s + c.c, 0) / Math.min(n, arr.length);
function rsi(arr, n = 14) {
  let gain = 0, loss = 0;
  for (let i = arr.length - n; i < arr.length; i++) {
    const d = arr[i].c - arr[i - 1].c;
    d > 0 ? (gain += d) : (loss -= d);
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
function renderAnalysis() {
  const c = getCandles('H1');
  const px = c[c.length - 1].c;
  const s20 = sma(c, 20), s50 = sma(c, 50), r = rsi(c);
  const atr = c.slice(-14).reduce((s, k) => s + (k.h - k.l), 0) / 14;
  $('#indicators').innerHTML = [
    ['Price', fmt(px)], ['SMA 20', fmt(s20)], ['SMA 50', fmt(s50)], ['RSI 14', r.toFixed(1)], ['ATR 14', fmt(atr)],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd class="mono">${v}</dd></div>`).join('');

  const bull = px > s20 && s20 > s50;
  const bear = px < s20 && s20 < s50;
  const sig = $('#signal');
  sig.className = `signal ${bull ? 'bull' : bear ? 'bear' : 'flat'}`;
  sig.textContent = bull ? 'Bullish trend · price above SMA20 > SMA50' : bear ? 'Bearish trend · price below SMA20 < SMA50' : 'Ranging · no clear trend';

  const ideas = [];
  if (bull) ideas.push(`Trend is up. Watch for pullbacks toward SMA20 (${fmt(s20)}) for buy setups, with stops below ${fmt(s20 - atr)}.`);
  if (bear) ideas.push(`Trend is down. Rallies into SMA20 (${fmt(s20)}) may offer sell setups, with stops above ${fmt(s20 + atr)}.`);
  if (!bull && !bear) ideas.push(`Range conditions. Consider waiting for a close beyond ${fmt(px + atr)} or ${fmt(px - atr)} before committing.`);
  if (r > 70) ideas.push(`RSI ${r.toFixed(0)} is overbought, so chasing longs here carries extra risk.`);
  if (r < 30) ideas.push(`RSI ${r.toFixed(0)} is oversold, so chasing shorts here carries extra risk.`);
  ideas.push(`Average H1 range is ~$${fmt(atr)}. Size positions so a 1×ATR stop risks no more than 1–2% of equity.`);
  $('#ideas').innerHTML = ideas.map((t) => `<p>${t}</p>`).join('');
}

// ---------- Live feed ----------
const feed = createFeed();
let lastBid = feed.price.bid;
let sentiment = 60;

feed.subscribe((q) => {
  for (const tf of Object.keys(candles)) candles[tf] = applyTick(candles[tf], tf, q.bid);

  $$('[data-bid]').forEach((el) => {
    el.textContent = fmt(q.bid);
    if (q.bid !== lastBid && el.tagName === 'STRONG') {
      el.classList.remove('tick-up', 'tick-down');
      el.classList.add(q.bid > lastBid ? 'tick-up' : 'tick-down');
    }
  });
  $$('[data-ask]').forEach((el) => (el.textContent = fmt(q.ask)));
  $$('[data-change]').forEach((el) => {
    const sign = q.change >= 0 ? '+' : '';
    el.textContent = `${sign}${fmt(q.change)} (${sign}${q.changePct.toFixed(2)}%)`;
    el.className = `mono ${q.change >= 0 ? 'up' : 'down'}`;
  });
  lastBid = q.bid;

  sentiment = Math.min(75, Math.max(35, sentiment + (Math.random() - 0.5) * 1.5));
  $('#sentBar').style.width = `${sentiment}%`;
  $('#sentBuy').textContent = `${Math.round(sentiment)}% Buyers`;
  $('#sentSell').textContent = `${100 - Math.round(sentiment)}% Sellers`;

  // Engine: pending fills, SL/TP, alerts
  const { state: next, events } = Demo.processTick(state, q);
  const fired = state.alerts.filter((a) => (a.dir === 'above' ? q.bid >= a.price : q.bid <= a.price));
  if (events.length || fired.length) {
    setState({ ...next, alerts: state.alerts.filter((a) => !fired.includes(a)) });
    events.forEach((ev) => toast(ev.type === 'filled'
      ? `Pending ${ev.order.side.toUpperCase()} filled @ ${fmt(ev.price)}`
      : `${ev.type === 'sl' ? 'Stop Loss' : 'Take Profit'} hit · ${signed(ev.pnl)}`));
    fired.forEach((a) => toast(`🔔 XAUUSD ${a.dir} ${fmt(a.price)}`));
  } else {
    renderAccount();
  }

  if (view.screen === 'trade') updateTradeInfo();
  drawVisible();
});

show(location.hash.slice(1) || 'home');
updateTradeInfo();
