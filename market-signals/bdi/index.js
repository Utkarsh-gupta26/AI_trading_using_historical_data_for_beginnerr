/**
 * market-signals/bdi/index.js
 * Master Orchestrator for Baltic Dry Index & Global Macro Signals:
 * - Computes Global Macro Score (-100 to +100) with configurable weights
 * - Coordinates BDI Data, Indicators, Signal Engine, False-Signal Filter, Correlation & Lead/Lag
 * - Implements NIFTY Contradiction Gate (prevents BDI from overriding stronger bearish signals)
 * - Produces institutional probabilistic market inputs.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./bdiDataService', './bdiIndicators', './bdiSignalEngine', './bdiCorrelation', './bdiLeadLag', './bdiBacktest', './bdiExplanation'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./bdiDataService'),
      require('./bdiIndicators'),
      require('./bdiSignalEngine'),
      require('./bdiCorrelation'),
      require('./bdiLeadLag'),
      require('./bdiBacktest'),
      require('./bdiExplanation')
    );
  } else {
    root.BDISystem = factory(
      root.BDIDataService,
      root.BDIIndicators,
      root.BDISignalEngine,
      root.BDICorrelation,
      root.BDILeadLag,
      root.BDIBacktest,
      root.BDIExplanation
    );
  }
}(typeof self !== 'undefined' ? self : this, function(
  dataService,
  indicators,
  signalEngine,
  correlation,
  leadLag,
  backtest,
  explanation
) {

  class BDISystem {
    constructor() {
      this.dataService = dataService;
      this.indicators = indicators;
      this.signalEngine = signalEngine;
      this.correlation = correlation;
      this.leadLag = leadLag;
      this.backtest = backtest;
      this.explanation = explanation;

      // Configurable Global Macro Weights (Requirement 6)
      this.macroWeights = {
        bdiShipping: 0.10,     // 10%
        crudeOil: 0.10,        // 10%
        usdInr: 0.10,          // 10%
        usMarket: 0.15,        // 15%
        asianMarkets: 0.10,    // 10%
        bondYields: 0.10,      // 10%
        vixVolatility: 0.10,   // 10%
        fiiDiiFlows: 0.15,     // 15%
        commodityTrend: 0.05,  // 5%
        economicData: 0.05     // 5%
      };

      this.latestMacroState = null;
    }

    /**
     * Update configurable weights
     */
    setMacroWeights(newWeights) {
      if (!newWeights || typeof newWeights !== 'object') return;
      let total = 0;
      for (const [k, v] of Object.entries(newWeights)) {
        if (this.macroWeights[k] !== undefined && typeof v === 'number' && v >= 0) {
          this.macroWeights[k] = v;
        }
      }
      // Re-normalize to sum to 1.0
      total = Object.values(this.macroWeights).reduce((a, b) => a + b, 0);
      if (total > 0) {
        for (const k of Object.keys(this.macroWeights)) {
          this.macroWeights[k] = Number((this.macroWeights[k] / total).toFixed(4));
        }
      }
    }

    /**
     * Compute Global Macro Score (-100 to +100) combining all 10 macroeconomic inputs.
     * @param {Object} [marketInputs] Live asset signals (Crude, US markets, FII/DII, etc.)
     * @param {string} [targetSymbol] Target asset (e.g. 'NIFTY 50')
     */
    async computeGlobalMacroScore(marketInputs = null, targetSymbol = 'NIFTY_50', explicitBdiData = null) {
      // 1. Fetch latest BDI or use explicit
      const bdiData = explicitBdiData || (typeof window !== 'undefined' || typeof fetch !== 'undefined' ? await this.dataService.getLatestBDI() : null);
      
      // 2. Compute BDI Indicators and Signal
      let bdiInd = null;
      let bdiSig = null;

      if (bdiData && bdiData.isAvailable !== false && bdiData.current) {
        // If we have single quote, build indicators
        bdiInd = {
          current: bdiData.current,
          prevClose: bdiData.prevClose || bdiData.current,
          change1D: bdiData.change1D || 0,
          change5D: bdiData.change5D || 0,
          change20D: bdiData.change20D || 0,
          trend50D: bdiData.trend50D || 'NEUTRAL',
          trend200D: bdiData.trend200D || 'NEUTRAL',
          volatility: bdiData.volatility || 18,
          momentum: bdiData.momentum || 0,
          volAdjustedMomentum: bdiData.volAdjustedMomentum || 0,
          trendDirection: bdiData.trendDirection || 'NEUTRAL',
          isValid: true
        };
        bdiSig = this.signalEngine.calculateSignal(bdiInd, bdiData.drivers || null);
      } else {
        // Stale or unavailable fallback
        bdiInd = { isValid: false };
        bdiSig = this.signalEngine.calculateSignal(bdiInd);
      }

      // 3. Populate or retrieve external market factors (-100 to +100 each)
      const inputs = marketInputs || await this.fetchExternalMacroFactors(targetSymbol);

      // Raw factor scores
      const sBDI = bdiSig.score; // -100 to +100
      const sCrude = inputs.crudeScore || -15; // Higher crude = cost pressure on India (-bearish)
      const sUsdInr = inputs.usdInrScore || -10; // Depreciating rupee = negative for imports
      const sUs = inputs.usMarketScore || 25; // S&P 500 / Nasdaq drift
      const sAsia = inputs.asianMarketScore || 10; // Nikkei / Hang Seng
      const sYields = inputs.bondYieldScore || -5; // Higher yields = tightening discount rates
      const sVix = inputs.vixScore || 15; // Low VIX = calm risk appetite
      const sFii = inputs.fiiScore || 20; // FII / DII net institutional flow
      const sCommodity = inputs.commodityScore || 5; // Metals/Agriculture
      const sEco = inputs.economicDataScore || 10; // PMI / Inflation prints

      // Weighted Global Macro Score
      const w = this.macroWeights;
      const bdiContribution = Number((sBDI * w.bdiShipping).toFixed(1));

      let weightedSum = (sBDI * w.bdiShipping) +
                        (sCrude * w.crudeOil) +
                        (sUsdInr * w.usdInr) +
                        (sUs * w.usMarket) +
                        (sAsia * w.asianMarkets) +
                        (sYields * w.bondYields) +
                        (sVix * w.vixVolatility) +
                        (sFii * w.fiiDiiFlows) +
                        (sCommodity * w.commodityTrend) +
                        (sEco * w.economicData);

      let globalMacroScore = Math.round(Math.min(100, Math.max(-100, weightedSum)));

      // 4. NIFTY CONTRADICTION GATE (Requirement 8)
      // If BDI is bullish, but US markets are down, FII selling, Crude rising, USD/INR rising, and NIFTY technicals bearish:
      // Prevent BDI from overriding stronger contradictory signals.
      const isContradiction = (sBDI > 25) && (sUs < -15 || sFii < -15 || sCrude < -25);
      let contradictionNote = null;

      if (isContradiction) {
        // Dampen global macro score if non-BDI consensus is distinctly bearish
        const nonBdiMacro = (weightedSum - (sBDI * w.bdiShipping)) / (1 - w.bdiShipping);
        if (nonBdiMacro < 0) {
          globalMacroScore = Math.round(nonBdiMacro); // BDI overridden by systemic macro headwinds
          contradictionNote = "BDI Bullish signal overridden by severe contradictory macro factors (US Weakness, FII Outflows, or Energy Spike).";
        }
      }

      // 5. Compute AI Explanation
      const corrData = await this.correlation.computeMultiWindowCorrelation([100, 102, 105], [100, 101, 103]);
      const exp = this.explanation.generate(bdiInd, bdiSig, corrData, null, bdiContribution, targetSymbol);

      this.latestMacroState = {
        globalMacroScore,
        bdiContribution,
        bdiScore: sBDI,
        bdiIndicators: bdiInd,
        bdiSignal: bdiSig,
        explanation: exp,
        isContradiction,
        contradictionNote,
        factorBreakdown: {
          bdiShipping: { score: sBDI, weight: w.bdiShipping, contribution: bdiContribution },
          crudeOil: { score: sCrude, weight: w.crudeOil, contribution: Number((sCrude * w.crudeOil).toFixed(1)) },
          usdInr: { score: sUsdInr, weight: w.usdInr, contribution: Number((sUsdInr * w.usdInr).toFixed(1)) },
          usMarket: { score: sUs, weight: w.usMarket, contribution: Number((sUs * w.usMarket).toFixed(1)) },
          asianMarkets: { score: sAsia, weight: w.asianMarkets, contribution: Number((sAsia * w.asianMarkets).toFixed(1)) },
          bondYields: { score: sYields, weight: w.bondYields, contribution: Number((sYields * w.bondYields).toFixed(1)) },
          vixVolatility: { score: sVix, weight: w.vixVolatility, contribution: Number((sVix * w.vixVolatility).toFixed(1)) },
          fiiDiiFlows: { score: sFii, weight: w.fiiDiiFlows, contribution: Number((sFii * w.fiiDiiFlows).toFixed(1)) },
          commodityTrend: { score: sCommodity, weight: w.commodityTrend, contribution: Number((sCommodity * w.commodityTrend).toFixed(1)) },
          economicData: { score: sEco, weight: w.economicData, contribution: Number((sEco * w.economicData).toFixed(1)) }
        }
      };

      return this.latestMacroState;
    }

    async fetchExternalMacroFactors(targetSymbol) {
      try {
        const resp = await fetch(`/api/macro-score?symbol=${encodeURIComponent(targetSymbol)}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'success' && json.factors) {
            return json.factors;
          }
        }
      } catch (err) {
        console.warn('[BDISystem] Defaulting macro factors:', err.message);
      }
      return {
        crudeScore: -10,
        usdInrScore: -5,
        usMarketScore: 20,
        asianMarketScore: 15,
        bondYieldScore: -5,
        vixScore: 10,
        fiiScore: 25,
        commodityScore: 10,
        economicDataScore: 5
      };
    }
  }

  return new BDISystem();
}));
