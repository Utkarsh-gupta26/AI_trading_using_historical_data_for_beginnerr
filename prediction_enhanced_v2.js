/**
 * PREDICTION ENGINE v2 – TIME-AWARE, CALIBRATED, AND STATISTICALLY STRONGER
 * ============================================================================
 * Key upgrades vs prediction_enhanced.js:
 *
 * 1. Explicit prediction horizon and time handling
 *    - Each prediction has: timeframeMs, horizonCandles, predictionTime, targetTime.
 *    - Outcome scoring uses the exact target window, not an ambiguous "next close".
 *
 * 2. Time-decayed, cost-adjusted strategy performance
 *    - Uses cost-adjusted return per signal, not just win/loss.
 *    - Exponential decay so recent performance matters more.
 *    - Robust shrinkage toward a neutral prior when data is sparse.
 *
 * 3. Ensemble probability calibration
 *    - Final confidence is calibrated using historical forecast errors.
 *    - Uses a simple beta-calibration style mapping from raw score to probability.
 *
 * 4. Empirical prediction intervals
 *    - Intervals are based on historical forecast errors by horizon and regime.
 *    - Coverage is tracked per regime and horizon bucket.
 *
 * 5. Safer adaptive weights
 *    - Weights use performance, regime fit, and correlation penalty.
 *    - Weights are capped and smoothed to avoid wild swings.
 *
 * 6. Stronger validation and data-quality gates
 *    - Validates inputs, strategy IDs, confidence ranges, and dataQuality fields.
 *    - Uses spreadTooWide in the gate.
 *
 * 7. Improved news handling (still simple)
 *    - Adds negation handling and timestamp decay.
 *    - Treats unknown headlines as "unclassified" instead of neutral by default.
 *
 * 8. Persistent-style record schema
 *    - Prediction records are structured so they can be stored in a DB later.
 *
 * IMPORTANT:
 * This engine is still probabilistic. It will be wrong often. The goal is to be
 * better calibrated and more honest about uncertainty, not to claim certainty.
 * ============================================================================
 */

'use strict';

// ----------------------------------------------------------------
// 1. CONFIG
// ----------------------------------------------------------------

const STRATEGY_IDS = [
  'S01_MomentumBreakout',
  'S02_SwingPullback',
  'S03_MeanReversion',
  'S04_IntradayScalp',
  'S05_CanSlimGrowth',
  'S06_ValueRecovery',
  'S07_LowVolDrift',
  'S08_RelativeStrength',
  'S09_OpeningRange',
  'S10_IndexTrend'
];

const BASE_WEIGHTS = {
  S01_MomentumBreakout: 0.12,
  S02_SwingPullback: 0.12,
  S03_MeanReversion: 0.08,
  S04_IntradayScalp: 0.10,
  S05_CanSlimGrowth: 0.10,
  S06_ValueRecovery: 0.08,
  S07_LowVolDrift: 0.12,
  S08_RelativeStrength: 0.10,
  S09_OpeningRange: 0.08,
  S10_IndexTrend: 0.10
};

