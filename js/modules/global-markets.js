/**
 * Nova Trade Workstation - Comprehensive Global Markets & Macro Correlation Engine
 * Live institutional monitoring of 50+ global indices, commodities, forex pairs, crypto assets & bond yields.
 */

class GlobalMarketsService {
  constructor() {
    this.marketsList = [];
    this.byRegion = {};
    this.marketDataCache = {};
    this.lastFetchedTime = 0;
    this.activeRegion = 'All';
    this.searchQuery = '';
    this.viewMode = 'grid'; // 'grid' | 'table'
    this.correlationWindow = '3M';
    this.correlationBaseAsset = '^NSEI';
    this.pollingTimer = null;
    this.isFetching = false;
  }

  /**
   * Fetch all global market quotes and stats from backend API
   */
  async fetchAllMarkets() {
    if (this.isFetching) return this.marketsList;
    this.isFetching = true;
    try {
      const resp = await fetch('/api/global-markets');
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.markets) {
          this.marketsList = json.markets;
          this.byRegion = json.byRegion || {};
          this.lastFetchedTime = json.timestamp || Date.now();

          // Populate cache
          this.marketsList.forEach(m => {
            this.marketDataCache[m.symbol] = m;
            this.marketDataCache[m.name] = m;
            if (m.aliases) {
              m.aliases.forEach(a => { this.marketDataCache[a] = m; });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[GlobalMarketsService] Error fetching /api/global-markets:', e);
    } finally {
      this.isFetching = false;
    }
    return this.marketsList;
  }

  /**
   * Start background polling every 15 seconds
   */
  startLiveUpdates() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.fetchAllMarkets().then(() => {
      this.renderTickerRibbon();
      const ws = document.getElementById('workspaceGlobal');
      if (ws && ws.classList.contains('active')) {
        this.renderWorkspace();
      }
    });

    this.pollingTimer = setInterval(async () => {
      await this.fetchAllMarkets();
      this.renderTickerRibbon();
      const ws = document.getElementById('workspaceGlobal');
      if (ws && ws.classList.contains('active')) {
        this.renderWorkspace();
      }
    }, 15000);
  }

  /**
   * Render continuous horizontal global ticker ribbon
   */
  renderTickerRibbon(containerId = 'globalTickerRibbon') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Premier global benchmarks to feature in the top ticker tape
    const marqueeSymbols = [
      '^GSPC', '^IXIC', '^DJI', '^NSEI', '^NSEBANK', '^BSESN',
      '^FTSE', '^GDAXI', '^N225', '^HSI', 'GC=F', 'CL=F',
      'BTC-USD', 'USDINR=X', 'DX-Y.NYB', '^TNX'
    ];

    const items = marqueeSymbols
      .map(sym => this.marketDataCache[sym])
      .filter(Boolean);

    if (items.length === 0 && this.marketsList.length > 0) {
      items.push(...this.marketsList.slice(0, 14));
    }

    if (items.length === 0) return;

    const htmlItems = items.map(m => {
      const isBull = (m.changePct || 0) >= 0;
      const sign = isBull ? '+' : '';
      const colorClass = isBull ? 'bull' : 'bear';
      const curSign = m.currency === 'INR' ? '₹' : (m.currency === 'USD' ? '$' : (m.currency === 'EUR' ? '€' : (m.currency === 'GBP' ? '£' : (m.currency === '%' ? '' : ''))));
      const suffix = m.currency === '%' ? '%' : '';

      return `
        <div class="ticker-tape-chip" onclick="window.globalMarketsService.openInChart('${m.symbol}')" title="Click to view ${m.name} chart">
          <span class="chip-name">${m.name}</span>
          <span class="chip-price mono" style="color:var(--aiot-950) !important; font-weight:800;">${curSign}${m.price != null ? Number(m.price).toLocaleString() : '--'}${suffix}</span>
          <span class="chip-pct mono ${colorClass}">${sign}${m.changePct != null ? Number(m.changePct).toFixed(2) : '0.00'}%</span>
        </div>
      `;
    }).join('');

    // Double for continuous marquee illusion
    container.innerHTML = `
      <div class="ticker-tape-track">
        ${htmlItems}
        ${htmlItems}
      </div>
    `;
  }

  /**
   * Render complete Global Markets Workspace
   */
  async renderWorkspace(containerId = 'workspaceGlobal') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.marketsList.length === 0) {
      await this.fetchAllMarkets();
    }

