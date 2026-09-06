/**
 * Nova Trade Workstation - Trade Journal, Automatic Trade Logging & Journal Analytics
 * Complete trading diary, automatic audit trails, equity curves, and strategy breakdowns.
 */

class JournalService {
  constructor() {
    this.trades = [];
    this.logs = [];
    this.storageKey = 'nova_trade_journal';
    this.logsStorageKey = 'nova_trade_logs';
    this.tagsList = [
      'Breakout', 'Pullback', 'Trend', 'Reversal', 'Momentum', 
      'Mean Reversion', 'News', 'Earnings', 'Scalp', 'Intraday', 'Swing', 'Position'
    ];
    this.loadData();
  }

  async loadData() {
    // Try loading from server storage first, then localStorage
    try {
      const res = await fetch('/api/storage?key=nova_trade_journal');
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        this.trades = data.data;
      } else {
        const local = localStorage.getItem(this.storageKey);
        if (local) this.trades = JSON.parse(local);
      }
    } catch (e) {
      const local = localStorage.getItem(this.storageKey);
      if (local) this.trades = JSON.parse(local);
    }

    try {
      const resLogs = await fetch('/api/storage?key=nova_trade_logs');
      const logData = await resLogs.json();
      if (logData && logData.data && Array.isArray(logData.data) && logData.data.length > 0) {
        this.logs = logData.data;
      } else {
        const localLogs = localStorage.getItem(this.logsStorageKey);
        if (localLogs) this.logs = JSON.parse(localLogs);
      }
    } catch (e) {
      const localLogs = localStorage.getItem(this.logsStorageKey);
      if (localLogs) this.logs = JSON.parse(localLogs);
    }