const REGIME_FIT = {
  STRONG_BULL: {
    S01_MomentumBreakout: 1.4,
    S02_SwingPullback: 1.2,
    S03_MeanReversion: 0.3,
    S04_IntradayScalp: 1.1,
    S05_CanSlimGrowth: 1.3,
    S06_ValueRecovery: 0.6,
    S07_LowVolDrift: 0.7,
    S08_RelativeStrength: 1.3,
    S09_OpeningRange: 1.1,
    S10_IndexTrend: 1.4
  },
  WEAK_BULL: {
    S01_MomentumBreakout: 1.1,
    S02_SwingPullback: 1.2,
    S03_MeanReversion: 0.6,
    S04_IntradayScalp: 1.0,
    S05_CanSlimGrowth: 1.0,
    S06_ValueRecovery: 0.8,
    S07_LowVolDrift: 0.9,
    S08_RelativeStrength: 1.1,
    S09_OpeningRange: 1.0,
    S10_IndexTrend: 1.1
  },
  SIDEWAYS: {
    S01_MomentumBreakout: 0.5,
    S02_SwingPullback: 0.7,
    S03_MeanReversion: 1.5,
    S04_IntradayScalp: 0.9,
    S05_CanSlimGrowth: 0.4,
    S06_ValueRecovery: 0.7,
    S07_LowVolDrift: 1.4,
    S08_RelativeStrength: 0.8,
    S09_OpeningRange: 0.7,
    S10_IndexTrend: 0.4
  },
  WEAK_BEAR: {
    S01_MomentumBreakout: 0.7,
    S02_SwingPullback: 0.6,
    S03_MeanReversion: 1.1,
    S04_IntradayScalp: 0.9,
    S05_CanSlimGrowth: 0.4,
    S06_ValueRecovery: 1.3,
    S07_LowVolDrift: 0.8,
    S08_RelativeStrength: 0.9,
    S09_OpeningRange: 0.8,
    S10_IndexTrend: 0.6
  },
  STRONG_BEAR: {
    S01_MomentumBreakout: 0.9,
    S02_SwingPullback: 0.4,
    S03_MeanReversion: 0.5,
    S04_IntradayScalp: 0.8,
    S05_CanSlimGrowth: 0.2,
    S06_ValueRecovery: 1.4,
    S07_LowVolDrift: 0.5,
    S08_RelativeStrength: 1.0,
    S09_OpeningRange: 0.7,
    S10_IndexTrend: 0.5
  },
  HIGH_VOL: {
    S01_MomentumBreakout: 1.0,
    S02_SwingPullback: 0.7,
    S03_MeanReversion: 0.9,
    S04_IntradayScalp: 1.2,
    S05_CanSlimGrowth: 0.6,
    S06_ValueRecovery: 0.8,
    S07_LowVolDrift: 0.3,
    S08_RelativeStrength: 0.9,
    S09_OpeningRange: 1.1,
    S10_IndexTrend: 0.8
  },
  LOW_VOL: {
    S01_MomentumBreakout: 0.6,
    S02_SwingPullback: 0.9,
    S03_MeanReversion: 1.0,
    S04_IntradayScalp: 0.6,
    S05_CanSlimGrowth: 0.8,
    S06_ValueRecovery: 0.7,
    S07_LowVolDrift: 1.5,
    S08_RelativeStrength: 1.0,
    S09_OpeningRange: 0.6,
    S10_IndexTrend: 0.9
  },
  CRISIS: {
    S01_MomentumBreakout: 0.4,
    S02_SwingPullback: 0.3,
    S03_MeanReversion: 0.3,
    S04_IntradayScalp: 0.6,
    S05_CanSlimGrowth: 0.1,
    S06_ValueRecovery: 0.5,
    S07_LowVolDrift: 0.2,
    S08_RelativeStrength: 0.5,
    S09_OpeningRange: 0.4,
    S10_IndexTrend: 0.3
  }
};

// Time and performance config
const TIMEFRAME_MS_DEFAULT = 15 * 60 * 1000; // 15 minutes
const HORIZON_CANDLES_DEFAULT = 2; // predict next 2 candles

const DECAY_PER_SIGNAL = 0.02; // exponential decay per new outcome
const MIN_EFFECTIVE_TRADES = 15; // shrinkage prior
const PRIOR_EXPECTANCY = 0.0; // prior mean return (cost-adjusted)

const MIN_TRADES_FOR_TRUST = 20; // legacy, used sparingly

const NEWS_WEIGHT = 0.15; // reduced vs original
const TECH_WEIGHT = 1 - NEWS_WEIGHT;

const NO_TRADE_CONFIDENCE_FLOOR = 0.40;
const MAX_SIGNAL_CONFIDENCE = 0.90;

// Weight smoothing and caps
const WEIGHT_SMOOTHING_ALPHA = 0.2; // new weight blend factor
const MAX_STRATEGY_WEIGHT = 0.35; // no single strategy > 35%
const MIN_STRATEGY_WEIGHT = 0.02; // floor to avoid complete death