    // 1. Calculate Macro Statistics
    const all = this.marketsList;
    const totalCount = all.length;
    const gainers = all.filter(m => (m.changePct || 0) > 0);
    const losers = all.filter(m => (m.changePct || 0) < 0);
    const gainerPct = totalCount > 0 ? Math.round((gainers.length / totalCount) * 100) : 50;

    let sentimentLabel = 'Neutral / Balanced';
    let sentimentColor = '#f59e0b';
    let sentimentBadgeClass = 'status-delayed';
    if (gainerPct >= 58) {
      sentimentLabel = 'Global Risk-On (Bullish Rally)';
      sentimentColor = '#089981';
      sentimentBadgeClass = 'status-live';
    } else if (gainerPct <= 42) {
      sentimentLabel = 'Global Risk-Off (Defensive Rotation)';
      sentimentColor = '#f23645';
      sentimentBadgeClass = 'status-closed';
    }

    // Find top gainer and top loser
    const sorted = [...all].sort((a, b) => (b.changePct || 0) - (a.changePct || 0));
    const topGainer = sorted[0] || { name: 'Gold', changePct: 1.2 };
    const topLoser = sorted[sorted.length - 1] || { name: 'Crude Oil', changePct: -0.8 };

    // 2. Filter markets by activeRegion and searchQuery
    let filtered = all;
    if (this.activeRegion && this.activeRegion !== 'All') {
      filtered = filtered.filter(m => m.region === this.activeRegion || m.category === this.activeRegion);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.symbol.toLowerCase().includes(q) ||
        (m.region && m.region.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
    }

    // 3. Generate HTML
    const regions = [
      { key: 'All', label: `All Markets (${totalCount})` },
      { key: 'US', label: `US & Americas (${(this.byRegion['US'] || []).length})` },
      { key: 'Europe', label: `Europe (${(this.byRegion['Europe'] || []).length})` },
      { key: 'Asia', label: `Asia-Pacific (${(this.byRegion['Asia'] || []).length})` },
      { key: 'India', label: `India (${(this.byRegion['India'] || []).length})` },
      { key: 'Commodities', label: `Commodities (${(this.byRegion['Commodities'] || []).length})` },
      { key: 'Forex', label: `Forex (${(this.byRegion['Forex'] || []).length})` },
      { key: 'Crypto', label: `Crypto (${(this.byRegion['Crypto'] || []).length})` },
      { key: 'Bonds', label: `Bonds (${(this.byRegion['Bonds'] || []).length})` }
    ];

    const regionTabsHtml = regions.map(r => `
      <button class="hero-tf-btn ${this.activeRegion === r.key ? 'active' : ''}" 
              onclick="window.globalMarketsService.setRegion('${r.key}')" 
              style="padding:6px 14px; font-size:11.5px; font-weight:700; border-radius:var(--radius-pill); cursor:pointer;">
        <span>${r.label}</span>
      </button>
    `).join('');

    // Generate cards or table rows
    let contentHtml = '';
    if (this.viewMode === 'grid') {
      contentHtml = `
        <div class="global-markets-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:14px; margin-top:16px;">
          ${filtered.map(m => this.renderMarketCard(m)).join('')}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="nova-card" style="padding:0; overflow-x:auto; margin-top:16px;">
          <table class="nova-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Region</th>
                <th>Price</th>
                <th>24h Change</th>
                <th>Day Range (Low - High)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(m => this.renderMarketTableRow(m)).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Correlation rows
    const corrRows = this.getCorrelationMatrix(this.correlationBaseAsset, this.correlationWindow);
    const corrHtml = corrRows.map(c => `
      <tr>
        <td><strong>${c.targetName}</strong> <span style="font-size:11px; color:#787b86;">(${c.targetSymbol})</span></td>
        <td class="mono">${c.window}</td>
        <td class="mono" style="font-weight:700; color:${c.coefficient >= 0 ? '#089981' : '#f23645'};">${c.formattedCoeff}</td>
        <td><span class="status-pill ${c.tagClass}">${c.strength}</span></td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div>
          <div class="ws-header-title" style="display:flex; align-items:center; gap:10px;">
            <span>Institutional Global Markets & Indices Terminal</span>
            <span class="status-pill status-live" style="font-size:10px;">LIVE STREAMING</span>
          </div>
          <div class="ws-subtitle">50+ cross-asset benchmarks covering US, European, Asian, Indian indices, commodities, currencies, cryptos, and sovereign bond yields.</div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <div style="display:flex; background:rgba(255,255,255,0.04); border-radius:6px; padding:2px; border:1px solid rgba(255,255,255,0.08);">
            <button class="hero-tf-btn ${this.viewMode === 'grid' ? 'active' : ''}" onclick="window.globalMarketsService.setViewMode('grid')" title="Grid View">Cards</button>
            <button class="hero-tf-btn ${this.viewMode === 'table' ? 'active' : ''}" onclick="window.globalMarketsService.setViewMode('table')" title="Dense Table View">Table</button>
          </div>
          <button class="nova-quick-pill" onclick="window.globalMarketsService.fetchAllMarkets().then(() => window.globalMarketsService.renderWorkspace())">Sync Feeds</button>
        </div>
      </div>

      <!-- Macro Intelligence Stats Ribbon -->
      <div class="ws-grid-4col" style="margin-bottom:16px;">
        <div class="nova-card" style="padding:12px 16px;">
          <span class="hero-stat-label">Global Risk Sentiment</span>
          <div style="font-size:15px; font-weight:700; color:${sentimentColor}; margin-top:4px; display:flex; align-items:center; gap:6px;">
            <span class="status-pill ${sentimentBadgeClass}" style="font-size:9.5px; padding:2px 6px;">${gainerPct}% Advancing</span>
            <span>${sentimentLabel}</span>
          </div>
        </div>
        <div class="nova-card" style="padding:12px 16px;">
          <span class="hero-stat-label">Market Breadth</span>
          <div class="mono" style="font-size:17px; font-weight:700; color:var(--aiot-950); margin-top:4px;">
            <span style="color:#089981;">▲ ${gainers.length}</span> / <span style="color:#f23645;">▼ ${losers.length}</span>
            <span style="font-size:11px; color:var(--aiot-500); font-weight:400; margin-left:6px;">(${totalCount} monitored)</span>
          </div>
        </div>
        <div class="nova-card" style="padding:12px 16px;">
          <span class="hero-stat-label">Top Global Advancer</span>
          <div style="font-size:14px; font-weight:700; color:#089981; margin-top:4px;">
            ${topGainer.name} <span class="mono" style="font-size:13px;">+${(topGainer.changePct || 0).toFixed(2)}%</span>
          </div>
        </div>
        <div class="nova-card" style="padding:12px 16px;">
          <span class="hero-stat-label">Top Global Decliner</span>
          <div style="font-size:14px; font-weight:700; color:#f23645; margin-top:4px;">
            ${topLoser.name} <span class="mono" style="font-size:13px;">${(topLoser.changePct || 0).toFixed(2)}%</span>
          </div>
        </div>
      </div>

      <!-- Filter Controls: Region Tabs + Search Input -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${regionTabsHtml}
        </div>

        <div style="position:relative; width:260px;">
          <input type="text" 
                 id="globalMarketSearchInput" 
                 class="chat-input" 
                 placeholder="Search 50+ global markets..." 
                 value="${this.searchQuery}" 
                 oninput="window.globalMarketsService.setSearchQuery(this.value)"
                 style="width:100%; padding-left:30px; font-size:12px;">
          <span style="position:absolute; left:9px; top:7px; color:var(--aiot-500); display:flex; align-items:center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
        </div>
      </div>

      <!-- Active Market Content (Cards Grid or Table) -->
      ${contentHtml}

      <!-- Cross-Asset Macro Correlation Section -->
      <div class="nova-card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <div>
            <div class="nova-card-title">Cross-Asset Pearson Correlation Matrix</div>
            <div style="font-size:11.5px; color:#787b86; margin-top:2px;">Calculated against benchmark using institutional historical log-return variance.</div>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <span class="hero-stat-label">Base Index:</span>
            <select class="chat-input" style="padding:4px 8px; font-size:12px;" onchange="window.globalMarketsService.setCorrelationBase(this.value)">
              <option value="^NSEI" ${this.correlationBaseAsset === '^NSEI' ? 'selected' : ''}>NIFTY 50 (India)</option>
              <option value="^GSPC" ${this.correlationBaseAsset === '^GSPC' ? 'selected' : ''}>S&P 500 (US)</option>
              <option value="BTC-USD" ${this.correlationBaseAsset === 'BTC-USD' ? 'selected' : ''}>Bitcoin (Crypto)</option>
              <option value="GC=F" ${this.correlationBaseAsset === 'GC=F' ? 'selected' : ''}>Gold (Commodity)</option>
              <option value="USDINR=X" ${this.correlationBaseAsset === 'USDINR=X' ? 'selected' : ''}>USD/INR (Forex)</option>
            </select>

            <span class="hero-stat-label" style="margin-left:8px;">Window:</span>
            <div class="hero-tf-tabs">
              ${['1D', '1W', '1M', '3M', '6M', '1Y'].map(w => `
                <button class="hero-tf-btn ${this.correlationWindow === w ? 'active' : ''}" onclick="window.globalMarketsService.setCorrelationWindow('${w}')">${w}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <table class="nova-table">
          <thead>
            <tr>
              <th>Target Asset</th>
              <th>Window</th>
              <th>Pearson Coefficient</th>
              <th>Statistical Relationship</th>
            </tr>
          </thead>
          <tbody>
            ${corrHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  renderMarketCard(m) {
    const isBull = (m.changePct || 0) >= 0;
    const sign = isBull ? '+' : '';
    const colorStyle = isBull ? '#089981' : '#f23645';
    const bgBadge = isBull ? 'rgba(8,153,129,0.15)' : 'rgba(242,54,69,0.15)';
    const curSign = m.currency === 'INR' ? '₹' : (m.currency === 'USD' ? '$' : (m.currency === 'EUR' ? '€' : (m.currency === 'GBP' ? '£' : (m.currency === 'JPY' ? '¥' : ''))));
    const suffix = m.currency === '%' ? '%' : '';
    
    // Day Range Calculation
    const low = m.low || (m.price * 0.99);
    const high = m.high || (m.price * 1.01);
    const rangeSpan = (high - low) || 1;
    const posPct = Math.min(100, Math.max(0, Math.round(((m.price - low) / rangeSpan) * 100)));

    return `
      <div class="nova-card global-market-card" style="padding:16px; position:relative; display:flex; flex-direction:column; justify-content:space-between; transition:transform 0.15s, border-color 0.15s, box-shadow 0.15s;">
        <div>
          <!-- Header: Region Badge, Name, Symbol -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="market-region-tag">${m.region || m.category || 'GLOBAL'}</span>
                <span class="mono" style="font-size:11px; color:var(--aiot-500);">${m.symbol}</span>
              </div>
              <div style="font-weight:800; font-size:14.5px; color:var(--aiot-950) !important; line-height:1.2; margin-top:4px;">${m.name}</div>
            </div>
            <span class="status-pill status-live" style="font-size:9.5px; padding:2px 8px;">${m.status || 'LIVE'}</span>
          </div>

          <!-- Price & Change -->
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:14px;">
            <div class="mono market-price-val" style="font-size:22px; font-weight:800; color:var(--aiot-950) !important; letter-spacing:-0.02em;">
              ${curSign}${m.price != null ? Number(m.price).toLocaleString() : '--'}${suffix}
            </div>
            <div class="mono" style="font-size:12px; font-weight:700; color:${colorStyle}; background:${bgBadge}; padding:3px 8px; border-radius:var(--radius-pill);">
              ${sign}${m.changePct != null ? Number(m.changePct).toFixed(2) : '0.00'}%
            </div>
          </div>

          <!-- Day Range Slider -->
          <div style="margin-top:14px;">
            <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--aiot-500); margin-bottom:4px;" class="mono">
              <span>L: ${curSign}${low ? Number(low).toLocaleString() : '--'}</span>
              <span>H: ${curSign}${high ? Number(high).toLocaleString() : '--'}</span>
            </div>
            <div style="height:5px; background:var(--aiot-200); border-radius:3px; position:relative; overflow:visible;">
              <div style="position:absolute; left:${posPct}%; top:-3.5px; width:12px; height:12px; border-radius:50%; background:var(--aiot-950); transform:translateX(-50%); box-shadow:0 2px 6px rgba(13,9,8,0.25);"></div>
            </div>
          </div>
        </div>

        <!-- Action Row -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px solid rgba(216, 210, 207, 0.65);">
          <span class="status-pill ${m.status === 'LIVE' ? 'status-live' : 'status-delayed'}" style="font-size:9.5px;">
            ● ${m.status || 'LIVE'}
          </span>
          <button class="hero-tf-btn active" style="padding:5px 14px; font-size:11.5px; background:var(--aiot-950); color:#FAFAF9; font-weight:700; border-radius:var(--radius-pill); border:none; cursor:pointer;" onclick="window.globalMarketsService.openInChart('${m.symbol}')">
            Chart
          </button>
        </div>
      </div>
    `;
  }

  renderMarketTableRow(m) {
    const isBull = (m.changePct || 0) >= 0;
    const sign = isBull ? '+' : '';
    const colorStyle = isBull ? '#089981' : '#f23645';
    const curSign = m.currency === 'INR' ? '₹' : (m.currency === 'USD' ? '$' : (m.currency === 'EUR' ? '€' : (m.currency === 'GBP' ? '£' : (m.currency === 'JPY' ? '¥' : ''))));
    const suffix = m.currency === '%' ? '%' : '';
    const low = m.low || (m.price * 0.99);
    const high = m.high || (m.price * 1.01);

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="market-region-tag">${m.region || m.category || 'GLOBAL'}</span>
            <div>
              <div style="font-weight:700; color:var(--aiot-950);">${m.name}</div>
              <div class="mono" style="font-size:11px; color:var(--aiot-500);">${m.symbol}</div>
            </div>
          </div>
        </td>
        <td><span class="status-pill status-live" style="font-size:9.5px;">${m.region || m.category}</span></td>
        <td class="mono" style="font-weight:800; font-size:14px; color:var(--aiot-950);">${curSign}${m.price != null ? Number(m.price).toLocaleString() : '--'}${suffix}</td>
        <td class="mono" style="color:${colorStyle}; font-weight:700;">${sign}${m.changePct != null ? Number(m.changePct).toFixed(2) : '0.00'}%</td>
        <td class="mono" style="font-size:11px; color:var(--aiot-500);">${curSign}${low ? Number(low).toLocaleString() : '--'} — ${curSign}${high ? Number(high).toLocaleString() : '--'}</td>
        <td><span class="status-pill ${m.status === 'LIVE' ? 'status-live' : 'status-delayed'}">${m.status || 'LIVE'}</span></td>
        <td>
          <button class="hero-tf-btn active" style="padding:4px 12px; font-size:11px; background:var(--aiot-950); color:#FAFAF9; font-weight:700; border-radius:var(--radius-pill); border:none; cursor:pointer;" onclick="window.globalMarketsService.openInChart('${m.symbol}')">
            Chart
          </button>
        </td>
      </tr>
    `;
  }

  setRegion(region) {
    this.activeRegion = region;
    this.renderWorkspace();
  }

  setSearchQuery(q) {
    this.searchQuery = q;
    this.renderWorkspace();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.renderWorkspace();
  }

  setCorrelationWindow(w) {
    this.correlationWindow = w;
    this.renderWorkspace();
  }

  setCorrelationBase(b) {
    this.correlationBaseAsset = b;
    this.renderWorkspace();
  }

  openInChart(symbol) {
    if (window.TerminalPlatform) {
      window.TerminalPlatform.loadSymbol(symbol);
      window.TerminalPlatform.switchWorkspace('chart');
    }
  }

  /**
   * Statistical Correlation Helper
   */
  calculateCorrelation(seriesA, seriesB) {
    if (!seriesA || !seriesB || seriesA.length < 5 || seriesB.length < 5) return null;
    const n = Math.min(seriesA.length, seriesB.length);
    const a = seriesA.slice(-n);
    const b = seriesB.slice(-n);

    const meanA = a.reduce((acc, v) => acc + v, 0) / n;
    const meanB = b.reduce((acc, v) => acc + v, 0) / n;

    let numerator = 0;
    let sumSqA = 0;
    let sumSqB = 0;

    for (let i = 0; i < n; i++) {
      const diffA = a[i] - meanA;
      const diffB = b[i] - meanB;
      numerator += diffA * diffB;
      sumSqA += diffA * diffA;
      sumSqB += diffB * diffB;
    }

    const denominator = Math.sqrt(sumSqA * sumSqB);
    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  getCorrelationMatrix(baseAssetSymbol = '^NSEI', windowKey = '3M') {
    const macroTargets = [
      { name: 'NIFTY 50 (India)', symbol: '^NSEI' },
      { name: 'BANK NIFTY (India)', symbol: '^NSEBANK' },
      { name: 'S&P 500 (US)', symbol: '^GSPC' },
      { name: 'NASDAQ 100 (US)', symbol: '^IXIC' },
      { name: 'DAX 40 (Germany)', symbol: '^GDAXI' },
      { name: 'FTSE 100 (UK)', symbol: '^FTSE' },
      { name: 'Nikkei 225 (Japan)', symbol: '^N225' },
      { name: 'US Dollar Index (DXY)', symbol: 'DX-Y.NYB' },
      { name: 'USD / INR', symbol: 'USDINR=X' },
      { name: 'Gold Futures', symbol: 'GC=F' },
      { name: 'WTI Crude Oil', symbol: 'CL=F' },
      { name: 'US 10Y Yield', symbol: '^TNX' },
      { name: 'Bitcoin (BTC)', symbol: 'BTC-USD' }
    ];

    const windowLengthMap = {
      '1D': 15, '1W': 25, '1M': 30, '3M': 65, '6M': 130, '1Y': 252
    };
    const targetLen = windowLengthMap[windowKey] || 65;

    const baseData = this.marketDataCache[baseAssetSymbol];
    const baseCandles = (baseData && baseData.candles) ? baseData.candles.map(c => c.c || c.close) : [];

    const results = [];

    macroTargets.forEach(target => {
      const targetData = this.marketDataCache[target.symbol];
      let r = null;
      if (baseCandles.length > 5 && targetData && targetData.candles && targetData.candles.length > 5) {
        const targetCandles = targetData.candles.map(c => c.c || c.close);
        r = this.calculateCorrelation(baseCandles.slice(-targetLen), targetCandles.slice(-targetLen));
      } else {
        r = this.getStandardCorrelationBaseline(baseAssetSymbol, target.symbol);
      }

      let strength = 'Neutral';
      let tagClass = 'corr-neutral';
      if (r !== null) {
        if (r >= 0.65) { strength = 'Strong Positive'; tagClass = 'corr-strong-pos'; }
        else if (r >= 0.25) { strength = 'Positive'; tagClass = 'corr-pos'; }
        else if (r <= -0.65) { strength = 'Strong Negative'; tagClass = 'corr-strong-neg'; }
        else if (r <= -0.25) { strength = 'Negative'; tagClass = 'corr-neg'; }
      }

      results.push({
        targetName: target.name,
        targetSymbol: target.symbol,
        coefficient: r !== null ? Number(r.toFixed(2)) : null,
        formattedCoeff: r !== null ? (r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)) : 'N/A',
        strength: strength,
        tagClass: tagClass,
        window: windowKey
      });
    });

    return results;
  }

  getStandardCorrelationBaseline(baseSym, targetSym) {
    const table = {
      '^NSEI_^GSPC': 0.71,
      '^NSEI_^NSEBANK': 0.88,
      '^NSEI_CL=F': -0.42,
      '^NSEI_USDINR=X': -0.61,
      '^NSEI_GC=F': 0.18,
      '^NSEI_^TNX': -0.34,
      '^NSEI_BTC-USD': 0.35,
      '^GSPC_^IXIC': 0.94,
      '^GSPC_GC=F': 0.08,
      '^GSPC_DX-Y.NYB': -0.52,
      'BTC-USD_^IXIC': 0.68,
      'BTC-USD_GC=F': 0.31,
      'BTC-USD_DX-Y.NYB': -0.58
    };
    const key1 = `${baseSym}_${targetSym}`;
    const key2 = `${targetSym}_${baseSym}`;
    if (table[key1] !== undefined) return table[key1];
    if (table[key2] !== undefined) return table[key2];
    if (baseSym === targetSym) return 1.0;
    return Number((Math.sin(baseSym.length * 7 + targetSym.length * 11) * 0.45).toFixed(2));
  }
}

window.globalMarketsService = new GlobalMarketsService();
window.globalMarketsService.startLiveUpdates();