    // Populate initial sample trades if empty to showcase analytics immediately
    if (!this.trades || this.trades.length === 0) {
      this.populateSampleTrades();
    }
  }

  populateSampleTrades() {
    const now = Date.now();
    const dayMs = 86400000;
    this.trades = [
      {
        id: 'TRD-1001',
        date: new Date(now - 14 * dayMs).toISOString().split('T')[0],
        timestamp: now - 14 * dayMs,
        symbol: 'RELIANCE',
        exchange: 'NSE',
        direction: 'LONG',
        entry: 2940.00,
        stop: 2910.00,
        target: 3010.00,
        exit: 3005.00,
        quantity: 35,
        positionSize: 102900,
        riskPercent: 1.0,
        riskAmount: 1050,
        rr: 2.17,
        strategy: 'Breakout',
        setup: 'Consolidation range breakout with high relative volume',
        condition: 'Bullish',
        timeframe: '15m',
        entryReason: 'Close above 20 EMA & 2940 resistance zone',
        exitReason: 'Reached near target resistance',
        result: 'WIN',
        pnl: 2275.00,
        holdingTimeMinutes: 125,
        screenshot: '',
        notes: 'Clean follow-through after 10:15 AM candle.',
        emotions: 'Disciplined',
        mistakes: 'None',
        lessonsLearned: 'Patience at key levels pays off.',
        tags: ['Breakout', 'Intraday', 'Trend'],
        followedPlan: true,
        stopRespected: true
      },
      {
        id: 'TRD-1002',
        date: new Date(now - 11 * dayMs).toISOString().split('T')[0],
        timestamp: now - 11 * dayMs,
        symbol: 'NIFTY',
        exchange: 'NSE',
        direction: 'LONG',
        entry: 22450.00,
        stop: 22410.00,
        target: 22550.00,
        exit: 22530.00,
        quantity: 25,
        positionSize: 561250,
        riskPercent: 1.0,
        riskAmount: 1000,
        rr: 2.0,
        strategy: 'Pullback',
        setup: 'Retracement to VWAP during strong morning trend',
        condition: 'Bullish',
        timeframe: '5m',
        entryReason: 'Bullish hammer on VWAP support',
        exitReason: 'Trailing stop triggered',
        result: 'WIN',
        pnl: 2000.00,
        holdingTimeMinutes: 65,
        screenshot: '',
        notes: 'Good execution at VWAP touch.',
        emotions: 'Confident',
        mistakes: 'None',
        lessonsLearned: 'Stick with higher timeframe trend.',
        tags: ['Pullback', 'Intraday'],
        followedPlan: true,
        stopRespected: true
      },
      {
        id: 'TRD-1003',
        date: new Date(now - 8 * dayMs).toISOString().split('T')[0],
        timestamp: now - 8 * dayMs,
        symbol: 'TCS',
        exchange: 'NSE',
        direction: 'SHORT',
        entry: 3880.00,
        stop: 3910.00,
        target: 3820.00,
        exit: 3910.00,
        quantity: 30,
        positionSize: 116400,
        riskPercent: 0.9,
        riskAmount: 900,
        rr: 2.0,
        strategy: 'Reversal',
        setup: 'Double top rejection on 4H resistance',
        condition: 'Sideways',
        timeframe: '15m',
        entryReason: 'Bearish engulfing candle on resistance',
        exitReason: 'Stop loss hit',
        result: 'LOSS',
        pnl: -900.00,
        holdingTimeMinutes: 42,
        screenshot: '',
        notes: 'Market absorbed selling pressure quickly.',
        emotions: 'Calm',
        mistakes: 'Ignored broader IT sector strength',
        lessonsLearned: 'Always check sector breadth before counter-trend reversal.',
        tags: ['Reversal', 'Intraday'],
        followedPlan: true,
        stopRespected: true
      },
      {
        id: 'TRD-1004',
        date: new Date(now - 5 * dayMs).toISOString().split('T')[0],
        timestamp: now - 5 * dayMs,
        symbol: 'BTCUSD',
        exchange: 'Delta',
        direction: 'LONG',
        entry: 64200.00,
        stop: 63600.00,
        target: 65800.00,
        exit: 65650.00,
        quantity: 0.15,
        positionSize: 9630,
        riskPercent: 1.0,
        riskAmount: 90,
        rr: 2.42,
        strategy: 'Breakout',
        setup: 'Ascending triangle breakout on 1H',
        condition: 'Bullish',
        timeframe: '1H',
        entryReason: 'Volume expansion with candle close above $64,200',
        exitReason: 'Reached $65.6k target',
        result: 'WIN',
        pnl: 217.50,
        holdingTimeMinutes: 340,
        screenshot: '',
        notes: 'Very clean structural trade.',
        emotions: 'Focused',
        mistakes: 'None',
        lessonsLearned: 'Higher timeframe consolidation delivers higher win rates.',
        tags: ['Breakout', 'Swing', 'Momentum'],
        followedPlan: true,
        stopRespected: true
      },
      {
        id: 'TRD-1005',
        date: new Date(now - 2 * dayMs).toISOString().split('T')[0],
        timestamp: now - 2 * dayMs,
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        direction: 'LONG',
        entry: 1650.00,
        stop: 1635.00,
        target: 1690.00,
        exit: 1682.00,
        quantity: 70,
        positionSize: 115500,
        riskPercent: 1.05,
        riskAmount: 1050,
        rr: 2.13,
        strategy: 'Pullback',
        setup: '50 EMA bounce on 15m chart',
        condition: 'Bullish',
        timeframe: '15m',
        entryReason: 'Pin bar off 50 EMA with positive delta',
        exitReason: 'Target reached',
        result: 'WIN',
        pnl: 2240.00,
        holdingTimeMinutes: 180,
        screenshot: '',
        notes: 'Followed bank nifty strength.',
        emotions: 'Disciplined',
        mistakes: 'None',
        lessonsLearned: 'Confluence with index makes setup robust.',
        tags: ['Pullback', 'Trend'],
        followedPlan: true,
        stopRespected: true
      }
    ];
    this.saveData();

    // Sample initial logs
    this.logs = [
      {
        id: 'LOG-001',
        timestamp: new Date(now - 2 * dayMs).toLocaleTimeString(),
        symbol: 'HDFCBANK',
        action: 'Position Opened',
        price: 1650.00,
        quantity: 70,
        orderType: 'LIMIT',
        reason: '50 EMA Pullback confluence',
        source: 'User Manual',
        status: 'FILLED'
      },
      {
        id: 'LOG-002',
        timestamp: new Date(now - 2 * dayMs + 180 * 60000).toLocaleTimeString(),
        symbol: 'HDFCBANK',
        action: 'Position Closed',
        price: 1682.00,
        quantity: 70,
        orderType: 'LIMIT',
        reason: 'Target zone reached (+₹2,240)',
        source: 'Limit Order',
        status: 'COMPLETED'
      },
      {
        id: 'LOG-003',
        timestamp: new Date().toLocaleTimeString(),
        symbol: 'BTCUSD',
        action: 'Signal Generated',
        price: 79913.23,
        quantity: 1,
        orderType: 'ANALYSIS',
        reason: 'RSI Bullish Divergence on 15m',
        source: 'AI Assistant',
        status: 'ACTIVE'
      }
    ];
    this.saveLogs();
  }

  async saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.trades));
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nova_trade_journal', value: this.trades })
      });
    } catch (e) {}
  }

  async saveLogs() {
    try {
      localStorage.setItem(this.logsStorageKey, JSON.stringify(this.logs));
      await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'nova_trade_logs', value: this.logs })
      });
    } catch (e) {}
  }

  /**
   * Add new Trade Entry to Journal
   */
  addTrade(trade) {
    if (!trade.id) trade.id = `TRD-${Date.now().toString().slice(-5)}`;
    if (!trade.timestamp) trade.timestamp = Date.now();
    if (!trade.date) trade.date = new Date().toISOString().split('T')[0];

    // Compute P&L if not provided
    if (trade.pnl === undefined && trade.exit && trade.entry && trade.quantity) {
      const mult = trade.direction === 'SHORT' ? -1 : 1;
      trade.pnl = (Number(trade.exit) - Number(trade.entry)) * Number(trade.quantity) * mult;
    }
    trade.result = trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN';

    this.trades.unshift(trade);
    this.saveData();

    // Also auto-log this action
    this.logAction({
      symbol: trade.symbol,
      action: 'Trade Journaled',
      price: trade.exit || trade.entry,
      quantity: trade.quantity,
      orderType: trade.direction,
      reason: `${trade.strategy} setup - P&L: ₹${(trade.pnl || 0).toFixed(2)}`,
      source: 'Trade Journal',
      status: 'LOGGED'
    });

    return trade;
  }

  /**
   * Log an action in Trading Logs
   */
  logAction(entry) {
    const log = {
      id: `LOG-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      isoDate: new Date().toISOString(),
      symbol: entry.symbol || 'SYSTEM',
      action: entry.action || 'Action',
      price: entry.price || 0,
      quantity: entry.quantity || 0,
      orderType: entry.orderType || 'SYSTEM',
      reason: entry.reason || '',
      source: entry.source || 'Workstation',
      status: entry.status || 'SUCCESS'
    };
    this.logs.unshift(log);
    if (this.logs.length > 500) this.logs.pop();
    this.saveLogs();
    return log;
  }

  /**
   * Calculate Institutional Journal Analytics
   */
  calculateAnalytics() {
    const trades = this.trades || [];
    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        netPnl: 0,
        profitFactor: 0,
        expectancy: 0,
        averageWin: 0,
        averageLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        averageRR: 0,
        maxDrawdown: 0,
        recoveryFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        equityCurve: [],
        strategyStats: {}
      };
    }

    let wins = 0;
    let losses = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;
    let largestWin = 0;
    let largestLoss = 0;
    let totalRR = 0;
    let validRRCount = 0;
    let netPnl = 0;

    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    const returns = [];
    const equityCurve = [];
    let runningEquity = 100000; // Starting baseline
    let peakEquity = 100000;
    let maxDrawdown = 0;

    // Sort chronologically for equity curve & streaks
    const chronoTrades = [...trades].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    chronoTrades.forEach((t, idx) => {
      const pnl = Number(t.pnl) || 0;
      netPnl += pnl;
      runningEquity += pnl;
      returns.push(pnl);

      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }
      const dd = peakEquity - runningEquity;
      if (dd > maxDrawdown) maxDrawdown = dd;

      equityCurve.push({
        tradeIndex: idx + 1,
        date: t.date,
        pnl: pnl,
        equity: runningEquity,
        symbol: t.symbol
      });

      if (pnl > 0) {
        wins++;
        totalWinPnl += pnl;
        if (pnl > largestWin) largestWin = pnl;
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (pnl < 0) {
        losses++;
        totalLossPnl += Math.abs(pnl);
        if (Math.abs(pnl) > largestLoss) largestLoss = Math.abs(pnl);
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }

      if (t.rr && Number(t.rr) > 0) {
        totalRR += Number(t.rr);
        validRRCount++;
      }
    });

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const avgWin = wins > 0 ? totalWinPnl / wins : 0;
    const avgLoss = losses > 0 ? totalLossPnl / losses : 0;
    const profitFactor = totalLossPnl > 0 ? (totalWinPnl / totalLossPnl) : (totalWinPnl > 0 ? 99.9 : 0);
    const avgRR = validRRCount > 0 ? (totalRR / validRRCount) : (avgLoss > 0 ? avgWin / avgLoss : 0);
    
    // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
    const winProb = wins / totalTrades;
    const lossProb = losses / totalTrades;
    const expectancy = (winProb * avgWin) - (lossProb * avgLoss);

    // Sharpe Ratio & Sortino Ratio
    const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance) || 1;
    const sharpeRatio = (meanReturn / stdDev) * Math.sqrt(252);

    const downsideDiffs = returns.filter(r => r < 0).map(r => Math.pow(r, 2));
    const downsideVariance = downsideDiffs.length > 0 ? downsideDiffs.reduce((a, b) => a + b, 0) / downsideDiffs.length : 1;
    const downsideStdDev = Math.sqrt(downsideVariance) || 1;
    const sortinoRatio = (meanReturn / downsideStdDev) * Math.sqrt(252);

    const recoveryFactor = maxDrawdown > 0 ? (netPnl / maxDrawdown) : 0;

    // Strategy breakdown
    const strategies = {};
    trades.forEach(t => {
      const strat = t.strategy || 'General';
      if (!strategies[strat]) {
        strategies[strat] = { trades: 0, wins: 0, losses: 0, totalPnl: 0, winPnl: 0, lossPnl: 0, totalRR: 0, rrCount: 0 };
      }
      const p = Number(t.pnl) || 0;
      strategies[strat].trades++;
      strategies[strat].totalPnl += p;
      if (p > 0) {
        strategies[strat].wins++;
        strategies[strat].winPnl += p;
      } else if (p < 0) {
        strategies[strat].losses++;
        strategies[strat].lossPnl += Math.abs(p);
      }
      if (t.rr && Number(t.rr) > 0) {
        strategies[strat].totalRR += Number(t.rr);
        strategies[strat].rrCount++;
      }
    });

    // Format strategies
    const strategyStats = {};
    Object.keys(strategies).forEach(key => {
      const s = strategies[key];
      strategyStats[key] = {
        name: key,
        trades: s.trades,
        winRate: ((s.wins / s.trades) * 100).toFixed(1) + '%',
        netPnl: s.totalPnl,
        profitFactor: s.lossPnl > 0 ? (s.winPnl / s.lossPnl).toFixed(2) : (s.winPnl > 0 ? '99.9' : '0.0'),
        avgRR: s.rrCount > 0 ? `1:${(s.totalRR / s.rrCount).toFixed(2)}` : '1:2.0'
      };
    });

    return {
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      winRate: winRate.toFixed(1),
      netPnl,
      profitFactor: Number(profitFactor.toFixed(2)),
      expectancy: Math.round(expectancy),
      averageWin: Math.round(avgWin),
      averageLoss: Math.round(avgLoss),
      largestWin: Math.round(largestWin),
      largestLoss: Math.round(largestLoss),
      averageRR: avgRR.toFixed(2),
      maxDrawdown: Math.round(maxDrawdown),
      recoveryFactor: Number(recoveryFactor.toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      sortinoRatio: Number(sortinoRatio.toFixed(2)),
      consecutiveWins: maxWinStreak,
      consecutiveLosses: maxLossStreak,
      equityCurve,
      strategyStats
    };
  }
}

// Global singleton instance
window.journalService = new JournalService();