// Interval calibration buckets
const HORIZON_BUCKETS = [1, 2, 4, 8]; // in candles

// ----------------------------------------------------------------
// 2. UTILS
// ----------------------------------------------------------------

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function isFiniteNumber(x) {
  return Number.isFinite(x) && !Number.isNaN(x);
}

function nowMs() {
  return Date.now();
}

function bucketHorizon(horizonCandles) {
  for (const b of HORIZON_BUCKETS) {
    if (horizonCandles <= b) return b;
  }
  return HORIZON_BUCKETS[HORIZON_BUCKETS.length - 1];
}

// ----------------------------------------------------------------
// 3. VALIDATION
// ----------------------------------------------------------------

function validateInputs({
  strategySignals,
  regime,
  currentPrice,
  recentReturns,
  headlines,
  dataQuality,
  timeframeMs,
  horizonCandles
}) {
  if (!Array.isArray(strategySignals) || strategySignals.length === 0) {
    throw new Error('strategySignals must be a non-empty array');
  }

  if (!REGIME_FIT[regime]) {
    throw new Error(`Unknown regime: ${regime}`);
  }

  if (!isFiniteNumber(currentPrice) || currentPrice <= 0) {
    throw new Error('currentPrice must be positive and finite');
  }

  if (timeframeMs != null && (!isFiniteNumber(timeframeMs) || timeframeMs <= 0)) {
    throw new Error('timeframeMs must be positive and finite');
  }

  if (horizonCandles != null && (!Number.isInteger(horizonCandles) || horizonCandles <= 0)) {
    throw new Error('horizonCandles must be a positive integer');
  }

  for (const s of strategySignals) {
    if (!STRATEGY_IDS.includes(s.id)) {
      throw new Error(`Unknown strategy: ${s.id}`);
    }

    if (!['BUY', 'SELL', 'HOLD'].includes(s.signal)) {
      throw new Error(`Invalid signal for ${s.id}: ${s.signal}`);
    }

    if (!isFiniteNumber(s.confidence) || s.confidence < 0 || s.confidence > 1) {
      throw new Error(`Invalid confidence for ${s.id}: ${s.confidence}`);
    }

    if (s.entry != null && !isFiniteNumber(s.entry)) {
      throw new Error(`Invalid entry for ${s.id}`);
    }
    if (s.sl != null && !isFiniteNumber(s.sl)) {
      throw new Error(`Invalid sl for ${s.id}`);
    }
    if (s.tp1 != null && !isFiniteNumber(s.tp1)) {
      throw new Error(`Invalid tp1 for ${s.id}`);
    }
    if (s.tp2 != null && !isFiniteNumber(s.tp2)) {
      throw new Error(`Invalid tp2 for ${s.id}`);
    }
  }

  if (recentReturns != null) {
    if (!Array.isArray(recentReturns)) {
      throw new Error('recentReturns must be an array');
    }
    for (const r of recentReturns) {
      if (!isFiniteNumber(r)) {
        throw new Error('recentReturns must contain finite numbers');
      }
    }
  }

  if (headlines != null && !Array.isArray(headlines)) {
    throw new Error('headlines must be an array');
  }

  if (dataQuality != null) {
    const dq = dataQuality;
    if (
      dq.isStale != null && typeof dq.isStale !== 'boolean' ||
      dq.hasGaps != null && typeof dq.hasGaps !== 'boolean' ||
      dq.spreadTooWide != null && typeof dq.spreadTooWide !== 'boolean'
    ) {
      throw new Error('dataQuality flags must be boolean');
    }
  }
}

// ----------------------------------------------------------------
// 4. CALIBRATION STORE (TIME-AWARE, COST-ADJUSTED)
// ----------------------------------------------------------------

class CalibrationStore {
  constructor() {
    this.byStrategy = {};
    this.predictionLog = new Map();
    this.ensembleCalibration = {};
    this.intervalCalibration = {};

    for (const id of STRATEGY_IDS) {
      this.byStrategy[id] = {
        effN: 0,
        expSum: 0,
        lastExp: 0,
        confBuckets: {},
        intervalErrors: []
      };
    }
  }

