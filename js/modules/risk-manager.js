/**
 * js/modules/risk-manager.js — AIOT Enterprise Risk Manager & Automated Position Size Calculator
 * Mathematical risk modeling, multi-currency support, auto-directional alignment & live asset sync
 */
'use strict';

class RiskManager {
  constructor() {
    this.accountBalance = 100000;
    this.currency = 'INR';
    this.currencySymbol = '₹';
    this.riskPercent = 1.0;
    this.dailyLossLimit = 5000;
    this.currentDailyLoss = 1200;
    this.weeklyLossLimit = 15000;
    this.currentWeeklyLoss = 3400;
    this.maxLeverage = 20;
    this.maxPositionSizePercent = 25;
    this.activeSymbol = 'NIFTY_50';

    this.calcInputs = {
      instrument: 'Indices',
      direction: 'LONG',
      entryPrice: 23897.70,
      stopLoss: 23550.00,
      targetPrice: 24590.00,
      leverage: 1,
      lotSize: 1,
      feesPercent: 0.05,
      slippageTicks: 1,
      tickSize: 0.05
    };

    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('aiot_risk_settings');
      if (saved) {
        const obj = JSON.parse(saved);
        Object.assign(this, obj);
      }
    } catch (e) {
      console.warn('Risk settings load error:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('aiot_risk_settings', JSON.stringify({
        accountBalance: this.accountBalance,
        currency: this.currency,
        riskPercent: this.riskPercent,
        dailyLossLimit: this.dailyLossLimit,
        weeklyLossLimit: this.weeklyLossLimit,
        maxLeverage: this.maxLeverage
      }));
    } catch (e) {}
  }

  setCurrency(curr) {
    this.currency = curr || 'USD';
    this.currencySymbol = this.currency === 'INR' ? '₹' : (this.currency === 'EUR' ? '€' : (this.currency === 'GBP' ? '£' : '$'));
  }

  /**
   * Automatically synchronize calculator with the currently active symbol and market price
   */
  syncWithSymbol(symbol, currentPrice, currency) {
    if (!symbol) return;
    this.activeSymbol = symbol;
    const price = Number(currentPrice) || 100;
    
    // Auto-detect currency
    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO') || ['NIFTY_50', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'BHARTIARTL', 'LT'].includes(symbol.toUpperCase());
    this.setCurrency(currency || (isIndian ? 'INR' : 'USD'));

    // Auto-detect instrument
    let instrument = 'Stocks';
    let lotSize = 1;
    const upper = symbol.toUpperCase();
    if (upper.includes('NIFTY') || upper.includes('SENSEX') || upper.includes('SPX') || upper.includes('NDX') || upper.includes('DJI') || upper.includes('DAX')) {
      instrument = 'Indices';
      if (upper.includes('NIFTY_50') || upper === 'NIFTY') lotSize = 25;
      else if (upper.includes('BANKNIFTY')) lotSize = 15;
    } else if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL') || upper.includes('USDT') || upper.includes('PERP')) {
      instrument = 'Crypto';
      lotSize = 1;
    } else if (upper.includes('XAU') || upper.includes('GOLD') || upper.includes('OIL') || upper.includes('SILVER')) {
      instrument = 'Commodities';
    }

    // Default intelligent 1:2 R:R setup: Stop at 1.5% risk, Target at 3.0% reward
    const stopDistance = price * 0.015;
    const targetDistance = price * 0.030;
    const entry = roundNum(price, 2);
    const stop = roundNum(price - stopDistance, 2);
    const target = roundNum(price + targetDistance, 2);

    this.calcInputs = {
      ...this.calcInputs,
      instrument,
      direction: 'LONG',
      entryPrice: entry,
      stopLoss: stop,
      targetPrice: target,
      lotSize: lotSize,
      leverage: instrument === 'Crypto' ? 5 : (instrument === 'Indices' ? 1 : 1)
    };

    return this.calcInputs;
  }

  /**
   * Automated Institutional Position Size Calculation
   * Supports auto-direction correction (if stop loss is above entry, auto-switches to SHORT)
   */
  calculatePosition(inputs = {}) {
    const p = { ...this.calcInputs, ...inputs };
    const balance = Math.max(100, Number(this.accountBalance) || 100000);
    const riskPct = Math.max(0.1, Math.min(100, Number(p.riskPercent !== undefined ? p.riskPercent : this.riskPercent) || 1.0));
    const riskAmount = balance * (riskPct / 100);

    let entry = Math.max(0.0001, Number(p.entryPrice) || 100);
    let stop = Math.max(0.0001, Number(p.stopLoss) || (entry * 0.98));
    let target = Math.max(0.0001, Number(p.targetPrice) || (entry * 1.04));
    let dir = (p.direction || 'LONG').toUpperCase();
    const lev = Math.max(1, Math.min(100, Number(p.leverage) || 1));
    const lotSize = Math.max(1, Number(p.lotSize) || 1);

    // Smart Auto-Direction Alignment:
    // If stop loss is above entry and direction was LONG, automatically correct to SHORT
    let autoCorrected = false;
    let correctionNote = '';
    if (stop > entry && dir === 'LONG') {
      dir = 'SHORT';
      autoCorrected = true;
      correctionNote = 'Auto-adjusted direction to SHORT based on stop loss > entry';
      if (target >= entry) {
        target = roundNum(entry - (Math.abs(stop - entry) * 2), 2);
      }
    } else if (stop < entry && dir === 'SHORT') {
      dir = 'LONG';
      autoCorrected = true;
      correctionNote = 'Auto-adjusted direction to LONG based on stop loss < entry';
      if (target <= entry) {
        target = roundNum(entry + (Math.abs(entry - stop) * 2), 2);
      }
    }

    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);

    // Prevent division by zero
    const effectiveStopDist = stopDistance > 0.00001 ? stopDistance : (entry * 0.01);

    // Raw unit quantity
    let maxQuantity = Math.floor(riskAmount / effectiveStopDist);
    if (maxQuantity < 1) maxQuantity = 1;

    // Apply lot size quantization if applicable
    let lots = 1;
    if (lotSize > 1) {
      lots = Math.max(1, Math.floor(maxQuantity / lotSize));
      maxQuantity = lots * lotSize;
    } else {
      lots = maxQuantity;
    }

    const totalPositionValue = maxQuantity * entry;
    const marginRequired = totalPositionValue / lev;
    const actualRiskAmount = maxQuantity * effectiveStopDist;
    const potentialProfit = maxQuantity * targetDistance;
    const rrRatio = effectiveStopDist > 0 ? (targetDistance / effectiveStopDist) : 2.0;
    const breakEvenWinRate = (1 / (1 + rrRatio)) * 100;

    // Fees & Slippage modeling
    const feesPct = Number(p.feesPercent) || 0.05;
    const estimatedFees = (totalPositionValue * (feesPct / 100)) * 2;
    const slippageTicks = Number(p.slippageTicks) || 1;
    const tickSize = Number(p.tickSize) || 0.05;
    const slippageCost = slippageTicks * tickSize * maxQuantity;
    const effectiveRisk = actualRiskAmount + estimatedFees + slippageCost;

    // Risk classification
    let riskLevel = 'LOW RISK';
    let riskBadgeClass = 'risk-low';
    const riskFraction = (effectiveRisk / balance) * 100;
    if (riskFraction > 3.0) {
      riskLevel = 'EXCESSIVE RISK';
      riskBadgeClass = 'risk-excessive';
    } else if (riskFraction > 2.0) {
      riskLevel = 'HIGH RISK';
      riskBadgeClass = 'risk-high';
    } else if (riskFraction > 1.2) {
      riskLevel = 'MODERATE RISK';
      riskBadgeClass = 'risk-moderate';
    }

    const sym = this.currencySymbol;

    return {
      valid: true,
      autoCorrected,
      correctionNote,
      currency: this.currency,
      currencySymbol: sym,
      accountBalance: balance,
      riskPercent: riskPct,
      riskAmount: riskAmount,
      entryPrice: entry,
      stopLoss: stop,
      targetPrice: target,
      direction: dir,
      instrument: p.instrument || 'Stocks',
      stopDistance: effectiveStopDist,
      targetDistance: targetDistance,
      riskPerShare: effectiveStopDist,
      maximumQuantity: maxQuantity,
      lotSize: lotSize,
      lots: lots,
      totalCapitalRequired: totalPositionValue,
      marginRequired: marginRequired,
      leverageUsed: lev,
      maximumLoss: effectiveRisk,
      rawLoss: actualRiskAmount,
      potentialProfit: potentialProfit,
      riskRewardRatio: rrRatio,
      rrFormatted: `1:${rrRatio.toFixed(2)}`,
      breakEvenWinRate: breakEvenWinRate,
      estimatedFees: estimatedFees,
      slippageCost: slippageCost,
      riskLevel: riskLevel,
      riskBadgeClass: riskBadgeClass,
      formula: `Position Size = Risk Amount (${sym}${Math.round(riskAmount).toLocaleString()} [${riskPct}%]) ÷ |${entry} - ${stop}| = ${maxQuantity.toLocaleString()} units`
    };
  }

  evaluateTradeLimits(newTradeRisk, newTradeMargin) {
    const warnings = [];
    const remainingDaily = this.dailyLossLimit - this.currentDailyLoss;

    if (newTradeRisk > remainingDaily) {
      warnings.push({
        level: 'EXCESSIVE RISK',
        message: `Trade risk (${this.formatCurrency(newTradeRisk)}) exceeds remaining daily allowance (${this.formatCurrency(remainingDaily)})`
      });
    }

    const remainingWeekly = this.weeklyLossLimit - this.currentWeeklyLoss;
    if (newTradeRisk > remainingWeekly) {
      warnings.push({
        level: 'HIGH RISK',
        message: `Trade risk exceeds weekly loss limit (${this.formatCurrency(remainingWeekly)})`
      });
    }

    if (newTradeMargin > (this.accountBalance * 0.85)) {
      warnings.push({
        level: 'HIGH RISK',
        message: 'Margin requirement exceeds 85% of total account balance'
      });
    }

    const status = warnings.length === 0 ? 'LOW RISK' :
                   warnings.some(w => w.level === 'EXCESSIVE RISK') ? 'EXCESSIVE RISK' : 'MODERATE RISK';

    return {
      status,
      remainingDailyLimit: Math.max(0, remainingDaily),
      remainingWeeklyLimit: Math.max(0, remainingWeekly),
      warnings
    };
  }

  formatCurrency(val) {
    const num = Number(val) || 0;
    return `${this.currencySymbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

function roundNum(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

window.riskManager = new RiskManager();
