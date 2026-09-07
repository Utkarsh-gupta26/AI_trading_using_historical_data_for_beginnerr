/**
 * market-signals/bdi/bdiBacktest.js
 * Empirical Event-Study Backtesting Engine for Baltic Dry Index:
 * Evaluates market behavior following large BDI shocks:
 * - BDI ↑ > 3%
 * - BDI ↑ > 5%
 * - BDI ↓ > 3%
 * - BDI ↓ > 5%
 *
 * Measures subsequent 1D, 3D, 5D, 10D, and 20D returns.
 * Computes: Win Rate, Average Return, Median Return, Max Drawdown, Profit Factor,
 * Sample Size, and Student's t-statistic for Statistical Significance.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDIBacktest = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDIBacktest {
    constructor() {
      this.HORIZONS = [1, 3, 5, 10, 20];
    }

    /**
     * Run backtest of BDI threshold events against subsequent market returns.
     * @param {Array<{date: string, bdiClose: number, marketClose: number}>} alignedData
     * @param {string} eventType 'SURGE_3' | 'SURGE_5' | 'DROP_3' | 'DROP_5'
     */
    runBacktest(alignedData, eventType = 'SURGE_3') {
      if (!Array.isArray(alignedData) || alignedData.length < 30) {
        return this.getEmptyResult('Insufficient overlapping historical data points');
      }

      // Map event condition
      let filterFn;
      let eventTitle = '';
      if (eventType === 'SURGE_3') {
        filterFn = (chg) => chg >= 3.0;
        eventTitle = 'BDI Daily Surge > +3.0%';
      } else if (eventType === 'SURGE_5') {
        filterFn = (chg) => chg >= 5.0;
        eventTitle = 'BDI Daily Spike > +5.0%';
      } else if (eventType === 'DROP_3') {
        filterFn = (chg) => chg <= -3.0;
        eventTitle = 'BDI Daily Drop < -3.0%';
      } else if (eventType === 'DROP_5') {
        filterFn = (chg) => chg <= -5.0;
        eventTitle = 'BDI Daily Plunge < -5.0%';
      } else {
        filterFn = (chg) => chg >= 3.0;
        eventTitle = 'BDI Daily Surge > +3.0%';
      }

      // 1. Identify trigger events
      const events = [];
      for (let i = 1; i < alignedData.length - 20; i++) {
        const prevBdi = alignedData[i - 1].bdiClose;
        const curBdi = alignedData[i].bdiClose;
        if (prevBdi > 0) {
          const bdiChange = ((curBdi - prevBdi) / prevBdi) * 100;
          if (filterFn(bdiChange)) {
            events.push({
              index: i,
              date: alignedData[i].date,
              bdiChange: Number(bdiChange.toFixed(2)),
              marketEntryPrice: alignedData[i].marketClose
            });
          }
        }
      }

      const sampleSize = events.length;
      if (sampleSize < 3) {
        return this.getEmptyResult(`Sample size too small (${sampleSize} occurrences found). No statistically valid conclusions can be drawn.`);
      }

      // 2. Measure forward returns for each horizon
      const horizonResults = {};

      this.HORIZONS.forEach(h => {
        const returns = [];
        let wins = 0;
        let totalGain = 0;
        let totalLoss = 0;
        let maxDd = 0;

        events.forEach(evt => {
          const entry = evt.marketEntryPrice;
          const exitIdx = evt.index + h;
          if (exitIdx < alignedData.length) {
            const exit = alignedData[exitIdx].marketClose;
            const ret = ((exit - entry) / entry) * 100;
            returns.push(ret);

            if (ret > 0) {
              wins++;
              totalGain += ret;
            } else {
              totalLoss += Math.abs(ret);
            }

            // Track lowest dip in horizon
            let lowestInHorizon = entry;
            for (let k = evt.index; k <= exitIdx; k++) {
              if (alignedData[k].marketClose < lowestInHorizon) {
                lowestInHorizon = alignedData[k].marketClose;
              }
            }
            const dd = ((lowestInHorizon - entry) / entry) * 100;
            if (dd < maxDd) maxDd = dd;
          }
        });

        if (returns.length === 0) return;

        const count = returns.length;
        const winRate = Number(((wins / count) * 100).toFixed(1));
        const avgReturn = Number((returns.reduce((a, b) => a + b, 0) / count).toFixed(2));

        // Median
        const sorted = [...returns].sort((a, b) => a - b);
        const medianReturn = Number((sorted[Math.floor(count / 2)]).toFixed(2));

        // Profit Factor
        const profitFactor = totalLoss > 0 ? Number((totalGain / totalLoss).toFixed(2)) : (totalGain > 0 ? 99.9 : 1.0);

        // Standard deviation and t-stat of returns
        const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (count - 1 || 1);
        const stdDev = Math.sqrt(variance);
        const tStat = stdDev > 0 ? Number(((avgReturn / (stdDev / Math.sqrt(count)))).toFixed(2)) : 0;
        const isStatisticallySignificant = Math.abs(tStat) >= 1.96 && count >= 10;

        horizonResults[`T+${h}D`] = {
          horizonDays: h,
          sampleCount: count,
          winRate,
          avgReturn,
          medianReturn,
          maxDrawdown: Number(maxDd.toFixed(2)),
          profitFactor,
          tStat,
          isStatisticallySignificant,
          verdict: isStatisticallySignificant
            ? (avgReturn > 0 ? 'Statistically Bullish Edge' : 'Statistically Bearish Edge')
            : 'Not Statistically Predictive'
        };
      });

      return {
        eventTitle,
        eventType,
        sampleSize,
        horizons: horizonResults,
        disclaimer: 'Do not claim BDI is predictive unless the historical test supports it. BDI is a macroeconomic factor, not a standalone trading signal.'
      };
    }

    getEmptyResult(reason) {
      return {
        eventTitle: 'BDI Historical Backtest',
        sampleSize: 0,
        horizons: {},
        disclaimer: reason || 'Insufficient sample data.'
      };
    }
  }

  return new BDIBacktest();
}));