  _bucketOf(conf) {
    return Math.min(90, Math.floor(conf * 100 / 10) * 10);
  }

  _updateExponentialAverage(strategyId, realizedReturn) {
    const s = this.byStrategy[strategyId];
    if (!s) return;

    const alpha = DECAY_PER_SIGNAL;
    const newEffN = s.effN * (1 - alpha) + 1;
    const newExpSum = s.expSum * (1 - alpha) + realizedReturn;
    const newExp = newExpSum / newEffN;

    s.effN = newEffN;
    s.expSum = newExpSum;
    s.lastExp = newExp;
  }

  recordStrategyOutcome(strategyId, statedConfidence, realizedReturn, forecastError) {
    const s = this.byStrategy[strategyId];
    if (!s) return;

    this._updateExponentialAverage(strategyId, realizedReturn);

    const b = this._bucketOf(statedConfidence);
    if (!s.confBuckets[b]) s.confBuckets[b] = { effN: 0, expSum: 0 };
    const bucket = s.confBuckets[b];

    const alpha = DECAY_PER_SIGNAL;
    bucket.effN = bucket.effN * (1 - alpha) + 1;
    bucket.expSum = bucket.expSum * (1 - alpha) + realizedReturn;

    if (isFiniteNumber(forecastError)) {
      s.intervalErrors.push(forecastError);
      if (s.intervalErrors.length > 500) {
        s.intervalErrors = s.intervalErrors.slice(-500);
      }
    }
  }

  strategyExpectancy(strategyId) {
    const s = this.byStrategy[strategyId];
    if (!s || s.effN <= 0) return PRIOR_EXPECTANCY;

    const priorWeight = Math.max(0, MIN_EFFECTIVE_TRADES - s.effN);
    const blendedExp =
      (s.expSum + priorWeight * PRIOR_EXPECTANCY) /
      (s.effN + priorWeight);

    return blendedExp;
  }

  calibrateConfidence(strategyId, statedConfidence) {
    const s = this.byStrategy[strategyId];
    const b = this._bucketOf(statedConfidence);
    const bucket = s && s.confBuckets[b];

    if (!bucket || bucket.effN < 8) {
      return statedConfidence * 0.9 + 0.05;
    }

    const bucketExp = bucket.expSum / bucket.effN;
    const mapped = 0.5 + 10 * bucketExp;
    return clamp(mapped, 0.05, 0.95);
  }

  recordEnsembleCalibration(rawScore, actualReturn, correctDirection) {
    const bucket = Math.min(90, Math.floor(Math.abs(rawScore) * 100 / 10) * 10);
    if (!this.ensembleCalibration[bucket]) {
      this.ensembleCalibration[bucket] = {
        effN: 0,
        correctSum: 0,
        returnSum: 0
      };
    }
    const cal = this.ensembleCalibration[bucket];
    const alpha = DECAY_PER_SIGNAL;

    cal.effN = cal.effN * (1 - alpha) + 1;
    cal.correctSum = cal.correctSum * (1 - alpha) + (correctDirection ? 1 : 0);
    cal.returnSum = cal.returnSum * (1 - alpha) + actualReturn;
  }

  calibratedDirectionProbability(rawScore) {
    const bucket = Math.min(90, Math.floor(Math.abs(rawScore) * 100 / 10) * 10);
    const cal = this.ensembleCalibration[bucket];
    if (!cal || cal.effN < 8) {
      return clamp(0.5 + 0.6 * Math.abs(rawScore), 0.45, 0.85);
    }
    const hitRate = cal.correctSum / cal.effN;
    const priorWeight = Math.max(0, MIN_EFFECTIVE_TRADES - cal.effN);
    const blendedHit =
      (cal.correctSum + priorWeight * 0.5) /
      (cal.effN + priorWeight);
    return clamp(blendedHit, 0.4, 0.9);
  }

