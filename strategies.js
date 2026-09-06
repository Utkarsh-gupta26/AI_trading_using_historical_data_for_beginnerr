// ==========================================================================
// strategies.js — 10 Professional Trading Strategies
// ==========================================================================

var Strategies = (() => {

  // Helper: get last valid value from indicator array
  function last(arr, offset = 0) {
    for (let i = arr.length - 1 - offset; i >= 0; i--) {
      if (arr[i] !== null && !isNaN(arr[i])) return arr[i];
    }
    return null;
  }

  function prev(arr, offset = 1) { return last(arr, offset); }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 1: Momentum / Breakout Trading
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function momentumBreakout(data, ind) {
    const name = "Momentum Breakout";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    // Trend filter: price above rising 50-day MA
    const sma50 = last(ind.sma50);
    const sma50slope = last(ind.sma50Slope);
    const sma200 = last(ind.sma200);

    if (sma50 && price > sma50) { score += 15; reasons.push("Price above 50-MA ✓"); }
    else if (sma50) { score -= 15; reasons.push("Price below 50-MA ✗"); }

    if (sma50slope && sma50slope > 0) { score += 10; reasons.push("50-MA rising ✓"); }
    else { score -= 5; reasons.push("50-MA flat/falling"); }

    if (sma200 && price > sma200) { score += 10; reasons.push("Price above 200-MA ✓"); }

    // Higher highs/lows
    const ts = ind.trendStructure;
    if (ts.higherHighs && ts.higherLows) { score += 15; reasons.push("Higher highs & higher lows ✓"); }
    else if (ts.higherHighs || ts.higherLows) { score += 5; reasons.push("Partial uptrend structure"); }

    // Breakout: price near/above resistance with high volume
    const sr = ind.supportResistance;
    const currentRVOL = last(ind.rvol);
    if (sr.resistance.length > 0) {
      const nearestRes = Math.min(...sr.resistance.filter(r => r > price * 0.98));
      if (price > nearestRes * 0.995) {
        score += 15; reasons.push(`Breaking above resistance at ${nearestRes.toFixed(0)} ✓`);
      }
    }

    if (currentRVOL && currentRVOL > 1.4) { score += 10; reasons.push(`Above-average volume (RVOL: ${currentRVOL.toFixed(1)}x) ✓`); }

    // RSI momentum
    const rsiVal = last(ind.rsi14);
    if (rsiVal > 55 && rsiVal < 75) { score += 10; reasons.push(`Healthy momentum (RSI: ${rsiVal.toFixed(0)}) ✓`); }
    else if (rsiVal > 75) { score -= 5; reasons.push(`Overbought warning (RSI: ${rsiVal.toFixed(0)})`); }

    // MACD positive
    const macdHist = last(ind.macd.histogram);
    if (macdHist && macdHist > 0) { score += 10; reasons.push("MACD histogram positive ✓"); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 20 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 2 * atrVal : price * 0.97,
      takeProfit1: atrVal ? price + 2 * atrVal : price * 1.03,
      takeProfit2: atrVal ? price + 3.5 * atrVal : price * 1.05,
      takeProfit3: atrVal ? price + 5 * atrVal : price * 1.08,
      exitCondition: "Trail stop under prior day low / rising 20-day MA. Exit if no move in 5 days."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 2: Swing Pullback to Moving Averages
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function swingPullback(data, ind) {
    const name = "Swing Pullback";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    const sma50 = last(ind.sma50);
    const ema20 = last(ind.ema20);
    const adxVal = last(ind.adx.adx);

    // Trend condition: price above 50-MA, ADX > 20
    if (sma50 && price > sma50) { score += 15; reasons.push("In uptrend (above 50-MA) ✓"); }
    else if (sma50) { score -= 10; reasons.push("Below 50-MA — not ideal for pullback buy"); }

    if (adxVal && adxVal > 20) { score += 10; reasons.push(`Trending market (ADX: ${adxVal.toFixed(0)}) ✓`); }
    else { score -= 5; reasons.push("Weak trend (ADX low)"); }

    // Pullback: price near 20-EMA or 50-MA
    if (ema20 && sma50) {
      const distTo20 = Math.abs(price - ema20) / ema20 * 100;
      const distTo50 = Math.abs(price - sma50) / sma50 * 100;
      if (distTo20 < 1.0 && price >= ema20 * 0.99) {
        score += 20; reasons.push(`Pullback touching 20-EMA (${distTo20.toFixed(1)}% away) ✓`);
      } else if (distTo50 < 1.5 && price >= sma50 * 0.99) {
        score += 15; reasons.push(`Pullback touching 50-MA (${distTo50.toFixed(1)}% away) ✓`);
      } else if (price < ema20 * 0.97) {
        score -= 10; reasons.push("Price too far below 20-EMA");
      }
    }

    // Reversal candle
    const patterns = ind.candlePatterns;
    const bullishPattern = patterns.find(p => p.type === 'bullish');
    if (bullishPattern) { score += 15; reasons.push(`Bullish candle: ${bullishPattern.name} ✓`); }

    // Volume picking up
    const rvolVal = last(ind.rvol);
    if (rvolVal && rvolVal > 1.1) { score += 5; reasons.push("Volume confirming ✓"); }

    // RSI not oversold (buying strength)
    const rsiVal = last(ind.rsi14);
    if (rsiVal && rsiVal > 35 && rsiVal < 55) { score += 10; reasons.push(`RSI in pullback zone (${rsiVal.toFixed(0)}) ✓`); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 20 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    const swingLow = data.slice(-5).reduce((min, d) => Math.min(min, d.low), Infinity);

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: Math.min(swingLow, ema20 ? ema20 * 0.99 : price * 0.97),
      takeProfit1: price + (price - swingLow) * 2,
      takeProfit2: price + (price - swingLow) * 3,
      takeProfit3: price + (price - swingLow) * 4,
      exitCondition: "Exit at prior high or measured move (2:1 R). Hold 3-7 days."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 3: Range Mean-Reversion
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function meanReversion(data, ind) {
    const name = "Mean Reversion";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    const adxVal = last(ind.adx.adx);
    const rsiVal = last(ind.rsi14);
    const bbPctB = last(ind.bollinger.pctB);
    const stochK = last(ind.stoch.k);

    // Range condition: ADX < 20
    if (adxVal && adxVal < 20) { score += 15; reasons.push(`Range-bound market (ADX: ${adxVal.toFixed(0)}) ✓`); }
    else if (adxVal && adxVal < 25) { score += 5; reasons.push(`Weakly trending (ADX: ${adxVal.toFixed(0)})`); }
    else { score -= 10; reasons.push("Strong trend — mean reversion risky"); }

    // Near support with oversold
    const sr = ind.supportResistance;
    if (sr.support.length > 0) {
      const nearestSup = Math.max(...sr.support.filter(s => s < price * 1.02));
      if (nearestSup && price < nearestSup * 1.015) {
        score += 15; reasons.push(`Near support at ${nearestSup.toFixed(0)} ✓`);
      }
    }

    // RSI oversold = buy, overbought = sell
    if (rsiVal) {
      if (rsiVal < 30) { score += 20; reasons.push(`RSI oversold (${rsiVal.toFixed(0)}) — buy signal ✓`); }
      else if (rsiVal < 40) { score += 10; reasons.push(`RSI approaching oversold (${rsiVal.toFixed(0)}) ✓`); }
      else if (rsiVal > 70) { score -= 20; reasons.push(`RSI overbought (${rsiVal.toFixed(0)}) — sell signal`); }
      else if (rsiVal > 60) { score -= 5; reasons.push(`RSI approaching overbought (${rsiVal.toFixed(0)})`); }
    }

    // Bollinger %B
    if (bbPctB !== null) {
      if (bbPctB < 0.1) { score += 15; reasons.push(`Below lower Bollinger Band (%B: ${(bbPctB*100).toFixed(0)}%) ✓`); }
      else if (bbPctB < 0.2) { score += 8; reasons.push(`Near lower band (%B: ${(bbPctB*100).toFixed(0)}%)`); }
      else if (bbPctB > 0.9) { score -= 15; reasons.push(`Above upper Bollinger Band`); }
    }

    // Stochastic confirmation
    if (stochK !== null && stochK < 20) { score += 10; reasons.push(`Stochastic oversold (${stochK.toFixed(0)}) ✓`); }
    else if (stochK !== null && stochK > 80) { score -= 10; reasons.push(`Stochastic overbought (${stochK.toFixed(0)})`); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';
    const bbMid = last(ind.bollinger.mid);

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 1.5 * atrVal : price * 0.975,
      takeProfit1: bbMid || price * 1.015,
      takeProfit2: atrVal ? price + 2 * atrVal : price * 1.025,
      takeProfit3: atrVal ? price + 3 * atrVal : price * 1.04,
      exitCondition: "Target opposite side of range. Avoid during major news/earnings."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 4: CAN SLIM (Adapted for Indices)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function canSlim(data, ind) {
    const name = "CAN SLIM";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    // N - New high (52-week high check)
    const high52w = Math.max(...data.slice(-Math.min(data.length, 252)).map(d => d.high));
    const distFromHigh = ((high52w - price) / high52w) * 100;
    if (distFromHigh < 5) { score += 20; reasons.push(`Near 52-week high (${distFromHigh.toFixed(1)}% away) ✓`); }
    else if (distFromHigh < 10) { score += 10; reasons.push(`Within 10% of 52-week high ✓`); }
    else { score -= 5; reasons.push(`${distFromHigh.toFixed(0)}% below 52-week high`); }

    // S - Supply & demand (volume surge)
    const rvolVal = last(ind.rvol);
    if (rvolVal && rvolVal > 1.5) { score += 15; reasons.push(`Volume surge (${rvolVal.toFixed(1)}x avg) ✓`); }
    else if (rvolVal && rvolVal > 1.2) { score += 5; reasons.push(`Decent volume (${rvolVal.toFixed(1)}x avg)`); }

    // L - Leader (Relative Strength)
    const roc3m = last(ind.roc12); // ~3 months
    if (roc3m && roc3m > 5) { score += 15; reasons.push(`Strong 3-month return (+${roc3m.toFixed(1)}%) ✓`); }
    else if (roc3m && roc3m > 0) { score += 5; reasons.push(`Positive 3-month return`); }
    else { score -= 10; reasons.push("Weak relative performance"); }

    // M - Market direction (above rising 50-MA)
    const sma50 = last(ind.sma50);
    const sma50slope = last(ind.sma50Slope);
    if (sma50 && price > sma50 && sma50slope > 0) {
      score += 15; reasons.push("Market in confirmed uptrend ✓");
    } else { score -= 10; reasons.push("Market trend not confirmed"); }

    // Breakout from base
    const recentHigh = Math.max(...data.slice(-20).map(d => d.high));
    const recentLow = Math.min(...data.slice(-20).map(d => d.low));
    const baseHeight = ((recentHigh - recentLow) / recentLow) * 100;
    if (baseHeight < 15 && price > recentHigh * 0.98) {
      score += 10; reasons.push(`Breaking from tight base (${baseHeight.toFixed(1)}% range) ✓`);
    }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 25 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: price * 0.925, // Hard 7.5% stop (O'Neil rule)
      takeProfit1: price * 1.10,
      takeProfit2: price * 1.20,
      takeProfit3: price * 1.25,
      exitCondition: "Hard stop at 7-8% below buy. Target 20-25% gain. 8-week hold rule if +20% in 3 weeks."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 5: Sector Rotation / Relative Strength
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function sectorRotation(data, ind, allData) {
    const name = "Sector Rotation";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    // Calculate RS for each index vs NIFTY 50
    const rsRankings = [];
    if (allData) {
      for (const key in allData) {
        const d = allData[key]?.data;
        if (!d || !Array.isArray(d) || d.length < 60) continue;
        const current = d[d.length - 1].close;
        const prev20 = d[d.length - 21]?.close || current;
        const prev60 = d[d.length - 61]?.close || current;
        const ret20 = ((current - prev20) / prev20) * 100;
        const ret60 = ((current - prev60) / prev60) * 100;
        const rsScore = ret20 * 0.6 + ret60 * 0.4;
        rsRankings.push({ key, name: allData[key]?.name || key, rsScore, ret20, ret60 });
      }
    }
    rsRankings.sort((a, b) => b.rsScore - a.rsScore);

    // Check if current symbol is a leader
    const currentSymbolKey = allData ? Object.keys(allData).find(k => allData[k]?.data === data) : null;
    const rank = rsRankings.findIndex(r => r.key === currentSymbolKey);

    if (rank === 0) { score += 25; reasons.push(`#1 Relative Strength — strongest sector ✓`); }
    else if (rank === 1) { score += 15; reasons.push(`#2 Relative Strength — strong sector ✓`); }
    else if (rank >= rsRankings.length - 1) { score -= 15; reasons.push(`Weakest sector — avoid`); }

    // Show sector rankings
    rsRankings.forEach((r, i) => {
      reasons.push(`  ${i + 1}. ${r.name}: RS ${r.rsScore.toFixed(1)} (20d: ${r.ret20 > 0 ? '+' : ''}${r.ret20.toFixed(1)}%)`);
    });

    // Trend alignment
    const sma50 = last(ind.sma50);
    if (sma50 && price > sma50) { score += 10; reasons.push("Price above 50-MA ✓"); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 20 ? 'BUY' : score < -10 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 2 * atrVal : price * 0.97,
      takeProfit1: atrVal ? price + 2 * atrVal : price * 1.03,
      takeProfit2: atrVal ? price + 4 * atrVal : price * 1.06,
      takeProfit3: atrVal ? price + 6 * atrVal : price * 1.10,
      exitCondition: "Rotate when sector RS rolls over and price breaks key MAs."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 6: Opening Range Breakout (Simulated)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function openingRangeBreakout(data, ind) {
    const name = "Opening Range Breakout";
    const icon = "";
    const lastCandle = data[data.length - 1];
    const price = lastCandle.close;
    const reasons = [];
    let score = 0;

    // Define "opening range" as the first day's range in last 5 days
    const recent = data.slice(-5);
    const orHigh = recent[0].high;
    const orLow = recent[0].low;

    if (price > orHigh) {
      score += 20; reasons.push(`Price broke above opening range high (${orHigh.toFixed(0)}) ✓`);
    } else if (price < orLow) {
      score -= 20; reasons.push(`Price broke below opening range low (${orLow.toFixed(0)})`);
    } else {
      reasons.push(`Price inside opening range (${orLow.toFixed(0)} – ${orHigh.toFixed(0)})`);
    }

    // VWAP confirmation
    const vwapVal = last(ind.vwap);
    if (vwapVal && price > vwapVal) { score += 10; reasons.push("Above VWAP ✓"); }
    else if (vwapVal) { score -= 10; reasons.push("Below VWAP"); }

    // Volume confirmation
    const rvolVal = last(ind.rvol);
    if (rvolVal && rvolVal > 1.5) { score += 15; reasons.push(`Strong relative volume (${rvolVal.toFixed(1)}x) ✓`); }

    // Gap analysis
    if (data.length >= 2) {
      const prevClose = data[data.length - 2].close;
      const gap = ((lastCandle.open - prevClose) / prevClose) * 100;
      if (gap > 0.5) { score += 10; reasons.push(`Gap up +${gap.toFixed(2)}% ✓`); }
      else if (gap < -0.5) { score -= 10; reasons.push(`Gap down ${gap.toFixed(2)}%`); }
    }

    // Momentum
    const rsiVal = last(ind.rsi14);
    if (rsiVal && rsiVal > 50 && rsiVal < 70) { score += 5; reasons.push("Momentum supporting ✓"); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: Math.min(orLow, atrVal ? price - 1.5 * atrVal : price * 0.985),
      takeProfit1: price + (price - orLow) * 1.5,
      takeProfit2: price + (price - orLow) * 2.5,
      takeProfit3: price + (price - orLow) * 3.5,
      exitCondition: "Exit if no follow-through in 30-60 min. Scale out at 1:2 R."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 7: Livermore Trend Following
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function livermoreTrend(data, ind) {
    const name = "Livermore Trend";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    // "Line of least resistance" — clear trend direction
    const ts = ind.trendStructure;
    if (ts.higherHighs && ts.higherLows) {
      score += 25; reasons.push("Clear uptrend: higher highs & higher lows ✓");
    } else if (ts.lowerHighs && ts.lowerLows) {
      score -= 25; reasons.push("Clear downtrend: lower highs & lower lows");
    } else {
      reasons.push("No clear trend direction — wait for clarity");
    }

    // Trend strength via ADX
    const adxVal = last(ind.adx.adx);
    if (adxVal && adxVal > 30) { score += 15; reasons.push(`Strong trend (ADX: ${adxVal.toFixed(0)}) ✓`); }
    else if (adxVal && adxVal > 20) { score += 5; reasons.push(`Moderate trend (ADX: ${adxVal.toFixed(0)})`); }

    // DI+ vs DI-
    const diPlus = last(ind.adx.diPlus);
    const diMinus = last(ind.adx.diMinus);
    if (diPlus && diMinus) {
      if (diPlus > diMinus) { score += 10; reasons.push(`DI+ > DI- (bullish pressure) ✓`); }
      else { score -= 10; reasons.push(`DI- > DI+ (bearish pressure)`); }
    }

    // Pyramid: recent move in favor (adding to winners)
    const ret5d = data.length > 5 ? ((price - data[data.length - 6].close) / data[data.length - 6].close) * 100 : 0;
    if (ret5d > 2) { score += 10; reasons.push(`5-day gain +${ret5d.toFixed(1)}% — pyramid opportunity ✓`); }

    // OBV confirming
    const obvArr = ind.obv;
    const obvCurrent = obvArr[obvArr.length - 1];
    const obv5ago = obvArr[obvArr.length - 6] || obvCurrent;
    if (obvCurrent > obv5ago) { score += 5; reasons.push("OBV rising — volume confirms ✓"); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 20 ? 'BUY' : score < -20 ? 'SELL' : 'HOLD';

    const lastSwingLow = ts.swingLows && ts.swingLows.length > 0 ?
      ts.swingLows[ts.swingLows.length - 1] : (atrVal ? price - 2 * atrVal : price * 0.97);

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: lastSwingLow,
      takeProfit1: atrVal ? price + 3 * atrVal : price * 1.04,
      takeProfit2: atrVal ? price + 5 * atrVal : price * 1.08,
      takeProfit3: atrVal ? price + 8 * atrVal : price * 1.12,
      exitCondition: "Never average down. Pyramid into winners. Trail under swing lows."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 8: MACD Divergence
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function macdDivergenceStrategy(data, ind) {
    const name = "MACD Divergence";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    const div = ind.macdDivergence;
    const macdHist = last(ind.macd.histogram);
    const macdLine = last(ind.macd.macdLine);
    const signalLine = last(ind.macd.signalLine);

    if (div.bullish) { score += 25; reasons.push("Bullish MACD divergence detected ✓"); }
    if (div.bearish) { score -= 25; reasons.push("Bearish MACD divergence detected"); }
    if (!div.bullish && !div.bearish) { reasons.push("No MACD divergence currently"); }

    // MACD crossover
    const prevMacdLine = prev(ind.macd.macdLine);
    const prevSignal = prev(ind.macd.signalLine);
    if (macdLine !== null && signalLine !== null && prevMacdLine !== null && prevSignal !== null) {
      if (prevMacdLine < prevSignal && macdLine > signalLine) {
        score += 20; reasons.push("MACD bullish crossover ✓");
      } else if (prevMacdLine > prevSignal && macdLine < signalLine) {
        score -= 20; reasons.push("MACD bearish crossover");
      }
    }

    // MACD histogram direction
    const prevHist = prev(ind.macd.histogram);
    if (macdHist !== null && prevHist !== null) {
      if (macdHist > prevHist && macdHist > 0) { score += 10; reasons.push("MACD momentum building ✓"); }
      else if (macdHist < prevHist && macdHist < 0) { score -= 10; reasons.push("MACD momentum fading"); }
    }

    // RSI confirmation
    const rsiVal = last(ind.rsi14);
    if (rsiVal && div.bullish && rsiVal < 40) { score += 10; reasons.push("RSI confirms oversold reversal ✓"); }
    if (rsiVal && div.bearish && rsiVal > 60) { score -= 10; reasons.push("RSI confirms overbought reversal"); }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 2 * atrVal : price * 0.975,
      takeProfit1: atrVal ? price + 2 * atrVal : price * 1.03,
      takeProfit2: atrVal ? price + 3 * atrVal : price * 1.05,
      takeProfit3: atrVal ? price + 5 * atrVal : price * 1.08,
      exitCondition: "Exit when divergence plays out or MACD crosses back."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 9: Bollinger Squeeze
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function bollingerSqueezeStrategy(data, ind) {
    const name = "Bollinger Squeeze";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    const squeeze = ind.bollingerSqueeze;
    const bbPctB = last(ind.bollinger.pctB);

    if (squeeze.isSqueeze) {
      score += 15; reasons.push(`Bollinger Squeeze active (strength: ${squeeze.squeezeStrength.toFixed(0)}%) ✓`);
      // Direction from prior trend
      const sma20 = last(ind.sma20);
      const sma50 = last(ind.sma50);
      if (sma20 && sma50 && sma20 > sma50) {
        score += 15; reasons.push("Prior trend bullish — expect upside breakout ✓");
      } else if (sma20 && sma50 && sma20 < sma50) {
        score -= 15; reasons.push("Prior trend bearish — expect downside breakout");
      }
    } else {
      reasons.push("No squeeze — bands are expanded");
      // Check if just broke out of squeeze
      if (squeeze.currentBW && squeeze.avgBW && squeeze.currentBW > squeeze.avgBW * 1.2) {
        if (bbPctB !== null && bbPctB > 0.8) {
          score += 15; reasons.push("Breakout from squeeze to upside ✓");
        } else if (bbPctB !== null && bbPctB < 0.2) {
          score -= 15; reasons.push("Breakout from squeeze to downside");
        }
      }
    }

    // Volume confirmation
    const rvolVal = last(ind.rvol);
    if (rvolVal && rvolVal > 1.3) { score += 10; reasons.push(`Volume expanding (${rvolVal.toFixed(1)}x) ✓`); }

    // Keltner inside Bollinger = TTM squeeze confirmation
    const keltUpper = last(ind.keltner.upper);
    const keltLower = last(ind.keltner.lower);
    const bbUpper = last(ind.bollinger.upper);
    const bbLower = last(ind.bollinger.lower);
    if (keltUpper && bbUpper && bbUpper < keltUpper && bbLower > keltLower) {
      score += 10; reasons.push("TTM Squeeze confirmed (BB inside Keltner) ✓");
    }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 15 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 2 * atrVal : price * 0.975,
      takeProfit1: atrVal ? price + 2 * atrVal : price * 1.03,
      takeProfit2: atrVal ? price + 3.5 * atrVal : price * 1.055,
      takeProfit3: atrVal ? price + 5 * atrVal : price * 1.08,
      exitCondition: "Trade the expansion. Exit when bands start contracting again."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRATEGY 10: Multi-Timeframe Confluence
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function multiTimeframe(data, ind) {
    const name = "Multi-Timeframe";
    const icon = "";
    const price = data[data.length - 1].close;
    const reasons = [];
    let score = 0;

    // "Weekly" = 5-day aggregation
    const weeklyBullish = data.length >= 5 && data[data.length - 1].close > data[data.length - 5].close;
    // "Monthly" = 20-day aggregation
    const monthlyBullish = data.length >= 20 && data[data.length - 1].close > data[data.length - 20].close;

    // Daily trend
    const sma20 = last(ind.sma20);
    const sma50 = last(ind.sma50);
    const dailyBullish = sma20 && sma50 && price > sma20 && sma20 > sma50;
    const dailyBearish = sma20 && sma50 && price < sma20 && sma20 < sma50;

    if (dailyBullish) { score += 15; reasons.push("Daily: Bullish (price > 20-EMA > 50-MA) ✓"); }
    else if (dailyBearish) { score -= 15; reasons.push("Daily: Bearish ✗"); }
    else { reasons.push("Daily: Mixed signals"); }

    if (weeklyBullish) { score += 15; reasons.push("Weekly: Bullish (5-day gain) ✓"); }
    else { score -= 10; reasons.push("Weekly: Bearish (5-day loss)"); }

    if (monthlyBullish) { score += 15; reasons.push("Monthly: Bullish (20-day gain) ✓"); }
    else { score -= 10; reasons.push("Monthly: Bearish (20-day loss)"); }

    // Confluence bonus
    const bullCount = [dailyBullish, weeklyBullish, monthlyBullish].filter(Boolean).length;
    if (bullCount === 3) { score += 20; reasons.push("All timeframes aligned BULLISH — high confidence!"); }
    else if (bullCount === 0) { score -= 20; reasons.push("All timeframes aligned BEARISH"); }
    else { reasons.push(`${bullCount}/3 timeframes bullish`); }

    // RSI alignment
    const rsiVal = last(ind.rsi14);
    if (rsiVal && rsiVal > 50 && rsiVal < 70 && bullCount >= 2) {
      score += 10; reasons.push(`RSI confirming (${rsiVal.toFixed(0)}) ✓`);
    }

    const atrVal = last(ind.atr14);
    const confidence = Math.min(100, Math.max(0, 50 + score));
    const signal = score > 20 ? 'BUY' : score < -20 ? 'SELL' : 'HOLD';

    return {
      name, icon, signal, confidence, score, reasons,
      entry: price,
      stopLoss: atrVal ? price - 2.5 * atrVal : price * 0.97,
      takeProfit1: atrVal ? price + 2.5 * atrVal : price * 1.035,
      takeProfit2: atrVal ? price + 4 * atrVal : price * 1.06,
      takeProfit3: atrVal ? price + 6 * atrVal : price * 1.10,
      exitCondition: "Only trade when multiple timeframes agree. Exit when alignment breaks."
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Run All Strategies
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function runAll(data, ind, allData) {
    const s01 = momentumBreakout(data, ind); s01.id = 'S01_MomentumBreakout';
    const s02 = swingPullback(data, ind); s02.id = 'S02_SwingPullback';
    const s03 = meanReversion(data, ind); s03.id = 'S03_MeanReversion';
    const s04 = macdDivergenceStrategy(data, ind); s04.id = 'S04_IntradayScalp';
    const s05 = canSlim(data, ind); s05.id = 'S05_CanSlimGrowth';
    const s06 = sectorRotation(data, ind, allData); s06.id = 'S06_ValueRecovery';
    const s07 = bollingerSqueezeStrategy(data, ind); s07.id = 'S07_LowVolDrift';
    const s08 = multiTimeframe(data, ind); s08.id = 'S08_RelativeStrength';
    const s09 = openingRangeBreakout(data, ind); s09.id = 'S09_OpeningRange';
    const s10 = livermoreTrend(data, ind); s10.id = 'S10_IndexTrend';
    return [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10];
  }

  return { runAll };
})();
if (typeof globalThis !== 'undefined') globalThis.Strategies = Strategies;
if (typeof window !== 'undefined') window.Strategies = Strategies;
