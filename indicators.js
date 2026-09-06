// ==========================================================================
// indicators.js — 30+ Technical Indicators Engine
// ==========================================================================

var Indicators = (() => {

  // ── Utility ──────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
  function stddev(arr) {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  }

  // ── Simple Moving Average ───────────────────────────────────────────────
  function sma(closes, period) {
    const out = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      out.push(sum / period);
    }
    return out;
  }

  // ── Exponential Moving Average ──────────────────────────────────────────
  function ema(closes, period) {
    const k = 2 / (period + 1);
    const out = [];
    let prev = null;
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      if (prev === null) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += closes[j];
        prev = sum / period;
      } else {
        prev = closes[i] * k + prev * (1 - k);
      }
      out.push(prev);
    }
    return out;
  }

  // ── RSI (Relative Strength Index) ───────────────────────────────────────
  function rsi(closes, period = 14) {
    const out = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period) { out.push(null); continue; }
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = closes[j] - closes[j - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) { out.push(100); continue; }
      const rs = avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
    return out;
  }

  // ── MACD ────────────────────────────────────────────────────────────────
  function macd(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const macdLine = [];
    for (let i = 0; i < closes.length; i++) {
      if (emaFast[i] === null || emaSlow[i] === null) { macdLine.push(null); continue; }
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
    // Signal line = EMA of MACD line
    const validMacd = macdLine.filter(v => v !== null);
    const signalLine = [];
    const k = 2 / (signal + 1);
    let prev = null;
    let validIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) { signalLine.push(null); continue; }
      if (validIdx < signal - 1) { signalLine.push(null); validIdx++; continue; }
      if (prev === null) {
        let sum = 0, count = 0;
        for (let j = i; j >= 0 && count < signal; j--) {
          if (macdLine[j] !== null) { sum += macdLine[j]; count++; }
        }
        prev = sum / signal;
      } else {
        prev = macdLine[i] * k + prev * (1 - k);
      }
      signalLine.push(prev);
      validIdx++;
    }
    const histogram = [];
    for (let i = 0; i < closes.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) { histogram.push(null); continue; }
      histogram.push(macdLine[i] - signalLine[i]);
    }
    return { macdLine, signalLine, histogram };
  }

  // ── Bollinger Bands ─────────────────────────────────────────────────────
  function bollingerBands(closes, period = 20, mult = 2) {
    const mid = sma(closes, period);
    const upper = [], lower = [], pctB = [], bandwidth = [];
    for (let i = 0; i < closes.length; i++) {
      if (mid[i] === null) {
        upper.push(null); lower.push(null); pctB.push(null); bandwidth.push(null);
        continue;
      }
      const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
      const sd = stddev(slice);
      const u = mid[i] + mult * sd;
      const l = mid[i] - mult * sd;
      upper.push(u);
      lower.push(l);
      pctB.push(u === l ? 0.5 : (closes[i] - l) / (u - l));
      bandwidth.push(mid[i] > 0 ? (u - l) / mid[i] : 0);
    }
    return { mid, upper, lower, pctB, bandwidth };
  }

  // ── ATR (Average True Range) ────────────────────────────────────────────
  function atr(data, period = 14) {
    const tr = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { tr.push(data[i].high - data[i].low); continue; }
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
    const out = [];
    for (let i = 0; i < tr.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      if (i === period - 1) {
        out.push(avg(tr.slice(0, period)));
      } else {
        out.push((out[out.length - 1] * (period - 1) + tr[i]) / period);
      }
    }
    return out;
  }

  // ── ADX (Average Directional Index) ─────────────────────────────────────
  function adx(data, period = 14) {
    const pDM = [], nDM = [], tr = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        pDM.push(0); nDM.push(0); tr.push(data[i].high - data[i].low);
        continue;
      }
      const upMove = data[i].high - data[i - 1].high;
      const downMove = data[i - 1].low - data[i].low;
      pDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      nDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }
    // Smoothed values
    const smoothTR = [], smoothPDM = [], smoothNDM = [];
    const diPlus = [], diMinus = [], dx = [], adxOut = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        smoothTR.push(null); smoothPDM.push(null); smoothNDM.push(null);
        diPlus.push(null); diMinus.push(null); dx.push(null); adxOut.push(null);
        continue;
      }
      if (i === period) {
        const sTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
        const sPDM = pDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
        const sNDM = nDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
        smoothTR.push(sTR); smoothPDM.push(sPDM); smoothNDM.push(sNDM);
      } else {
        const prevTR = smoothTR[smoothTR.length - 1];
        const prevPDM = smoothPDM[smoothPDM.length - 1];
        const prevNDM = smoothNDM[smoothNDM.length - 1];
        smoothTR.push(prevTR - prevTR / period + tr[i]);
        smoothPDM.push(prevPDM - prevPDM / period + pDM[i]);
        smoothNDM.push(prevNDM - prevNDM / period + nDM[i]);
      }
      const sTR = smoothTR[smoothTR.length - 1];
      const dp = sTR > 0 ? (smoothPDM[smoothPDM.length - 1] / sTR) * 100 : 0;
      const dm = sTR > 0 ? (smoothNDM[smoothNDM.length - 1] / sTR) * 100 : 0;
      diPlus.push(dp); diMinus.push(dm);
      const dxVal = (dp + dm) > 0 ? Math.abs(dp - dm) / (dp + dm) * 100 : 0;
      dx.push(dxVal);
      adxOut.push(null); // placeholder, calculated below
    }
    // ADX = smoothed DX
    const adxFinal = new Array(data.length).fill(null);
    const validDX = [];
    for (let i = 0; i < dx.length; i++) {
      if (dx[i] !== null) validDX.push({ idx: i, val: dx[i] });
    }
    if (validDX.length >= period) {
      let adxVal = avg(validDX.slice(0, period).map(v => v.val));
      adxFinal[validDX[period - 1].idx] = adxVal;
      for (let j = period; j < validDX.length; j++) {
        adxVal = (adxVal * (period - 1) + validDX[j].val) / period;
        adxFinal[validDX[j].idx] = adxVal;
      }
    }
    return { adx: adxFinal, diPlus, diMinus };
  }

  // ── Stochastic Oscillator ───────────────────────────────────────────────
  function stochastic(data, kPeriod = 14, dPeriod = 3) {
    const kLine = [];
    for (let i = 0; i < data.length; i++) {
      if (i < kPeriod - 1) { kLine.push(null); continue; }
      let highest = -Infinity, lowest = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        highest = Math.max(highest, data[j].high);
        lowest = Math.min(lowest, data[j].low);
      }
      const range = highest - lowest;
      kLine.push(range === 0 ? 50 : ((data[i].close - lowest) / range) * 100);
    }
    const dLine = sma(kLine.map(v => v === null ? 0 : v), dPeriod);
    // Fix null alignment
    for (let i = 0; i < kLine.length; i++) {
      if (kLine[i] === null) dLine[i] = null;
    }
    return { k: kLine, d: dLine };
  }

  // ── Williams %R ─────────────────────────────────────────────────────────
  function williamsR(data, period = 14) {
    const out = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      let highest = -Infinity, lowest = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        highest = Math.max(highest, data[j].high);
        lowest = Math.min(lowest, data[j].low);
      }
      const range = highest - lowest;
      out.push(range === 0 ? -50 : ((highest - data[i].close) / range) * -100);
    }
    return out;
  }

  // ── CCI (Commodity Channel Index) ───────────────────────────────────────
  function cci(data, period = 20) {
    const tp = data.map(d => (d.high + d.low + d.close) / 3);
    const out = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { out.push(null); continue; }
      const slice = tp.slice(i - period + 1, i + 1);
      const mean = avg(slice);
      const meanDev = avg(slice.map(v => Math.abs(v - mean)));
      out.push(meanDev === 0 ? 0 : (tp[i] - mean) / (0.015 * meanDev));
    }
    return out;
  }

  // ── Rate of Change ──────────────────────────────────────────────────────
  function roc(closes, period = 12) {
    const out = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period) { out.push(null); continue; }
      out.push(((closes[i] - closes[i - period]) / closes[i - period]) * 100);
    }
    return out;
  }

  // ── OBV (On-Balance Volume) ─────────────────────────────────────────────
  function obv(data) {
    const out = [0];
    for (let i = 1; i < data.length; i++) {
      if (data[i].close > data[i - 1].close) out.push(out[i - 1] + data[i].volume);
      else if (data[i].close < data[i - 1].close) out.push(out[i - 1] - data[i].volume);
      else out.push(out[i - 1]);
    }
    return out;
  }

  // ── VWAP (Volume Weighted Average Price) ────────────────────────────────
  function vwap(data) {
    const out = [];
    let cumTP = 0, cumVol = 0;
    for (let i = 0; i < data.length; i++) {
      const tp = (data[i].high + data[i].low + data[i].close) / 3;
      cumTP += tp * data[i].volume;
      cumVol += data[i].volume;
      out.push(cumVol > 0 ? cumTP / cumVol : data[i].close);
    }
    return out;
  }

  // ── Volume Moving Average ───────────────────────────────────────────────
  function volumeMA(data, period = 20) {
    const vols = data.map(d => d.volume);
    return sma(vols, period);
  }

  // ── Relative Volume (RVOL) ──────────────────────────────────────────────
  function rvol(data, period = 20) {
    const volMA = volumeMA(data, period);
    return data.map((d, i) => volMA[i] && volMA[i] > 0 ? d.volume / volMA[i] : 1);
  }

  // ── Keltner Channels ───────────────────────────────────────────────────
  function keltner(data, emaPeriod = 20, atrPeriod = 10, mult = 1.5) {
    const closes = data.map(d => d.close);
    const mid = ema(closes, emaPeriod);
    const atrVals = atr(data, atrPeriod);
    const upper = [], lower = [];
    for (let i = 0; i < data.length; i++) {
      if (mid[i] === null || atrVals[i] === null) { upper.push(null); lower.push(null); continue; }
      upper.push(mid[i] + mult * atrVals[i]);
      lower.push(mid[i] - mult * atrVals[i]);
    }
    return { mid, upper, lower };
  }

  // ── Support & Resistance Levels ─────────────────────────────────────────
  function supportResistance(data, lookback = 20) {
    if (data.length < lookback) return { support: [], resistance: [] };
    const recent = data.slice(-lookback);
    const pivots = [];
    for (let i = 2; i < recent.length - 2; i++) {
      // Swing high
      if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
          recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high) {
        pivots.push({ type: 'resistance', price: recent[i].high, idx: i });
      }
      // Swing low
      if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
          recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low) {
        pivots.push({ type: 'support', price: recent[i].low, idx: i });
      }
    }
    return {
      support: pivots.filter(p => p.type === 'support').map(p => p.price),
      resistance: pivots.filter(p => p.type === 'resistance').map(p => p.price)
    };
  }

  // ── Higher Highs / Higher Lows Detection ────────────────────────────────
  function trendStructure(data, lookback = 20) {
    if (data.length < lookback) return { higherHighs: false, higherLows: false, lowerHighs: false, lowerLows: false };
    const recent = data.slice(-lookback);
    const swingHighs = [], swingLows = [];
    for (let i = 2; i < recent.length - 2; i++) {
      if (recent[i].high >= recent[i - 1].high && recent[i].high >= recent[i + 1].high) {
        swingHighs.push(recent[i].high);
      }
      if (recent[i].low <= recent[i - 1].low && recent[i].low <= recent[i + 1].low) {
        swingLows.push(recent[i].low);
      }
    }
    let higherHighs = swingHighs.length >= 2, lowerHighs = swingHighs.length >= 2;
    let higherLows = swingLows.length >= 2, lowerLows = swingLows.length >= 2;
    for (let i = 1; i < swingHighs.length; i++) {
      if (swingHighs[i] <= swingHighs[i - 1]) higherHighs = false;
      if (swingHighs[i] >= swingHighs[i - 1]) lowerHighs = false;
    }
    for (let i = 1; i < swingLows.length; i++) {
      if (swingLows[i] <= swingLows[i - 1]) higherLows = false;
      if (swingLows[i] >= swingLows[i - 1]) lowerLows = false;
    }
    return { higherHighs, higherLows, lowerHighs, lowerLows, swingHighs, swingLows };
  }

  // ── Candlestick Pattern Recognition ─────────────────────────────────────
  function candlePatterns(data) {
    if (data.length < 3) return [];
    const patterns = [];
    const i = data.length - 1;
    const c = data[i];
    const p = data[i - 1];
    const pp = data[i - 2];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const isBullish = c.close > c.open;
    const isBearish = c.close < c.open;
    const pBody = Math.abs(p.close - p.open);
    const pIsBullish = p.close > p.open;
    const pIsBearish = p.close < p.open;

    // Doji
    if (body < range * 0.1 && range > 0) {
      patterns.push({ name: 'Doji', type: 'neutral', strength: 60 });
    }
    // Hammer (bullish reversal)
    if (lowerWick > body * 2 && upperWick < body * 0.5 && range > 0) {
      patterns.push({ name: 'Hammer', type: 'bullish', strength: 70 });
    }
    // Shooting Star (bearish reversal)
    if (upperWick > body * 2 && lowerWick < body * 0.5 && range > 0) {
      patterns.push({ name: 'Shooting Star', type: 'bearish', strength: 70 });
    }
    // Bullish Engulfing
    if (isBullish && pIsBearish && c.open <= p.close && c.close >= p.open && body > pBody) {
      patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 80 });
    }
    // Bearish Engulfing
    if (isBearish && pIsBullish && c.open >= p.close && c.close <= p.open && body > pBody) {
      patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 80 });
    }
    // Morning Star
    if (pp.close < pp.open && Math.abs(p.close - p.open) < (pp.high - pp.low) * 0.3 &&
        c.close > c.open && c.close > (pp.open + pp.close) / 2) {
      patterns.push({ name: 'Morning Star', type: 'bullish', strength: 85 });
    }
    // Evening Star
    if (pp.close > pp.open && Math.abs(p.close - p.open) < (pp.high - pp.low) * 0.3 &&
        c.close < c.open && c.close < (pp.open + pp.close) / 2) {
      patterns.push({ name: 'Evening Star', type: 'bearish', strength: 85 });
    }
    // Three White Soldiers
    if (isBullish && pIsBullish && pp.close > pp.open &&
        c.close > p.close && p.close > pp.close) {
      patterns.push({ name: 'Three White Soldiers', type: 'bullish', strength: 75 });
    }
    // Three Black Crows
    if (isBearish && pIsBearish && pp.close < pp.open &&
        c.close < p.close && p.close < pp.close) {
      patterns.push({ name: 'Three Black Crows', type: 'bearish', strength: 75 });
    }
    // Marubozu (strong body, tiny wicks)
    if (body > range * 0.85 && range > 0) {
      patterns.push({
        name: isBullish ? 'Bullish Marubozu' : 'Bearish Marubozu',
        type: isBullish ? 'bullish' : 'bearish',
        strength: 65
      });
    }

    return patterns;
  }

  // ── MA Slope ────────────────────────────────────────────────────────────
  function maSlope(maValues, lookback = 5) {
    const out = [];
    for (let i = 0; i < maValues.length; i++) {
      if (i < lookback || maValues[i] === null || maValues[i - lookback] === null) {
        out.push(null); continue;
      }
      out.push((maValues[i] - maValues[i - lookback]) / maValues[i - lookback] * 100);
    }
    return out;
  }

  // ── MACD Divergence Detection ───────────────────────────────────────────
  function macdDivergence(data, macdHist) {
    const result = { bullish: false, bearish: false };
    if (data.length < 20) return result;
    const len = data.length;
    // Check last 10 candles for divergence
    const recentPrices = data.slice(-10).map(d => d.close);
    const recentHist = macdHist.slice(-10).filter(v => v !== null);
    if (recentHist.length < 5) return result;
    // Bullish divergence: lower low in price, higher low in MACD while in negative territory
    const priceMin1 = Math.min(...recentPrices.slice(0, 5));
    const priceMin2 = Math.min(...recentPrices.slice(5));
    const histMin1 = Math.min(...recentHist.slice(0, Math.floor(recentHist.length / 2)));
    const histMin2 = Math.min(...recentHist.slice(Math.floor(recentHist.length / 2)));
    if (priceMin2 < priceMin1 && histMin2 > histMin1 && histMin1 < 0) result.bullish = true;
    // Bearish divergence: higher high in price, lower high in MACD while in positive territory
    const priceMax1 = Math.max(...recentPrices.slice(0, 5));
    const priceMax2 = Math.max(...recentPrices.slice(5));
    const histMax1 = Math.max(...recentHist.slice(0, Math.floor(recentHist.length / 2)));
    const histMax2 = Math.max(...recentHist.slice(Math.floor(recentHist.length / 2)));
    if (priceMax2 > priceMax1 && histMax2 < histMax1 && histMax1 > 0) result.bearish = true;
    return result;
  }

  // ── Bollinger Squeeze Detection ─────────────────────────────────────────
  function bollingerSqueeze(bandwidth, lookback = 20) {
    if (bandwidth.length < lookback) return { isSqueeze: false, squeezeStrength: 0 };
    const recent = bandwidth.slice(-lookback).filter(v => v !== null);
    if (recent.length < 5) return { isSqueeze: false, squeezeStrength: 0 };
    const currentBW = recent[recent.length - 1];
    const avgBW = avg(recent);
    const minBW = Math.min(...recent);
    const isSqueeze = currentBW < avgBW * 0.75;
    const squeezeStrength = isSqueeze ? clamp((1 - currentBW / avgBW) * 100, 0, 100) : 0;
    return { isSqueeze, squeezeStrength, currentBW, avgBW, minBW };
  }

  // ── Compute All Indicators ──────────────────────────────────────────────
  function computeAll(data) {
    const closes = data.map(d => d.close);
    const result = {
      // Trend
      sma9: sma(closes, 9),
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      sma200: sma(closes, 200),
      ema9: ema(closes, 9),
      ema12: ema(closes, 12),
      ema20: ema(closes, 20),
      ema26: ema(closes, 26),
      ema50: ema(closes, 50),
      // Momentum
      rsi14: rsi(closes, 14),
      macd: macd(closes),
      stoch: stochastic(data),
      williamsR: williamsR(data),
      cci: cci(data),
      roc12: roc(closes, 12),
      // Volatility
      bollinger: bollingerBands(closes),
      atr14: atr(data, 14),
      keltner: keltner(data),
      // Volume
      obv: obv(data),
      vwap: vwap(data),
      volumeMA20: volumeMA(data, 20),
      rvol: rvol(data),
      // Structure
      adx: adx(data),
      trendStructure: trendStructure(data),
      supportResistance: supportResistance(data),
      candlePatterns: candlePatterns(data),
    };
    // Derived
    result.sma50Slope = maSlope(result.sma50);
    result.macdDivergence = macdDivergence(data, result.macd.histogram);
    result.bollingerSqueeze = bollingerSqueeze(result.bollinger.bandwidth);
    return result;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  return {
    sma, ema, rsi, macd, bollingerBands, atr, adx, stochastic,
    williamsR, cci, roc, obv, vwap, volumeMA, rvol, keltner,
    supportResistance, trendStructure, candlePatterns, maSlope,
    macdDivergence, bollingerSqueeze, computeAll, clamp, avg, stddev
  };
})();
if (typeof globalThis !== 'undefined') globalThis.Indicators = Indicators;
if (typeof window !== 'undefined') window.Indicators = Indicators;
