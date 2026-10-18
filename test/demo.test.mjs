import assert from 'node:assert/strict';
import * as D from '../js/demo.js';

const q = (bid) => ({ bid, ask: Math.round((bid + 0.3) * 100) / 100 });
let s = D.initialState();

// Margin matches the mockup: 0.10 lot @ 2345.82 -> USD 23.46
assert.equal(D.marginFor(0.1, 2345.82), 23.46);

// Buy opens at ask, P/L closes at bid: +1.00 USD move * 0.10 lot * 100 oz = +10
const before = s;
let r = D.openMarket(s, { side: 'buy', lots: 0.1 }, q(2345.52));
assert.equal(r.error, '');
s = r.state;
assert.equal(s.positions[0].entry, 2345.82);
assert.equal(D.pnl(s.positions[0], q(2346.82)), 10);
assert.equal(D.equity(s, q(2346.82)), 10010);

// Original state was not mutated
assert.equal(before.positions.length, 0);

// Closing realizes P/L into balance and history
s = D.closePosition(s, s.positions[0].id, q(2346.82));
assert.equal(s.balance, 10010);
assert.equal(s.positions.length, 0);
assert.equal(s.history[0].pnl, 10);

// Stop validation
assert.match(D.openMarket(s, { side: 'buy', lots: 0.1, sl: 2400 }, q(2345)).error, /Stop Loss must be below/);
assert.match(D.openMarket(s, { side: 'sell', lots: 0.1, tp: 2400 }, q(2345)).error, /Take Profit must be below/);

// Margin check: 50 lots @ 2345 needs 11,725 > 10,010 free
assert.equal(D.openMarket(s, { side: 'buy', lots: 50 }, q(2345)).error, 'Not enough free margin');

// Sell with TP: hits when ask <= tp
s = D.openMarket(s, { side: 'sell', lots: 1, tp: 2340 }, q(2345)).state;
let t = D.processTick(s, q(2339.6)); // ask 2339.9
assert.equal(t.events[0].type, 'tp');
assert.equal(t.state.positions.length, 0);
assert.equal(t.state.history[0].pnl, 510); // (2345 - 2339.9) * 1 * 100
s = t.state;

// Pending buy limit below market fills when ask drops to it
r = D.placePending(s, { side: 'buy', lots: 0.5, price: 2340 }, q(2345));
assert.equal(r.state.pending[0].kind, 'limit');
t = D.processTick(r.state, q(2341)); // ask 2341.3, not yet
assert.equal(t.state.pending.length, 1);
t = D.processTick(t.state, q(2339.5)); // ask 2339.8 <= 2340
assert.equal(t.events[0].type, 'filled');
assert.equal(t.state.positions[0].entry, 2339.8);

// Buy stop above market
assert.equal(D.placePending(s, { side: 'buy', lots: 0.5, price: 2350 }, q(2345)).state.pending[0].kind, 'stop');

// Lot clamping
assert.equal(D.clampLots(0.004), 0.01);
assert.equal(D.clampLots(0.126), 0.13);
assert.equal(D.clampLots(999), 50);

console.log('demo account logic: all checks passed');