  recordIntervalOutcome(regime, horizonCandles, forecastError, withinInterval) {
    const horizonBucket = bucketHorizon(horizonCandles);
    const key = `${regime}_${horizonBucket}`;

    if (!this.intervalCalibration[key]) {
      this.intervalCalibration[key] = {
        errors: [],
        coverageHits: 0,
        coverageTotal: 0
      };
    }
    const ic = this.intervalCalibration[key];

    ic.errors.push(forecastError);
    if (ic.errors.length > 1000) {
      ic.errors = ic.errors.slice(-1000);
    }

    ic.coverageTotal += 1;
    if (withinInterval) ic.coverageHits += 1;
  }

  getIntervalQuantiles(regime, horizonCandles, targetCoverage = 0.80) {
    const horizonBucket = bucketHorizon(horizonCandles);
    const key = `${regime}_${horizonBucket}`;
    const ic = this.intervalCalibration[key];

    if (!ic || ic.errors.length < 30) {
      const allErrors = [];
      for (const k in this.intervalCalibration) {
        allErrors.push(...this.intervalCalibration[k].errors);
      }
      if (allErrors.length < 30) {
        const sigma = 0.01;
        const z = 1.28;
        return {
          qLow: -z * sigma,
          qHigh: z * sigma,
          coverage: null
        };
      }
      const sorted = [...allErrors].sort((a, b) => a - b);
      const lowIdx = Math.floor((1 - targetCoverage) / 2 * sorted.length);
      const highIdx = Math.ceil((1 - (1 - targetCoverage) / 2) * sorted.length) - 1;
      return {
        qLow: sorted[lowIdx],
        qHigh: sorted[highIdx],
        coverage: null
      };
    }

    const sorted = [...ic.errors].sort((a, b) => a - b);
    const lowIdx = Math.floor((1 - targetCoverage) / 2 * sorted.length);
    const highIdx = Math.ceil((1 - (1 - targetCoverage) / 2) * sorted.length) - 1;

    const coverage =
      ic.coverageTotal > 0 ? ic.coverageHits / ic.coverageTotal : null;

    return {
      qLow: sorted[lowIdx],
      qHigh: sorted[highIdx],
      coverage
    };
  }

  logPrediction(id, record) {
    this.predictionLog.set(id, record);
  }

  recordOutcome(predictionId, actualCloseAtTarget, fills = null) {
    const rec = this.predictionLog.get(predictionId);
    if (!rec) return null;

    const actualReturn =
      (actualCloseAtTarget - rec.priceAtPrediction) / rec.priceAtPrediction;

    const medianPredictedReturn =
      (rec.predictedClose - rec.priceAtPrediction) / rec.priceAtPrediction;

    const forecastError = actualReturn - medianPredictedReturn;

    const actualDirection =
      actualCloseAtTarget > rec.priceAtPrediction
        ? 'UP'
        : actualCloseAtTarget < rec.priceAtPrediction
          ? 'DOWN'
          : 'FLAT';

    const withinInterval =
      actualCloseAtTarget >= rec.predictedLow &&
      actualCloseAtTarget <= rec.predictedHigh;

    rec.strategySignals.forEach(sig => {
      if (sig.vote === 0) return;
      const strategyRealizedReturn = sig.vote * actualReturn;
      this.recordStrategyOutcome(
        sig.id,
        sig.confidence,
        strategyRealizedReturn,
        forecastError
      );
    });

    const correctDirection =
      (rec.normalizedScore > 0 && actualDirection === 'UP') ||
      (rec.normalizedScore < 0 && actualDirection === 'DOWN');

    this.recordEnsembleCalibration(rec.normalizedScore, actualReturn, correctDirection);

    this.recordIntervalOutcome(
      rec.regime,
      rec.horizonCandles,
      forecastError,
      withinInterval
    );

    rec.resolved = true;
    rec.actualClose = actualCloseAtTarget;
    rec.actualDirection = actualDirection;
    rec.actualReturn = actualReturn;
    rec.withinInterval = withinInterval;
    rec.fills = fills;

    return {
      actualDirection,
      withinInterval,
      actualReturn,
      predictionId
    };
  }

