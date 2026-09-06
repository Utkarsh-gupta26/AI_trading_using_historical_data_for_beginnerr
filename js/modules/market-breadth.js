/**
 * Nova Trade Workstation - Market Breadth & NIFTY Sector Rotation Dashboard
 * Quantifies market participation, internal strength metrics, and sector rotation across 1D–1Y.
 */

class MarketBreadthService {
  constructor() {
    this.breadthMetrics = {
      indexName: 'NIFTY 500 / NSE Broad Market',
      advances: 312,
      declines: 176,
      unchanged: 12,
      adRatio: 1.77,
      pctAbove20EMA: 68.4,
      pctAbove50EMA: 62.1,
      pctAbove200EMA: 57.8,
      new52WHighs: 41,
      new52WLows: 6,
      status: 'HEALTHY EXPANSION',
      lastUpdated: new Date().toLocaleTimeString()
    };

    this.sectors = [
      { name: 'NIFTY Bank', sector: 'Banking', perf1D: 1.42, perf1W: 2.85, perf1M: 4.10, perf3M: 8.90, perf6M: 14.2, perf1Y: 22.4, rsi: 64.2, momentum: 'Strong Bullish', trend: 'Leading', volume: '1.35x RVOL' },
      { name: 'NIFTY IT', sector: 'IT', perf1D: -0.65, perf1W: 0.90, perf1M: 3.20, perf3M: 12.4, perf6M: 19.8, perf1Y: 28.5, rsi: 56.8, momentum: 'Bullish Consolidation', trend: 'Weakening', volume: '0.92x RVOL' },
      { name: 'NIFTY Auto', sector: 'Auto', perf1D: 0.88, perf1W: 1.75, perf1M: 2.60, perf3M: 6.40, perf6M: 16.5, perf1Y: 34.2, rsi: 61.5, momentum: 'Bullish Trend', trend: 'Leading', volume: '1.18x RVOL' },
      { name: 'NIFTY Pharma', sector: 'Pharma', perf1D: 0.45, perf1W: 1.20, perf1M: -0.80, perf3M: 4.20, perf6M: 11.2, perf1Y: 18.9, rsi: 51.2, momentum: 'Neutral Accumulation', trend: 'Improving', volume: '0.84x RVOL' },
      { name: 'NIFTY Energy', sector: 'Energy', perf1D: -0.32, perf1W: -1.10, perf1M: 1.40, perf3M: 5.10, perf6M: 9.80, perf1Y: 16.4, rsi: 48.6, momentum: 'Pullback', trend: 'Lagging', volume: '1.05x RVOL' },
      { name: 'NIFTY FMCG', sector: 'FMCG', perf1D: 0.12, perf1W: 0.40, perf1M: 0.95, perf3M: 2.80, perf6M: 5.40, perf1Y: 12.1, rsi: 52.0, momentum: 'Defensive Steady', trend: 'Improving', volume: '0.78x RVOL' },
      { name: 'NIFTY Metal', sector: 'Metals', perf1D: 1.95, perf1W: 3.40, perf1M: 5.80, perf3M: 9.40, perf6M: 15.2, perf1Y: 26.8, rsi: 69.1, momentum: 'Strong Momentum Breakout', trend: 'Leading', volume: '1.62x RVOL' },
      { name: 'NIFTY Realty', sector: 'Realty', perf1D: 1.15, perf1W: 2.10, perf1M: 3.90, perf3M: 11.5, perf6M: 24.1, perf1Y: 48.6, rsi: 66.4, momentum: 'High Beta Breakout', trend: 'Leading', volume: '1.40x RVOL' },
      { name: 'NIFTY Fin Services', sector: 'Financial Services', perf1D: 1.28, perf1W: 2.50, perf1M: 3.85, perf3M: 8.20, perf6M: 13.6, perf1Y: 21.0, rsi: 63.8, momentum: 'Bullish Trend', trend: 'Leading', volume: '1.25x RVOL' }
    ];
  }

  getBreadthSummary() {
    return this.breadthMetrics;
  }

  getSectorRotation(timeframe = '1M') {
    const keyMap = {
      '1D': 'perf1D',
      '1W': 'perf1W',
      '1M': 'perf1M',
      '3M': 'perf3M',
      '6M': 'perf6M',
      '1Y': 'perf1Y'
    };
    const prop = keyMap[timeframe] || 'perf1M';

    // Return sectors sorted by performance descending
    return [...this.sectors].sort((a, b) => b[prop] - a[prop]).map(s => ({
      ...s,
      selectedPerf: s[prop],
      formattedPerf: s[prop] > 0 ? `+${s[prop].toFixed(2)}%` : `${s[prop].toFixed(2)}%`,
      badgeClass: s[prop] > 0 ? 'bullish-tag' : 'bearish-tag'
    }));
  }
}

window.marketBreadthService = new MarketBreadthService();
