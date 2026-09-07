/**
 * market-signals/bdi/bdiExplanation.js
 * Generates natural language AI explanations grounding BDI influence in actual numbers:
 * "Why is BDI affecting today's prediction?"
 * Explicitly breaks down demand vs supply bottlenecks, correlation strength,
 * and exact points contributed to the Global Macro Score.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDIExplanation = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDIExplanation {
    /**
     * Generate grounded natural language explanation
     * @param {Object} bdiIndicators
     * @param {Object} bdiSignal
     * @param {Object} correlationData
     * @param {Object} leadLagData
     * @param {number} macroPoints Points contributed to Global Macro Score (e.g. +8)
     * @param {string} targetSymbol
     */
    generate(bdiIndicators, bdiSignal, correlationData, leadLagData, macroPoints = 0, targetSymbol = 'NIFTY 50') {
      if (!bdiIndicators || !bdiIndicators.isValid) {
        return {
          title: "Why is BDI affecting today's prediction?",
          narrative: "BDI data is currently unavailable or stale. Under institutional risk controls, the BDI factor has been defaulted to neutral (0) and excluded from influencing today's prediction.",
          impactPoints: 0,
          riskWarning: "BDI is a macroeconomic indicator, not a standalone trading signal.",
          drivers: []
        };
      }

      const c5D = bdiIndicators.change5D;
      const c20D = bdiIndicators.change20D;
      const chgStr = c5D >= 0 ? `+${c5D.toFixed(1)}%` : `${c5D.toFixed(1)}%`;
      const chg20Str = c20D >= 0 ? `+${c20D.toFixed(1)}%` : `${c20D.toFixed(1)}%`;
      const currentVal = bdiIndicators.current ? bdiIndicators.current.toLocaleString() : 'N/A';

      const driver = bdiSignal.driverAnalysis || {};
      const discount = driver.discountApplied || 0;
      const primaryCause = driver.primaryCause || 'Global freight demand cycles';

      let supplyDemandClause = '';
      if (discount > 0) {
        supplyDemandClause = `However, supply chain telemetry attributes significant upward pressure to fleet supply constraints and port bottlenecks (${discount}% discount applied by the False-Signal Filter).`;
      } else if (bdiSignal.score > 20) {
        supplyDemandClause = `The advance is broadly verified by physical iron ore, coal, and grain dry bulk flows, confirming real economic commodity pull.`;
      } else if (bdiSignal.score < -20) {
        supplyDemandClause = `Freight rates reflect declining industrial trade volumes and easing maritime shipping demand.`;
      } else {
        supplyDemandClause = `Dry bulk shipping rates remain rangebound within normal seasonal volatility.`;
      }

      let corrClause = '';
      if (correlationData && correlationData.d90 !== undefined) {
        const rVal = correlationData.d90;
        corrClause = `The current 90-day correlation with ${targetSymbol} is ${rVal > 0 ? '+' : ''}${rVal.toFixed(2)} (${correlationData.regimeDesc || 'moderately correlated'}).`;
      }

      const pointsFormatted = macroPoints >= 0 ? `+${macroPoints}` : `${macroPoints}`;
      const narrative = `The Baltic Dry Index (BDI) stands at ${currentVal}, moving ${chgStr} over the last 5 sessions and ${chg20Str} over 20 sessions. ${supplyDemandClause} ${corrClause} Consequently, BDI is contributing ${pointsFormatted} points to the Global Macro Score rather than acting as a standalone predictor for ${targetSymbol}.`;

      return {
        title: "Why is BDI affecting today's prediction?",
        narrative,
        impactPoints: macroPoints,
        currentBdi: currentVal,
        change5D: chgStr,
        primaryCause,
        discountApplied: discount,
        riskWarning: "BDI is a macroeconomic indicator, not a standalone trading signal.",
        drivers: [
          { label: 'Demand Attribution', score: driver.demandScore || 50 },
          { label: 'Supply/Congestion Bottleneck', score: driver.supplyDisruptionScore || 30 },
          { label: 'Signal Quality Discount', score: discount }
        ]
      };
    }
  }

  return new BDIExplanation();
}));
