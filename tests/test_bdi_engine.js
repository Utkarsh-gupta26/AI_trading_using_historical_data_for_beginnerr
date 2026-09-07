/**
 * tests/test_bdi_engine.js
 * Automated Unit Tests for Baltic Dry Index Scoring & Filter Modules
 * Validates:
 * 1. BDI Indicators (Momentum, Moving Averages, Volatility)
 * 2. Signal Engine normalization (-100 to +100 bounds)
 * 3. False-Signal Filter (Disruption penalty damping)
 * 4. Pearson Correlation Engine
 * 5. Lead/Lag forward analysis & t-statistic
 * 6. Event-Study Backtesting
 * 7. Global Macro Score weighting & NIFTY Contradiction Gate
 */

const assert = require('assert');
const path = require('path');

const indicators = require('../market-signals/bdi/bdiIndicators');
const signalEngine = require('../market-signals/bdi/bdiSignalEngine');
const correlation = require('../market-signals/bdi/bdiCorrelation');
const leadLag = require('../market-signals/bdi/bdiLeadLag');
const backtest = require('../market-signals/bdi/bdiBacktest');
const explanation = require('../market-signals/bdi/bdiExplanation');
const bdiSystem = require('../market-signals/bdi/index');

console.log('--- RUNNING BDI ENGINE UNIT TESTS ---');

// TEST 1: Indicators Calculation
{
  const testPrices = [];
  let base = 2000;
  for (let i = 0; i < 60; i++) {
    base += (i % 2 === 0 ? 15 : -5);
    testPrices.push({ date: `2026-0${Math.floor(i/30)+1}-${(i%28)+1}`, close: base });
  }

  const ind = indicators.compute(testPrices);
  assert.strictEqual(ind.isValid, true, 'Indicators should be valid');
  assert.ok(ind.current > 0, 'Current price should be positive');
  assert.ok(typeof ind.change1D === 'number', '1D change must be numeric');
  assert.ok(typeof ind.change5D === 'number', '5D change must be numeric');
  assert.ok(typeof ind.change20D === 'number', '20D change must be numeric');
  assert.ok(ind.volatility > 0, 'Volatility must be calculated');
  console.log('✓ TEST 1 PASSED: BDI Indicators calculation verified.');
}

// TEST 2: Signal Engine Normalization Bounds (-100 to +100)
{
  const mockIndBull = {
    isValid: true,
    change1D: 8.5,
    change5D: 15.2,
    change20D: 35.0,
    trend50D: 'BULLISH',
    trend200D: 'BULLISH',
    volAdjustedMomentum: 2.8
  };
  const bullSig = signalEngine.calculateSignal(mockIndBull);
  assert.ok(bullSig.score <= 100 && bullSig.score >= -100, 'Score must be clamped within [-100, 100]');
  assert.ok(bullSig.score > 40, 'Strong bull indicators should yield score > 40');
  assert.strictEqual(bullSig.bias, 'STRONG_BULLISH');

  const mockIndBear = {
    isValid: true,
    change1D: -7.5,
    change5D: -18.0,
    change20D: -40.0,
    trend50D: 'BEARISH',
    trend200D: 'BEARISH',
    volAdjustedMomentum: -3.1
  };
  const bearSig = signalEngine.calculateSignal(mockIndBear);
  assert.ok(bearSig.score <= -40, 'Strong bear indicators should yield negative score');
  console.log('✓ TEST 2 PASSED: BDI Signal Engine bounds & normalization verified.');
}

// TEST 3: False-Signal Filter (Requirement 3: Supply Disruption vs Demand)
{
  const mockIndicators = {
    isValid: true,
    change1D: 5.0,
    change5D: 12.0,
    change20D: 25.0,
    trend50D: 'BULLISH',
    trend200D: 'BULLISH',
    volAdjustedMomentum: 2.0
  };

  // Case A: Demand-driven (strong commodity pull)
  const demandDrivers = {
    commodityDemand: 0.85,
    chineseIndustrial: 0.80,
    ironOreCoal: 0.90,
    grainDemand: 0.75,
    vesselSupplyDeficit: 0.20,
    portCongestion: 0.15,
    weatherDisruption: 0.10,
    geopoliticalRerouting: 0.10,
    capacityShortage: 0.15
  };
  const resDemand = signalEngine.calculateSignal(mockIndicators, demandDrivers);

  // Case B: Supply-driven (Panama/Suez port congestion & vessel shortage)
  const supplyDrivers = {
    commodityDemand: 0.20,
    chineseIndustrial: 0.15,
    ironOreCoal: 0.25,
    grainDemand: 0.20,
    vesselSupplyDeficit: 0.85,
    portCongestion: 0.95,
    weatherDisruption: 0.80,
    geopoliticalRerouting: 0.90,
    capacityShortage: 0.80
  };
  const resSupply = signalEngine.calculateSignal(mockIndicators, supplyDrivers);

  assert.ok(resDemand.score > resSupply.score, 'Demand-driven score must be higher than supply-disruption score');
  assert.ok(resSupply.driverAnalysis.discountApplied > 0, 'Supply-driven spike must apply discount');
  console.log(`✓ TEST 3 PASSED: False-Signal Filter successfully discounted supply shock from ${resDemand.score} down to ${resSupply.score} (Discount: ${resSupply.driverAnalysis.discountApplied}%).`);
}

