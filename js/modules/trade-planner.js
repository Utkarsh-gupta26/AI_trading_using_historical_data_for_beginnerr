/**
 * Nova Trade Workstation - Pre-Trade Checklist, Locked Trade Plan & Post-Trade Review
 * Enforces systematic trading discipline, checklist gating, plan integrity locking, and post-trade audits.
 */

class TradePlannerService {
  constructor() {
    this.checklistItems = [
      { id: 'chk_trend', label: 'Primary Trend Identified on Daily / 4H Timeframe', checked: false, required: true },
      { id: 'chk_htf', label: 'Higher Timeframe Support / Resistance Levels Confirmed', checked: false, required: true },
      { id: 'chk_entry', label: 'Precise Trigger Entry Price Identified & Invalidation Clear', checked: false, required: true },
      { id: 'chk_stop', label: 'Protective Stop-Loss Defined Based on Market Structure', checked: false, required: true },
      { id: 'chk_target', label: 'Minimum 1:2.0 Risk-to-Reward Target Established', checked: false, required: true },
      { id: 'chk_risk', label: 'Calculated Risk ≤ 1.0% of Total Account Equity', checked: false, required: true },
      { id: 'chk_rr', label: 'Risk/Reward Ratio Acceptable (> 1:2.0)', checked: false, required: true },
      { id: 'chk_news', label: 'Economic Calendar Checked for Impending High-Impact Events', checked: false, required: true },
      { id: 'chk_global', label: 'Global Market Macro & Correlation Aligned', checked: false, required: false },
      { id: 'chk_size', label: 'Position Size & Margin Formally Calculated', checked: false, required: true },
      { id: 'chk_plan', label: 'Trade Plan Formulated and Parameters Locked', checked: false, required: true }
    ];

    this.activeTradePlan = {
      symbol: 'RELIANCE',
      direction: 'LONG',
      entryPrice: 2980.00,
      stopLoss: 2940.00,
      targetPrice: 3060.00,
      positionSize: 25,
      riskPercent: 1.0,
      rr: '1:2.0',
      setup: 'Breakout',
      entryReason: 'Close above 20 EMA with volume expansion',
      invalidation: 'Break below 2935 structural swing low',
      timeframe: '15m',
      marketRegime: 'Bull (Risk-On)',
      notes: 'Aligns with broader energy sector strength.',
      isLocked: false,
      lockedAt: null,
      modificationLogs: []
    };

    this.loadPlannerState();
  }

  loadPlannerState() {
    try {
      const saved = localStorage.getItem('nova_trade_planner');
      if (saved) {
        const obj = JSON.parse(saved);
        if (obj.checklistItems) this.checklistItems = obj.checklistItems;
        if (obj.activeTradePlan) this.activeTradePlan = obj.activeTradePlan;
      }
    } catch (e) {}
  }

  savePlannerState() {
    try {
      localStorage.setItem('nova_trade_planner', JSON.stringify({
        checklistItems: this.checklistItems,
        activeTradePlan: this.activeTradePlan
      }));
    } catch (e) {}
  }

  toggleChecklist(id) {
    const item = this.checklistItems.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      this.savePlannerState();
    }
    return this.getReadinessStatus();
  }

  getReadinessStatus() {
    const requiredTotal = this.checklistItems.filter(i => i.required).length;
    const requiredPassed = this.checklistItems.filter(i => i.required && i.checked).length;
    const isReady = requiredPassed === requiredTotal;
    const percentage = Math.round((requiredPassed / requiredTotal) * 100);

    return {
      isReady,
      percentage,
      requiredPassed,
      requiredTotal,
      statusText: isReady ? 'READY TO TRADE' : `GATED (${percentage}% READY)`,
      badgeClass: isReady ? 'status-live' : 'status-delayed'
    };
  }

  lockPlan() {
    if (!this.activeTradePlan.isLocked) {
      this.activeTradePlan.isLocked = true;
      this.activeTradePlan.lockedAt = new Date().toISOString();
      this.activeTradePlan.originalSnapshot = { ...this.activeTradePlan };
      
      if (window.journalService) {
        window.journalService.logAction({
          symbol: this.activeTradePlan.symbol,
          action: 'Trade Plan Locked',
          price: this.activeTradePlan.entryPrice,
          quantity: this.activeTradePlan.positionSize,
          orderType: this.activeTradePlan.direction,
          reason: `Locked plan for ${this.activeTradePlan.setup}. Stop: ₹${this.activeTradePlan.stopLoss}, Target: ₹${this.activeTradePlan.targetPrice}`,
          source: 'Trade Planner',
          status: 'LOCKED'
        });
      }
      this.savePlannerState();
      return true;
    }
    return false;
  }

  modifyPlan(fields) {
    if (this.activeTradePlan.isLocked) {
      const modLog = {
        timestamp: new Date().toLocaleTimeString(),
        changes: fields,
        reason: fields.modificationReason || 'Trader adjustment post-lock'
      };
      this.activeTradePlan.modificationLogs.push(modLog);

      if (window.journalService) {
        window.journalService.logAction({
          symbol: this.activeTradePlan.symbol,
          action: 'Locked Plan Modified',
          price: fields.entryPrice || this.activeTradePlan.entryPrice,
          quantity: fields.positionSize || this.activeTradePlan.positionSize,
          orderType: 'AUDIT',
          reason: `Post-lock adjustment: ${JSON.stringify(fields)}`,
          source: 'Plan Enforcement',
          status: 'WARNING'
        });
      }
    }
    Object.assign(this.activeTradePlan, fields);
    this.savePlannerState();
  }

  submitPostTradeReview(reviewData) {
    const journalEntry = {
      id: `TRD-${Date.now().toString().slice(-5)}`,
      symbol: reviewData.symbol || this.activeTradePlan.symbol,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      direction: reviewData.direction || this.activeTradePlan.direction,
      entry: Number(reviewData.entry) || this.activeTradePlan.entryPrice,
      stop: Number(reviewData.stop) || this.activeTradePlan.stopLoss,
      target: Number(reviewData.target) || this.activeTradePlan.targetPrice,
      exit: Number(reviewData.exit) || this.activeTradePlan.targetPrice,
      quantity: Number(reviewData.quantity) || this.activeTradePlan.positionSize,
      pnl: Number(reviewData.pnl) || 0,
      strategy: reviewData.strategy || this.activeTradePlan.setup,
      followedPlan: reviewData.followedPlan === 'yes',
      stopRespected: reviewData.stopRespected === 'yes',
      entryAccordingToSetup: reviewData.entryAccordingToSetup === 'yes',
      exitAccordingToPlan: reviewData.exitAccordingToPlan === 'yes',
      notes: reviewData.notes || '',
      whatWentWell: reviewData.whatWentWell || '',
      whatWentWrong: reviewData.whatWentWrong || '',
      whatShouldChange: reviewData.whatShouldChange || '',
      emotions: reviewData.emotions || 'Disciplined',
      tags: reviewData.tags || [this.activeTradePlan.setup, 'Reviewed']
    };

    if (window.journalService) {
      window.journalService.addTrade(journalEntry);
    }
    return journalEntry;
  }
}

window.tradePlannerService = new TradePlannerService();
