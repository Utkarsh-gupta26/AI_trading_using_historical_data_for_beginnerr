/**
 * ENHANCED PREDICTION / SIGNAL FUSION ENGINE
 * ============================================================
 * This is an upgrade of prediction.js from your Signal Desk engine.
 *
 * WHAT CHANGED VS THE ORIGINAL, AND WHY:
 *
 * 1. Static W_base weights -> ADAPTIVE weights driven by each
 *    strategy's rolling realized performance + current regime fit.
 *    (A strategy that's been wrong for the last 50 signals should
 *    count for less right now, regardless of its "baseline" weight.)
 *
 * 2. Raw confidence numbers -> CALIBRATED confidence.
 *    A strategy that says "80% confidence" is only trustworthy if,
 *    historically, its 80%-confidence calls were actually right
 *    ~80% of the time. We track that and rescale.
 *
 * 3. Single point forecast -> PREDICTION INTERVAL.
 *    We never emit one "Predicted Close" as if it were fact. We
 *    emit a distribution (median + confidence band) and we track
 *    how often reality falls inside that band, so the band width
 *    is honest, not decorative.
 *
 * 4. No accuracy tracking -> ONLINE CALIBRATION LOG.
 *    Every prediction is stored with a unique id. When the next
 *    candle closes, record_outcome() scores it. This closes the
 *    loop your original doc explicitly said was needed
 *    ("model predictions must be versioned... store prediction,
 *    actual_outcome") but the original prediction.js never did.
 *
 * 5. Added an explicit NO_TRADE / LOW_CONFIDENCE gate so the system
 *    can say "I don't have an edge right now" instead of forcing
 *    a directional call on every candle.
 *
 * IMPORTANT HONESTY NOTE (please keep this, don't strip it out):
 * This engine will still be wrong sometimes. That is mathematically
 * unavoidable for any market-prediction system. What this version
 * does differently is: (a) know roughly HOW wrong it tends to be,
 * (b) say so explicitly via confidence + interval width, and
 * (c) refuse to signal when it doesn't have a real edge. That is
 * what "enhanced" can honestly mean here — better calibrated, not
 * error-free.
 * ============================================================
 */

'use strict';

// ----------------------------------------------------------------
// 1. CONFIG
// ----------------------------------------------------------------

const STRATEGY_IDS = [
  'S01_MomentumBreakout', 'S02_SwingPullback', 'S03_MeanReversion',
  'S04_IntradayScalp', 'S05_CanSlimGrowth', 'S06_ValueRecovery',
  'S07_LowVolDrift', 'S08_RelativeStrength', 'S09_OpeningRange',
  'S10_IndexTrend'
];

// Baseline weights only used as a PRIOR before we have live history.
// They decay in influence as real performance data accumulates.
const BASE_WEIGHTS = {
  S01_MomentumBreakout: 0.12, S02_SwingPullback: 0.12, S03_MeanReversion: 0.08,
  S04_IntradayScalp: 0.10, S05_CanSlimGrowth: 0.10, S06_ValueRecovery: 0.08,
  S07_LowVolDrift: 0.12, S08_RelativeStrength: 0.10, S09_OpeningRange: 0.08,
  S10_IndexTrend: 0.10
};