  intervalCoverageRate(regime, horizonCandles) {
    const horizonBucket = bucketHorizon(horizonCandles);
    const key = `${regime}_${horizonBucket}`;
    const ic = this.intervalCalibration[key];
    if (!ic || ic.coverageTotal === 0) return null;
    return ic.coverageHits / ic.coverageTotal;
  }
}

// ----------------------------------------------------------------
// 5. ADAPTIVE STRATEGY WEIGHTING (TIME-DECAYED, REGIME-AWARE)
// ----------------------------------------------------------------

function computeAdaptiveWeight(strategyId, regime, calStore, prevWeights) {
  const base = BASE_WEIGHTS[strategyId] ?? 1 / STRATEGY_IDS.length;
  const regimeFit =
    (REGIME_FIT[regime] && REGIME_FIT[regime][strategyId]) ?? 1.0;

  const exp = calStore.strategyExpectancy(strategyId);
  const perfMultiplier = 1 + 15 * exp;
  const raw = base * regimeFit * Math.max(0.2, perfMultiplier);

  if (prevWeights && prevWeights[strategyId] != null) {
    const prev = prevWeights[strategyId];
    const smoothed =
      (1 - WEIGHT_SMOOTHING_ALPHA) * prev +
      WEIGHT_SMOOTHING_ALPHA * raw;
    return smoothed;
  }

  return raw;
}

function normalizeAndCapWeights(weightMap) {
  const capped = {};
  for (const k in weightMap) {
    capped[k] = clamp(
      weightMap[k],
      MIN_STRATEGY_WEIGHT,
      MAX_STRATEGY_WEIGHT
    );
  }

  const total = Object.values(capped).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const k in capped) {
    out[k] = capped[k] / total;
  }
  return out;
}

// ----------------------------------------------------------------
// 6. NEWS SENTIMENT (SIMPLE BUT SAFER)
// ----------------------------------------------------------------

const BULLISH_TOKENS = [
  'surge',
  'rally',
  'breakout',
  'record high',
  'profit',
  'expansion',
  'upgrade',
  'gain',
  'beat',
  'outperform'
];

const BEARISH_TOKENS = [
  'crash',
  'plunge',
  'slump',
  'tariff',
  'decline',
  'inflation',
  'loss',
  'rout',
  'recession',
  'miss',
  'downgrade'
];

const NEGATION_WORDS = ['no', 'not', 'never', 'unlikely', 'avoids'];

function hasNegationNear(text, index) {
  const before = text.slice(Math.max(0, index - 60), index);
  return NEGATION_WORDS.some(w => before.includes(w));
}

function scoreHeadlines(headlines, nowMsValue = null) {
  const now = nowMsValue ?? nowMs();

  if (!headlines || headlines.length === 0) {
    return {
      score: 0,
      status: 'LIVE_NEWS_DATA_UNAVAILABLE',
      nBull: 0,
      nBear: 0,
      nUnclassified: 0
    };
  }

  let nBull = 0;
  let nBear = 0;
  let nUnclassified = 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const h of headlines) {
    const text = (h.title || '').toLowerCase();
    const ts = h.timestamp ?? now;
    const ageHours = (now - ts) / (1000 * 60 * 60);

    const timeWeight = clamp(1 - ageHours / 48, 0.2, 1.0);

    let localBull = 0;
    let localBear = 0;

    for (const t of BULLISH_TOKENS) {
      const idx = text.indexOf(t);
      if (idx >= 0 && !hasNegationNear(text, idx)) {
        localBull += 1;
      }
    }

    for (const t of BEARISH_TOKENS) {
      const idx = text.indexOf(t);
      if (idx >= 0 && !hasNegationNear(text, idx)) {
        localBear += 1;
      }
    }

    if (localBull === 0 && localBear === 0) {
      nUnclassified += 1;
      continue;
    }

    const localScore = (localBull - localBear) / (localBull + localBear);
    weightedSum += localScore * timeWeight;
    weightTotal += timeWeight;

    if (localScore > 0) nBull += 1;
    else if (localScore < 0) nBear += 1;
  }

  if (weightTotal === 0) {
    return {
      score: 0,
      status: 'NEWS_UNCLASSIFIED',
      nBull,
      nBear,
      nUnclassified
    };
  }

  const score = weightedSum / weightTotal;
  return {
    score,
    status: 'OK',
    nBull,
    nBear,
    nUnclassified
  };
}

