// ============================================================================
// js/indicator-engine.js — Technical Indicators & Sub-Pane Rendering Engine
// ============================================================================
'use strict';

const IndicatorEngine = (() => {

  // ── 1. Math Computations ─────────────────────────────────────────────────
  function sma(data, period = 20, source = 'close') {
    const out = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j][source];
      out.push(sum / period);
    }
    return out;
  }

  function ema(data, period = 20, source = 'close') {
    const k = 2 / (period + 1);
    const out = [];
    let prev = null;
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      const val = data[i][source];
      if (prev === null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j][source];
        prev = sum / period;
      } else {
        prev = val * k + prev * (1 - k);
      }
      out.push(prev);
    }
    return out;
  }

  function bollingerBands(data, period = 20, mult = 2.0, source = 'close') {
    const mid = sma(data, period, source);
    const upper = [];
    const lower = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1 || mid[i] === null) {
        upper.push(null);
        lower.push(null);
        continue;
      }
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (data[j][source] - mid[i]) ** 2;
      }
      const dev = Math.sqrt(sumSq / period) * mult;
      upper.push(mid[i] + dev);
      lower.push(mid[i] - dev);
    }
    return { mid, upper, lower };
  }

  function vwap(data) {
    const out = [];
    let cumVol = 0;
    let cumVolPrice = 0;

    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const typ = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 1;
      cumVolPrice += typ * vol;
      cumVol += vol;
      out.push(cumVol > 0 ? cumVolPrice / cumVol : c.close);
    }
    return out;
  }

  function rsi(data, period = 14) {
    const out = [];
    if (data.length < period) return out;

    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = 0; i < period; i++) out.push(null);
    out.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) out.push(100);
      else out.push(100 - (100 / (1 + avgGain / avgLoss)));
    }
    return out;
  }

  function macd(data, fast = 12, slow = 26, signalPeriod = 9) {
    const fastEma = ema(data, fast);
    const slowEma = ema(data, slow);
    const macdLine = [];

    for (let i = 0; i < data.length; i++) {
      if (fastEma[i] === null || slowEma[i] === null) macdLine.push(null);
      else macdLine.push(fastEma[i] - slowEma[i]);
    }

    // Signal is EMA of MACD Line
    const k = 2 / (signalPeriod + 1);
    const signalLine = [];
    let prevSig = null;

    for (let i = 0; i < macdLine.length; i++) {
      const val = macdLine[i];
      if (val === null) { signalLine.push(null); continue; }
      if (prevSig === null) {
        prevSig = val;
      } else {
        prevSig = val * k + prevSig * (1 - k);
      }
      signalLine.push(prevSig);
    }

    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) histogram.push(null);
      else histogram.push(macdLine[i] - signalLine[i]);
    }

    return { macdLine, signalLine, histogram };
  }

  function stochastic(data, kPeriod = 14, dPeriod = 3) {
    const k = [];
    for (let i = 0; i < data.length; i++) {
      if (i < kPeriod - 1) { k.push(null); continue; }
      let minLow = Infinity;
      let maxHigh = -Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (data[j].low < minLow) minLow = data[j].low;
        if (data[j].high > maxHigh) maxHigh = data[j].high;
      }
      const close = data[i].close;
      const span = maxHigh - minLow;
      k.push(span > 0 ? ((close - minLow) / span) * 100 : 50);
    }

    // %D is SMA of %K
    const d = [];
    for (let i = 0; i < k.length; i++) {
      if (k[i] === null || i < kPeriod + dPeriod - 2) { d.push(null); continue; }
      let sum = 0;
      for (let j = i - dPeriod + 1; j <= i; j++) sum += (k[j] || 50);
      d.push(sum / dPeriod);
    }

    return { k, d };
  }

  function atr(data, period = 14) {
    const tr = [0];
    for (let i = 1; i < data.length; i++) {
      const h = data[i].high;
      const l = data[i].low;
      const prevC = data[i - 1].close;
      tr.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
    }
    const out = [];
    let avg = 0;
    for (let i = 0; i < tr.length; i++) {
      if (i < period) {
        avg += tr[i];
        out.push(null);
        if (i === period - 1) { avg /= period; out[i] = avg; }
      } else {
        avg = (avg * (period - 1) + tr[i]) / period;
        out.push(avg);
      }
    }
    return out;
  }

  // ── 2. Indicator Sub-Pane Renderer ───────────────────────────────────────
  // Class to render secondary panes (RSI, MACD, Stoch, Volume)
  class SubPane {
    constructor(container, id, type, title, height = 110) {
      this.container = container;
      this.id = id;
      this.type = type; // 'rsi', 'macd', 'stoch', 'atr', 'volume'
      this.title = title;
      this.height = height;
      this.visible = true;

      this._initDOM();
    }

    _initDOM() {
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'sub-pane-wrapper';
      this.wrapper.style.height = `${this.height}px`;
      this.wrapper.style.position = 'relative';
      this.wrapper.style.borderTop = '1px solid #2a2e39';
      this.wrapper.style.background = '#131722';

      // Header Bar with Title & Close
      this.header = document.createElement('div');
      this.header.className = 'sub-pane-header';
      this.header.innerHTML = `
        <span class="sub-pane-title">${this.title}</span>
        <span class="sub-pane-val" id="${this.id}_val">--</span>
        <button class="sub-pane-btn" title="Close Pane">✕</button>
      `;
      this.wrapper.appendChild(this.header);

      this.closeBtn = this.header.querySelector('.sub-pane-btn');
      this.closeBtn.onclick = () => {
        if (this.onClose) this.onClose(this.id);
      };

      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.wrapper.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.container.appendChild(this.wrapper);
    }

    render(chartEngine, data) {
      if (!this.visible || !chartEngine || !data) return;

      const rect = this.wrapper.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      const dpr = window.devicePixelRatio || 1;

      if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const ctx = this.ctx;
      ctx.fillStyle = '#131722';
      ctx.fillRect(0, 0, w, h);

      const range = chartEngine._calcVisibleRange();
      if (range.count === 0) return;

      const chartW = chartEngine.chartWidth;
      const axisW = chartEngine.priceAxisWidth;

      if (this.type === 'rsi') {
        this._renderRSI(ctx, chartEngine, range, data, chartW, h, axisW);
      } else if (this.type === 'macd') {
        this._renderMACD(ctx, chartEngine, range, data, chartW, h, axisW);
      } else if (this.type === 'stoch') {
        this._renderStoch(ctx, chartEngine, range, data, chartW, h, axisW);
      }
    }

    _renderRSI(ctx, chartEngine, range, data, w, h, axisW) {
      const rsiArr = rsi(data, 14);
      const y70 = h * 0.30;
      const y30 = h * 0.70;

      // 70 / 30 guide bands
      ctx.save();
      ctx.strokeStyle = '#2a2e39';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y70); ctx.lineTo(w, y70);
      ctx.moveTo(0, y30); ctx.lineTo(w, y30);
      ctx.stroke();

      // Band Fill (30 to 70 zone)
      ctx.fillStyle = 'rgba(120, 81, 169, 0.08)';
      ctx.fillRect(0, y70, w, y30 - y70);
      ctx.restore();

      // RSI Line
      ctx.save();
      ctx.strokeStyle = '#b388ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = rsiArr[i];
        if (val === null || isNaN(val)) continue;
        const x = chartEngine.indexToX(i, range);
        const y = h - (val / 100) * h;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Axis Labels (70, 30)
      ctx.fillStyle = '#787b86';
      ctx.font = '10px sans-serif';
      ctx.fillText('70', w + 6, y70 + 3);
      ctx.fillText('30', w + 6, y30 + 3);

      // Latest Value Pill
      const lastVal = rsiArr[rsiArr.length - 1];
      if (lastVal !== null && !isNaN(lastVal)) {
        const valEl = document.getElementById(`${this.id}_val`);
        if (valEl) valEl.textContent = lastVal.toFixed(1);
      }
    }

    _renderMACD(ctx, chartEngine, range, data, w, h, axisW) {
      const res = macd(data, 12, 26, 9);
      let maxAbs = 0.001;

      for (let i = range.start; i <= range.end; i++) {
        if (res.macdLine[i]) maxAbs = Math.max(maxAbs, Math.abs(res.macdLine[i]));
        if (res.signalLine[i]) maxAbs = Math.max(maxAbs, Math.abs(res.signalLine[i]));
        if (res.histogram[i]) maxAbs = Math.max(maxAbs, Math.abs(res.histogram[i]));
      }

      const zeroY = h / 2;
      const scale = (h * 0.44) / maxAbs;

      // Zero Line
      ctx.save();
      ctx.strokeStyle = '#2a2e39';
      ctx.beginPath();
      ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY);
      ctx.stroke();

      // Histogram
      const candleW = chartEngine.candleWidth;
      for (let i = range.start; i <= range.end; i++) {
        const hist = res.histogram[i];
        if (hist === null) continue;
        const x = chartEngine.indexToX(i, range);
        const barH = hist * scale;
        ctx.fillStyle = hist >= 0 ? '#089981' : '#f23645';
        ctx.fillRect(x - candleW / 2, zeroY - barH, candleW, barH);
      }

      // MACD Line (Blue)
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = res.macdLine[i];
        if (val === null) continue;
        const x = chartEngine.indexToX(i, range);
        const y = zeroY - val * scale;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Signal Line (Orange)
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = res.signalLine[i];
        if (val === null) continue;
        const x = chartEngine.indexToX(i, range);
        const y = zeroY - val * scale;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      const lastHist = res.histogram[res.histogram.length - 1];
      if (lastHist !== null) {
        const valEl = document.getElementById(`${this.id}_val`);
        if (valEl) valEl.textContent = `${lastHist.toFixed(2)}`;
      }
    }

    _renderStoch(ctx, chartEngine, range, data, w, h, axisW) {
      const res = stochastic(data, 14, 3);
      const y80 = h * 0.20;
      const y20 = h * 0.80;

      ctx.save();
      ctx.strokeStyle = '#2a2e39';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y80); ctx.lineTo(w, y80);
      ctx.moveTo(0, y20); ctx.lineTo(w, y20);
      ctx.stroke();
      ctx.restore();

      // %K Line (Blue)
      ctx.save();
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      let started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = res.k[i];
        if (val === null) continue;
        const x = chartEngine.indexToX(i, range);
        const y = h - (val / 100) * h;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // %D Line (Orange)
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = res.d[i];
        if (val === null) continue;
        const x = chartEngine.indexToX(i, range);
        const y = h - (val / 100) * h;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    destroy() {
      if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.removeChild(this.wrapper);
      }
    }
  }

  return {
    sma,
    ema,
    bollingerBands,
    vwap,
    rsi,
    macd,
    stochastic,
    atr,
    SubPane
  };
})();

if (typeof window !== 'undefined') window.IndicatorEngine = IndicatorEngine;