// Which regime each strategy is naturally suited for.
// Used as a multiplicative fit-score, not a hard filter.
const REGIME_FIT = {
  STRONG_BULL:  { S01_MomentumBreakout: 1.4, S02_SwingPullback: 1.2, S03_MeanReversion: 0.3, S04_IntradayScalp: 1.1, S05_CanSlimGrowth: 1.3, S06_ValueRecovery: 0.6, S07_LowVolDrift: 0.7, S08_RelativeStrength: 1.3, S09_OpeningRange: 1.1, S10_IndexTrend: 1.4 },
  WEAK_BULL:    { S01_MomentumBreakout: 1.1, S02_SwingPullback: 1.2, S03_MeanReversion: 0.6, S04_IntradayScalp: 1.0, S05_CanSlimGrowth: 1.0, S06_ValueRecovery: 0.8, S07_LowVolDrift: 0.9, S08_RelativeStrength: 1.1, S09_OpeningRange: 1.0, S10_IndexTrend: 1.1 },
  SIDEWAYS:     { S01_MomentumBreakout: 0.5, S02_SwingPullback: 0.7, S03_MeanReversion: 1.5, S04_IntradayScalp: 0.9, S05_CanSlimGrowth: 0.4, S06_ValueRecovery: 0.7, S07_LowVolDrift: 1.4, S08_RelativeStrength: 0.8, S09_OpeningRange: 0.7, S10_IndexTrend: 0.4 },
  WEAK_BEAR:    { S01_MomentumBreakout: 0.7, S02_SwingPullback: 0.6, S03_MeanReversion: 1.1, S04_IntradayScalp: 0.9, S05_CanSlimGrowth: 0.4, S06_ValueRecovery: 1.3, S07_LowVolDrift: 0.8, S08_RelativeStrength: 0.9, S09_OpeningRange: 0.8, S10_IndexTrend: 0.6 },
  STRONG_BEAR:  { S01_MomentumBreakout: 0.9, S02_SwingPullback: 0.4, S03_MeanReversion: 0.5, S04_IntradayScalp: 0.8, S05_CanSlimGrowth: 0.2, S06_ValueRecovery: 1.4, S07_LowVolDrift: 0.5, S08_RelativeStrength: 1.0, S09_OpeningRange: 0.7, S10_IndexTrend: 0.5 },
  HIGH_VOL:     { S01_MomentumBreakout: 1.0, S02_SwingPullback: 0.7, S03_MeanReversion: 0.9, S04_IntradayScalp: 1.2, S05_CanSlimGrowth: 0.6, S06_ValueRecovery: 0.8, S07_LowVolDrift: 0.3, S08_RelativeStrength: 0.9, S09_OpeningRange: 1.1, S10_IndexTrend: 0.8 },
  LOW_VOL:      { S01_MomentumBreakout: 0.6, S02_SwingPullback: 0.9, S03_MeanReversion: 1.0, S04_IntradayScalp: 0.6, S05_CanSlimGrowth: 0.8, S06_ValueRecovery: 0.7, S07_LowVolDrift: 1.5, S08_RelativeStrength: 1.0, S09_OpeningRange: 0.6, S10_IndexTrend: 0.9 },
  CRISIS:       { S01_MomentumBreakout: 0.4, S02_SwingPullback: 0.3, S03_MeanReversion: 0.3, S04_IntradayScalp: 0.6, S05_CanSlimGrowth: 0.1, S06_ValueRecovery: 0.5, S07_LowVolDrift: 0.2, S08_RelativeStrength: 0.5, S09_OpeningRange: 0.4, S10_IndexTrend: 0.3 }
};

const MIN_TRADES_FOR_TRUST = 20;   // below this, lean on the prior
const NEWS_WEIGHT = 0.20;
const TECH_WEIGHT = 1 - NEWS_WEIGHT;
const NO_TRADE_CONFIDENCE_FLOOR = 0.42; // below this -> NO_TRADE, not a coin-flip signal
const MAX_SIGNAL_CONFIDENCE = 0.93;     // hard ceiling: never claim near-certainty

// ----------------------------------------------------------------
// 2. PERFORMANCE / CALIBRATION STORE
// ----------------------------------------------------------------
// In production back this with a DB table (see your doc's `predictions`
// / `model_versions` tables). Kept in-memory here for clarity.

class CalibrationStore {
  constructor() {
    this.byStrategy = {}; // id -> { wins, losses, confBuckets: {bucket: {n, correct}} }
    this.predictionLog = new Map(); // predictionId -> record
    for (const id of STRATEGY_IDS) {
      this.byStrategy[id] = { wins: 0, losses: 0, confBuckets: {} };
    }
  }

  _bucketOf(conf) {
    // 10-point buckets: 0-10,10-20,...,90-100
    return Math.min(90, Math.floor(conf * 100 / 10) * 10);
  }

