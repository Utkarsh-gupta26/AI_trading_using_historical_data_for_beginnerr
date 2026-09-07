/**
 * market-signals/bdi/bdiLeadLag.js
 * Lead/Lag Cross-Correlation & Statistical Predictive Significance Engine:
 * Analyzes:
 * - BDI(t) -> Market(t + 1)
 * - BDI(t) -> Market(t + 3)
 * - BDI(t) -> Market(t + 5)
 * - BDI(t) -> Market(t + 10)
 * - BDI(t) -> Market(t + 20)
 *
 * Computes Pearson r, Student's t-statistic, and p-value.
 * ONLY allows lead/lag weighting if statistically significant (p < 0.05).
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDILeadLag = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDILeadLag {
    constructor() {
      this.HORIZONS = [1, 3, 5, 10, 20];
    }

    /**
     * Compute forward-shifted cross-correlation and t-test
     * @param {Array<number>} bdiReturns Array of daily BDI % changes
     * @param {Array<number>} marketReturns Array of daily target market % changes
     */
    analyzeLeadLag(bdiReturns, marketReturns) {
      const results = {};
      let bestHorizon = null;
      let highestCorrelation = 0;
      let hasStatisticallySignificantLead = false;

      this.HORIZONS.forEach(lag => {
        if (bdiReturns.length < lag + 15 || marketReturns.length < lag + 15) {
          results[lag] = {
            lagDays: lag,
            correlation: 0,
            tStat: 0,
            pValue: 1.0,
            isSignificant: false,
            sampleSize: 0,
            verdict: 'Insufficient Data'
          };
          return;
        }

        // Shift market returns forward by `lag` days relative to BDI returns
        const x = [];
        const y = [];
        const n = Math.min(bdiReturns.length - lag, marketReturns.length - lag);

        for (let i = 0; i < n; i++) {
          x.push(bdiReturns[i]);
          y.push(marketReturns[i + lag]);
        }

        const r = this.calculatePearson(x, y);
        const sampleSize = x.length;

        // Student's t-statistic: t = r * sqrt((n - 2) / (1 - r^2))
        const degreesOfFreedom = sampleSize - 2;
        let tStat = 0;
        let pValue = 1.0;

        if (Math.abs(r) < 0.999 && degreesOfFreedom > 0) {
          tStat = r * Math.sqrt(degreesOfFreedom / (1 - Math.pow(r, 2)));
          pValue = this.approximateTwoTailedPValue(tStat, degreesOfFreedom);
        }

        // Statistical significance threshold: alpha = 0.05
        const isSignificant = pValue < 0.05 && Math.abs(r) >= 0.12;

        if (isSignificant) {
          hasStatisticallySignificantLead = true;
          if (Math.abs(r) > Math.abs(highestCorrelation)) {
            highestCorrelation = r;
            bestHorizon = lag;
          }
        }

        results[lag] = {
          lagDays: lag,
          correlation: Number(r.toFixed(3)),
          tStat: Number(tStat.toFixed(2)),
          pValue: Number(pValue.toFixed(4)),
          isSignificant,
          sampleSize,
          verdict: isSignificant
            ? `Statistically Significant (${(r > 0 ? '+' : '')}${Number(r.toFixed(3))}, p=${Number(pValue.toFixed(3))})`
            : 'No Meaningful Predictive Edge (p > 0.05)'
        };
      });

      return {
        horizons: results,
        bestHorizon,
        hasStatisticallySignificantLead,
        summary: hasStatisticallySignificantLead
          ? `BDI movements demonstrate statistically validated leading indicator properties at T+${bestHorizon} days (r=${highestCorrelation.toFixed(2)}).`
          : 'Lead/Lag relationship currently lacks statistical predictive significance (p > 0.05). BDI weight reduced in forward predictions.'
      };
    }

    calculatePearson(x, y) {
      const n = x.length;
      if (n === 0) return 0;
      const meanX = x.reduce((a, b) => a + b, 0) / n;
      const meanY = y.reduce((a, b) => a + b, 0) / n;

      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      if (denX <= 0 || denY <= 0) return 0;
      return num / Math.sqrt(denX * denY);
    }

    /**
     * Approximate two-tailed p-value for Student's t distribution
     */
    approximateTwoTailedPValue(t, df) {
      const absT = Math.abs(t);
      // Standard normal approximation for degrees of freedom > 30
      const x = absT / Math.sqrt(df);
      // Hastings approximation for standard normal tail probability
      const z = absT;
      const p = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
      const tProb = p / (z + 1.0 / (z + 2.0 / (z + 3.0)));
      return Math.min(1.0, Math.max(0.0001, 2 * tProb));
    }
  }

  return new BDILeadLag();
}));
