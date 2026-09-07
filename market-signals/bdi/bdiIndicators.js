/**
 * market-signals/bdi/bdiIndicators.js
 * Mathematical engine for Baltic Dry Index indicators:
 * - 1D, 5D, 20D Percentage Changes
 * - 50D and 200D Trend Slopes and Moving Averages
 * - Volatility (Annualized standard deviation of daily log returns)
 * - Volatility-Adjusted Momentum
 * - Multi-Timeframe Trend Direction classification
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDIIndicators = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDIIndicators {
    /**
     * Compute comprehensive metrics from historical BDI series.
     * @param {Array<{date: string, close: number}>} historicalData
     */
    compute(historicalData) {
      if (!Array.isArray(historicalData) || historicalData.length < 5) {
        return {
          current: 0,
          prevClose: 0,
          change1D: 0,
          change5D: 0,
          change20D: 0,
          trend50D: 'NEUTRAL',
          trend200D: 'NEUTRAL',
          sma50: 0,
          sma200: 0,
          volatility: 0,
          momentum: 0,
          volAdjustedMomentum: 0,
          trendDirection: 'NEUTRAL',
          isValid: false
        };
      }

      const closes = historicalData.map(d => Number(d.close || d.value || 0)).filter(v => v > 0);
      const n = closes.length;
      if (n < 2) {
        return { isValid: false, trendDirection: 'NEUTRAL' };
      }

      const current = closes[n - 1];
      const prevClose = closes[n - 2];
      const change1D = ((current - prevClose) / prevClose) * 100;

      const idx5D = Math.max(0, n - 6);
      const change5D = ((current - closes[idx5D]) / closes[idx5D]) * 100;

      const idx20D = Math.max(0, n - 21);
      const change20D = ((current - closes[idx20D]) / closes[idx20D]) * 100;

      // 50-day Moving Average & Trend
      const len50 = Math.min(n, 50);
      const slice50 = closes.slice(n - len50);
      const sma50 = slice50.reduce((acc, v) => acc + v, 0) / len50;
      const slope50 = (slice50[slice50.length - 1] - slice50[0]) / slice50[0];
      let trend50D = 'NEUTRAL';
      if (current > sma50 * 1.02 && slope50 > 0.02) trend50D = 'BULLISH';
      else if (current < sma50 * 0.98 && slope50 < -0.02) trend50D = 'BEARISH';

      // 200-day Moving Average & Trend
      const len200 = Math.min(n, 200);
      const slice200 = closes.slice(n - len200);
      const sma200 = slice200.reduce((acc, v) => acc + v, 0) / len200;
      const slope200 = (slice200[slice200.length - 1] - slice200[0]) / slice200[0];
      let trend200D = 'NEUTRAL';
      if (current > sma200 * 1.03 && slope200 > 0.03) trend200D = 'BULLISH';
      else if (current < sma200 * 0.97 && slope200 < -0.03) trend200D = 'BEARISH';

      // 20-Day Annualized Volatility
      const returns20 = [];
      const startVol = Math.max(1, n - 21);
      for (let i = startVol; i < n; i++) {
        if (closes[i - 1] > 0) {
          returns20.push(Math.log(closes[i] / closes[i - 1]));
        }
      }
      let volatility = 0;
      if (returns20.length > 2) {
        const mean = returns20.reduce((a, b) => a + b, 0) / returns20.length;
        const variance = returns20.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns20.length - 1);
        volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized percentage
      }

      // Volatility-Adjusted Momentum
      // Normalizes 20-day percentage momentum by daily volatility
      const volAdjustedMomentum = volatility > 0 ? (change20D / (volatility / Math.sqrt(252))) : change20D;

      // Overall BDI Trend Direction
      let trendDirection = 'NEUTRAL';
      const bullScore = (change5D > 1.5 ? 1 : 0) + (change20D > 3.0 ? 1 : 0) + (trend50D === 'BULLISH' ? 1 : 0) + (trend200D === 'BULLISH' ? 1 : 0);
      const bearScore = (change5D < -1.5 ? 1 : 0) + (change20D < -3.0 ? 1 : 0) + (trend50D === 'BEARISH' ? 1 : 0) + (trend200D === 'BEARISH' ? 1 : 0);

      if (bullScore >= 3) trendDirection = 'BULLISH';
      else if (bearScore >= 3) trendDirection = 'BEARISH';
      else trendDirection = 'NEUTRAL';

      return {
        current: Number(current.toFixed(2)),
        prevClose: Number(prevClose.toFixed(2)),
        change1D: Number(change1D.toFixed(2)),
        change5D: Number(change5D.toFixed(2)),
        change20D: Number(change20D.toFixed(2)),
        trend50D,
        trend200D,
        sma50: Number(sma50.toFixed(2)),
        sma200: Number(sma200.toFixed(2)),
        volatility: Number(volatility.toFixed(2)),
        momentum: Number(change20D.toFixed(2)),
        volAdjustedMomentum: Number(volAdjustedMomentum.toFixed(2)),
        trendDirection,
        isValid: true
      };
    }
  }

  return new BDIIndicators();
}));