  recordStrategyOutcome(strategyId, statedConfidence, wasCorrect) {
    const s = this.byStrategy[strategyId];
    if (!s) return;
    wasCorrect ? s.wins++ : s.losses++;
    const b = this._bucketOf(statedConfidence);
    if (!s.confBuckets[b]) s.confBuckets[b] = { n: 0, correct: 0 };
    s.confBuckets[b].n++;
    if (wasCorrect) s.confBuckets[b].correct++;
  }

  // Historical hit-rate for a strategy, blended with a neutral 50% prior
  // so a strategy with only 3 trades doesn't look artificially perfect.
  strategyHitRate(strategyId) {
    const s = this.byStrategy[strategyId];
    if (!s) return 0.5;
    const n = s.wins + s.losses;
    const priorWeight = Math.max(0, MIN_TRADES_FOR_TRUST - n);
    const priorN = priorWeight;
    const blendedWins = s.wins + 0.5 * priorN;
    const blendedN = n + priorN;
    return blendedN === 0 ? 0.5 : blendedWins / blendedN;
  }

  // Calibrate a strategy's stated confidence against its own track record
  // in that confidence bucket. Falls back to the stated value if no data.
  calibrateConfidence(strategyId, statedConfidence) {
    const s = this.byStrategy[strategyId];
    const b = this._bucketOf(statedConfidence);
    const bucket = s && s.confBuckets[b];
    if (!bucket || bucket.n < 8) return statedConfidence; // not enough data to override
    return bucket.correct / bucket.n;
  }

  logPrediction(id, record) { this.predictionLog.set(id, record); }

  // Call this once the actual next-candle outcome is known.
  recordOutcome(predictionId, actualClose) {
    const rec = this.predictionLog.get(predictionId);
    if (!rec) return null;
    const actualDirection = actualClose > rec.priceAtPrediction ? 'UP'
      : actualClose < rec.priceAtPrediction ? 'DOWN' : 'FLAT';
    const withinInterval = actualClose >= rec.predictedLow && actualClose <= rec.predictedHigh;
    rec.strategySignals.forEach(sig => {
      const predictedUp = sig.vote > 0;
      const predictedDown = sig.vote < 0;
      const correct = (predictedUp && actualDirection === 'UP') ||
                       (predictedDown && actualDirection === 'DOWN');
      if (sig.vote !== 0) {
        this.recordStrategyOutcome(sig.id, sig.confidence, correct);
      }
    });
    rec.resolved = true;
    rec.actualClose = actualClose;
    rec.actualDirection = actualDirection;
    rec.withinInterval = withinInterval;
    return { actualDirection, withinInterval, predictionId };
  }

  // Rolling interval-coverage rate: are our "80% intervals" actually
  // containing the outcome ~80% of the time? This is the real test of
  // whether the uncertainty bounds are honest.
  intervalCoverageRate() {
    const resolved = [...this.predictionLog.values()].filter(r => r.resolved);
    if (resolved.length === 0) return null;
    const hit = resolved.filter(r => r.withinInterval).length;
    return hit / resolved.length;
  }
}

// ----------------------------------------------------------------
// 3. ADAPTIVE STRATEGY WEIGHTING
// ----------------------------------------------------------------

function computeAdaptiveWeight(strategyId, regime, calStore) {
  const base = BASE_WEIGHTS[strategyId] ?? (1 / STRATEGY_IDS.length);
  const regimeFit = (REGIME_FIT[regime] && REGIME_FIT[regime][strategyId]) ?? 1.0;
  const hitRate = calStore.strategyHitRate(strategyId); // 0..1, prior-blended
  // Convert hit-rate into a multiplier centered at 1.0 for 50% hit rate.
  // A strategy running at 65% hit rate gets ~1.3x weight; 35% gets ~0.7x.
  const perfMultiplier = 1 + 2 * (hitRate - 0.5);
  const raw = base * regimeFit * Math.max(0.15, perfMultiplier);
  return raw;
}

function normalizeWeights(weightMap) {
  const total = Object.values(weightMap).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const k in weightMap) out[k] = weightMap[k] / total;
  return out;
}

