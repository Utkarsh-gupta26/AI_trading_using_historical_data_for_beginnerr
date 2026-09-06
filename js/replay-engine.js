// ============================================================================
// js/replay-engine.js — Historical Bar Replay Simulator
// ============================================================================
'use strict';

class ReplayEngine {
  constructor(chartEngine, onReplayStateChange) {
    this.chart = chartEngine;
    this.onStateChange = onReplayStateChange;

    this.isActive = false;
    this.isPlaying = false;
    this.isSelectingCutoff = false;

    this.fullCandles = [];
    this.currentIndex = 0;
    this.speedMs = 1000; // 1s per bar at 1x
    this.timer = null;

    this._bindClickToCutoff();
  }

  startSelection() {
    this.isSelectingCutoff = true;
    if (this.chart && this.chart.canvas) {
      this.chart.canvas.style.cursor = 'crosshair';
    }
    if (this.onStateChange) this.onStateChange({ selecting: true, active: false });
  }

  setCutoffIndex(index) {
    this.isSelectingCutoff = false;
    this.isActive = true;
    this.isPlaying = false;

    // Cache full real historical candles
    this.fullCandles = [...this.chart.candles];
    this.currentIndex = Math.max(10, Math.min(index, this.fullCandles.length - 2));

    // Show only candles up to cut-off
    this._updateChartSlice();
    if (this.onStateChange) this.onStateChange({ selecting: false, active: true, playing: false });
  }

  play() {
    if (!this.isActive || this.isPlaying) return;
    this.isPlaying = true;
    if (this.onStateChange) this.onStateChange({ active: true, playing: true });

    this.timer = setInterval(() => {
      this.stepForward();
    }, this.speedMs);
  }

  pause() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.onStateChange) this.onStateChange({ active: true, playing: false });
  }

  stepForward() {
    if (!this.isActive) return;
    if (this.currentIndex >= this.fullCandles.length - 1) {
      this.pause();
      return;
    }

    this.currentIndex++;
    this._updateChartSlice();
  }

  setSpeed(multiplier) {
    this.speedMs = Math.round(1000 / multiplier);
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  exit() {
    this.pause();
    this.isActive = false;
    this.isSelectingCutoff = false;

    // Restore full live candles
    if (this.fullCandles.length > 0) {
      this.chart.setData(this.fullCandles, false);
      this.fullCandles = [];
    }

    if (this.onStateChange) this.onStateChange({ active: false, playing: false, selecting: false });
  }

  _updateChartSlice() {
    const slice = this.fullCandles.slice(0, this.currentIndex + 1);
    this.chart.setData(slice, false);
  }

  _bindClickToCutoff() {
    if (!this.chart || !this.chart.canvas) return;
    this.chart.canvas.addEventListener('click', (e) => {
      if (!this.isSelectingCutoff) return;

      const rect = this.chart.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const range = this.chart._calcVisibleRange();
      const index = this.chart.xToIndex(x, range);

      if (index >= 5 && index < this.chart.candles.length) {
        this.setCutoffIndex(index);
      }
    });
  }

  // Requirement #22 & #29: Isolated Simulation Journal
  enterSimulatedTrade(params = {}) {
    if (!this.isActive || !this.fullCandles[this.currentIndex]) return null;
    const curCandle = this.fullCandles[this.currentIndex];
    const trade = {
      id: `SIM-${Date.now().toString().slice(-5)}`,
      symbol: (window.chartEngine && window.chartEngine.currentSymbol) || 'REPLAY',
      direction: params.direction || 'LONG',
      entryPrice: curCandle.close,
      stopLoss: params.stopLoss || (params.direction === 'SHORT' ? curCandle.close * 1.015 : curCandle.close * 0.985),
      targetPrice: params.targetPrice || (params.direction === 'SHORT' ? curCandle.close * 0.97 : curCandle.close * 1.035),
      quantity: params.quantity || 25,
      entryTime: curCandle.time,
      status: 'OPEN',
      environment: 'REPLAY_SIMULATION'
    };
    if (!this.simulatedTrades) this.simulatedTrades = [];
    this.simulatedTrades.unshift(trade);
    this.saveSimulationJournal();
    return trade;
  }

  closeSimulatedTrade(tradeId) {
    if (!this.simulatedTrades) return;
    const t = this.simulatedTrades.find(tr => tr.id === tradeId);
    if (t && t.status === 'OPEN' && this.fullCandles[this.currentIndex]) {
      const curCandle = this.fullCandles[this.currentIndex];
      t.exitPrice = curCandle.close;
      t.exitTime = curCandle.time;
      const mult = t.direction === 'SHORT' ? -1 : 1;
      t.pnl = (t.exitPrice - t.entryPrice) * t.quantity * mult;
      t.status = 'CLOSED';
      this.saveSimulationJournal();
    }
  }

  saveSimulationJournal() {
    try {
      localStorage.setItem('nova_simulation_journal', JSON.stringify(this.simulatedTrades || []));
    } catch (e) {}
  }

  getSimulationJournal() {
    try {
      const saved = localStorage.getItem('nova_simulation_journal');
      return saved ? JSON.parse(saved) : (this.simulatedTrades || []);
    } catch (e) {
      return [];
    }
  }
}

if (typeof window !== 'undefined') window.ReplayEngine = ReplayEngine;
