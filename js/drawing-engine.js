// ============================================================================
// js/drawing-engine.js — Vector Drawing Tools & Annotation System
// ============================================================================
'use strict';

class DrawingEngine {
  constructor(chartEngine) {
    this.chart = chartEngine;
    this.drawings = [];
    this.activeTool = 'cursor'; // cursor, trendline, horizontal, vertical, fibonacci, rectangle, ray, measure
    this.isDrawing = false;
    this.currentDrawing = null;
    this.selectedDrawing = null;
    this.dragHandle = null;

    this.defaultColor = '#2962ff';
    this.defaultWidth = 1.5;

    this._bindEvents();
  }

  setTool(tool) {
    this.activeTool = tool;
    this.isDrawing = false;
    this.currentDrawing = null;
    if (this.chart && this.chart.canvas) {
      this.chart.canvas.style.cursor = (tool === 'cursor') ? 'default' : 'crosshair';
    }
  }

  addDrawing(drawing) {
    this.drawings.push(drawing);
    this._syncWithChart();
  }

  deleteSelected() {
    if (!this.selectedDrawing) return;
    this.drawings = this.drawings.filter(d => d !== this.selectedDrawing);
    this.selectedDrawing = null;
    this._syncWithChart();
  }

  clearAll() {
    this.drawings = [];
    this.selectedDrawing = null;
    this._syncWithChart();
  }

  _syncWithChart() {
    if (this.chart) {
      this.chart.drawings = this.drawings;
      this.chart.render();
    }
  }

  _bindEvents() {
    if (!this.chart || !this.chart.canvas) return;
    const canvas = this.chart.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (this.activeTool === 'cursor' || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x > this.chart.chartWidth || y > this.chart.chartHeight) return;

      const range = this.chart._calcVisibleRange();
      const index = this.chart.xToIndex(x, range);
      if (index < 0 || index >= this.chart.displayCandles.length) return;

      const candle = this.chart.displayCandles[index];
      const price = this.chart.yToPrice(y);
      const time = candle.time;

      if (!this.isDrawing) {
        // Start new drawing
        this.isDrawing = true;
        if (this.activeTool === 'horizontal') {
          this.addDrawing({
            id: `draw_${Date.now()}`,
            type: 'horizontal',
            price,
            color: this.defaultColor,
            lineWidth: this.defaultWidth,
            visible: true
          });
          this.isDrawing = false;
          this.setTool('cursor');
        } else if (this.activeTool === 'vertical') {
          this.addDrawing({
            id: `draw_${Date.now()}`,
            type: 'vertical',
            time,
            color: this.defaultColor,
            lineWidth: this.defaultWidth,
            visible: true
          });
          this.isDrawing = false;
          this.setTool('cursor');
        } else if (this.activeTool === 'risk_reward') {
          const entryPrice = price;
          const stopLoss = entryPrice * 0.985;
          const targetPrice = entryPrice * 1.035;
          this.addDrawing({
            id: `draw_${Date.now()}`,
            type: 'risk_reward',
            time: time,
            entryPrice: entryPrice,
            stopLoss: stopLoss,
            targetPrice: targetPrice,
            width: Math.max(160, this.chart.chartWidth * 0.28),
            visible: true
          });
          this.isDrawing = false;
          this.setTool('cursor');
          this.saveToStorage();
        } else {
          // 2-point drawing (trendline, fibonacci, rectangle, ray)
          this.currentDrawing = {
            id: `draw_${Date.now()}`,
            type: this.activeTool,
            p1: { time, price },
            p2: { time, price },
            color: this.defaultColor,
            lineWidth: this.defaultWidth,
            visible: true
          };
          this.drawings.push(this.currentDrawing);
          this._syncWithChart();
        }
      } else {
        // Finalize 2-point drawing
        if (this.currentDrawing) {
          this.currentDrawing.p2 = { time, price };
          this.isDrawing = false;
          this.currentDrawing = null;
          this.setTool('cursor');
          this._syncWithChart();
          this.saveToStorage();
        }
      }
    });

    // Handle cursor drag for risk_reward handles
    let draggingRr = null;
    let dragPart = null;

    canvas.addEventListener('mousedown', (e) => {
      if (this.activeTool !== 'cursor' || e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const d of this.drawings) {
        if (d.type === 'risk_reward') {
          const range = this.chart._calcVisibleRange();
          const p1X = this.chart._timeToX(d.time, range);
          const rightX = Math.min(this.chart.chartWidth - 5, p1X + (d.width || 160));
          const entryY = this.chart.priceToY(d.entryPrice);
          const stopY = this.chart.priceToY(d.stopLoss);
          const targetY = this.chart.priceToY(d.targetPrice);

          if (Math.abs(x - rightX) <= 15) {
            if (Math.abs(y - targetY) <= 12) {
              draggingRr = d;
              dragPart = 'target';
              break;
            } else if (Math.abs(y - entryY) <= 12) {
              draggingRr = d;
              dragPart = 'entry';
              break;
            } else if (Math.abs(y - stopY) <= 12) {
              draggingRr = d;
              dragPart = 'stop';
              break;
            }
          }
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (draggingRr) {
        draggingRr = null;
        dragPart = null;
        this.saveToStorage();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (draggingRr && dragPart) {
        const newPrice = this.chart.yToPrice(y);
        if (dragPart === 'target') draggingRr.targetPrice = newPrice;
        else if (dragPart === 'entry') draggingRr.entryPrice = newPrice;
        else if (dragPart === 'stop') draggingRr.stopLoss = newPrice;
        this._syncWithChart();
        return;
      }

      if (!this.isDrawing || !this.currentDrawing) return;

      const range = this.chart._calcVisibleRange();
      const index = this.chart.xToIndex(x, range);
      if (index >= 0 && index < this.chart.displayCandles.length) {
        const candle = this.chart.displayCandles[index];
        const price = this.chart.yToPrice(y);
        this.currentDrawing.p2 = { time: candle.time, price };
        this._syncWithChart();
      }
    });
  }

  saveToStorage(symbol = 'ACTIVE') {
    try {
      const key = `drawings_${symbol}`;
      localStorage.setItem(key, JSON.stringify(this.drawings));
      // Also persist to server endpoint if online
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: this.drawings })
      }).catch(() => {});
    } catch (e) {}
  }

  loadFromStorage(symbol = 'ACTIVE') {
    try {
      const key = `drawings_${symbol}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        this.drawings = JSON.parse(saved);
        this._syncWithChart();
      }
    } catch (e) {}
  }
}

if (typeof window !== 'undefined') window.DrawingEngine = DrawingEngine;
