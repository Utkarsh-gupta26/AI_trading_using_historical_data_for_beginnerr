// ============================================================================
// js/chart-engine.js — High-Performance TradingView-Grade Canvas Chart Engine
// ============================================================================
'use strict';

class ChartEngine {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.options = Object.assign({
      chartType: 'candlestick', // candlestick, hollow, heikinAshi, line, area, baseline, bar
      scaleType: 'linear',      // linear, log, percentage
      autoScale: true,
      showVolume: true,
      showGrid: true,
      showCrosshair: true,
      theme: 'dark',
      syncId: options.syncId || null
    }, options);

    this.candles = [];
    this.displayCandles = []; // For Heikin-Ashi or transformed types
    this.drawings = [];
    this.overlays = []; // Indicators on main chart: [{ id, name, type, color, data: [] }]

    // Viewport & Scale State
    this.candleWidth = 9;       // pixels per candle
    this.candleGap = 3;         // gap between candles
    this.panOffset = 0;         // horizontal pan offset in candles from right
    this.priceScaleFactor = 1.0;// manual vertical scale factor
    this.pricePanOffset = 0;    // manual vertical pan offset
    this.minPrice = 0;
    this.maxPrice = 1;
    this.firstVisiblePrice = 1;

    // Dimensions
    this.width = 800;
    this.height = 500;
    this.priceAxisWidth = 72;
    this.timeAxisHeight = 26;
    this.chartWidth = this.width - this.priceAxisWidth;
    this.chartHeight = this.height - this.timeAxisHeight;

    // Mouse & Crosshair State
    this.mouseX = -1;
    this.mouseY = -1;
    this.hoverIndex = -1;
    this.isDraggingChart = false;
    this.isDraggingPriceAxis = false;
    this.isDraggingTimeAxis = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartPan = 0;
    this.dragStartPriceScale = 1.0;

    // Callbacks
    this.onCrosshairMove = null;
    this.onVisibleRangeChange = null;
    this.onNeedOlderData = null;