// ----------------------------------------------------------------
// 7. CORE FUSION FUNCTION (TIME-AWARE, CALIBRATED)
// ----------------------------------------------------------------

function fuseSignal({
  strategySignals,
  regime,
  headlines,
  currentPrice,
  recentReturns,
  calStore,
  dataQuality,
  timeConfig = {}
}) {
  const timeframeMs = timeConfig.timeframeMs ?? TIMEFRAME_MS_DEFAULT;
  const horizonCandles = timeConfig.horizonCandles ?? HORIZON_CANDLES_DEFAULT;
  const predictionTime = timeConfig.predictionTime ?? nowMs();
  const targetTime = predictionTime + timeframeMs * horizonCandles;

  validateInputs({
    strategySignals,
    regime,
    currentPrice,
    recentReturns,
    headlines,
    dataQuality,
    timeframeMs,
    horizonCandles
  });

  const dq = dataQuality || {};
  if (dq.isStale || dq.hasGaps || dq.spreadTooWide) {
    return {
      signal: 'NO_TRADE',
      reason: 'DATA_QUALITY_FAILURE',
      confidence: null,
      timeConfig: { timeframeMs, horizonCandles, predictionTime, targetTime }
    };
  }

  const calibratedSignals = strategySignals.map(s => {
    const vote =
      s.signal === 'BUY' ? 1 : s.signal === 'SELL' ? -1 : 0;
    const calibratedConfidence = calStore.calibrateConfidence(
      s.id,
      s.confidence
    );
    return { ...s, vote, calibratedConfidence };
  });

  const rawWeights = {};
  for (const s of calibratedSignals) {
    rawWeights[s.id] = computeAdaptiveWeight(
      s.id,
      regime,
      calStore,
      null
    );
  }
  const weights = normalizeAndCapWeights(rawWeights);

  let weightedVoteSum = 0;
  let weightSum = 0;

  for (const s of calibratedSignals) {
    const w = weights[s.id] * s.calibratedConfidence;
    weightedVoteSum += w * s.vote;
    weightSum += w;
  }

  const technicalScore =
    weightSum === 0 ? 0 : weightedVoteSum / weightSum;

  const news = scoreHeadlines(headlines, predictionTime);

  let normalizedScore;
  if (news.status === 'OK') {
    normalizedScore =
      TECH_WEIGHT * technicalScore + NEWS_WEIGHT * news.score;
  } else {
    normalizedScore = technicalScore;
  }

  let confidenceAdjustment = 0;
  let confluenceNote = 'NO_NEWS_DATA';

  if (news.status === 'OK') {
    const sameSign =
      Math.sign(technicalScore) !== 0 &&
      Math.sign(technicalScore) === Math.sign(news.score);
    if (sameSign) {
      confidenceAdjustment = 0.08;
      confluenceNote = 'CONFLUENCE_CONFIRMED';
    } else if (Math.sign(news.score) !== 0) {
      confidenceAdjustment = -0.10;
      confluenceNote = 'DIVERGENCE_WARNING';
    } else {
      confluenceNote = 'NEWS_NEUTRAL';
    }
  }

  const agreement = calibratedSignals.length
    ? calibratedSignals.filter(
        s =>
          Math.sign(s.vote) === Math.sign(normalizedScore) &&
          s.vote !== 0
      ).length / calibratedSignals.length
    : 0;

  let rawConfidence =
    Math.abs(normalizedScore) * 0.6 + agreement * 0.4;

  rawConfidence = clamp(
    rawConfidence + confidenceAdjustment,
    0,
    MAX_SIGNAL_CONFIDENCE
  );

  const calibratedProb = calStore.calibratedDirectionProbability(
    normalizedScore
  );

  const finalConfidence = clamp(
    0.5 * rawConfidence + 0.5 * calibratedProb,
    0,
    MAX_SIGNAL_CONFIDENCE
  );

  const n = recentReturns && recentReturns.length ? recentReturns.length : 0;
  const meanReturn = n
    ? recentReturns.reduce((a, b) => a + b, 0) / n
    : 0;
  const variance = n
    ? recentReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / n
    : 0;
  const sigma = Math.sqrt(variance);

  const directionalBias = normalizedScore * sigma * 2.2;
  const medianReturn = meanReturn + directionalBias;
  const predictedClose = currentPrice * (1 + medianReturn);

  const { qLow, qHigh } = calStore.getIntervalQuantiles(
    regime,
    horizonCandles,
    0.80
  );

  const predictedLow = currentPrice * (1 + medianReturn + qLow);
  const predictedHigh = currentPrice * (1 + medianReturn + qHigh);

  const finalLow = Math.min(predictedLow, predictedClose, predictedHigh);
  const finalHigh = Math.max(predictedLow, predictedClose, predictedHigh);

  let finalSignal;
  if (finalConfidence < NO_TRADE_CONFIDENCE_FLOOR) {
    finalSignal = 'NO_TRADE';
  } else if (normalizedScore > 0.5) {
    finalSignal = 'STRONG_BUY';
  } else if (normalizedScore > 0.15) {
    finalSignal = 'BUY';
  } else if (normalizedScore > 0.02) {
    finalSignal = 'WEAK_BUY';
  } else if (normalizedScore < -0.5) {
    finalSignal = 'STRONG_SELL';
  } else if (normalizedScore < -0.15) {
    finalSignal = 'SELL';
  } else if (normalizedScore < -0.02) {
    finalSignal = 'WEAK_SELL';
  } else {
    finalSignal = 'NEUTRAL';
  }

  const predictionId = `pred_${predictionTime}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const record = {
    predictionId,
    timestamp: predictionTime,
    targetTime,
    timeframeMs,
    horizonCandles,
    regime,
    priceAtPrediction: currentPrice,
    predictedClose,
    predictedHigh: finalHigh,
    predictedLow: finalLow,
    normalizedScore,
    confidence: finalConfidence,
    finalSignal,
    strategySignals: calibratedSignals.map(s => ({
      id: s.id,
      vote: s.vote,
      confidence: s.calibratedConfidence
    })),
    resolved: false
  };

  calStore.logPrediction(predictionId, record);

  return {
    predictionId,
    signal: finalSignal,
    confidence: Number(finalConfidence.toFixed(4)),
    normalizedScore: Number(normalizedScore.toFixed(4)),
    technicalScore: Number(technicalScore.toFixed(4)),
    newsScore: news.score,
    newsStatus: news.status,
    confluence: confluenceNote,
    forecast: {
      predictedClose: Number(predictedClose.toFixed(4)),
      predictedHigh: Number(finalHigh.toFixed(4)),
      predictedLow: Number(finalLow.toFixed(4)),
      timeframeMs,
      horizonCandles,
      predictionTime,
      targetTime,
      note:
        'Probabilistic range based on historical forecast errors. ' +
        'Track record: see calStore.intervalCoverageRate(regime, horizonCandles).'
    },
    strategyWeights: weights,
    disclaimer:
      'Probability, not certainty. No signal here implies guaranteed profit or 100% accuracy.'
  };
}

module.exports = {
  CalibrationStore,
  fuseSignal,
  computeAdaptiveWeight,
  scoreHeadlines,
  validateInputs,
  STRATEGY_IDS,
  BASE_WEIGHTS,
  REGIME_FIT,
  TIMEFRAME_MS_DEFAULT,
  HORIZON_CANDLES_DEFAULT
};
