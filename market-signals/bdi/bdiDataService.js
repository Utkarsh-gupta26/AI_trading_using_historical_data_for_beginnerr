/**
 * market-signals/bdi/bdiDataService.js
 * Retrieves and caches live & historical Baltic Dry Index data with strict quality verification.
 * Adheres to rule: Never fabricate fake BDI values. If stale/unavailable, signal = neutral.
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDIDataService = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {

  class BDIDataService {
    constructor() {
      this.cachedLatest = null;
      this.cachedHistorical = {};
      this.lastFetchTime = 0;
      this.cacheDurationMs = 60 * 1000; // 1 minute client cache
    }

    /**
     * Retrieve the latest available BDI snapshot and quality metadata.
     */
    async getLatestBDI() {
      const now = Date.now();
      if (this.cachedLatest && (now - this.lastFetchTime < this.cacheDurationMs)) {
        return this.cachedLatest;
      }

      try {
        const resp = await fetch('/api/bdi/latest');
        if (!resp.ok) {
          throw new Error(`HTTP error ${resp.status}`);
        }
        const data = await resp.json();
        if (data.status === 'success' && data.bdi) {
          this.cachedLatest = data.bdi;
          this.lastFetchTime = now;
          return this.cachedLatest;
        }
        throw new Error('Invalid payload from /api/bdi/latest');
      } catch (err) {
        console.warn('[BDIDataService] Fetch failed:', err.message);
        // Return structured stale/unavailable state
        return {
          current: null,
          prevClose: null,
          change1D: 0,
          change5D: 0,
          change20D: 0,
          trend50D: 'NEUTRAL',
          trend200D: 'NEUTRAL',
          volatility: 0,
          momentum: 0,
          trendDirection: 'NEUTRAL',
          isAvailable: false,
          isStale: true,
          quality: {
            source: 'Baltic Exchange / Data Feed',
            lastUpdated: null,
            dataDelay: 'N/A',
            completeness: 0,
            qualityScore: 0,
            statusText: 'BDI data unavailable/stale — excluded from prediction.'
          }
        };
      }
    }

    /**
     * Retrieve historical BDI series with aligned target market (e.g. NIFTY 50).
     */
    async getHistoricalBDI(range = '1Y', compareSymbol = 'NIFTY_50') {
      const cacheKey = `${range}_${compareSymbol}`;
      if (this.cachedHistorical[cacheKey]) {
        return this.cachedHistorical[cacheKey];
      }

      try {
        const url = `/api/bdi/historical?range=${encodeURIComponent(range)}&compare=${encodeURIComponent(compareSymbol)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
        const data = await resp.json();
        if (data.status === 'success') {
          this.cachedHistorical[cacheKey] = data;
          return data;
        }
        throw new Error('Failed to retrieve historical BDI data');
      } catch (err) {
        console.warn('[BDIDataService] Historical fetch failed:', err.message);
        return {
          status: 'error',
          series: [],
          quality: {
            statusText: 'BDI historical data unavailable/stale — excluded from prediction.'
          }
        };
      }
    }

    clearCache() {
      this.cachedLatest = null;
      this.cachedHistorical = {};
      this.lastFetchTime = 0;
    }
  }

  return new BDIDataService();
}));