// ----------------------------------------------------------------
// 4. NEWS SENTIMENT (unchanged logic, isolated for clarity)
// ----------------------------------------------------------------

const BULLISH_TOKENS = ['surge','rally','breakout','record high','profit','expansion','upgrade','gain'];
const BEARISH_TOKENS = ['crash','plunge','slump','tariff','decline','inflation','loss','rout','recession'];

function scoreHeadlines(headlines) {
  if (!headlines || headlines.length === 0) {
    return { score: 0, status: 'LIVE_NEWS_DATA_UNAVAILABLE', nBull: 0, nBear: 0 };
  }
  let nBull = 0, nBear = 0;
  for (const h of headlines) {
    const text = (h.title || '').toLowerCase();
    if (BULLISH_TOKENS.some(t => text.includes(t))) nBull++;
    if (BEARISH_TOKENS.some(t => text.includes(t))) nBear++;
  }
  const denom = nBull + nBear;
  const score = denom === 0 ? 0 : (nBull - nBear) / denom;
  return { score, status: 'OK', nBull, nBear };
}

// ----------------------------------------------------------------
// 5. CORE FUSION FUNCTION
// ----------------------------------------------------------------

/**
 * @param {Array} strategySignals - [{ id, signal: 'BUY'|'SELL'|'HOLD', confidence: 0..1, entry, sl, tp1, tp2 }]
 * @param {string} regime - one of the REGIME_FIT keys
 * @param {Array} headlines - [{title, source, timestamp}]
 * @param {number} currentPrice
 * @param {Array<number>} recentReturns - last 20 period returns, for vol/drift
 * @param {CalibrationStore} calStore
 * @param {Object} dataQuality - { isStale, hasGaps, spreadTooWide }
 */
