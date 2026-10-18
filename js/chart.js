// Minimal canvas chart: candles or area line, price grid, last-price tag. DPR aware.

const COLORS = { up: '#22C55E', down: '#EF4444', grid: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.45)', gold: '#F5C451' };

function fit(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: width, h: height };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{o:number,h:number,l:number,c:number}[]} candles
 * @param {{ type?: 'candle'|'line', axis?: boolean, tag?: boolean, progress?: number }} opts
 *   progress 0..1 animates the draw-in from left to right.
 */
export function drawChart(canvas, candles, { type = 'candle', axis = true, tag = true, progress = 1 } = {}) {
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!candles.length || !w || !h) return;

  const pad = { t: 10, b: 10, l: 4, r: axis ? 52 : 6 };
  const visible = candles.slice(0, Math.max(1, Math.ceil(candles.length * progress)));
  const hi = Math.max(...candles.map((c) => c.h));
  const lo = Math.min(...candles.map((c) => c.l));
  const range = hi - lo || 1;
  const cw = (w - pad.l - pad.r) / candles.length;
  const y = (p) => pad.t + ((hi - p) / range) * (h - pad.t - pad.b);
  const x = (i) => pad.l + i * cw + cw / 2;

  if (axis) {
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const p = lo + (range * g) / 4;
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(pad.l, y(p)); ctx.lineTo(w - pad.r, y(p)); ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(p.toFixed(2), w - pad.r + 6, y(p));
    }
  }

  if (type === 'line') {
    const grad = ctx.createLinearGradient(0, pad.t, 0, h);
    grad.addColorStop(0, 'rgba(34,197,94,0.35)');
    grad.addColorStop(1, 'rgba(34,197,94,0)');
    ctx.beginPath();
    visible.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c))));
    ctx.strokeStyle = COLORS.up; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(x(visible.length - 1), h); ctx.lineTo(x(0), h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  } else {
    const bw = Math.max(1, cw * 0.62);
    visible.forEach((c, i) => {
      const color = c.c >= c.o ? COLORS.up : COLORS.down;
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(i), y(c.h)); ctx.lineTo(x(i), y(c.l)); ctx.stroke();
      const top = y(Math.max(c.o, c.c));
      ctx.fillRect(x(i) - bw / 2, top, bw, Math.max(1, y(Math.min(c.o, c.c)) - top));
    });
  }

  if (tag && progress >= 1) {
    const last = candles[candles.length - 1];
    const ly = y(last.c);
    const color = last.c >= last.o ? COLORS.up : COLORS.down;
    ctx.setLineDash([3, 3]); ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(pad.l, ly); ctx.lineTo(w - pad.r, ly); ctx.stroke(); ctx.setLineDash([]);
    if (axis) {
      ctx.fillStyle = color;
      ctx.fillRect(w - pad.r + 1, ly - 8, pad.r - 2, 16);
      ctx.fillStyle = '#05140A';
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(last.c.toFixed(2), w - pad.r + 4, ly);
    }
  }
}

/** Animate the draw-in once, then resolve. */
export function animateIn(canvas, candles, opts, ms = 1200) {
  return new Promise((resolve) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawChart(canvas, candles, opts); return resolve(); }
    const t0 = performance.now();
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      drawChart(canvas, candles, { ...opts, progress: 1 - (1 - p) ** 3 });
      p < 1 ? requestAnimationFrame(frame) : resolve();
    };
    requestAnimationFrame(frame);
  });
}
