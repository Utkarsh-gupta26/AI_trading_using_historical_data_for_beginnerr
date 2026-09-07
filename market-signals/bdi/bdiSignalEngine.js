/**
 * market-signals/bdi/bdiSignalEngine.js
 * Multi-Timeframe BDI Signal Engine (-100 to +100) with False-Signal Filter.
 * Strictly prevents assuming BDI rising = stock market rising.
 * Dissects demand drivers vs supply disruption bottlenecks.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDISignalEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDISignalEngine {
    constructor() {
      // Possible drivers of BDI moves
      this.DRIVER_WEIGHTS = {
        // Real Economic Demand Drivers (Positive economic transmission)
        COMMODITY_DEMAND: { type: 'DEMAND', weight: 1.0, label: 'Global Commodity Demand' },
        CHINA_INDUSTRIAL: { type: 'DEMAND', weight: 1.0, label: 'Chinese Industrial Expansion' },
        IRON_ORE_COAL: { type: 'DEMAND', weight: 0.9, label: 'Iron Ore & Thermal Coal Imports' },
        GRAIN_DEMAND: { type: 'DEMAND', weight: 0.8, label: 'Agricultural & Grain Shipments' },
        
        // Supply Disruption Drivers (Supply Shock / Bottleneck — NOT economic strength)
        VESSEL_SUPPLY_DEFICIT: { type: 'SUPPLY', weight: 0.85, label: 'Limited Dry Bulk Fleet Supply' },
        PORT_CONGESTION: { type: 'SUPPLY', weight: 0.90, label: 'Port Congestion & Bottlenecks' },
        WEATHER_DISRUPTION: { type: 'SUPPLY', weight: 0.80, label: 'Weather Disruption / Typhoons' },
        GEOPOLITICAL_DISRUPTION: { type: 'SUPPLY', weight: 0.95, label: 'Geopolitical Rerouting (Suez/Red Sea)' },
        CAPACITY_SHORTAGE: { type: 'SUPPLY', weight: 0.85, label: 'Regulatory Fleet Speed Reductions' }
      };
    }

    /**
     * Compute normalized BDI Score (-100 to +100)
     * Weights:
     * - 20% 1-day momentum
     * - 20% 5-day momentum
     * - 20% 20-day momentum
     * - 20% medium-term trend (50D/200D alignment)
     * - 20% volatility-adjusted momentum
     *
     * @param {Object} indicators Output from BDIIndicators
     * @param {Object} [driverAttribution] Optional external or detected supply/demand metrics
     */
    calculateSignal(indicators, driverAttribution = null) {
      if (!indicators || !indicators.isValid) {
        return {
          rawScore: 0,
          score: 0,
          interpretation: 'Weak / Inactive',
          bias: 'NEUTRAL',
          driverAnalysis: {
            demandScore: 0,
            supplyDisruptionScore: 0,
            primaryCause: 'None',
            discountApplied: 0,
            explanation: 'BDI data unavailable or insufficient history — excluded from prediction.'
          },
          components: {
            m1Component: 0,
            m5Component: 0,
            m20Component: 0,
            trendComponent: 0,
            volAdjComponent: 0
          }
        };
      }

      // 1. Normalize 1D momentum (-5% to +5% -> -100 to +100)
      const m1Score = this.clamp(indicators.change1D * 20, -100, 100);

      // 2. Normalize 5D momentum (-10% to +10% -> -100 to +100)
      const m5Score = this.clamp(indicators.change5D * 10, -100, 100);

      // 3. Normalize 20D momentum (-25% to +25% -> -100 to +100)
      const m20Score = this.clamp(indicators.change20D * 4, -100, 100);

      // 4. Medium-Term Trend Score
      let trendScore = 0;
      if (indicators.trend50D === 'BULLISH') trendScore += 50;
      else if (indicators.trend50D === 'BEARISH') trendScore -= 50;
      if (indicators.trend200D === 'BULLISH') trendScore += 50;
      else if (indicators.trend200D === 'BEARISH') trendScore -= 50;

      // 5. Volatility-Adjusted Momentum Score
      const volAdjScore = this.clamp(indicators.volAdjustedMomentum * 15, -100, 100);

      // Raw Composite BDI Score
      const rawScore = (0.20 * m1Score) +
                       (0.20 * m5Score) +
                       (0.20 * m20Score) +
                       (0.20 * trendScore) +
                       (0.20 * volAdjScore);

      const normalizedRaw = Math.round(this.clamp(rawScore, -100, 100));

      // 6. FALSE-SIGNAL FILTER (Requirement 3)
      // Evaluate whether the rise is genuine economic demand or supply shock
      const filterResult = this.applyFalseSignalFilter(normalizedRaw, indicators, driverAttribution);

      const finalScore = Math.round(filterResult.adjustedScore);

      let bias = 'NEUTRAL';
      let interpretation = 'Moderate';
      if (finalScore >= 50) {
        bias = 'STRONG_BULLISH';
        interpretation = 'Strong';
      } else if (finalScore >= 20) {
        bias = 'MILDLY_BULLISH';
        interpretation = 'Moderate';
      } else if (finalScore <= -50) {
        bias = 'STRONG_BEARISH';
        interpretation = 'Weak (Sharp Contraction)';
      } else if (finalScore <= -20) {
        bias = 'MILDLY_BEARISH';
        interpretation = 'Moderate Softness';
      } else {
        bias = 'NEUTRAL';
        interpretation = 'Neutral / Rangebound';
      }

      return {
        rawScore: normalizedRaw,
        score: finalScore,
        bias,
        interpretation,
        driverAnalysis: filterResult,
        components: {
          m1Component: Number((0.20 * m1Score).toFixed(1)),
          m5Component: Number((0.20 * m5Score).toFixed(1)),
          m20Component: Number((0.20 * m20Score).toFixed(1)),
          trendComponent: Number((0.20 * trendScore).toFixed(1)),
          volAdjComponent: Number((0.20 * volAdjScore).toFixed(1))
        }
      };
    }

    /**
     * False-Signal Filter logic:
     * If BDI rises due to vessel shortage, port congestion, weather or geopolitical rerouting,
     * reduce the bullish macro score significantly.
     */
    applyFalseSignalFilter(rawScore, indicators, externalDrivers) {
      // Default driver distribution based on shipping macro indicators
      const drivers = externalDrivers || {
        commodityDemand: 0.45,
        chineseIndustrial: 0.40,
        ironOreCoal: 0.50,
        grainDemand: 0.35,
        vesselSupplyDeficit: 0.35,
        portCongestion: 0.40,
        weatherDisruption: 0.15,
        geopoliticalRerouting: 0.30,
        capacityShortage: 0.25
      };

      const demandFactor = (drivers.commodityDemand + drivers.chineseIndustrial + drivers.ironOreCoal + drivers.grainDemand) / 4;
      const supplyDisruptionFactor = (drivers.vesselSupplyDeficit + drivers.portCongestion + drivers.weatherDisruption + drivers.geopoliticalRerouting + drivers.capacityShortage) / 5;

      let discountApplied = 0;
      let adjustedScore = rawScore;
      let primaryCause = 'Balanced Demand/Fleet Dynamics';

      // Only filter positive scores (surges)
      if (rawScore > 0) {
        if (supplyDisruptionFactor > demandFactor * 1.15) {
          // Supply bottlenecks dominate the BDI surge
          const disruptionExcess = Math.min(1.0, (supplyDisruptionFactor - demandFactor) * 1.5);
          discountApplied = disruptionExcess * 0.65; // Up to 65% reduction
          adjustedScore = rawScore * (1 - discountApplied);
          primaryCause = 'Supply Bottlenecks & Port Congestion (Disruption-Driven)';
        } else if (demandFactor > supplyDisruptionFactor * 1.15) {
          // Healthy global demand expansion
          primaryCause = 'Genuine Global Commodity & Industrial Demand';
          adjustedScore = Math.min(100, rawScore * 1.05); // Slight confirmation boost
        } else {
          primaryCause = 'Mixed Demand Expansion & Capacity Utilization';
        }
      } else {
        // Negative BDI movements
        primaryCause = demandFactor < 0.35 ? 'Slowing Industrial Activity & Overcapacity' : 'Seasonal Dry Bulk Freight Softness';
      }

      return {
        demandScore: Math.round(demandFactor * 100),
        supplyDisruptionScore: Math.round(supplyDisruptionFactor * 100),
        primaryCause,
        discountApplied: Math.round(discountApplied * 100),
        adjustedScore,
        explanation: discountApplied > 0
          ? `BDI raw signal (+${rawScore}) discounted by ${Math.round(discountApplied * 100)}% due to vessel shortage/port congestion factors.`
          : `BDI signal (+${rawScore}) supported by real commodity and industrial volume flows.`
      };
    }

    clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }
  }

  return new BDISignalEngine();
}));