// TEST 4: Pearson Correlation Calculation
{
  const seriesA = [10, 12, 14, 16, 18, 20, 22, 24];
  const seriesB = [5, 6, 7, 8, 9, 10, 11, 12];
  const rPerfect = correlation.pearsonCorrelation(seriesA, seriesB);
  assert.ok(Math.abs(rPerfect - 1.0) < 0.001, 'Identical linear relationship should yield r = 1.0');

  const seriesInverse = [24, 22, 20, 18, 16, 14, 12, 10];
  const rInverse = correlation.pearsonCorrelation(seriesA, seriesInverse);
  assert.ok(Math.abs(rInverse - (-1.0)) < 0.001, 'Opposite linear relationship should yield r = -1.0');
  console.log('✓ TEST 4 PASSED: Pearson Correlation calculations verified.');
}

// TEST 5: Lead/Lag Analysis & Statistical Significance
{
  const bdiRets = [1.2, -0.5, 2.3, 1.8, -1.2, 0.4, 3.1, -2.0, 1.5, 0.8, -0.4, 2.1, 1.1, -1.0, 0.5, 2.4, 1.3, -0.8, 0.9, 1.7, -1.5, 2.0, 0.7, -0.3, 1.4];
  const mktRets = [0.4, 1.0, -0.3, 2.0, 1.5, -1.0, 0.3, 2.8, -1.8, 1.2, 0.6, -0.3, 1.9, 0.9, -0.8, 0.4, 2.1, 1.0, -0.6, 0.8, 1.5, -1.2, 1.8, 0.5, -0.2];
  const llRes = leadLag.analyzeLeadLag(bdiRets, mktRets);
  assert.ok(llRes.horizons[1], 'Must evaluate 1-day horizon');
  assert.ok(llRes.horizons[5], 'Must evaluate 5-day horizon');
  assert.ok(llRes.horizons[20], 'Must evaluate 20-day horizon');
  console.log('✓ TEST 5 PASSED: Lead/Lag forward horizon calculations verified.');
}

// TEST 6: Event-Study Backtesting
{
  const alignedHistory = [];
  let b = 1500;
  let m = 22000;
  for (let i = 0; i < 100; i++) {
    // Inject a few >3% BDI surges
    const bChg = (i % 12 === 0) ? 4.5 : (i % 2 === 0 ? 0.8 : -0.6);
    b = b * (1 + bChg / 100);
    m = m * (1 + (bChg > 3 ? 0.9 : 0.1) / 100);
    alignedHistory.push({ date: `Day ${i}`, bdiClose: b, marketClose: m });
  }
  const btRes = backtest.runBacktest(alignedHistory, 'SURGE_3');
  assert.ok(btRes.sampleSize > 0, 'Backtest should detect trigger events');
  assert.ok(btRes.horizons['T+1D'], 'Must include T+1D metrics');
  assert.ok(btRes.horizons['T+5D'], 'Must include T+5D metrics');
  console.log(`✓ TEST 6 PASSED: Event backtest ran with ${btRes.sampleSize} sample events.`);
}

// TEST 7: Global Macro Score & NIFTY Contradiction Gate (Requirement 8)
{
  // Scenario: BDI is surging (+65), but US markets down, FII selling heavily, and crude spiking
  const contradictoryInputs = {
    crudeScore: -40,       // Crude oil spiking
    usdInrScore: -30,      // Rupee weakening
    usMarketScore: -45,    // Wall street falling
    asianMarketScore: -20, // Asian weakness
    bondYieldScore: -25,   // Yields rising
    vixScore: -35,         // VIX surging
    fiiScore: -50,         // Severe FII selling
    commodityScore: 10,
    economicDataScore: -10
  };

  const explicitBdiData = {
    current: 3200,
    prevClose: 3000,
    change1D: 6.6,
    change5D: 14.5,
    change20D: 28.0,
    trend50D: 'BULLISH',
    trend200D: 'BULLISH',
    volatility: 16.5,
    volAdjustedMomentum: 2.5,
    isAvailable: true
  };

  bdiSystem.computeGlobalMacroScore(contradictoryInputs, 'NIFTY 50', explicitBdiData).then(res => {
    assert.ok(res.isContradiction, 'Must flag contradiction between BDI and broader macro');
    assert.ok(res.globalMacroScore < 0, 'BDI must NOT override severe bearish macro headwind');
    assert.ok(res.contradictionNote.includes('overridden'), 'Must include explanation note');
    console.log(`✓ TEST 7 PASSED: NIFTY Contradiction Gate successfully prevented BDI (+${res.bdiScore}) from overriding macro headwinds (Global Macro Score: ${res.globalMacroScore}).`);
    console.log('--- ALL 7 UNIT TESTS PASSED SUCCESSFULLY ---');
  });
}