function fuseSignal({ strategySignals, regime, headlines, currentPrice, recentReturns, calStore, dataQuality }) {

  // --- Data quality gate first: never produce a signal on bad data ---
  if (dataQuality && (dataQuality.isStale || dataQuality.hasGaps)) {
    return {
      signal: 'NO_TRADE',
      reason: 'DATA_QUALITY_FAILURE',
      confidence: null
    };
  }

  // --- Calibrate each strategy's stated confidence against its track record ---
  const calibratedSignals = strategySignals.map(s => {
    const vote = s.signal === 'BUY' ? 1 : s.signal === 'SELL' ? -1 : 0;
    const calibratedConfidence = calStore.calibrateConfidence(s.id, s.confidence);
    return { ...s, vote, calibratedConfidence };
  });

  // --- Adaptive, regime-aware, performance-weighted ensemble ---
  const rawWeights = {};
  for (const s of calibratedSignals) {
    rawWeights[s.id] = computeAdaptiveWeight(s.id, regime, calStore);
  }
  const weights = normalizeWeights(rawWeights);

  let weightedVoteSum = 0;
  let weightSum = 0;
  for (const s of calibratedSignals) {
    const w = weights[s.id] * s.calibratedConfidence;
    weightedVoteSum += w * s.vote;
    weightSum += w;
  }
  const technicalScore = weightSum === 0 ? 0 : weightedVoteSum / weightSum; // -1..+1

  // --- News fusion ---
  const news = scoreHeadlines(headlines);
  const normalizedScore = news.status === 'OK'
    ? (TECH_WEIGHT * technicalScore) + (NEWS_WEIGHT * news.score)
    : technicalScore; // if no live news, don't silently invent a neutral 20% weight on nothing

  // --- Confluence / divergence adjustment ---
  let confidenceAdjustment = 0;
  let confluenceNote = 'NO_NEWS_DATA';
  if (news.status === 'OK') {
    const sameSign = Math.sign(technicalScore) !== 0 && Math.sign(technicalScore) === Math.sign(news.score);
    if (sameSign) { confidenceAdjustment = 0.10; confluenceNote = 'CONFLUENCE_CONFIRMED'; }
    else if (Math.sign(news.score) !== 0) { confidenceAdjustment = -0.12; confluenceNote = 'DIVERGENCE_WARNING'; }
    else { confluenceNote = 'NEWS_NEUTRAL'; }
  }

  // --- Base confidence derived from |normalizedScore| and cross-strategy agreement ---
  const agreement = calibratedSignals.length
    ? calibratedSignals.filter(s => Math.sign(s.vote) === Math.sign(normalizedScore) && s.vote !== 0).length / calibratedSignals.length
    : 0;
  let confidence = Math.abs(normalizedScore) * 0.6 + agreement * 0.4;
  confidence = Math.max(0, Math.min(MAX_SIGNAL_CONFIDENCE, confidence + confidenceAdjustment));

  // --- Volatility stats for interval width (honest uncertainty, not a fixed % everywhere) ---
  const n = recentReturns && recentReturns.length ? recentReturns.length : 0;
  const meanReturn = n ? recentReturns.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n ? recentReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) / n : 0;
  const sigma = Math.sqrt(variance);

  // Directional bias scaled by volatility and score, same spirit as your
  // original formula, but the OUTPUT is an interval, not a false-precision point.
  const directionalBias = normalizedScore * sigma * 2.2;
  const medianReturn = meanReturn + directionalBias;
  const predictedClose = currentPrice * (1 + medianReturn);

  // Interval width widens with volatility AND with model uncertainty
  // (low confidence -> wider interval, not a tighter fake one).
  const uncertaintyMultiplier = 1.5 + (1 - confidence); // 1.5 to 2.5
  const predictedHigh = currentPrice * (1 + Math.abs(meanReturn) + uncertaintyMultiplier * sigma + Math.max(0, news.score * 0.005));
  const predictedLow  = currentPrice * (1 - Math.abs(meanReturn) - uncertaintyMultiplier * sigma - Math.max(0, -news.score * 0.005));

  // --- Signal quality gate ---
  let finalSignal;
  if (confidence < NO_TRADE_CONFIDENCE_FLOOR) {
    finalSignal = 'NO_TRADE';
  } else if (normalizedScore > 0.5) finalSignal = 'STRONG_BUY';
  else if (normalizedScore > 0.15) finalSignal = 'BUY';
  else if (normalizedScore > 0.02) finalSignal = 'WEAK_BUY';
  else if (normalizedScore < -0.5) finalSignal = 'STRONG_SELL';
  else if (normalizedScore < -0.15) finalSignal = 'SELL';
  else if (normalizedScore < -0.02) finalSignal = 'WEAK_SELL';
  else finalSignal = 'NEUTRAL';

  const predictionId = `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    predictionId,
    timestamp: Date.now(),
    priceAtPrediction: currentPrice,
    predictedClose, predictedHigh, predictedLow,
    normalizedScore, confidence, finalSignal,
    strategySignals: calibratedSignals.map(s => ({ id: s.id, vote: s.vote, confidence: s.calibratedConfidence })),
    resolved: false
  };
  calStore.logPrediction(predictionId, record);

  return {
    predictionId,
    signal: finalSignal,
    confidence: Number(confidence.toFixed(4)),
    normalizedScore: Number(normalizedScore.toFixed(4)),
    technicalScore: Number(technicalScore.toFixed(4)),
    newsScore: news.score,
    newsStatus: news.status,
    confluence: confluenceNote,
    forecast: {
      predictedClose: Number(predictedClose.toFixed(4)),
      predictedHigh: Number(predictedHigh.toFixed(4)),
      predictedLow: Number(predictedLow.toFixed(4)),
      note: 'This is a probabilistic range, not a guaranteed price. Track record: see calStore.intervalCoverageRate().'
    },
    strategyWeights: weights,
    disclaimer: 'Probability, not certainty. No signal here implies guaranteed profit or 100% accuracy.'
  };
}

module.exports = {
  CalibrationStore,
  fuseSignal,
  computeAdaptiveWeight,
  scoreHeadlines,
  STRATEGY_IDS,
  BASE_WEIGHTS,
  REGIME_FIT
};