    // Setup Canvas DOM
    this._initDOM();
    this._bindEvents();
  }

  _initDOM() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'chart-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    if (window.ResizeObserver && this.container) {
      this._ro = new ResizeObserver(() => {
        this.resize();
      });
      this._ro.observe(this.container);
    }

    this.resize();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.width = Math.floor(rect.width);
    this.height = Math.floor(rect.height);
    this.chartWidth = Math.max(10, this.width - this.priceAxisWidth);
    this.chartHeight = Math.max(10, this.height - this.timeAxisHeight);

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }

  setData(candles, resetView = false) {
    this.candles = candles || [];
    this._computeTransformedData();

    if (resetView || this.panOffset === 0) {
      this.panOffset = 0;
      this.priceScaleFactor = 1.0;
      this.pricePanOffset = 0;
    }
    this.render();
  }

  appendTick(candle, isNew) {
    if (!this.candles || this.candles.length === 0) {
      this.setData([candle], true);
      return;
    }

    if (isNew) {
      this.candles.push(candle);
      if (this.panOffset > 0) this.panOffset += 1; // Keep viewing the past position
    } else {
      this.candles[this.candles.length - 1] = candle;
    }

    this._computeTransformedData();
    this.render();
  }

  prependOlderCandles(olderCandles) {
    if (!olderCandles || olderCandles.length === 0) return;
    this.candles = [...olderCandles, ...this.candles];
    this._computeTransformedData();
    // Shift panOffset so the user viewport stays seamlessly stationary
    this.panOffset += olderCandles.length;
    this.render();
  }

  setChartType(type) {
    this.options.chartType = type;
    this._computeTransformedData();
    this.render();
  }

  setScaleType(scale) {
    this.options.scaleType = scale; // linear, log, percentage
    this.render();
  }

  resetChart() {
    this.panOffset = 0;
    this.priceScaleFactor = 1.0;
    this.pricePanOffset = 0;
    this.candleWidth = 9;
    this.candleGap = 3;
    this.render();
  }

  // ── Heikin-Ashi & Transform computations ─────────────────────────────────
  _computeTransformedData() {
    if (this.options.chartType !== 'heikinAshi') {
      this.displayCandles = this.candles;
      return;
    }

    const ha = [];
    for (let i = 0; i < this.candles.length; i++) {
      const c = this.candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      let haOpen;
      if (i === 0) {
        haOpen = (c.open + c.close) / 2;
      } else {
        haOpen = (ha[i - 1].open + ha[i - 1].close) / 2;
      }
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);

      ha.push({
        time: c.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: c.volume,
        raw: c
      });
    }
    this.displayCandles = ha;
  }

  // ── Coordinates & Scaling Math ───────────────────────────────────────────
  _calcVisibleRange() {
    const total = this.displayCandles.length;
    if (total === 0) return { start: 0, end: 0, count: 0 };

    const step = this.candleWidth + this.candleGap;
    const visibleCount = Math.ceil(this.chartWidth / step) + 2;

    const end = Math.max(0, total - 1 - this.panOffset);
    const start = Math.max(0, end - visibleCount + 1);

    return { start, end, count: Math.max(0, end - start + 1) };
  }

  priceToY(price) {
    if (this.minPrice === this.maxPrice) return this.chartHeight / 2;
    let norm;
    if (this.options.scaleType === 'log') {
      const logMin = Math.log(Math.max(1e-8, this.minPrice));
      const logMax = Math.log(Math.max(1e-8, this.maxPrice));
      const logP = Math.log(Math.max(1e-8, price));
      norm = (logP - logMin) / (logMax - logMin);
    } else if (this.options.scaleType === 'percentage') {
      const base = this.firstVisiblePrice || 1;
      const pct = ((price - base) / base) * 100;
      const pctMin = ((this.minPrice - base) / base) * 100;
      const pctMax = ((this.maxPrice - base) / base) * 100;
      norm = (pct - pctMin) / (pctMax - pctMin);
    } else {
      norm = (price - this.minPrice) / (this.maxPrice - this.minPrice);
    }

    // Canvas Y: 0 at top, chartHeight at bottom
    return this.chartHeight - (norm * this.chartHeight);
  }

  yToPrice(y) {
    const norm = (this.chartHeight - y) / this.chartHeight;
    if (this.options.scaleType === 'log') {
      const logMin = Math.log(Math.max(1e-8, this.minPrice));
      const logMax = Math.log(Math.max(1e-8, this.maxPrice));
      return Math.exp(logMin + norm * (logMax - logMin));
    } else if (this.options.scaleType === 'percentage') {
      const base = this.firstVisiblePrice || 1;
      const pctMin = ((this.minPrice - base) / base) * 100;
      const pctMax = ((this.maxPrice - base) / base) * 100;
      const pct = pctMin + norm * (pctMax - pctMin);
      return base * (1 + pct / 100);
    } else {
      return this.minPrice + norm * (this.maxPrice - this.minPrice);
    }
  }

  indexToX(index, range) {
    const step = this.candleWidth + this.candleGap;
    // Rightmost visible candle sits near right edge of chart area
    const rightMargin = 20;
    const offsetFromEnd = (range.end - index);
    return this.chartWidth - rightMargin - (offsetFromEnd * step);
  }

  xToIndex(x, range) {
    const step = this.candleWidth + this.candleGap;
    const rightMargin = 20;
    const offsetFromRight = (this.chartWidth - rightMargin - x);
    const index = Math.round(range.end - (offsetFromRight / step));
    return index;
  }

  // ── Render Master Pipeline ───────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear with terminal dark background
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, w, h);

    if (!this.displayCandles || this.displayCandles.length === 0) {
      this._renderEmptyState();
      return;
    }

    const range = this._calcVisibleRange();
    if (range.count === 0) return;

    // Calculate Min & Max for visible window
    let minP = Infinity;
    let maxP = -Infinity;
    let maxVol = 0;

    for (let i = range.start; i <= range.end; i++) {
      const c = this.displayCandles[i];
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    this.firstVisiblePrice = this.displayCandles[range.start]?.open || minP;

    // Apply auto-scale with 10% breathing room, modified by manual scaleFactor
    if (minP === Infinity) { minP = 100; maxP = 101; }
    const span = Math.max(0.0001, maxP - minP);
    const mid = (minP + maxP) / 2;
    const scaledSpan = (span * 1.15) / this.priceScaleFactor;

    this.minPrice = mid - scaledSpan / 2 + this.pricePanOffset;
    this.maxPrice = mid + scaledSpan / 2 + this.pricePanOffset;

    // 1. Render Grid
    if (this.options.showGrid) {
      this._renderGrid(range);
    }

    // 2. Render Volume Histogram (Bottom 20% of chart)
    if (this.options.showVolume) {
      this._renderVolume(range, maxVol);
    }

    // 3. Render Main Candles / Chart Type
    this._renderMainData(range);

    // 4. Render Overlays (Indicators on main chart: EMA, SMA, BB, etc.)
    this._renderOverlays(range);

    // 5. Render Drawings (Lines, Fibs, Channels, Shapes)
    this._renderDrawings(range);

    // 6. Current Price Line & Axis Badges
    this._renderPriceLines();

    // 7. Render Axis Bars
    this._renderPriceAxis();
    this._renderTimeAxis(range);

    // 8. Render Crosshair & Live Hover Badges
    if (this.options.showCrosshair && this.mouseX >= 0 && this.mouseY >= 0 && this.mouseX < this.chartWidth && this.mouseY < this.chartHeight) {
      this._renderCrosshair(range);
    }

    // Trigger infinite backward pagination if user scrolled near the left end
    if (range.start <= 15 && this.onNeedOlderData) {
      this.onNeedOlderData();
    }
  }

  // ── Sub-Renderers ────────────────────────────────────────────────────────
  _renderGrid(range) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Horizontal Price Grid (5 to 8 divisions)
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const y = Math.round((this.chartHeight / steps) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.chartWidth, y);
      ctx.stroke();
    }

    // Vertical Time Grid
    const step = this.candleWidth + this.candleGap;
    const candlesPerLine = Math.max(10, Math.floor(80 / step));
    for (let i = range.start; i <= range.end; i++) {
      if (i % candlesPerLine === 0) {
        const x = Math.round(this.indexToX(i, range)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.chartHeight);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  _renderVolume(range, maxVol) {
    if (maxVol <= 0) return;
    const ctx = this.ctx;
    const volHeight = this.chartHeight * 0.18;
    const bottom = this.chartHeight;

    for (let i = range.start; i <= range.end; i++) {
      const c = this.displayCandles[i];
      const x = this.indexToX(i, range);
      const isBull = c.close >= c.open;
      const h = Math.max(2, (c.volume / maxVol) * volHeight);

      ctx.fillStyle = isBull ? 'rgba(8, 153, 129, 0.28)' : 'rgba(242, 54, 69, 0.28)';
      ctx.fillRect(x - this.candleWidth / 2, bottom - h, this.candleWidth, h);
    }
  }

  _renderMainData(range) {
    const ctx = this.ctx;
    const type = this.options.chartType;

    if (type === 'line' || type === 'area' || type === 'baseline') {
      this._renderLineStyle(range, type);
      return;
    }

    // Candlestick, Hollow, Heikin-Ashi, Bar
    for (let i = range.start; i <= range.end; i++) {
      const c = this.displayCandles[i];
      const x = Math.round(this.indexToX(i, range));
      const isBull = c.close >= c.open;
      const color = isBull ? '#089981' : '#f23645';

      const yOpen = Math.round(this.priceToY(c.open));
      const yClose = Math.round(this.priceToY(c.close));
      const yHigh = Math.round(this.priceToY(c.high));
      const yLow = Math.round(this.priceToY(c.low));

      if (type === 'bar') {
        // Traditional OHLC Bar
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        // High to low
        ctx.moveTo(x + 0.5, yHigh);
        ctx.lineTo(x + 0.5, yLow);
        // Open tick (left)
        ctx.moveTo(x - this.candleWidth / 2, yOpen + 0.5);
        ctx.lineTo(x + 0.5, yOpen + 0.5);
        // Close tick (right)
        ctx.moveTo(x + 0.5, yClose + 0.5);
        ctx.lineTo(x + this.candleWidth / 2, yClose + 0.5);
        ctx.stroke();
      } else {
        const candleW = Math.max(2, Math.round(this.candleWidth));
        const bodyLeft = Math.round(x - candleW / 2);
        const wickX = Math.round(x) + 0.5;

        // Wick line
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wickX, yHigh);
        ctx.lineTo(wickX, yLow);
        ctx.stroke();

        // Body
        const top = Math.min(yOpen, yClose);
        const bot = Math.max(yOpen, yClose);
        const height = Math.max(1.5, bot - top);

        if (type === 'hollow' && isBull) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(bodyLeft + 0.5, top + 0.5, candleW - 1, height);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(bodyLeft, top, candleW, height);
        }
      }
    }
  }

  _renderLineStyle(range, type) {
    const ctx = this.ctx;
    ctx.save();

    const points = [];
    for (let i = range.start; i <= range.end; i++) {
      const c = this.displayCandles[i];
      points.push({ x: this.indexToX(i, range), y: this.priceToY(c.close) });
    }

    if (points.length < 2) { ctx.restore(); return; }

    if (type === 'area') {
      const grad = ctx.createLinearGradient(0, 0, 0, this.chartHeight);
      grad.addColorStop(0, 'rgba(41, 98, 255, 0.35)');
      grad.addColorStop(1, 'rgba(41, 98, 255, 0.00)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, this.chartHeight);
      ctx.lineTo(points[0].x, this.chartHeight);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Line Stroke
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  _renderOverlays(range) {
    if (!this.overlays || this.overlays.length === 0) return;
    const ctx = this.ctx;

    for (const ov of this.overlays) {
      if (!ov.visible || !ov.data) continue;
      ctx.save();
      ctx.strokeStyle = ov.color || '#f7a600';
      ctx.lineWidth = ov.lineWidth || 1.5;
      ctx.beginPath();

      let started = false;
      for (let i = range.start; i <= range.end; i++) {
        const val = ov.data[i];
        if (val === null || val === undefined || isNaN(val)) continue;
        const x = this.indexToX(i, range);
        const y = this.priceToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  _renderDrawings(range) {
    if (!this.drawings || this.drawings.length === 0) return;
    const ctx = this.ctx;

    for (const d of this.drawings) {
      if (!d.visible) continue;
      ctx.save();
      ctx.strokeStyle = d.color || '#2962ff';
      ctx.lineWidth = d.lineWidth || 1.5;
      if (d.dash) ctx.setLineDash(d.dash);

      if (d.type === 'trendline' || d.type === 'ray' || d.type === 'extended') {
        const p1 = this._pointToXY(d.p1, range);
        const p2 = this._pointToXY(d.p2, range);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (d.type === 'horizontal') {
        const y = Math.round(this.priceToY(d.price)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.chartWidth, y);
        ctx.stroke();
      } else if (d.type === 'vertical') {
        const x = Math.round(this._timeToX(d.time, range)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.chartHeight);
        ctx.stroke();
      } else if (d.type === 'fibonacci') {
        this._renderFibonacci(d, range);
      } else if (d.type === 'rectangle') {
        const p1 = this._pointToXY(d.p1, range);
        const p2 = this._pointToXY(d.p2, range);
        ctx.fillStyle = d.fillColor || 'rgba(41, 98, 255, 0.15)';
        ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
      } else if (d.type === 'risk_reward') {
        this._renderRiskReward(d, range);
      }
      ctx.restore();
    }
  }

  _renderRiskReward(d, range) {
    const ctx = this.ctx;
    const entryY = this.priceToY(d.entryPrice);
    const stopY = this.priceToY(d.stopLoss);
    const targetY = this.priceToY(d.targetPrice);
    const p1X = this._timeToX(d.time, range);
    const width = d.width || Math.max(140, this.chartWidth * 0.28);
    const rightX = Math.min(this.chartWidth - 5, p1X + width);

    // Calculate dynamic values
    const stopDist = Math.abs(d.entryPrice - d.stopLoss);
    const targetDist = Math.abs(d.targetPrice - d.entryPrice);
    const rr = stopDist > 0 ? (targetDist / stopDist) : 0;
    const balance = (window.riskManager ? window.riskManager.accountBalance : 100000);
    const riskPct = (window.riskManager ? window.riskManager.riskPercent : 1.0);
    const riskAmt = balance * (riskPct / 100);
    const qty = stopDist > 0 ? Math.floor(riskAmt / stopDist) : 1;
    const rewardAmt = qty * targetDist;
    const beWinRate = rr > 0 ? (1 / (1 + rr)) * 100 : 50;

    // Green Target Box
    ctx.fillStyle = 'rgba(8, 153, 129, 0.18)';
    ctx.strokeStyle = '#089981';
    ctx.lineWidth = 1.5;
    const targetTop = Math.min(entryY, targetY);
    const targetH = Math.max(2, Math.abs(entryY - targetY));
    ctx.fillRect(p1X, targetTop, rightX - p1X, targetH);
    ctx.strokeRect(p1X, targetTop, rightX - p1X, targetH);

    // Red Stop Box
    ctx.fillStyle = 'rgba(242, 54, 69, 0.18)';
    ctx.strokeStyle = '#f23645';
    const stopTop = Math.min(entryY, stopY);
    const stopH = Math.max(2, Math.abs(entryY - stopY));
    ctx.fillRect(p1X, stopTop, rightX - p1X, stopH);
    ctx.strokeRect(p1X, stopTop, rightX - p1X, stopH);

    // Entry Line
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p1X, entryY);
    ctx.lineTo(rightX, entryY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Drag Handle Circles on the right edge
    ctx.fillStyle = '#089981';
    ctx.beginPath(); ctx.arc(rightX, targetY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2962ff';
    ctx.beginPath(); ctx.arc(rightX, entryY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f23645';
    ctx.beginPath(); ctx.arc(rightX, stopY, 5, 0, Math.PI * 2); ctx.fill();

    // Labels
    ctx.font = '10.5px "IBM Plex Mono", monospace';
    // Target Box Text
    ctx.fillStyle = '#089981';
    ctx.fillText(`TARGET: ${d.targetPrice.toFixed(2)} | +₹${Math.round(rewardAmt).toLocaleString()} (R:R 1:${rr.toFixed(2)})`, p1X + 8, targetTop + 14);

    // Entry Line Text
    ctx.fillStyle = '#f0f3fa';
    ctx.fillText(`ENTRY: ${d.entryPrice.toFixed(2)} | QTY: ${qty} units`, p1X + 8, entryY - 4);

    // Stop Box Text
    ctx.fillStyle = '#f23645';
    ctx.fillText(`STOP: ${d.stopLoss.toFixed(2)} | -₹${Math.round(riskAmt).toLocaleString()} | Break-even: ${beWinRate.toFixed(0)}%`, p1X + 8, stopTop + stopH - 6);
  }

  _renderFibonacci(d, range) {
    const ctx = this.ctx;
    const y1 = this.priceToY(d.p1.price);
    const y2 = this.priceToY(d.p2.price);
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    const colors = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#2962ff', '#787b86'];

    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      const y = y1 + (y2 - y1) * lvl;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.chartWidth, y);
      ctx.stroke();

      // Fib Label
      ctx.fillStyle = colors[i % colors.length];
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.fillText(`${lvl} (${this.yToPrice(y).toFixed(2)})`, 10, y - 3);
    }
  }

  _pointToXY(pt, range) {
    return {
      x: this._timeToX(pt.time, range),
      y: this.priceToY(pt.price)
    };
  }

  _timeToX(time, range) {
    // Find closest candle index
    let bestIdx = range.start;
    let minDiff = Infinity;
    for (let i = range.start; i <= range.end; i++) {
      const diff = Math.abs(this.displayCandles[i].time - time);
      if (diff < minDiff) { minDiff = diff; bestIdx = i; }
    }
    return this.indexToX(bestIdx, range);
  }

  _renderPriceLines() {
    if (!this.displayCandles || this.displayCandles.length === 0) return;
    const ctx = this.ctx;
    const last = this.displayCandles[this.displayCandles.length - 1];
    const lastPrice = last.close;
    const y = Math.round(this.priceToY(lastPrice)) + 0.5;

    // Dotted Current Price Line
    ctx.save();
    ctx.strokeStyle = last.close >= last.open ? '#089981' : '#f23645';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.chartWidth, y);
    ctx.stroke();

    // Badge on Price Scale
    ctx.fillStyle = last.close >= last.open ? '#089981' : '#f23645';
    ctx.fillRect(this.chartWidth + 1, y - 10, this.priceAxisWidth - 2, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._formatPrice(lastPrice), this.chartWidth + this.priceAxisWidth / 2, y);
    ctx.restore();
  }

  _renderPriceAxis() {
    const ctx = this.ctx;
    const x = this.chartWidth;

    // Background & Divider
    ctx.fillStyle = '#131722';
    ctx.fillRect(x, 0, this.priceAxisWidth, this.chartHeight);
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, this.chartHeight);
    ctx.stroke();

    // Price Labels
    const steps = 6;
    ctx.fillStyle = '#787b86';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= steps; i++) {
      const y = (this.chartHeight / steps) * i;
      const price = this.yToPrice(y);
      let text;
      if (this.options.scaleType === 'percentage') {
        const base = this.firstVisiblePrice || 1;
        const pct = ((price - base) / base) * 100;
        text = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
      } else {
        text = this._formatPrice(price);
      }
      ctx.fillText(text, x + 8, Math.max(8, Math.min(this.chartHeight - 8, y)));
    }
  }

  _renderTimeAxis(range) {
    const ctx = this.ctx;
    const y = this.chartHeight;

    // Background & Divider
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, y, this.width, this.timeAxisHeight);
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(this.width, y + 0.5);
    ctx.stroke();

    // Time Labels
    const step = this.candleWidth + this.candleGap;
    const candlesPerLabel = Math.max(10, Math.floor(100 / step));
    ctx.fillStyle = '#787b86';
    ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = range.start; i <= range.end; i++) {
      if (i % candlesPerLabel === 0) {
        const c = this.displayCandles[i];
        const xPos = this.indexToX(i, range);
        if (xPos > 30 && xPos < this.chartWidth - 30) {
          ctx.fillText(this._formatTime(c.time), xPos, y + this.timeAxisHeight / 2);
        }
      }
    }
  }

  _renderCrosshair(range) {
    const ctx = this.ctx;
    const mx = this.mouseX;
    const my = this.mouseY;

    // Draw Dashed Crosshair Lines
    ctx.save();
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(0, my + 0.5);
    ctx.lineTo(this.chartWidth, my + 0.5);
    ctx.stroke();

    // Vertical
    ctx.beginPath();
    ctx.moveTo(mx + 0.5, 0);
    ctx.lineTo(mx + 0.5, this.chartHeight);
    ctx.stroke();
    ctx.restore();

    // Price Badge on Price Axis
    const hoverPrice = this.yToPrice(my);
    ctx.fillStyle = '#363a45';
    ctx.fillRect(this.chartWidth + 1, my - 10, this.priceAxisWidth - 2, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._formatPrice(hoverPrice), this.chartWidth + this.priceAxisWidth / 2, my);

    // Time Badge on Time Axis
    const hoverIdx = this.xToIndex(mx, range);
    if (hoverIdx >= 0 && hoverIdx < this.displayCandles.length) {
      const hoverTime = this.displayCandles[hoverIdx].time;
      const timeStr = this._formatFullDateTime(hoverTime);
      ctx.fillStyle = '#363a45';
      const badgeW = 120;
      ctx.fillRect(Math.max(0, Math.min(this.chartWidth - badgeW, mx - badgeW / 2)), this.chartHeight + 1, badgeW, this.timeAxisHeight - 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.fillText(timeStr, Math.max(badgeW / 2, Math.min(this.chartWidth - badgeW / 2, mx)), this.chartHeight + this.timeAxisHeight / 2);

      // Notify callback for top OHLC header
      if (this.onCrosshairMove) {
        this.onCrosshairMove(this.displayCandles[hoverIdx]);
      }
    }
  }

  setChartState(state, message) {
    this.chartState = state;
    this.statusMessage = message;
    if (!this.displayCandles || this.displayCandles.length === 0) {
      this.render();
    }
  }

  updateActiveCandle(tick) {
    if (!this.displayCandles || this.displayCandles.length === 0) return;
    const ltp = Number(tick.ltp || tick.close);
    if (isNaN(ltp) || ltp <= 0) return;

    const last = this.displayCandles[this.displayCandles.length - 1];
    last.high = Math.max(last.high, ltp);
    last.low = Math.min(last.low, ltp);
    last.close = ltp;
    if (tick.volume) last.volume += (tick.volume || 0);

    this.render();
  }

  _renderEmptyState() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#131722';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const state = this.chartState || 'LOADING';
    let title = this.statusMessage || 'Loading authentic market data...';
    let subtitle = '';

    if (state === 'LOADING') {
      title = 'Loading authentic market data...';
      subtitle = 'Connecting to real-time market data engine';
      ctx.fillStyle = '#2962ff';
    } else if (state === 'MARKET_CLOSED') {
      title = 'Market Closed';
      subtitle = this.statusMessage || 'Showing last authentic trading session close';
      ctx.fillStyle = '#f59e0b';
    } else if (state === 'DISCONNECTED' || state === 'RECONNECTING') {
      title = 'Market Data Feed Reconnecting...';
      subtitle = 'Attempting connection to local real-time WebSocket server';
      ctx.fillStyle = '#ef4444';
    } else if (state === 'NO_DATA') {
      title = 'No Market Data Available';
      subtitle = this.statusMessage || 'The selected instrument returned no trading history';
      ctx.fillStyle = '#787b86';
    } else {
      ctx.fillStyle = '#787b86';
    }

    ctx.font = 'bold 14.5px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    ctx.fillText(title, this.chartWidth / 2, this.chartHeight / 2 - 10);

    if (subtitle) {
      ctx.fillStyle = '#787b86';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.fillText(subtitle, this.chartWidth / 2, this.chartHeight / 2 + 14);
    }
    ctx.restore();
  }

  // ── Formatters ───────────────────────────────────────────────────────────
  _formatPrice(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(2);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  }

  _formatTime(t) {
    const d = new Date(t);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (this.options.scaleType === 'daily' || this.candleWidth < 4) {
      return `${d.getDate()} ${months[d.getMonth()]}`;
    }
    return `${hrs}:${mins}`;
  }

  _formatFullDateTime(t) {
    const d = new Date(t);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)} ${hrs}:${mins}`;
  }

  // ── Event Handlers (Zoom, Pan, Drag) ─────────────────────────────────────
  _bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;

      if (this.isDraggingChart) {
        const dx = e.clientX - this.dragStartX;
        const step = this.candleWidth + this.candleGap;
        const candleDelta = Math.round(dx / step);
        this.panOffset = Math.max(0, this.dragStartPan + candleDelta);
      } else if (this.isDraggingPriceAxis) {
        const dy = e.clientY - this.dragStartY;
        const factorDelta = dy * 0.005;
        this.priceScaleFactor = Math.max(0.1, Math.min(10, this.dragStartPriceScale * (1 - factorDelta)));
      }

      this.render();
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      if (x > this.chartWidth) {
        // Dragging price axis to stretch scale
        this.isDraggingPriceAxis = true;
        this.dragStartPriceScale = this.priceScaleFactor;
        canvas.style.cursor = 'ns-resize';
      } else if (y < this.chartHeight) {
        // Dragging main chart to pan
        this.isDraggingChart = true;
        this.dragStartPan = this.panOffset;
        canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingChart = false;
      this.isDraggingPriceAxis = false;
      canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Zoom centered around cursor
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const oldWidth = this.candleWidth;
      this.candleWidth = Math.max(2, Math.min(45, this.candleWidth * zoomFactor));
      this.candleGap = Math.max(1, Math.round(this.candleWidth * 0.3));

      this.render();
    }, { passive: false });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x > this.chartWidth) {
        // Double-click price axis resets to auto-scale!
        this.priceScaleFactor = 1.0;
        this.pricePanOffset = 0;
        this.render();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.mouseX = -1;
      this.mouseY = -1;
      this.render();
      if (this.onCrosshairMove && this.displayCandles.length > 0) {
        this.onCrosshairMove(this.displayCandles[this.displayCandles.length - 1]);
      }
    });
  }
}

if (typeof window !== 'undefined') window.ChartEngine = ChartEngine;
