// ============================================================================
// js/alert-engine.js — Real-Time Price & Technical Indicator Alerts
// ============================================================================
'use strict';

class AlertEngine {
  constructor() {
    this.alerts = [];
    this.listeners = [];
    this.audioCtx = null;

    this.loadAlerts();
  }

  createAlert(params) {
    // params: { symbol, condition, targetPrice, note, once: true }
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      symbol: params.symbol,
      condition: params.condition, // crossing_above, crossing_below, greater_than, less_than
      targetPrice: parseFloat(params.targetPrice),
      note: params.note || `${params.symbol} ${params.condition} ${params.targetPrice}`,
      once: params.once !== false,
      active: true,
      createdAt: Date.now(),
      lastPrice: null,
      triggeredAt: null
    };

    this.alerts.push(alert);
    this.saveAlerts();
    this.emit('change', this.alerts);
    return alert;
  }

  deleteAlert(id) {
    this.alerts = this.alerts.filter(a => a.id !== id);
    this.saveAlerts();
    this.emit('change', this.alerts);
  }

  checkPrice(symbol, currentPrice) {
    for (const a of this.alerts) {
      if (!a.active || a.symbol !== symbol) continue;

      let triggered = false;
      const target = a.targetPrice;
      const prev = a.lastPrice;

      if (a.condition === 'crossing_above') {
        if (prev !== null && prev <= target && currentPrice > target) triggered = true;
      } else if (a.condition === 'crossing_below') {
        if (prev !== null && prev >= target && currentPrice < target) triggered = true;
      } else if (a.condition === 'greater_than') {
        if (currentPrice >= target) triggered = true;
      } else if (a.condition === 'less_than') {
        if (currentPrice <= target) triggered = true;
      }

      a.lastPrice = currentPrice;

      if (triggered) {
        a.triggeredAt = Date.now();
        if (a.once) a.active = false;
        this.triggerAlert(a, currentPrice);
        this.saveAlerts();
      }
    }
  }

  triggerAlert(alert, currentPrice) {
    this.playChime();
    this.emit('triggered', { alert, currentPrice });
  }

  playChime() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio notification unavailable:', e);
    }
  }

  saveAlerts() {
    try {
      localStorage.setItem('terminal_alerts', JSON.stringify(this.alerts));
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'alerts', value: this.alerts })
      }).catch(() => {});
    } catch (e) {}
  }

  loadAlerts() {
    try {
      const saved = localStorage.getItem('terminal_alerts');
      if (saved) this.alerts = JSON.parse(saved);
    } catch (e) {}
  }

  on(eventName, cb) {
    this.listeners.push({ eventName, cb });
  }

  emit(eventName, data) {
    for (const l of this.listeners) {
      if (l.eventName === eventName) {
        try { l.cb(data); } catch (e) {}
      }
    }
  }
}

if (typeof window !== 'undefined') window.AlertEngine = AlertEngine;
