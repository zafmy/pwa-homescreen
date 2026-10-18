// Pure demo-account logic. Every function returns a NEW state; nothing is mutated.
import { CONTRACT, LEVERAGE } from './price.js';

export const START_BALANCE = 10000;
export const LOT_STEP = 0.01;
export const MIN_LOT = 0.01;
export const MAX_LOT = 50;

const r2 = (n) => Math.round(n * 100) / 100;
const uid = () => Math.random().toString(36).slice(2, 9);

export const initialState = () => ({ balance: START_BALANCE, positions: [], pending: [], history: [] });

export const clampLots = (lots) => r2(Math.min(MAX_LOT, Math.max(MIN_LOT, Math.round(lots / LOT_STEP) * LOT_STEP)));

/** Required margin in USD for `lots` at `price`. */
export const marginFor = (lots, price) => r2((lots * CONTRACT * price) / LEVERAGE);

/** Buys close at bid, sells close at ask. */
export const pnl = (pos, { bid, ask }) =>
  r2((pos.side === 'buy' ? bid - pos.entry : pos.entry - ask) * pos.lots * CONTRACT);

export const floating = (state, quote) => r2(state.positions.reduce((s, p) => s + pnl(p, quote), 0));
export const usedMargin = (state) => r2(state.positions.reduce((s, p) => s + marginFor(p.lots, p.entry), 0));
export const equity = (state, quote) => r2(state.balance + floating(state, quote));
export const freeMargin = (state, quote) => r2(equity(state, quote) - usedMargin(state));

/**
 * Validate SL/TP against side and reference price. Returns an error string or ''.
 * Buy: SL below, TP above. Sell: SL above, TP below.
 */
export function validateStops(side, ref, sl, tp) {
  if (sl != null && (side === 'buy' ? sl >= ref : sl <= ref)) return `Stop Loss must be ${side === 'buy' ? 'below' : 'above'} ${ref.toFixed(2)}`;
  if (tp != null && (side === 'buy' ? tp <= ref : tp >= ref)) return `Take Profit must be ${side === 'buy' ? 'above' : 'below'} ${ref.toFixed(2)}`;
  return '';
}

/** Open a market order. Returns { state, error }. */
export function openMarket(state, { side, lots, sl = null, tp = null }, quote) {
  const entry = side === 'buy' ? quote.ask : quote.bid;
  const error = validateStops(side, entry, sl, tp) || marginCheck(state, lots, entry, quote);
  if (error) return { state, error };
  const pos = { id: uid(), side, lots: clampLots(lots), entry, sl, tp, t: Date.now() };
  return { state: { ...state, positions: [...state.positions, pos] }, error: '' };
}

/** Place a pending order at `price`; it becomes a position when the market reaches it. */
export function placePending(state, { side, lots, price, sl = null, tp = null }, quote) {
  if (!(price > 0)) return { state, error: 'Enter a valid entry price' };
  const error = validateStops(side, price, sl, tp) || marginCheck(state, lots, price, quote);
  if (error) return { state, error };
  const ref = side === 'buy' ? quote.ask : quote.bid;
  // Below market for a buy = limit, above = stop (mirrored for sells).
  const kind = (side === 'buy') === price < ref ? 'limit' : 'stop';
  const order = { id: uid(), side, kind, lots: clampLots(lots), price: r2(price), sl, tp, t: Date.now() };
  return { state: { ...state, pending: [...state.pending, order] }, error: '' };
}

function marginCheck(state, lots, price, quote) {
  if (!(lots >= MIN_LOT)) return 'Volume too small';
  return marginFor(lots, price) > freeMargin(state, quote) ? 'Not enough free margin' : '';
}

export function closePosition(state, id, quote, reason = 'manual') {
  const pos = state.positions.find((p) => p.id === id);
  if (!pos) return state;
  const profit = pnl(pos, quote);
  const exit = pos.side === 'buy' ? quote.bid : quote.ask;
  return {
    ...state,
    balance: r2(state.balance + profit),
    positions: state.positions.filter((p) => p.id !== id),
    history: [{ ...pos, exit, pnl: profit, reason, closedAt: Date.now() }, ...state.history].slice(0, 100),
  };
}

export const cancelPending = (state, id) => ({ ...state, pending: state.pending.filter((o) => o.id !== id) });

/**
 * Run on every tick: fill pending orders that were reached, then close positions whose SL/TP was hit.
 * Returns { state, events } where events describe what happened (for toasts).
 */
export function processTick(state, quote) {
  let next = state;
  const events = [];

  for (const o of state.pending) {
    const px = o.side === 'buy' ? quote.ask : quote.bid;
    const hit = o.kind === 'limit' ? (o.side === 'buy' ? px <= o.price : px >= o.price) : (o.side === 'buy' ? px >= o.price : px <= o.price);
    if (!hit) continue;
    const pos = { id: o.id, side: o.side, lots: o.lots, entry: px, sl: o.sl, tp: o.tp, t: Date.now() };
    next = { ...next, pending: next.pending.filter((p) => p.id !== o.id), positions: [...next.positions, pos] };
    events.push({ type: 'filled', order: o, price: px });
  }

  for (const p of next.positions) {
    const px = p.side === 'buy' ? quote.bid : quote.ask;
    const slHit = p.sl != null && (p.side === 'buy' ? px <= p.sl : px >= p.sl);
    const tpHit = p.tp != null && (p.side === 'buy' ? px >= p.tp : px <= p.tp);
    if (!slHit && !tpHit) continue;
    const reason = slHit ? 'sl' : 'tp';
    next = closePosition(next, p.id, quote, reason);
    events.push({ type: reason, position: p, pnl: next.history[0].pnl });
  }

  return { state: next, events };
}
