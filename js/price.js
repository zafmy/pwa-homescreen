// Simulated XAUUSD feed: a mean-reverting random walk. Demo only, NOT market data.
// ponytail: fake prices; swap createFeed() internals for a WebSocket/REST source when a broker API exists.

export const SYMBOL = 'XAUUSD';
export const SPREAD = 0.3; // USD between bid and ask
export const CONTRACT = 100; // oz per 1.00 lot
export const LEVERAGE = 1000;

const TF_SECONDS = { M1: 60, M5: 300, M15: 900, H1: 3600, H4: 14400, D1: 86400 };
export const TIMEFRAMES = Object.keys(TF_SECONDS);

const round2 = (n) => Math.round(n * 100) / 100;

function step(price, anchor, vol) {
  const drift = (anchor - price) * 0.002; // gently pull back toward the anchor
  return price + drift + (Math.random() - 0.48) * vol;
}

/** Build `count` historical candles ending now. */
export function makeCandles(tf = 'M15', count = 80, anchor = 2345.67) {
  const span = TF_SECONDS[tf] ?? 900;
  const vol = Math.sqrt(span / 60) * 0.55;
  const now = Math.floor(Date.now() / 1000 / span) * span;
  let price = anchor - vol * 6;
  return Array.from({ length: count }, (_, i) => {
    const open = price;
    let high = open, low = open;
    for (let k = 0; k < 6; k++) {
      price = step(price, anchor, vol);
      high = Math.max(high, price);
      low = Math.min(low, price);
    }
    return { t: now - (count - 1 - i) * span, o: round2(open), h: round2(high), l: round2(low), c: round2(price) };
  });
}

/**
 * Live tick stream. Listeners get { bid, ask, change, changePct, open }.
 * One shared feed per page keeps every widget in sync.
 */
export function createFeed({ start = 2345.67, intervalMs = 1000 } = {}) {
  const listeners = new Set();
  const dayOpen = round2(start - 12.34);
  let bid = start;
  let timer = null;

  const snapshot = () => {
    const change = round2(bid - dayOpen);
    return { bid: round2(bid), ask: round2(bid + SPREAD), change, changePct: round2((change / dayOpen) * 100), open: dayOpen };
  };

  const tick = () => {
    bid = step(bid, start, 0.45);
    const s = snapshot();
    listeners.forEach((fn) => fn(s));
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot());
      if (!timer) timer = setInterval(tick, intervalMs);
      return () => {
        listeners.delete(fn);
        if (!listeners.size) { clearInterval(timer); timer = null; }
      };
    },
    get price() { return snapshot(); },
  };
}

/** Fold a live price into the last candle (new candle when its time bucket ends). */
export function applyTick(candles, tf, price) {
  const span = TF_SECONDS[tf] ?? 900;
  const bucket = Math.floor(Date.now() / 1000 / span) * span;
  const last = candles[candles.length - 1];
  if (!last || bucket > last.t) {
    return [...candles.slice(1), { t: bucket, o: price, h: price, l: price, c: price }];
  }
  const updated = { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) };
  return [...candles.slice(0, -1), updated];
}

export const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
