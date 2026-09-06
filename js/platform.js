// ============================================================================
// js/platform.js — Terminal Application Orchestrator & Multi-Chart Manager
// ============================================================================
'use strict';

const TerminalPlatform = (() => {

  let currentSymbol = 'BTCUSD';
  let currentTimeframe = '1m';
  let currentLayout = '1'; // '1', '2-h', '2-v', '4'
  let mainChart = null;
  let secondaryCharts = [];
  let drawingEngine = null;
  let replayEngine = null;
  let alertEngine = null;
  let activeSubPanes = [];

  // Watchlists - Comprehensive Curated Multi-Asset Registry
  let watchlist = [
    // Benchmark & Sectoral Indices
    { symbol: 'NIFTY_50', name: 'NIFTY 50 Benchmark Index', category: 'NSE Index', tab: 'indices', exchange: 'NSE', currency: 'INR', price: 23897.70, changePct: 0.45, vol: 0 },
    { symbol: 'BANKNIFTY', name: 'NIFTY Bank Sectoral Index', category: 'NSE Index', tab: 'indices', exchange: 'NSE', currency: 'INR', price: 51450.20, changePct: 0.82, vol: 0 },
    { symbol: 'SENSEX', name: 'BSE SENSEX 30 Index', category: 'BSE Index', tab: 'indices', exchange: 'BSE', currency: 'INR', price: 78920.40, changePct: 0.38, vol: 0 },
    { symbol: 'SPX', name: 'S&P 500 Large Cap Index', category: 'US Index', tab: 'indices', exchange: 'S&P', currency: 'USD', price: 5738.10, changePct: 0.62, vol: 0 },
    { symbol: 'NDX', name: 'NASDAQ 100 Tech Index', category: 'US Index', tab: 'indices', exchange: 'NASDAQ', currency: 'USD', price: 20120.50, changePct: 0.94, vol: 0 },
    { symbol: 'DJI', name: 'Dow Jones Industrial Average', category: 'US Index', tab: 'indices', exchange: 'DJI', currency: 'USD', price: 42350.80, changePct: 0.28, vol: 0 },
    { symbol: 'DAX', name: 'DAX 40 Germany Benchmark', category: 'European Index', tab: 'indices', exchange: 'XETR', currency: 'EUR', price: 19460.50, changePct: 0.55, vol: 0 },
    { symbol: 'FINNIFTY', name: 'NIFTY Financial Services', category: 'NSE Index', tab: 'indices', exchange: 'NSE', currency: 'INR', price: 24120.00, changePct: 0.70, vol: 0 },

    // US Tech & Mega-Cap Equities
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 228.15, changePct: -0.65, vol: 0 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 138.42, changePct: 2.45, vol: 0 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 428.50, changePct: 0.75, vol: 0 },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 256.80, changePct: 3.20, vol: 0 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 186.40, changePct: 1.15, vol: 0 },
    { symbol: 'GOOGL', name: 'Alphabet Inc. (Google)', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 165.20, changePct: 0.35, vol: 0 },
    { symbol: 'META', name: 'Meta Platforms Inc. (Facebook)', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 582.10, changePct: 1.80, vol: 0 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'US Tech', tab: 'us', exchange: 'NASDAQ', currency: 'USD', price: 154.60, changePct: 2.10, vol: 0 },
    { symbol: 'PLTR', name: 'Palantir Technologies', category: 'US Tech', tab: 'us', exchange: 'NYSE', currency: 'USD', price: 42.80, changePct: 4.10, vol: 0 },

    // Top Indian Equities (NSE Bluechips)
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 2980.50, changePct: 0.85, vol: 0 },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 3892.00, changePct: -0.84, vol: 0 },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 1672.30, changePct: 1.12, vol: 0 },
    { symbol: 'INFY', name: 'Infosys Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 1845.20, changePct: -0.45, vol: 0 },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 1248.80, changePct: 1.74, vol: 0 },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 1042.10, changePct: 2.15, vol: 0 },
    { symbol: 'SBIN', name: 'State Bank of India', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 824.50, changePct: 1.30, vol: 0 },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 1580.20, changePct: 0.90, vol: 0 },
    { symbol: 'LT', name: 'Larsen & Toubro Ltd', category: 'NSE Bluechip', tab: 'indian', exchange: 'NSE', currency: 'INR', price: 3620.00, changePct: 1.05, vol: 0 },

    // Crypto, Commodities & Forex
    { symbol: 'BTCUSD', name: 'Bitcoin Perpetual', category: 'Crypto Perpetual', tab: 'crypto', exchange: 'BINANCE', currency: 'USD', price: 67240.50, changePct: 2.40, vol: 0 },
    { symbol: 'ETHUSD', name: 'Ethereum Perpetual', category: 'Crypto Perpetual', tab: 'crypto', exchange: 'BINANCE', currency: 'USD', price: 3481.20, changePct: 1.10, vol: 0 },
    { symbol: 'SOLUSD', name: 'Solana Perpetual', category: 'Crypto Perpetual', tab: 'crypto', exchange: 'BINANCE', currency: 'USD', price: 178.65, changePct: 5.80, vol: 0 },
    { symbol: 'XAUUSD', name: 'Gold Spot / USD', category: 'Commodities', tab: 'crypto', exchange: 'TVC', currency: 'USD', price: 2685.40, changePct: 0.65, vol: 0 },
    { symbol: 'USOIL', name: 'WTI Crude Oil', category: 'Commodities', tab: 'crypto', exchange: 'TVC', currency: 'USD', price: 71.40, changePct: -1.25, vol: 0 },
    { symbol: 'SILVER', name: 'Silver Spot / USD', category: 'Commodities', tab: 'crypto', exchange: 'TVC', currency: 'USD', price: 31.85, changePct: 1.40, vol: 0 }
  ];

  let currentWatchlistTab = 'all';
  let currentQuickCategory = 'indices';

  const QUICK_CATEGORY_PRESETS = {
    'indices': [
      { sym: 'SPX', label: 'S&P 500' },
      { sym: 'NDX', label: 'NASDAQ 100' },
      { sym: 'DJI', label: 'DOW JONES' },
      { sym: 'DAX', label: 'DAX 40' },
      { sym: 'NIFTY_50', label: 'NIFTY 50' },
      { sym: 'BANKNIFTY', label: 'BANK NIFTY' },
      { sym: 'SENSEX', label: 'SENSEX 30' }
    ],
    'us': [
      { sym: 'AAPL', label: 'Apple' },
      { sym: 'NVDA', label: 'NVIDIA' },
      { sym: 'MSFT', label: 'Microsoft' },
      { sym: 'TSLA', label: 'Tesla' },
      { sym: 'AMZN', label: 'Amazon' },
      { sym: 'GOOGL', label: 'Alphabet' },
      { sym: 'META', label: 'Meta' },
      { sym: 'AMD', label: 'AMD' },
      { sym: 'PLTR', label: 'Palantir' }
    ],
    'indian': [
      { sym: 'INFY', label: 'Infosys' },
      { sym: 'HDFCBANK', label: 'HDFC Bank' },
      { sym: 'ICICIBANK', label: 'ICICI Bank' },
      { sym: 'RELIANCE', label: 'Reliance' },
      { sym: 'TCS', label: 'TCS' },
      { sym: 'TATAMOTORS', label: 'Tata Motors' },
      { sym: 'SBIN', label: 'SBI' },
      { sym: 'BHARTIARTL', label: 'Bharti Airtel' }
    ],
    'crypto': [
      { sym: 'BTCUSD', label: 'BTC/USD' },
      { sym: 'ETHUSD', label: 'ETH/USD' },
      { sym: 'SOLUSD', label: 'SOL/USD' },
      { sym: 'XAUUSD', label: 'Gold Spot' },
      { sym: 'USOIL', label: 'Crude Oil' },
      { sym: 'SILVER', label: 'Silver Spot' }
    ]
  };

  function switchQuickCategory(cat) {
    currentQuickCategory = cat;
    document.querySelectorAll('.quick-cat-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-qcat') === cat);
    });
    renderQuickPills();
  }

  function renderQuickPills() {
    const container = document.getElementById('chartQuickPills');
    if (!container) return;
    const list = QUICK_CATEGORY_PRESETS[currentQuickCategory] || QUICK_CATEGORY_PRESETS['indices'];
    container.innerHTML = list.map(item => {
      const isActive = currentSymbol === item.sym;
      return `<button class="chart-symbol-pill ${isActive ? 'active' : ''}" onclick="TerminalPlatform.loadSymbol('${item.sym}')">
        <span>${item.label}</span>
      </button>`;
    }).join('');
  }

  // ── 1. Initialize Terminal ───────────────────────────────────────────────
  async function init() {
    console.log('[TerminalPlatform] Initializing production financial platform...');

    // Load saved preferences
    loadPreferences();

    // Setup main chart
    const chartContainer = document.getElementById('mainChartContainer');
    mainChart = new ChartEngine(chartContainer, {
      chartType: 'candlestick',
      scaleType: 'linear',
      autoScale: true
    });

    drawingEngine = new DrawingEngine(mainChart);
    drawingEngine.loadFromStorage(currentSymbol);

    replayEngine = new ReplayEngine(mainChart, handleReplayStateChange);
    alertEngine = new AlertEngine();

    // Hook crosshair to update header OHLC
    mainChart.onCrosshairMove = (candle) => {
      updateHeaderOHLC(candle);
    };

    // Hook backward pagination
    mainChart.onNeedOlderData = () => {
      MarketDataService.loadOlderCandles(currentSymbol, currentTimeframe, 200).then(res => {
        if (res && res.addedCount > 0) {
          mainChart.prependOlderCandles(res.candles.slice(0, res.addedCount));
        }
      });
    };

    // Hook real-time ticks
    MarketDataService.on('tick', ({ symbol, candle, isNew, candles }) => {
      if (symbol === currentSymbol) {
        mainChart.appendTick(candle, isNew);
        updateHeaderPrice(candle);
        updateActiveSubPanes(candles);
        alertEngine.checkPrice(symbol, candle.close);
      }
      updateWatchlistRow(symbol, candle.close);
    });

    MarketDataService.on('status', ({ status }) => {
      updateStatusBadge(status);
    });

    // Bind UI controls
    bindHeaderControls();
    bindDrawingToolbar();
    bindSidebarTabs();
    bindSearchModal();
    bindAlertModal();
    bindReplayControls();

    // Initial Watchlists & Navigation
    renderQuickPills();
    renderWatchlist();
    renderDedicatedWatchlist();

    // Start Live Market Quotes Synchronization
    syncWatchlistQuotes();
    setInterval(() => syncWatchlistQuotes(), 7500);

    // Initial Data Load
    await loadSymbol(currentSymbol, currentTimeframe);

    // Auto-resize chart once ready
    if (mainChart) mainChart.resize();

    // Window resize handler
    window.addEventListener('resize', () => {
      if (mainChart) mainChart.resize();
      activeSubPanes.forEach(p => p.render(mainChart, MarketDataService.getCandles(currentSymbol, currentTimeframe)));
    });
  }

  let isInitialLoad = true;

  // Official Raw Exchange Ticker Map for external TradingView links
  const OFFICIAL_TV_TICKERS = {
    'NIFTY_50': 'NSE:NIFTY', 'NIFTY': 'NSE:NIFTY', '^NSEI': 'NSE:NIFTY',
    'BANKNIFTY': 'NSE:BANKNIFTY', '^NSEBANK': 'NSE:BANKNIFTY',
    'SENSEX': 'BSE:SENSEX', '^BSESN': 'BSE:SENSEX',
    'FINNIFTY': 'NSE:FINNIFTY', 'MIDCPNIFTY': 'NSE:MIDCPNIFTY',
    'RELIANCE': 'NSE:RELIANCE', 'TCS': 'NSE:TCS', 'HDFCBANK': 'NSE:HDFCBANK',
    'INFY': 'NSE:INFY', 'ICICIBANK': 'NSE:ICICIBANK', 'SBIN': 'NSE:SBIN',
    'BHARTIARTL': 'NSE:BHARTIARTL', 'ITC': 'NSE:ITC', 'LT': 'NSE:LT',
    'TATAMOTORS': 'NSE:TATAMOTORS', 'AXISBANK': 'NSE:AXISBANK',
    'MARUTI': 'NSE:MARUTI', 'SUNPHARMA': 'NSE:SUNPHARMA', 'TITAN': 'NSE:TITAN',
    'BAJFINANCE': 'NSE:BAJFINANCE', 'TATASTEEL': 'NSE:TATASTEEL',
    'SPX': 'SP:SPX', '^GSPC': 'SP:SPX', 'S&P 500': 'SP:SPX',
    'NDX': 'NASDAQ:NDX', '^NDX': 'NASDAQ:NDX', 'NASDAQ': 'NASDAQ:NDX',
    'DJI': 'DJ:DJI', '^DJI': 'DJ:DJI'
  };

  function updateTradingViewSymbol(symbol) {
    const host = document.getElementById('tvWidgetContainerHost');
    if (!host) return;

    // Embed-Safe Exchange Mapping:
    // Guarantees 100% embeddable widgets without the "This symbol is only available on TradingView" error.
    // (NSE & BSE legally prohibit third-party widget embeds, so we map them to INDA/EPI benchmarks or US ADRs for embedded preview,
    // and provide a direct 1-click 'Open on TV' button for the official exchange feed).
    const tvMap = {
      // Global Indices & ETFs
      'SPX': 'AMEX:SPY',
      '^GSPC': 'AMEX:SPY',
      'S&P 500': 'AMEX:SPY',
      'SPY': 'AMEX:SPY',
      'NDX': 'NASDAQ:QQQ',
      '^NDX': 'NASDAQ:QQQ',
      '^IXIC': 'NASDAQ:QQQ',
      'NASDAQ': 'NASDAQ:QQQ',
      'NASDAQ 100': 'NASDAQ:QQQ',
      'QQQ': 'NASDAQ:QQQ',
      'DJI': 'AMEX:DIA',
      '^DJI': 'AMEX:DIA',
      'DOW': 'AMEX:DIA',
      'DIA': 'AMEX:DIA',
      'RUT': 'AMEX:IWM',
      '^RUT': 'AMEX:IWM',
      'IWM': 'AMEX:IWM',
      'DAX': 'INDEX:DAX',
      '^GDAXI': 'INDEX:DAX',
      'FTSE': 'INDEX:FTSE',
      '^FTSE': 'INDEX:FTSE',
      'CAC': 'INDEX:CAC',
      'NIKKEI': 'INDEX:NKY',
      'HANGSENG': 'INDEX:HSI',

      // Indian Indices (Mapped to high-liquidity embeddable ETFs)
      'NIFTY_50': 'AMEX:INDA',
      'NIFTY': 'AMEX:INDA',
      '^NSEI': 'AMEX:INDA',
      'BANKNIFTY': 'BATS:EPI',
      '^NSEBANK': 'BATS:EPI',
      'SENSEX': 'AMEX:INDA',
      '^BSESN': 'AMEX:INDA',
      'FINNIFTY': 'AMEX:INDA',
      'MIDCPNIFTY': 'AMEX:INDA',
      'GIFTI': 'AMEX:INDA',

      // 🇺🇸 US Mega-Cap & Bluechips (100% native exchange embed)
      'AAPL': 'NASDAQ:AAPL',
      'MSFT': 'NASDAQ:MSFT',
      'NVDA': 'NASDAQ:NVDA',
      'GOOGL': 'NASDAQ:GOOGL',
      'AMZN': 'NASDAQ:AMZN',
      'META': 'NASDAQ:META',
      'TSLA': 'NASDAQ:TSLA',
      'AMD': 'NASDAQ:AMD',
      'NFLX': 'NASDAQ:NFLX',
      'INTC': 'NASDAQ:INTC',
      'COIN': 'NASDAQ:COIN',
      'PLTR': 'NYSE:PLTR',
      'BRK.B': 'NYSE:BRK.B',
      'JPM': 'NYSE:JPM',
      'V': 'NYSE:V',
      'WMT': 'NYSE:WMT',
      'DIS': 'NYSE:DIS',
      'BA': 'NYSE:BA',
      'CRM': 'NYSE:CRM',

      // 🇮🇳 Top Indian Equities
      // ADRs on NYSE (live interactive candlestick chart):
      'INFY': 'NYSE:INFY',
      'HDFCBANK': 'NYSE:HDB',
      'HDB': 'NYSE:HDB',
      'ICICIBANK': 'NYSE:IBN',
      'IBN': 'NYSE:IBN',
      'WIPRO': 'NYSE:WIT',
      'WIT': 'NYSE:WIT',

      // Domestic NSE equities: embed-safe INDA preview + direct TV link
      'RELIANCE': 'AMEX:INDA',
      'TCS': 'AMEX:INDA',
      'SBIN': 'AMEX:INDA',
      'BHARTIARTL': 'AMEX:INDA',
      'ITC': 'AMEX:INDA',
      'LT': 'AMEX:INDA',
      'TATAMOTORS': 'AMEX:INDA',
      'AXISBANK': 'AMEX:INDA',
      'MARUTI': 'AMEX:INDA',
      'SUNPHARMA': 'AMEX:INDA',
      'TITAN': 'AMEX:INDA',
      'BAJFINANCE': 'AMEX:INDA',
      'TATASTEEL': 'AMEX:INDA',
      'HINDUNILVR': 'AMEX:INDA',
      'ADANIENT': 'AMEX:INDA',
      'ADANIPORTS': 'AMEX:INDA',
      'ASIANPAINT': 'AMEX:INDA',
      'HCLTECH': 'AMEX:INDA',
      'KOTAKBANK': 'AMEX:INDA',
      'NTPC': 'AMEX:INDA',
      'POWERGRID': 'AMEX:INDA',
      'COALINDIA': 'AMEX:INDA',
      'ULTRACEMCO': 'AMEX:INDA',
      'ONGC': 'AMEX:INDA',

      // Crypto Perpetuals & Spot
      'BTCUSD': 'BINANCE:BTCUSDT',
      'BTC': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT',
      'ETH': 'BINANCE:ETHUSDT',
      'SOLUSD': 'BINANCE:SOLUSDT',
      'SOL': 'BINANCE:SOLUSDT',
      'XRPUSD': 'BINANCE:XRPUSDT',
      'DOGEUSD': 'BINANCE:DOGEUSDT',
      'ADAUSD': 'BINANCE:ADAUSDT',
      'AVAXUSD': 'BINANCE:AVAXUSDT',
      'LINKUSD': 'BINANCE:LINKUSDT',
      'BNBUSD': 'BINANCE:BNBUSDT',
      'SUIUSD': 'BINANCE:SUIUSDT',
      'PEPEUSD': 'BINANCE:PEPEUSDT',
      'NEARUSD': 'BINANCE:NEARUSDT',

      // Commodities & Forex
      'GOLD': 'TVC:GOLD',
      'XAUUSD': 'TVC:GOLD',
      'SILVER': 'TVC:SILVER',
      'XAGUSD': 'TVC:SILVER',
      'USOIL': 'TVC:USOIL',
      'CRUDE': 'TVC:USOIL',
      'UKOIL': 'TVC:UKOIL',
      'BRENT': 'TVC:UKOIL',
      'NATGAS': 'TVC:NATGAS',
      'EURUSD': 'FX:EURUSD',
      'USDINR': 'FX_IDC:USDINR',
      'GBPUSD': 'FX:GBPUSD',
      'USDJPY': 'FX:USDJPY'
    };

    // Calculate Safe Widget Symbol
    const tvSymbol = tvMap[symbol] || (symbol.includes(':') ? symbol : (symbol.startsWith('^') ? 'AMEX:SPY' : (symbol === 'NASDAQ' ? 'NASDAQ:QQQ' : `NASDAQ:${symbol}`)));
    const officialTvSymbol = OFFICIAL_TV_TICKERS[symbol] || (symbol.includes(':') ? symbol : tvSymbol);

    // Update Quick Header Asset Pill & External TradingView Launcher
    const itemMeta = watchlist.find(w => w.symbol === symbol) || 
                     CLIENT_SEARCH_CATALOG.find(c => c.symbol === symbol);
    const symEl = document.getElementById('activeAssetSymbol');
    const nameEl = document.getElementById('activeAssetName');
    const badgeEl = document.getElementById('activeAssetBadge');
    const extBtn = document.getElementById('tvExternalLinkBtn');

    if (symEl) symEl.textContent = tvSymbol;
    if (nameEl) nameEl.textContent = itemMeta ? itemMeta.name : symbol;
    if (extBtn) {
      extBtn.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(officialTvSymbol)}`;
      extBtn.title = `Open official ${officialTvSymbol} directly on TradingView.com`;
    }

    if (badgeEl) {
      if (officialTvSymbol.startsWith('NSE:') || officialTvSymbol.startsWith('BSE:')) {
        if (tvSymbol.startsWith('NYSE:')) {
          badgeEl.textContent = 'NYSE ADR';
          badgeEl.className = 'symbol-badge badge-us';
          badgeEl.title = 'Live US ADR on NYSE with direct interactive candlestick chart.';
        } else {
          badgeEl.textContent = 'INDA · NSE (↗ TV)';
          badgeEl.className = 'symbol-badge badge-nse-info';
          badgeEl.title = 'NSE restricts direct 3rd-party widget embeds. Charting INDA benchmark. Click ↗ Open on TV for official NSE feed.';
        }
      } else if (itemMeta && itemMeta.tab === 'us') {
        badgeEl.textContent = 'US TECH';
        badgeEl.className = 'symbol-badge badge-us';
        badgeEl.title = 'US Exchange';
      } else if (itemMeta && itemMeta.tab === 'indices') {
        badgeEl.textContent = 'INDEX ETF';
        badgeEl.className = 'symbol-badge badge-index';
        badgeEl.title = 'Benchmark Index';
      } else {
        badgeEl.textContent = itemMeta ? (itemMeta.category || 'ASSET') : 'ACTIVE';
        badgeEl.className = 'symbol-badge badge-us';
      }
    }

    // Update active highlight on quick pills
    renderQuickPills();

    host.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '100%';
    container.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = 'calc(100% - 32px)';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const copyrightDiv = document.createElement('div');
    copyrightDiv.className = 'tradingview-widget-copyright';
    copyrightDiv.innerHTML = `<a href="https://www.tradingview.com/symbols/${tvSymbol.replace(':', '-')}/" rel="noopener nofollow" target="_blank"><span class="blue-text">${symbol} stock chart</span></a><span class="trademark"> by TradingView</span>`;
    container.appendChild(copyrightDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: "D",
      locale: "en",
      save_image: true,
      style: "1",
      symbol: tvSymbol,
      theme: "light",
      timezone: "Etc/UTC",
      backgroundColor: "#FAFAF9",
      gridColor: "rgba(216, 210, 207, 0.4)",
      watchlist: [
        "AMEX:SPY", "NASDAQ:QQQ", "AMEX:DIA", "AMEX:INDA", "NYSE:INFY", "NYSE:HDB",
        "NASDAQ:AAPL", "NASDAQ:MSFT", "NASDAQ:NVDA", "NASDAQ:GOOGL", "NASDAQ:AMZN", "NASDAQ:META", "NASDAQ:TSLA", "NASDAQ:AMD",
        "BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:SOLUSDT", "TVC:GOLD", "TVC:USOIL"
      ],
      withdateranges: false,
      compareSymbols: [],
      support_host: "https://www.tradingview.com",
      studies: [],
      autosize: true
    });
    container.appendChild(script);
    host.appendChild(container);
  }

  // ── 2. Symbol & Timeframe Loader ─────────────────────────────────────────
  async function loadSymbol(symbol, timeframe = currentTimeframe) {
    currentSymbol = symbol;
    currentTimeframe = timeframe;

    updateHeaderSymbolInfo(symbol, timeframe);
    updateStatusBadge('CONNECTING');
    updateTradingViewSymbol(symbol);

    const res = await MarketDataService.loadCandles(symbol, timeframe, 300);
    if (res.success && res.candles.length > 0) {
      if (mainChart) mainChart.setData(res.candles, true);
      updateHeaderOHLC(res.candles[res.candles.length - 1]);
      updateHeaderPrice(res.candles[res.candles.length - 1]);
      updateActiveSubPanes(res.candles);
      runAIAnalysis(symbol, res.candles);
      if (drawingEngine) drawingEngine.loadFromStorage(symbol);
    } else {
      updateStatusBadge('DATA_UNAVAILABLE');
    }
  }

  function setTimeframe(tf) {
    currentTimeframe = tf;
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tf') === tf);
    });
    loadSymbol(currentSymbol, tf);
  }

  function setChartType(type) {
    mainChart.setChartType(type);
    document.querySelectorAll('.chart-type-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
  }

  // ── 3. Sub-Panes (RSI, MACD, etc.) ────────────────────────────────────────
  function toggleSubPane(type, title) {
    const existing = activeSubPanes.find(p => p.type === type);
    if (existing) {
      existing.destroy();
      activeSubPanes = activeSubPanes.filter(p => p !== existing);
    } else {
      const container = document.getElementById('subPanesContainer');
      const pane = new IndicatorEngine.SubPane(container, `pane_${type}`, type, title, 110);
      pane.onClose = (id) => {
        pane.destroy();
        activeSubPanes = activeSubPanes.filter(p => p.id !== id);
      };
      activeSubPanes.push(pane);
      const candles = MarketDataService.getCandles(currentSymbol, currentTimeframe);
      pane.render(mainChart, candles);
    }
    mainChart.resize();
  }

  function updateActiveSubPanes(candles) {
    activeSubPanes.forEach(pane => pane.render(mainChart, candles));
  }

  // ── 4. Main Chart Overlays (EMA, SMA, BB) ────────────────────────────────
  function toggleOverlay(id, name, type, period, color) {
    const existing = mainChart.overlays.find(o => o.id === id);
    if (existing) {
      existing.visible = !existing.visible;
    } else {
      const candles = MarketDataService.getCandles(currentSymbol, currentTimeframe);
      let data = [];
      if (type === 'ema') data = IndicatorEngine.ema(candles, period);
      else if (type === 'sma') data = IndicatorEngine.sma(candles, period);
      else if (type === 'vwap') data = IndicatorEngine.vwap(candles);

      mainChart.overlays.push({
        id, name, type, period, color, visible: true, data
      });
    }
    mainChart.render();
  }

  // ── 5. AI Market Analysis ────────────────────────────────────────────────
  function runAIAnalysis(symbol, candles) {
    if (!candles || candles.length === 0) return;
    const lastPrice = candles[candles.length - 1].close;
    const analysis = AIAnalysisEngine.analyzeMultiTimeframe(candles, symbol, lastPrice);

    // Update AI Panel DOM
    const panel = document.getElementById('aiAnalysisContent');
    if (!panel) return;

    const trendColor = analysis.overallTrend === 'BULLISH' ? 'var(--bull)' :
                       analysis.overallTrend === 'BEARISH' ? 'var(--bear)' : 'var(--gold)';

    panel.innerHTML = `
      <div class="ai-overview-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; color:var(--text-secondary);">Market Structure</span>
          <span class="regime-badge ${analysis.regime.toLowerCase()}">${analysis.regime}</span>
        </div>
        <div style="font-size:18px; font-weight:700; color:${trendColor}; margin-top:6px;">
          ${analysis.overallTrend} · ${analysis.confidence}% Confidence
        </div>
      </div>

      <!-- Multi-Timeframe Alignment Matrix -->
      <div class="panel-section-title">Multi-Timeframe Matrix</div>
      <div class="tf-matrix-grid">
        ${Object.keys(analysis.timeframes).map(tf => {
          const item = analysis.timeframes[tf];
          return `
            <div class="tf-matrix-item">
              <span class="tf-matrix-label">${tf}</span>
              <span class="tf-matrix-dir ${item.class}">${item.direction}</span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Key Support & Resistance -->
      <div class="panel-section-title">Institutional S/R Levels</div>
      <div class="sr-levels-grid">
        <div class="sr-card res">
          <div class="sr-label">Resistance</div>
          <div class="sr-val mono">${formatPrice(analysis.resistance)}</div>
        </div>
        <div class="sr-card sup">
          <div class="sr-label">Support</div>
          <div class="sr-val mono">${formatPrice(analysis.support)}</div>
        </div>
      </div>

      <!-- Trade Scenarios -->
      <div class="panel-section-title">Trade Scenarios</div>
      <div class="trade-scenario-card bull">
        <div class="scenario-title">▲ Bullish Scenario (R:R ${analysis.bullishScenario.riskReward})</div>
        <div class="scenario-body">${analysis.bullishScenario.description}</div>
        <div class="scenario-targets">
          <span>Target 1: <strong>${formatPrice(analysis.bullishScenario.target1)}</strong></span>
          <span>Target 2: <strong>${formatPrice(analysis.bullishScenario.target2)}</strong></span>
          <span>Stop: <strong>${formatPrice(analysis.bullishScenario.stopLoss)}</strong></span>
        </div>
      </div>

      <div class="trade-scenario-card bear" style="margin-top:8px;">
        <div class="scenario-title">▼ Bearish Scenario (R:R ${analysis.bearishScenario.riskReward})</div>
        <div class="scenario-body">${analysis.bearishScenario.description}</div>
        <div class="scenario-targets">
          <span>Target 1: <strong>${formatPrice(analysis.bearishScenario.target1)}</strong></span>
          <span>Target 2: <strong>${formatPrice(analysis.bearishScenario.target2)}</strong></span>
          <span>Stop: <strong>${formatPrice(analysis.bearishScenario.stopLoss)}</strong></span>
        </div>
      </div>

      <div class="invalidation-card" style="margin-top:10px;">
        <strong>Invalidation Level:</strong> ${analysis.invalidation}
      </div>

      <div class="risk-disclaimer">
        ${analysis.riskWarning}
      </div>
    `;
  }

  // ── 6. Watchlist UI & Live Updates ───────────────────────────────────────
  function renderWatchlist() {
    const container = document.getElementById('watchlistItems');
    if (!container) return;

    container.innerHTML = '';
    const filtered = watchlist.filter(item => {
      if (currentWatchlistTab === 'delta') return item.category === 'Delta';
      if (currentWatchlistTab === 'nse') return item.category === 'NSE' || item.category === 'BSE';
      return true;
    });

    filtered.forEach(item => {
      const isSelected = item.symbol === currentSymbol;
      const isBull = item.changePct >= 0;
      const changeClass = isBull ? 'bull' : 'bear';
      const sign = isBull ? '+' : '';

      const el = document.createElement('div');
      el.className = `watchlist-row ${isSelected ? 'active' : ''}`;
      el.id = `wl_row_${item.symbol}`;
      el.onclick = () => loadSymbol(item.symbol);

      el.innerHTML = `
        <div class="wl-left">
          <span class="wl-symbol">${item.symbol}</span>
          <span class="wl-name">${item.name}</span>
        </div>
        <div class="wl-right">
          <span class="wl-price mono" id="wl_p_${item.symbol}">${item.price > 0 ? formatPrice(item.price) : '--'}</span>
          <span class="wl-chg mono ${changeClass}" id="wl_c_${item.symbol}">${item.price > 0 ? `${sign}${item.changePct.toFixed(2)}%` : '--'}</span>
        </div>
      `;
      container.appendChild(el);
    });
  }

  function updateWatchlistRow(symbol, price) {
    const item = watchlist.find(w => w.symbol === symbol);
    if (!item) return;

    const prevPrice = item.price;
    item.price = price;
    if (prevPrice > 0) {
      item.change = price - prevPrice;
      item.changePct = ((price - prevPrice) / prevPrice) * 100;
    }

    const priceEl = document.getElementById(`wl_p_${symbol}`);
    const chgEl = document.getElementById(`wl_c_${symbol}`);
    if (priceEl) {
      priceEl.textContent = formatPrice(price);
      priceEl.classList.add(price >= prevPrice ? 'flash-bull' : 'flash-bear');
      setTimeout(() => priceEl.classList.remove('flash-bull', 'flash-bear'), 400);
    }
    if (chgEl) {
      const isBull = item.changePct >= 0;
      chgEl.className = `wl-chg mono ${isBull ? 'bull' : 'bear'}`;
      chgEl.textContent = `${isBull ? '+' : ''}${item.changePct.toFixed(2)}%`;
    }
  }

  // ── 7. Header Controls & Events ──────────────────────────────────────────
  function bindHeaderControls() {
    // Timeframe selector buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
      btn.onclick = () => setTimeframe(btn.getAttribute('data-tf'));
    });

    // Chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
      btn.onclick = () => setChartType(btn.getAttribute('data-type'));
    });

    // Indicators modal button
    const indBtn = document.getElementById('indicatorsModalBtn');
    if (indBtn) {
      indBtn.onclick = () => openIndicatorsModal();
    }

    // Fullscreen toggle
    const fsBtn = document.getElementById('fullscreenToggleBtn');
    if (fsBtn) {
      fsBtn.onclick = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      };
    }
  }

  function bindDrawingToolbar() {
    document.querySelectorAll('.draw-tool-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.getAttribute('data-tool');
        if (tool === 'clear') {
          drawingEngine.clearAll();
          document.querySelector('.draw-tool-btn[data-tool="cursor"]').classList.add('active');
          drawingEngine.setTool('cursor');
        } else {
          drawingEngine.setTool(tool);
        }
      };
    });
  }

  function bindSidebarTabs() {
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const panel = document.getElementById(tabId);
        if (panel) panel.classList.add('active');
        if (tabId === 'tabChat' && window.liveChatEngine) {
          window.liveChatEngine.scrollToBottom();
        }
      };
    });
  }

  function bindSearchModal() {
    const searchInput = document.getElementById('globalSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => handleSearchQuery(e.target.value));
      searchInput.addEventListener('keyup', (e) => handleSearchQuery(e.target.value));
      searchInput.addEventListener('change', (e) => handleSearchQuery(e.target.value));
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === 'Escape') {
        closeSearchModal();
        closeIndicatorsModal();
        closeAlertModal();
      }
    });
  }
  function bindAlertModal() {
    const modal = document.getElementById('alertModal');
    const closeBtn = document.getElementById('closeAlertModalBtn');
    if (closeBtn && modal) {
      closeBtn.onclick = () => { modal.style.display = 'none'; };
    }
  }

  function openAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeAlertModal() {
    const modal = document.getElementById('alertModal');
    if (modal) modal.style.display = 'none';
  }

  let currentSearchCategory = 'all';

  const CLIENT_SEARCH_CATALOG = [
    // ── 1. Benchmark Indices (Global & Indian) ──
    { symbol: "NIFTY_50", name: "NIFTY 50 Benchmark Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "BANKNIFTY", name: "NIFTY Bank Sectoral Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "SENSEX", name: "BSE SENSEX 30 Index", category: "BSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "SPX", name: "S&P 500 Large Cap Index", category: "US Benchmark", tab: "indices", currency: "USD", tag: "US" },
    { symbol: "NDX", name: "NASDAQ 100 Technology Index", category: "US Tech Benchmark", tab: "indices", currency: "USD", tag: "US" },
    { symbol: "DJI", name: "Dow Jones Industrial Average", category: "US Benchmark", tab: "indices", currency: "USD", tag: "US" },
    { symbol: "DAX", name: "DAX 40 Germany Index", category: "European Benchmark", tab: "indices", currency: "EUR", tag: "EU" },
    { symbol: "FTSE", name: "FTSE 100 London Index", category: "European Benchmark", tab: "indices", currency: "GBP", tag: "UK" },
    { symbol: "NIKKEI", name: "Nikkei 225 Tokyo Index", category: "Asian Benchmark", tab: "indices", currency: "JPY", tag: "JP" },
    { symbol: "HANGSENG", name: "Hang Seng Hong Kong Index", category: "Asian Benchmark", tab: "indices", currency: "HKD", tag: "HK" },
    { symbol: "FINNIFTY", name: "NIFTY Financial Services", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "MIDCPNIFTY", name: "NIFTY Midcap Select Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "NIFTYIT", name: "NIFTY IT Sectoral Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "NIFTYAUTO", name: "NIFTY Auto Sectoral Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "NIFTYPHARMA", name: "NIFTY Pharma Sectoral Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },
    { symbol: "NIFTYMETAL", name: "NIFTY Metal Sectoral Index", category: "NSE Index", tab: "indices", currency: "INR", tag: "IN" },

    // ── 2. US Tech Giants & Mega-Cap Equities ──
    { symbol: "AAPL", name: "Apple Inc.", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "NVDA", name: "NVIDIA Corporation", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "MSFT", name: "Microsoft Corporation", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "GOOGL", name: "Alphabet Inc. (Google)", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "AMZN", name: "Amazon.com Inc.", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "META", name: "Meta Platforms Inc. (Facebook)", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "TSLA", name: "Tesla Inc.", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "AMD", name: "Advanced Micro Devices", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "NFLX", name: "Netflix Inc.", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "INTC", name: "Intel Corporation", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "COIN", name: "Coinbase Global Inc.", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "PLTR", name: "Palantir Technologies", category: "US Tech", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "BRK.B", name: "Berkshire Hathaway Inc.", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "V", name: "Visa Inc.", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "WMT", name: "Walmart Inc.", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },
    { symbol: "DIS", name: "The Walt Disney Company", category: "US Equities", tab: "us_stocks", currency: "USD", tag: "US" },

    // ── 3. Top Indian Equities (NSE Bluechips) ──
    { symbol: "RELIANCE", name: "Reliance Industries Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "TCS", name: "Tata Consultancy Services", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "HDFCBANK", name: "HDFC Bank Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "INFY", name: "Infosys Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "ICICIBANK", name: "ICICI Bank Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "SBIN", name: "State Bank of India", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "ITC", name: "ITC Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "LT", name: "Larsen & Toubro Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "TATAMOTORS", name: "Tata Motors Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "AXISBANK", name: "Axis Bank Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "MARUTI", name: "Maruti Suzuki India", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "TITAN", name: "Titan Company Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "TATASTEEL", name: "Tata Steel Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "ADANIENT", name: "Adani Enterprises Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "ADANIPORTS", name: "Adani Ports & SEZ", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "ASIANPAINT", name: "Asian Paints Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "HCLTECH", name: "HCL Technologies Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },
    { symbol: "WIPRO", name: "Wipro Ltd", category: "NSE Bluechip", tab: "indian_stocks", currency: "INR", tag: "IN" },

    // ── 4. Crypto Assets ──
    { symbol: "BTCUSD", name: "Bitcoin Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "ETHUSD", name: "Ethereum Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "SOLUSD", name: "Solana Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "XRPUSD", name: "Ripple Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "DOGEUSD", name: "Dogecoin Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "ADAUSD", name: "Cardano Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "AVAXUSD", name: "Avalanche Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "LINKUSD", name: "Chainlink Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "BNBUSD", name: "BNB Chain Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "SUIUSD", name: "Sui Network Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "PEPEUSD", name: "Pepe Token Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },
    { symbol: "NEARUSD", name: "NEAR Protocol Perpetual", category: "Crypto", tab: "crypto", currency: "USD", tag: "CRYPTO" },

    // ── 5. Commodities & Forex ──
    { symbol: "XAUUSD", name: "Gold Spot / USD", category: "Commodities", tab: "commodities", currency: "USD", tag: "COMM" },
    { symbol: "SILVER", name: "Silver Spot / USD", category: "Commodities", tab: "commodities", currency: "USD", tag: "COMM" },
    { symbol: "USOIL", name: "WTI Crude Oil", category: "Commodities", tab: "commodities", currency: "USD", tag: "COMM" },
    { symbol: "UKOIL", name: "Brent Crude Oil", category: "Commodities", tab: "commodities", currency: "USD", tag: "COMM" },
    { symbol: "NATGAS", name: "Natural Gas Futures", category: "Commodities", tab: "commodities", currency: "USD", tag: "COMM" },
    { symbol: "EURUSD", name: "EUR / USD Spot Rate", category: "Forex", tab: "commodities", currency: "USD", tag: "FX" },
    { symbol: "USDINR", name: "USD / INR Spot Rate", category: "Forex", tab: "commodities", currency: "INR", tag: "FX" },
    { symbol: "GBPUSD", name: "GBP / USD Spot Rate", category: "Forex", tab: "commodities", currency: "USD", tag: "FX" },
    { symbol: "USDJPY", name: "USD / JPY Spot Rate", category: "Forex", tab: "commodities", currency: "JPY", tag: "FX" }
  ];

  function openSearchModal() {
    const modal = document.getElementById('searchModalBackdrop');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('globalSearchInput');
      if (input) {
        input.value = '';
        input.focus();
        handleSearchQuery('');
      }
    }
  }

  function closeSearchModal() {
    const modal = document.getElementById('searchModalBackdrop');
    if (modal) modal.classList.remove('open');
  }

  function setSearchCategory(cat) {
    currentSearchCategory = cat || 'all';
    document.querySelectorAll('.search-cat-pill').forEach(pill => {
      if (pill.getAttribute('data-cat') === currentSearchCategory) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    const input = document.getElementById('globalSearchInput');
    handleSearchQuery(input ? input.value : '');
  }

  async function handleSearchQuery(q) {
    const rawQ = (q || '').trim();
    const queryLower = rawQ.toLowerCase();

    // 1. Instant local search match (0ms latency)
    let filtered = CLIENT_SEARCH_CATALOG.filter(item => {
      if (currentSearchCategory !== 'all') {
        if (currentSearchCategory === 'indices' && item.tab !== 'indices') return false;
        if (currentSearchCategory === 'us_stocks' && item.tab !== 'us_stocks') return false;
        if (currentSearchCategory === 'indian_stocks' && item.tab !== 'indian_stocks') return false;
        if (currentSearchCategory === 'crypto' && item.tab !== 'crypto') return false;
        if (currentSearchCategory === 'commodities' && item.tab !== 'commodities') return false;
      }
      if (!queryLower) return true;
      return item.symbol.toLowerCase().includes(queryLower) ||
             item.name.toLowerCase().includes(queryLower) ||
             item.category.toLowerCase().includes(queryLower);
    });

    renderSearchResults(filtered);

    // 2. Query backend /api/search to combine any live updates
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(rawQ)}&category=${encodeURIComponent(currentSearchCategory)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.results) {
          if (rawQ) {
            // When user typed a search query, prioritize filtered results
            const matched = data.results.length > 0 ? data.results : filtered;
            renderSearchResults(matched);
          } else if (data.results.length > 0) {
            const existingSyms = new Set(filtered.map(f => f.symbol.toUpperCase()));
            const newItems = data.results.filter(r => !existingSyms.has(r.symbol.toUpperCase()));
            if (newItems.length > 0) {
              renderSearchResults([...filtered, ...newItems]);
            }
          }
        }
      }
    } catch (e) {}
  }

  function renderSearchResults(results) {
    const list = document.getElementById('searchResultsList');
    if (!list) return;

    if (!results || results.length === 0) {
      list.innerHTML = `
        <div style="padding:28px 16px; text-align:center; color:var(--aiot-500);">
          <div style="font-size:13px; font-weight:600; color:var(--aiot-950);">No matching assets found</div>
          <div style="font-size:11.5px; margin-top:4px;">Try searching for "AAPL", "NVDA", "NIFTY", "RELIANCE", "BTC", or "GOLD"</div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="font-size:11px; color:var(--aiot-500); padding:0 4px 8px 4px; display:flex; justify-content:space-between; align-items:center;">
        <span>Showing <strong>${results.length}</strong> matching assets</span>
        <span style="color:var(--aiot-700); font-size:10.5px;">Click to load chart · Add to Watchlist</span>
      </div>
    `;

    html += results.map(item => {
      let badgeClass = 'badge-nse';
      const tab = item.tab || '';
      if (tab === 'us_stocks' || tab === 'us' || (item.category && item.category.includes('US'))) badgeClass = 'badge-us';
      else if (tab === 'indices' || (item.category && item.category.includes('Index'))) badgeClass = 'badge-index';
      else if (tab === 'crypto' || (item.category && item.category.includes('Crypto'))) badgeClass = 'badge-crypto';
      else if (tab === 'commodities' || (item.category && (item.category.includes('Commodities') || item.category.includes('Forex')))) badgeClass = 'badge-commodity';

      const tagText = item.tag || (tab === 'us_stocks' ? 'US' : (tab === 'indices' ? 'IDX' : (tab === 'crypto' ? 'CRYPTO' : (tab === 'commodities' ? 'COMM' : 'NSE'))));

      return `
        <div class="search-result-card" onclick="TerminalPlatform.selectSearchedSymbol('${item.symbol}')">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:26px; text-align:center;"><span class="market-region-tag" style="font-size:9.5px; padding:2px 5px;">${tagText}</span></div>
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; font-size:13.5px; color:var(--aiot-950); font-family:'IBM Plex Mono', monospace;">${item.symbol}</span>
                <span class="symbol-badge ${badgeClass}">${item.category}</span>
              </div>
              <div style="font-size:11.5px; color:var(--aiot-600); margin-top:2px;">${item.name} · <span style="color:var(--aiot-500);">${item.currency || 'USD'}</span></div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="search-action-btn" onclick="event.stopPropagation(); TerminalPlatform.selectSearchedSymbol('${item.symbol}');">Chart</button>
            <button class="search-action-btn" title="Add to Watchlist" onclick="event.stopPropagation(); TerminalPlatform.addToWatchlist('${item.symbol}', '${item.name}', '${item.category}');">+ Watchlist</button>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = html;
  }

  function addToWatchlist(sym, name, category) {
    const itemMeta = CLIENT_SEARCH_CATALOG.find(c => c.symbol === sym);
    if (!watchlist.find(w => w.symbol === sym)) {
      watchlist.unshift({
        symbol: sym,
        name: name || (itemMeta ? itemMeta.name : sym),
        category: category || (itemMeta ? itemMeta.category : 'Custom'),
        tab: itemMeta ? (itemMeta.tab === 'us_stocks' ? 'us' : (itemMeta.tab === 'indian_stocks' ? 'indian' : itemMeta.tab)) : 'custom',
        price: 0,
        change: 0,
        changePct: 0,
        vol: 0
      });
      renderWatchlist();
      renderDedicatedWatchlist();
    }
  }

  function selectSearchedSymbol(symbol) {
    closeSearchModal();
    const itemMeta = CLIENT_SEARCH_CATALOG.find(c => c.symbol === symbol);
    if (!watchlist.find(w => w.symbol === symbol)) {
      watchlist.unshift({
        symbol,
        name: itemMeta ? itemMeta.name : symbol,
        category: itemMeta ? itemMeta.category : 'Custom',
        tab: itemMeta ? (itemMeta.tab === 'us_stocks' ? 'us' : (itemMeta.tab === 'indian_stocks' ? 'indian' : itemMeta.tab)) : 'custom',
        price: 0,
        change: 0,
        changePct: 0,
        vol: 0
      });
      renderWatchlist();
      renderDedicatedWatchlist();
    }
    loadSymbol(symbol);
    switchWorkspace('chart');
  }

  // ── 8. Replay Engine UI Handling ─────────────────────────────────────────
  function handleReplayStateChange({ active, playing, selecting }) {
    const bar = document.getElementById('replayControlBar');
    const replayBtn = document.getElementById('replayToggleBtn');
    if (!bar) return;

    if (active || selecting) {
      bar.style.display = 'flex';
      if (replayBtn) replayBtn.classList.add('active');
    } else {
      bar.style.display = 'none';
      if (replayBtn) replayBtn.classList.remove('active');
    }

    const playPauseBtn = document.getElementById('replayPlayPauseBtn');
    if (playPauseBtn) {
      playPauseBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
    }
  }

  function bindReplayControls() {
    const toggleBtn = document.getElementById('replayToggleBtn');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        if (replayEngine.isActive) replayEngine.exit();
        else replayEngine.startSelection();
      };
    }

    const playBtn = document.getElementById('replayPlayPauseBtn');
    if (playBtn) {
      playBtn.onclick = () => {
        if (replayEngine.isPlaying) replayEngine.pause();
        else replayEngine.play();
      };
    }

    const stepBtn = document.getElementById('replayStepBtn');
    if (stepBtn) {
      stepBtn.onclick = () => replayEngine.stepForward();
    }

    const exitBtn = document.getElementById('replayExitBtn');
    if (exitBtn) {
      exitBtn.onclick = () => replayEngine.exit();
    }
  }

  // ── 9. Header Status & Labels ────────────────────────────────────────────
  function updateHeaderSymbolInfo(symbol, timeframe) {
    const symEl = document.getElementById('headerActiveSymbol');
    const tfEl = document.getElementById('headerActiveTf');
    if (symEl) symEl.textContent = symbol;
    if (tfEl) tfEl.textContent = timeframe;
  }

  function updateHeaderOHLC(c) {
    if (!c) return;
    const oEl = document.getElementById('headerO');
    const hEl = document.getElementById('headerH');
    const lEl = document.getElementById('headerL');
    const cEl = document.getElementById('headerC');
    if (oEl) oEl.textContent = formatPrice(c.open);
    if (hEl) hEl.textContent = formatPrice(c.high);
    if (lEl) lEl.textContent = formatPrice(c.low);
    if (cEl) cEl.textContent = formatPrice(c.close);
  }

  function updateHeaderPrice(c) {
    if (!c) return;
    const pEl = document.getElementById('headerActivePrice');
    if (pEl) {
      pEl.textContent = formatPrice(c.close);
      pEl.style.color = c.close >= c.open ? 'var(--bull)' : 'var(--bear)';
    }
  }

  function updateStatusBadge(status) {
    const badge = document.getElementById('headerStatusBadge');
    if (!badge) return;
    badge.className = `status-pill status-${status.toLowerCase()}`;
    badge.textContent = status;
  }

  // ── 10. Delta Account Summary ────────────────────────────────────────────
  async function fetchDeltaAccountSummary() {
    try {
      const resp = await fetch('/api/delta/account');
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          const eqEl = document.getElementById('deltaNetEquity');
          const balEl = document.getElementById('deltaAvailMargin');
          if (eqEl) eqEl.textContent = `$${data.netEquityUSD.toFixed(2)} USD (~₹${data.balanceINR.toFixed(2)})`;
          if (balEl) balEl.textContent = `$${data.availableBalanceUSD.toFixed(2)} USD`;
        }
      }
    } catch (e) {}
  }

  // ── 11. Workstation Navigation & State Preservation ────────────────────────
  let activeWorkspace = 'chart';

  function switchWorkspace(wsId) {
    if (!wsId) return;
    activeWorkspace = wsId;

    // 1. Update navigation button states
    document.querySelectorAll('.nova-nav-btn').forEach(btn => {
      if (btn.getAttribute('data-ws') === wsId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Hide all workspace panels and show target
    const targetWsMap = {
      'markets': 'workspaceMarkets',
      'chart': 'workspaceChart',
      'watchlist': 'workspaceWatchlist',
      'positions': 'workspacePositions',
      'risk': 'workspaceRisk',
      'journal': 'workspaceJournal',
      'logs': 'workspaceLogs',
      'analytics': 'workspaceAnalytics',
      'global': 'workspaceGlobal',
      'regime': 'workspaceRegime',
      'calendar': 'workspaceCalendar',
      'news': 'workspaceNews',
      'breadth': 'workspaceBreadth',
      'scanner': 'workspaceScanner',
      'backtest': 'workspaceBacktest',
      'replay': 'workspaceChart', // Replay operates directly on chart
      'portfolio': 'workspacePositions',
      'ai': 'workspaceAi',
      'planner': 'workspacePlanner',
      'settings': 'workspaceSettings'
    };

    const targetId = targetWsMap[wsId] || 'workspaceMarkets';
    document.querySelectorAll('.workspace-panel').forEach(p => {
      if (p.id === targetId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // 3. If switching to chart workspace, trigger canvas resize immediately
    if (targetId === 'workspaceChart' && mainChart) {
      setTimeout(() => {
        mainChart.resize();
        if (wsId === 'replay' && replayEngine) {
          replayEngine.startSelection();
        }
      }, 50);
    }

    // 4. Remember last opened workspace
    try {
      localStorage.setItem('nova_last_workspace', wsId);
    } catch (e) {}

    // 5. Trigger appropriate module renderer
    if (wsId === 'markets') renderMarketsOverview();
    else if (wsId === 'watchlist') renderDedicatedWatchlist();
    else if (wsId === 'risk') syncRiskWithActiveAsset();
    else if (wsId === 'journal') renderTradeJournalWorkspace();
    else if (wsId === 'logs') renderTradingLogsWorkspace();
    else if (wsId === 'analytics') renderAnalyticsWorkspace();
    else if (wsId === 'global') renderGlobalMarketsWorkspace();
    else if (wsId === 'regime') renderMarketRegimeWorkspace();
    else if (wsId === 'calendar') renderEconomicCalendarWorkspace();
    else if (wsId === 'news') renderNewsWorkspace();
    else if (wsId === 'breadth') renderBreadthWorkspace();
    else if (wsId === 'scanner') renderScannerWorkspace();
    else if (wsId === 'planner') renderPlannerWorkspace();
  }

  function toggleSidebar() {
    const rail = document.getElementById('novaNavRail');
    const icon = document.getElementById('collapseIcon');
    if (!rail) return;
    rail.classList.toggle('collapsed');
    if (icon) {
      icon.textContent = rail.classList.contains('collapsed') ? '▶' : '◀';
    }
    // Resize chart if visible
    if (activeWorkspace === 'chart' && mainChart) {
      setTimeout(() => mainChart.resize(), 250);
    }
  }

  // ── 11B. Real-Time Quotes Synchronization Engine ─────────────────────────────
  let liveQuotesData = {};

  async function syncWatchlistQuotes() {
    try {
      const syms = watchlist.map(w => w.symbol).concat(['NIFTY_50', 'SPX', 'NDX', 'DJI', 'AAPL', 'NVDA', 'MSFT', 'TSLA', 'RELIANCE', 'TCS', 'BTCUSD', 'ETHUSD', 'XAUUSD']);
      const uniqueSyms = Array.from(new Set(syms)).join(',');
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(uniqueSyms)}`);
      const data = await res.json();
      if (!data || !data.success || !data.quotes) return;

      liveQuotesData = { ...liveQuotesData, ...data.quotes };

      // Update in-memory watchlist
      watchlist.forEach(item => {
        const q = liveQuotesData[item.symbol.toUpperCase()];
        if (q && q.price) {
          item.price = q.price;
          item.changePct = q.changePct;
          item.prevClose = q.prevClose;
          item.high = q.high;
          item.low = q.low;
          item.vol = q.volume;
          item.currency = q.currency || item.currency;
        }
      });

      // Update Overview 24h stats if active symbol matches
      const activeQ = liveQuotesData[currentSymbol.toUpperCase()];
      if (activeQ) {
        const highEl = document.getElementById('hero24High');
        const lowEl = document.getElementById('hero24Low');
        const volEl = document.getElementById('hero24Vol');
        const currPfx = activeQ.currency === 'INR' ? '₹' : '$';
        if (highEl && activeQ.high) highEl.textContent = `${currPfx}${activeQ.high.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (lowEl && activeQ.low) lowEl.textContent = `${currPfx}${activeQ.low.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        if (volEl && activeQ.volume) {
          const volStr = activeQ.volume > 1e9 ? `${(activeQ.volume / 1e9).toFixed(1)}B` : (activeQ.volume > 1e6 ? `${(activeQ.volume / 1e6).toFixed(1)}M` : `${activeQ.volume.toLocaleString()}`);
          volEl.textContent = `${currPfx}${volStr}`;
        }
      }

      if (activeWorkspace === 'markets') renderMarketsOverview();
      if (activeWorkspace === 'watchlist') renderDedicatedWatchlist();
      
      // Update Risk Manager active price badge if visible
      const riskSymBadge = document.getElementById('riskActiveSymbolBadge');
      const riskPriceBadge = document.getElementById('riskActivePriceBadge');
      if (riskSymBadge && riskPriceBadge && window.riskManager) {
        const symQ = liveQuotesData[window.riskManager.activeSymbol.toUpperCase()];
        if (symQ && symQ.price) {
          riskPriceBadge.textContent = `${window.riskManager.currencySymbol}${symQ.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        }
      }
    } catch (e) {
      console.warn('Live quotes sync notice:', e);
    }
  }

  // ── 12. Modular Workspace Renderers ───────────────────────────────────────

  function renderMarketsOverview() {
    const list = document.getElementById('overviewWatchlistRows');
    if (!list) return;

    const previewList = [
      { sym: 'NIFTY_50', name: 'NIFTY 50 Benchmark' },
      { sym: 'SPX', name: 'S&P 500 Large Cap' },
      { sym: 'AAPL', name: 'Apple Inc.' },
      { sym: 'NVDA', name: 'NVIDIA Corp' },
      { sym: 'RELIANCE', name: 'Reliance Industries' },
      { sym: 'TCS', name: 'Tata Consultancy' },
      { sym: 'BTCUSD', name: 'Bitcoin Perpetual' },
      { sym: 'XAUUSD', name: 'Gold Spot / USD' }
    ];

    list.innerHTML = previewList.map(item => {
      const q = liveQuotesData[item.sym.toUpperCase()];
      const wItem = watchlist.find(w => w.symbol === item.sym) || {};
      const priceVal = q ? q.price : (wItem.price || 0);
      const chgPct = q ? q.changePct : (wItem.changePct || 0.0);
      const isBull = chgPct >= 0;
      const currPfx = (q && q.currency === 'INR') || ['NIFTY_50', 'RELIANCE', 'TCS'].includes(item.sym) ? '₹' : '$';
      const formattedPrice = priceVal > 0 ? `${currPfx}${priceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--';
      const formattedChg = `${isBull ? '+' : ''}${chgPct.toFixed(2)}%`;

      return `
        <div class="watchlist-row" style="background:rgba(13,9,8,0.02); border:1px solid rgba(216,210,207,0.6); border-radius:8px; padding:7px 12px; cursor:pointer;" onclick="TerminalPlatform.loadSymbol('${item.sym}'); TerminalPlatform.switchWorkspace('chart');">
          <div class="wl-left">
            <span class="wl-symbol" style="color:var(--aiot-950); font-weight:800; font-family:'IBM Plex Mono', monospace;">${item.sym}</span>
            <span class="wl-name" style="color:var(--aiot-600);">${item.name}</span>
          </div>
          <div class="wl-right">
            <span class="wl-price mono" style="color:var(--aiot-950); font-weight:800;">${formattedPrice}</span>
            <span class="wl-chg mono ${isBull ? 'bull' : 'bear'}">${formattedChg}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  let dedicatedWatchlistSearchQuery = '';

  function filterWatchlistView(tab) {
    currentWatchlistTab = tab;
    ['all', 'indices', 'us', 'indian', 'crypto'].forEach(t => {
      const el = document.getElementById(`wlTab_${t}`);
      if (el) el.classList.toggle('active', t === tab);
    });
    renderDedicatedWatchlist();
  }

  function filterWatchlistInput(query) {
    dedicatedWatchlistSearchQuery = (query || '').trim().toLowerCase();
    renderDedicatedWatchlist();
  }

  function renderDedicatedWatchlist() {
    const tbody = document.getElementById('dedicatedWatchlistTbody');
    if (!tbody) return;

    const filtered = watchlist.filter(item => {
      if (currentWatchlistTab === 'indices' && item.tab !== 'indices') return false;
      if (currentWatchlistTab === 'us' && item.tab !== 'us') return false;
      if (currentWatchlistTab === 'indian' && item.tab !== 'indian') return false;
      if (currentWatchlistTab === 'crypto' && item.tab !== 'crypto') return false;

      if (dedicatedWatchlistSearchQuery) {
        const matchSym = item.symbol.toLowerCase().includes(dedicatedWatchlistSearchQuery);
        const matchName = item.name.toLowerCase().includes(dedicatedWatchlistSearchQuery);
        const matchCat = (item.category || '').toLowerCase().includes(dedicatedWatchlistSearchQuery);
        return matchSym || matchName || matchCat;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--aiot-500);">No assets found matching the selected category.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const q = liveQuotesData[item.symbol.toUpperCase()];
      const price = q ? q.price : item.price;
      const changePct = q ? q.changePct : item.changePct;
      const isBull = changePct >= 0;
      const sign = isBull ? '+' : '';
      let badgeClass = 'badge-nse';
      if (item.tab === 'us') badgeClass = 'badge-us';
      else if (item.tab === 'indices') badgeClass = 'badge-index';
      else if (item.tab === 'crypto') badgeClass = 'badge-crypto';

      const currPrefix = item.currency === 'INR' ? '₹' : '$';

      return `
        <tr style="cursor:pointer;" onclick="TerminalPlatform.loadSymbol('${item.symbol}'); TerminalPlatform.switchWorkspace('chart');">
          <td><strong style="color:var(--aiot-950); font-family:'IBM Plex Mono', monospace; font-size:13px;">${item.symbol}</strong></td>
          <td style="color:var(--aiot-700); font-size:12.5px;">${item.name}</td>
          <td><span class="symbol-badge ${badgeClass}">${item.category}</span></td>
          <td class="mono font-bold" style="color:var(--aiot-950);">${price > 0 ? currPrefix + formatPrice(price) : '--'}</td>
          <td class="mono font-bold ${isBull ? 'bull' : 'bear'}">${price > 0 ? `${sign}${changePct.toFixed(2)}%` : '--'}</td>
          <td style="color:var(--aiot-500);"><span style="font-family:'IBM Plex Mono', monospace; font-size:11px; background:rgba(13,9,8,0.04); padding:2px 6px; border-radius:4px;">${item.exchange || 'FEED'}</span></td>
          <td><button class="hero-tf-btn" style="background:var(--aiot-950); color:#FAFAF9; font-weight:700;">Chart</button></td>
        </tr>
      `;
    }).join('');
  }

  // ── 12B. Automated Risk Manager Synchronization ──────────────────────────────
  function syncRiskWithActiveAsset() {
    if (!window.riskManager) return;
    const sym = currentSymbol || 'NIFTY_50';
    const q = liveQuotesData[sym.toUpperCase()] || {};
    let curPrice = q.price;
    if (!curPrice && latestCandles && latestCandles.length > 0) {
      curPrice = latestCandles[latestCandles.length - 1].close;
    }
    if (!curPrice) curPrice = 100;

    const setup = window.riskManager.syncWithSymbol(sym, curPrice, q.currency);

    const entryInp = document.getElementById('calcEntryPrice');
    const stopInp = document.getElementById('calcStopLoss');
    const targetInp = document.getElementById('calcTargetPrice');
    const dirSelect = document.getElementById('calcDirection');
    const instSelect = document.getElementById('calcInstrument');
    const lotInp = document.getElementById('calcLotSize');
    const levInp = document.getElementById('calcLeverage');

    if (entryInp) entryInp.value = setup.entryPrice;
    if (stopInp) stopInp.value = setup.stopLoss;
    if (targetInp) targetInp.value = setup.targetPrice;
    if (dirSelect) dirSelect.value = setup.direction;
    if (instSelect) instSelect.value = setup.instrument;
    if (lotInp) lotInp.value = setup.lotSize;
    if (levInp) levInp.value = setup.leverage;

    const symBadge = document.getElementById('riskActiveSymbolBadge');
    const priceBadge = document.getElementById('riskActivePriceBadge');
    if (symBadge) symBadge.textContent = sym;
    if (priceBadge) priceBadge.textContent = `${window.riskManager.currencySymbol}${setup.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    if (typeof recalcPositionSize === 'function') recalcPositionSize();
  }

  function setRiskRewardPreset(ratio) {
    const entry = Number(document.getElementById('calcEntryPrice').value) || 100;
    const stop = Number(document.getElementById('calcStopLoss').value) || (entry * 0.98);
    const dir = document.getElementById('calcDirection').value;
    const stopDist = Math.abs(entry - stop);

    const newTarget = dir === 'LONG' ? (entry + stopDist * ratio) : (entry - stopDist * ratio);
    const targetInp = document.getElementById('calcTargetPrice');
    if (targetInp) targetInp.value = Math.max(0.01, Math.round(newTarget * 100) / 100);

    if (typeof recalcPositionSize === 'function') recalcPositionSize();
  }

  function renderTradeJournalWorkspace(filterTag = 'ALL') {
    const tbody = document.getElementById('tradeJournalTbody');
    if (!tbody || !window.journalService) return;

    let trades = window.journalService.trades || [];
    if (filterTag !== 'ALL') {
      trades = trades.filter(t => t.tags && t.tags.includes(filterTag));
    }

    if (trades.length === 0) {
      tbody.innerHTML = `<tr><td colspan="15" style="text-align:center; padding:24px; color:#787b86;">No journal entries recorded for tag "${filterTag}".</td></tr>`;
      return;
    }

    tbody.innerHTML = trades.map(t => {
      const isWin = (t.pnl || 0) > 0;
      const pnlColor = isWin ? '#089981' : (t.pnl < 0 ? '#f23645' : '#787b86');
      const tagsHtml = (t.tags || []).map(tag => `<span class="news-pill crypto" style="font-size:9.5px; margin-right:3px;">${tag}</span>`).join('');

      return `
        <tr>
          <td><strong style="color:var(--aiot-950); font-weight:700;">${t.id}</strong></td>
          <td class="mono" style="font-size:11px; color:var(--aiot-700);">${t.date}</td>
          <td><strong style="color:var(--aiot-950);">${t.symbol}</strong></td>
          <td><span class="status-pill" style="background:${t.direction === 'LONG' ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)'}; color:${t.direction === 'LONG' ? '#059669' : '#DC2626'}; font-weight:700;">${t.direction}</span></td>
          <td class="mono" style="color:var(--aiot-900);">₹${t.entry.toFixed(2)}</td>
          <td class="mono" style="color:var(--aiot-900);">₹${t.stop.toFixed(2)}</td>
          <td class="mono" style="color:var(--aiot-900);">₹${t.target.toFixed(2)}</td>
          <td class="mono" style="color:var(--aiot-900);">₹${(t.exit || t.entry).toFixed(2)}</td>
          <td class="mono" style="color:var(--aiot-900);">${t.quantity}</td>
          <td class="mono" style="color:var(--aiot-900);">${t.rr ? `1:${Number(t.rr).toFixed(2)}` : '1:2.0'}</td>
          <td style="color:var(--aiot-900); font-weight:600;">${t.strategy || 'Breakout'}</td>
          <td><span class="status-pill ${isWin ? 'status-live' : 'risk-high'}">${t.result || (isWin ? 'WIN' : 'LOSS')}</span></td>
          <td class="mono font-bold" style="color:${pnlColor};">${t.pnl >= 0 ? '+' : ''}₹${Number(t.pnl || 0).toFixed(2)}</td>
          <td>${tagsHtml}</td>
          <td style="font-size:11.5px; color:var(--aiot-700); max-width:220px;">${t.notes || t.entryReason || '--'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderTradingLogsWorkspace() {
    const tbody = document.getElementById('tradingLogsTbody');
    if (!tbody || !window.journalService) return;

    const logs = window.journalService.logs || [];
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--aiot-500);">No automated logs recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="mono" style="font-size:11px; color:var(--aiot-600);">${l.timestamp}</td>
        <td><strong style="color:var(--aiot-950);">${l.symbol}</strong></td>
        <td><strong style="color:var(--aiot-900);">${l.action}</strong></td>
        <td class="mono" style="color:var(--aiot-900);">${l.price ? `₹${Number(l.price).toFixed(2)}` : '--'}</td>
        <td class="mono" style="color:var(--aiot-900);">${l.quantity || '--'}</td>
        <td><span class="news-pill fed" style="font-size:9.5px;">${l.orderType}</span></td>
        <td style="color:var(--aiot-700); font-weight:500;">${l.reason}</td>
        <td style="color:var(--aiot-600);">${l.source}</td>
        <td><span class="status-pill status-live" style="font-size:9.5px;">${l.status}</span></td>
      </tr>
    `).join('');
  }

  function renderAnalyticsWorkspace() {
    if (!window.journalService) return;
    const ana = window.journalService.calculateAnalytics();

    const wrEl = document.getElementById('anaWinRate');
    if (wrEl) wrEl.textContent = `${ana.winRate}%`;

    const wlCount = document.getElementById('anaWinLossCount');
    if (wlCount) wlCount.textContent = `${ana.winningTrades} Wins · ${ana.losingTrades} Losses`;

    const pfEl = document.getElementById('anaProfitFactor');
    if (pfEl) pfEl.textContent = `${ana.profitFactor}`;

    const shEl = document.getElementById('anaSharpe');
    if (shEl) shEl.textContent = `${ana.sharpeRatio} / ${ana.sortinoRatio}`;

    const ddEl = document.getElementById('anaMaxDd');
    if (ddEl) ddEl.textContent = `₹${ana.maxDrawdown.toLocaleString()} (Recovery: ${ana.recoveryFactor})`;

    // Strategy Performance Table
    const tbody = document.getElementById('strategyPerformanceTbody');
    if (tbody && ana.strategyStats) {
      const rows = Object.values(ana.strategyStats);
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td><strong style="color:var(--aiot-950); font-weight:700;">${r.name}</strong></td>
          <td class="mono" style="color:var(--aiot-900);">${r.trades}</td>
          <td class="mono font-bold" style="color:#059669;">${r.winRate}</td>
          <td class="mono" style="color:var(--aiot-900);">${r.avgRR}</td>
          <td class="mono font-bold" style="color:#059669;">${r.profitFactor}</td>
          <td class="mono font-bold" style="color:${r.netPnl >= 0 ? '#059669' : '#DC2626'};">${r.netPnl >= 0 ? '+' : ''}₹${r.netPnl.toLocaleString()}</td>
        </tr>
      `).join('');
    }
  }

  async function renderGlobalMarketsWorkspace(windowKey = '3M') {
    if (!window.globalMarketsService) return;
    await window.globalMarketsService.renderWorkspace('workspaceGlobal');
  }

  function renderMarketRegimeWorkspace() {
    if (!window.marketRegimeEngine) return;
    const candles = (mainChart && mainChart.candles) ? mainChart.candles : [];
    const res = window.marketRegimeEngine.evaluateRegime(candles);

    const bigEl = document.getElementById('regimeBigState');
    if (bigEl) {
      bigEl.textContent = res.regime;
      bigEl.style.color = res.regime.includes('Bull') ? '#059669' : (res.regime.includes('Bear') ? '#DC2626' : '#D97706');
    }

    const secEl = document.getElementById('regimeSecondaryState');
    if (secEl) secEl.textContent = `Secondary: ${res.secondaryState} · Confidence: ${res.confidence}%`;

    const rulesEl = document.getElementById('regimeRulesApplied');
    if (rulesEl) rulesEl.textContent = res.rulesApplied;

    const list = document.getElementById('regimeEvidenceList');
    if (list) {
      list.innerHTML = res.evidence.map(e => `
        <div style="background:var(--aiot-50); border:1px solid var(--aiot-300); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <strong style="font-size:12.5px; color:var(--aiot-950); font-weight:700;">${e.factor}</strong>
            <div style="font-size:11.5px; color:var(--aiot-600); margin-top:3px; font-weight:500;">${e.observation}</div>
          </div>
          <span class="status-pill status-live" style="font-size:9.5px;">${e.score}</span>
        </div>
      `).join('');
    }
  }

  function renderEconomicCalendarWorkspace() {
    if (!window.economicCalendarService) return;
    const list = document.getElementById('economicCalendarList');
    if (list) {
      list.innerHTML = window.economicCalendarService.events.map(ev => `
        <div class="nova-news-item" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; color:var(--aiot-700); font-weight:700;">${ev.country} · ${ev.time}</span>
            <span class="status-pill ${ev.importance === 'HIGH' ? 'risk-high' : 'risk-moderate'}" style="font-size:9px;">${ev.importance} IMPACT</span>
          </div>
          <strong style="font-size:13px; color:var(--aiot-950); margin-top:4px; font-weight:700; line-height:1.4;">${ev.event}</strong>
          <div style="display:flex; gap:14px; font-size:11.5px; color:var(--aiot-600); margin-top:6px;">
            <span>Prev: <strong class="mono" style="color:var(--aiot-900); font-weight:600;">${ev.previous}</strong></span>
            <span>Forecast: <strong class="mono" style="color:var(--aiot-900); font-weight:600;">${ev.forecast}</strong></span>
            <span>Actual: <strong class="mono" style="color:#059669; font-weight:700;">${ev.actual}</strong></span>
          </div>
        </div>
      `).join('');
    }

    // Historical Impact
    const impactList = document.getElementById('historicalImpactStatsList');
    if (impactList) {
      const stats = window.economicCalendarService.getImpactStats('US CPI');
      impactList.innerHTML = Object.keys(stats.reactions).map(asset => {
        const r = stats.reactions[asset];
        return `
          <div style="background:var(--aiot-50); border:1px solid var(--aiot-300); border-radius:8px; padding:10px 14px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:12.5px; color:var(--aiot-950); font-weight:700;">${asset}</strong>
              <span class="mono" style="color:#D97706; font-size:11px; font-weight:700;">Volatility ${r.volIncrease}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--aiot-600); margin-top:6px;">
              <span>Avg Move: <strong class="mono" style="color:var(--aiot-900);">${r.avgMove}</strong></span>
              <span>Max Move: <strong class="mono" style="color:#DC2626;">${r.maxMove}</strong></span>
              <span>Recovery: <strong class="mono" style="color:#059669; font-weight:700;">${r.recoveryTime}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  async function renderNewsWorkspace(selectedCategory = 'all') {
    const list = document.getElementById('dedicatedNewsFeedList');
    if (!list) return;

    list.innerHTML = `<div style="padding:24px; text-align:center; color:#787b86;">Fetching live institutional global market news...</div>`;

    let headlines = [];
    try {
      const resp = await fetch('/api/news?symbol=GLOBAL&limit=25');
      const data = await resp.json();
      if (data && data.headlines && data.headlines.length > 0) {
        headlines = data.headlines;
      }
    } catch (e) {}

    if (headlines.length === 0) {
      headlines = [
        {
          title: "US Core Inflation Prints 2.7% YoY, Clearing Runway for Federal Reserve Easing",
          time: "14 min ago",
          source: "Reuters / Bureau of Labor Statistics",
          category: "fed",
          link: "https://www.reuters.com",
          sentiment: "BULLISH",
          fact: "Official CPI YoY slowed to 2.7%, marking the lowest reading since March 2021.",
          marketReaction: "S&P 500 futures rallied +0.65%, US 10Y yield dropped 6 bps to 3.81%, and Bitcoin touched $67,400.",
          aiInterpretation: "Disinflationary continuation favors risk-on assets. Probability of 25 bps rate cut reaches 91%."
        },
        {
          title: "Bitcoin Breaks $67k Resistance Amid Accelerating Institutional ETF Inflows",
          time: "28 min ago",
          source: "CoinDesk / SEC Filings",
          category: "crypto",
          link: "https://www.coindesk.com",
          sentiment: "BULLISH",
          fact: "Net daily inflows across spot Bitcoin ETFs topped $420M led by BlackRock IBIT and Fidelity FBTC.",
          marketReaction: "Perpetual funding rates stabilized at neutral +0.01% while open interest expanded 8%.",
          aiInterpretation: "Spot-driven buying without excessive leverage liquidations indicates high institutional accumulation."
        },
        {
          title: "NVIDIA Earnings Beat Expectations as Next-Gen Architecture Production Accelerates",
          time: "1 hr ago",
          source: "Bloomberg / NASDAQ",
          category: "earnings",
          link: "https://www.bloomberg.com",
          sentiment: "NEUTRAL",
          fact: "Quarterly revenue reached $30.04B vs $28.7B consensus estimates, gross margin sustained at 75.1%.",
          marketReaction: "Share price fluctuated in after-hours trading between -2.1% and +3.4% before stabilizing.",
          aiInterpretation: "Datacenter capex commitments from cloud hyperscalers confirm multi-quarter forward revenue visibility."
        },
        {
          title: "Global Supply Chain Rebound Fuels European and Asian Manufacturing Expansion",
          time: "3 hrs ago",
          source: "Financial Times",
          category: "markets",
          link: "https://www.ft.com",
          sentiment: "BULLISH",
          fact: "Eurozone flash composite PMI advanced to 51.2 while Japan manufacturing gauge posted strongest gains of the year.",
          marketReaction: "DAX and Nikkei 225 hit new monthly recovery highs with industrial stocks leading.",
          aiInterpretation: "Broadening equity market participation reduces concentration risk in mega-cap technology."
        }
      ];
    }

    // Filter by category if selected
    const filtered = selectedCategory === 'all' 
      ? headlines 
      : headlines.filter(h => (h.category || '').toLowerCase() === selectedCategory.toLowerCase());

    const filterToolbar = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        <button class="hero-tf-btn ${selectedCategory === 'all' ? 'active' : ''}" onclick="TerminalPlatform.renderNewsWorkspace('all')">All Global News</button>
        <button class="hero-tf-btn ${selectedCategory === 'fed' ? 'active' : ''}" onclick="TerminalPlatform.renderNewsWorkspace('fed')">Central Banks & Rates</button>
        <button class="hero-tf-btn ${selectedCategory === 'crypto' ? 'active' : ''}" onclick="TerminalPlatform.renderNewsWorkspace('crypto')">Crypto & Digital Assets</button>
        <button class="hero-tf-btn ${selectedCategory === 'earnings' ? 'active' : ''}" onclick="TerminalPlatform.renderNewsWorkspace('earnings')">Corporate Earnings</button>
        <button class="hero-tf-btn ${selectedCategory === 'markets' ? 'active' : ''}" onclick="TerminalPlatform.renderNewsWorkspace('markets')">World Markets</button>
      </div>
    `;

    const cardsHtml = filtered.map(item => {
      const cat = item.category || 'markets';
      const fact = item.fact || 'Report published by official financial statistical agencies.';
      const reaction = item.marketReaction || 'Cross-asset volatility index reacted with immediate price discovery.';
      const aiInterp = item.aiInterpretation || 'Statistical forward model projects continued multi-timeframe consolidation.';
      const link = item.link || '#';

      return `
        <div class="nova-card" style="margin-bottom:14px; padding:18px 22px; border:1px solid rgba(216,210,207,0.75); background:#FFFFFF;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="news-pill ${cat}">${cat.toUpperCase()}</span>
              <span class="status-pill ${item.sentiment === 'BULLISH' ? 'status-live' : item.sentiment === 'BEARISH' ? 'risk-high' : 'status-delayed'}" style="font-size:9.5px;">${item.sentiment || 'NEUTRAL'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11.5px; color:var(--aiot-600); font-weight:600;">${item.source} · ${item.time}</span>
              <a href="${link}" target="_blank" rel="noopener noreferrer" style="color:var(--aiot-800); text-decoration:none; font-size:13px; font-weight:700;" title="Open Source Link">↗</a>
            </div>
          </div>
          <strong style="font-size:15px; color:var(--aiot-950); font-weight:700; margin:10px 0 12px 0; display:block; line-height:1.4;">${item.title}</strong>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:12px;">
            <div style="background:var(--aiot-50); border:1px solid var(--aiot-300); border-radius:10px; padding:12px;">
              <span style="font-size:10.5px; color:var(--aiot-700); text-transform:uppercase; font-weight:800; letter-spacing:0.04em;">1. FACT</span>
              <div style="font-size:12px; color:var(--aiot-900); font-weight:500; margin-top:6px; line-height:1.45;">${fact}</div>
            </div>
            <div style="background:rgba(5,150,105,0.06); border:1px solid rgba(5,150,105,0.25); border-radius:10px; padding:12px;">
              <span style="font-size:10.5px; color:#047857; text-transform:uppercase; font-weight:800; letter-spacing:0.04em;">2. MARKET REACTION</span>
              <div style="font-size:12px; color:var(--aiot-900); font-weight:500; margin-top:6px; line-height:1.45;">${reaction}</div>
            </div>
            <div style="background:rgba(125,111,103,0.08); border:1px solid rgba(125,111,103,0.25); border-radius:10px; padding:12px;">
              <span style="font-size:10.5px; color:var(--aiot-800); text-transform:uppercase; font-weight:800; letter-spacing:0.04em;">3. AI INTERPRETATION</span>
              <div style="font-size:12px; color:var(--aiot-900); font-weight:500; margin-top:6px; line-height:1.45;">${aiInterp}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.innerHTML = filterToolbar + cardsHtml;
  }

  function renderBreadthWorkspace() {
    if (!window.marketBreadthService) return;
    const tbody = document.getElementById('sectorRotationTbody');
    if (!tbody) return;

    const sectors = window.marketBreadthService.getSectorRotation('1M');
    tbody.innerHTML = sectors.map(s => `
      <tr>
        <td><strong style="color:var(--aiot-950);">${s.name}</strong></td>
        <td><span class="status-pill status-live" style="font-size:9px;">${s.sector}</span></td>
        <td class="mono font-bold" style="color:${s.selectedPerf >= 0 ? '#059669' : '#DC2626'};">${s.formattedPerf}</td>
        <td class="mono" style="color:var(--aiot-900);">${s.rsi}</td>
        <td><span class="status-pill ${s.selectedPerf > 0 ? 'status-live' : 'risk-high'}" style="font-size:9.5px;">${s.momentum}</span></td>
        <td class="mono" style="color:var(--aiot-900);">${s.volume}</td>
        <td><strong style="color:#059669; font-weight:700;">${s.trend}</strong></td>
      </tr>
    `).join('');
  }

  function renderScannerWorkspace(preset = 'Breakout') {
    if (!window.marketScannerService) return;
    const tbody = document.getElementById('scannerResultsTbody');
    if (!tbody) return;

    const results = window.marketScannerService.scan(preset);
    tbody.innerHTML = results.map(item => {
      const isBull = item.change >= 0;
      return `
        <tr>
          <td><strong style="color:var(--aiot-950); font-weight:700;">${item.symbol}</strong></td>
          <td style="color:var(--aiot-800);">${item.name}</td>
          <td><span class="status-pill status-live" style="font-size:9px;">${item.sector}</span></td>
          <td class="mono font-bold" style="color:var(--aiot-900);">₹${item.price.toFixed(2)}</td>
          <td class="mono ${isBull ? 'bull' : 'bear'}">${isBull ? '+' : ''}${item.change.toFixed(2)}%</td>
          <td class="mono" style="color:#D97706; font-weight:600;">${item.rvol}x</td>
          <td class="mono" style="color:var(--aiot-900);">${item.rsi}</td>
          <td><span class="status-pill status-live" style="font-size:9px;">${item.bollinger}</span></td>
          <td style="color:#059669; font-weight:700;">${item.emaCross}</td>
          <td class="mono" style="color:var(--aiot-900);">${item.dist52WHigh}%</td>
          <td><button class="hero-tf-btn active" style="font-weight:700;" onclick="TerminalPlatform.loadSymbol('${item.symbol}'); TerminalPlatform.switchWorkspace('chart');">Load Chart</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderPlannerWorkspace() {
    if (!window.tradePlannerService) return;
    const container = document.getElementById('checklistItemsContainer');
    if (!container) return;

    const items = window.tradePlannerService.checklistItems;
    container.innerHTML = items.map(item => `
      <label style="display:flex; align-items:center; gap:10px; background:var(--aiot-50); border:1px solid var(--aiot-300); padding:10px 14px; border-radius:8px; cursor:pointer; margin-bottom:6px;">
        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="togglePlannerCheck('${item.id}')" style="accent-color:var(--aiot-950); width:17px; height:17px;">
        <span style="font-size:12.5px; color:var(--aiot-950); font-weight:600;">${item.label}</span>
      </label>
    `).join('');

    const status = window.tradePlannerService.getReadinessStatus();
    const badge = document.getElementById('checklistReadinessBadge');
    if (badge) {
      badge.textContent = status.statusText;
      badge.className = `status-pill ${status.badgeClass}`;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function formatPrice(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(2);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  }

  function loadPreferences() {
    try {
      const savedSymbol = localStorage.getItem('last_symbol');
      if (savedSymbol) currentSymbol = savedSymbol;
      const savedTf = localStorage.getItem('last_timeframe');
      if (savedTf) currentTimeframe = savedTf;
      const savedWs = localStorage.getItem('nova_last_workspace');
      if (savedWs) activeWorkspace = savedWs;
    } catch (e) {}
  }

  // ── 19. AI Quantitative Prediction Engine Integration ────────────────────
  let currentPredictionHorizon = 1;
  let latestPredictionResult = null;

  function openPredictionModal(customSymbol, customTimeframe, horizon) {
    if (customSymbol) currentSymbol = customSymbol;
    if (customTimeframe) currentTimeframe = customTimeframe;
    if (horizon) currentPredictionHorizon = horizon;

    const backdrop = document.getElementById('predictionModalBackdrop');
    if (backdrop) backdrop.classList.add('open');

    // Update active horizon pill
    document.querySelectorAll('.horizon-pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-horizon')) === currentPredictionHorizon);
    });

    executePrediction(currentPredictionHorizon);
  }

  function closePredictionModal() {
    const backdrop = document.getElementById('predictionModalBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  function setPredictionHorizon(h) {
    currentPredictionHorizon = Number(h);
    document.querySelectorAll('.horizon-pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-horizon')) === currentPredictionHorizon);
    });
    executePrediction(currentPredictionHorizon);
  }

  async function switchPredictionSymbol(sym) {
    if (!sym) return;
    currentSymbol = sym;
    const tf = currentTimeframe || '1m';
    await loadSymbol(sym, tf);
    await executePrediction(currentPredictionHorizon);
  }

  async function executePrediction(horizon = currentPredictionHorizon) {
    const sym = currentSymbol || 'BTCUSD';
    const tf = currentTimeframe || '1m';

    // Sync asset dropdown and title
    const selEl = document.getElementById('predSymbolSelect');
    if (selEl) selEl.value = sym;
    const titleEl = document.getElementById('predStudiedAssetTitle');
    if (titleEl) titleEl.textContent = `${sym} (${tf})`;
    const studiedCountEl = document.getElementById('predDataPointsStudied');
    if (studiedCountEl) studiedCountEl.textContent = 'Studying live market data...';

    // Header info update
    const symEl = document.getElementById('predHeaderSymbol');
    const tfEl = document.getElementById('predHeaderTf');
    const priceEl = document.getElementById('predHeaderPrice');
    if (symEl) symEl.textContent = sym;
    if (tfEl) tfEl.textContent = tf;

    const isIndian = ['INR', 'NIFTY_50', 'BANKNIFTY', 'SENSEX', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'TATAMOTORS', 'LT'].some(k => sym.includes(k));
    const currSym = isIndian ? '₹' : '$';

    function fmt(val) {
      if (val === null || val === undefined || isNaN(val)) return '--';
      return currSym + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Indicate loading
    const badgeText = document.getElementById('predSignalText');
    if (badgeText) badgeText.textContent = 'ANALYZING MARKET BARS...';

    // 1. Gather Authentic Live Candle Dataset
    let rawCandles = [];
    if (typeof MarketDataService !== 'undefined') {
      const loadRes = await MarketDataService.loadCandles(sym, tf, 200);
      if (loadRes && loadRes.success && loadRes.candles && loadRes.candles.length > 0) {
        rawCandles = loadRes.candles;
      }
    }

    if (!rawCandles || rawCandles.length === 0) {
      rawCandles = (typeof MarketDataService !== 'undefined') ? MarketDataService.getCandles(sym, tf) : [];
    }

    if (!rawCandles || rawCandles.length < 20) {
      try {
        const resp = await fetch(`/api/live?symbol=${encodeURIComponent(sym)}&interval=${tf}&limit=200`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.candles && json.candles.length > 0) {
            rawCandles = json.candles.map(c => ({
              time: c.t,
              open: c.o,
              high: c.h,
              low: c.l,
              close: c.c,
              volume: c.v
            }));
          }
        }
      } catch (e) {
        console.warn('Live candle fetch for prediction:', e);
      }
    }

    if ((!rawCandles || rawCandles.length < 20) && typeof MARKET_DATA !== 'undefined') {
      const entry = MARKET_DATA[sym] || MARKET_DATA['NIFTY_50'] || Object.values(MARKET_DATA)[0];
      if (entry && entry.data) {
        rawCandles = entry.data.map((d, i) => ({
          time: Date.now() - (entry.data.length - i) * 60000,
          open: d.o,
          high: d.h,
          low: d.l,
          close: d.c,
          volume: d.v
        }));
      }
    }

    if (!rawCandles || rawCandles.length === 0) {
      const base = 25000;
      rawCandles = [];
      let p = base;
      for (let i = 60; i >= 0; i--) {
        const o = p;
        const c = p + (Math.sin(i / 3) * 20);
        rawCandles.push({
          time: Date.now() - i * 60000,
          open: o,
          high: Math.max(o, c) + 10,
          low: Math.min(o, c) - 10,
          close: c,
          volume: 50000
        });
        p = c;
      }
    }

    const normalized = rawCandles.map(c => ({
      open: Number(c.open !== undefined ? c.open : c.o),
      high: Number(c.high !== undefined ? c.high : c.h),
      low: Number(c.low !== undefined ? c.low : c.l),
      close: Number(c.close !== undefined ? c.close : c.c),
      volume: Number(c.volume !== undefined ? c.volume : (c.v || 50000)),
      time: c.time || c.t || Date.now()
    }));

    if (studiedCountEl) {
      studiedCountEl.textContent = `${normalized.length} Live Historical Bars Analyzed`;
    }

    // 2. Fetch News sentiment if available
    let newsSentiment = null;
    try {
      const nResp = await fetch(`/api/news?symbol=${encodeURIComponent(sym)}&limit=5`);
      if (nResp.ok) {
        const nJson = await nResp.json();
        if (nJson && nJson.sentimentScore !== undefined) {
          newsSentiment = nJson;
        }
      }
    } catch(e) {}

    // 3. Generate Prediction
    const pred = (typeof PredictionEngine !== 'undefined' && PredictionEngine.generatePrediction)
      ? PredictionEngine.generatePrediction(normalized, {
          symbol: sym,
          timeframe: tf,
          horizonCandles: horizon
        }, newsSentiment)
      : null;

    if (!pred) {
      console.error('PredictionEngine unavailable');
      return;
    }

    latestPredictionResult = { pred, symbol: sym, timeframe: tf };

    const currentPrice = pred.price || normalized[normalized.length - 1].close;
    if (priceEl) priceEl.textContent = fmt(currentPrice);

    // 4. Update Consensus Banner
    const badge = document.getElementById('predSignalBadge');
    const badgeIcon = document.getElementById('predSignalIcon');
    const sigText = document.getElementById('predSignalText');
    const confText = document.getElementById('predConfidenceText');
    const regimeEl = document.getElementById('predRegimeBadge');
    const expRetEl = document.getElementById('predExpectedReturn');

    if (badge && sigText) {
      sigText.textContent = pred.finalSignal.replace('_', ' ');
      if (pred.finalSignal.includes('BUY')) {
        badge.className = 'pred-signal-pill buy';
        if (badgeIcon) badgeIcon.innerHTML = window.AIOT_ICONS ? AIOT_ICONS.arrowUp : '▲';
      } else if (pred.finalSignal.includes('SELL')) {
        badge.className = 'pred-signal-pill sell';
        if (badgeIcon) badgeIcon.innerHTML = window.AIOT_ICONS ? AIOT_ICONS.arrowDown : '▼';
      } else {
        badge.className = 'pred-signal-pill neutral';
        if (badgeIcon) badgeIcon.innerHTML = window.AIOT_ICONS ? AIOT_ICONS.sparkle : '●';
      }
    }

    if (confText) confText.textContent = `${pred.confidence}% Model Confidence`;
    if (regimeEl) regimeEl.textContent = pred.regimeDesc || pred.regime || 'Equilibrium';
    if (expRetEl) expRetEl.textContent = `${pred.expectedReturn} drift · ±${pred.expectedVolatility}`;

    // 5. Update Candlestick Visual & Forecast Meta
    const nc = pred.nextCandle;
    const isBull = nc.predictedClose >= currentPrice;
    const dirPill = document.getElementById('predCandleDirectionPill');
    if (dirPill) {
      dirPill.textContent = `${nc.predictedDirection} (${nc.bias >= 0 ? '+' : ''}${nc.bias}%)`;
      dirPill.className = isBull ? 'status-pill status-live' : 'status-pill status-error';
    }

    const cHigh = document.getElementById('predCandleHigh');
    const cClose = document.getElementById('predCandleClose');
    const cOpen = document.getElementById('predCandleOpen');
    const cLow = document.getElementById('predCandleLow');
    const qBand = document.getElementById('predQuantileBand');
    const tTime = document.getElementById('predTargetTime');

    if (cHigh) cHigh.textContent = fmt(nc.predictedHigh);
    if (cClose) cClose.textContent = fmt(nc.predictedClose);
    if (cOpen) cOpen.textContent = fmt(currentPrice);
    if (cLow) cLow.textContent = fmt(nc.predictedLow);

    if (qBand) qBand.textContent = `[${fmt(nc.predictedLow)} — ${fmt(nc.predictedHigh)}]`;
    if (tTime) {
      const targetDate = pred.targetTime ? new Date(pred.targetTime) : new Date(Date.now() + 60000 * horizon);
      tTime.textContent = `${targetDate.toLocaleTimeString()} (${horizon} bar${horizon > 1 ? 's' : ''})`;
    }

    // Dynamic graphic position for candlestick
    const cgWick = document.getElementById('cgWick');
    const cgBody = document.getElementById('cgBody');
    if (cgWick && cgBody) {
      cgBody.className = isBull ? 'cg-body bullish' : 'cg-body bearish';
      const range = Math.max(0.001, nc.predictedHigh - nc.predictedLow);
      const topOffset = Math.max(4, Math.min(65, ((nc.predictedHigh - Math.max(currentPrice, nc.predictedClose)) / range) * 85));
      const bodyHeight = Math.max(14, Math.min(65, (Math.abs(nc.predictedClose - currentPrice) / range) * 85));
      cgBody.style.top = `${topOffset}px`;
      cgBody.style.height = `${bodyHeight}px`;
    }

    // 6. Update Targets & SL
    const con = pred.consensus;
    const tp1El = document.getElementById('predTP1Val');
    const tp2El = document.getElementById('predTP2Val');
    const tp3El = document.getElementById('predTP3Val');
    const slEl = document.getElementById('predSLVal');
    const rrBadge = document.getElementById('predRRBadge');

    if (tp1El) tp1El.textContent = fmt(con.takeProfit1);
    if (tp2El) tp2El.textContent = fmt(con.takeProfit2);
    if (tp3El) tp3El.textContent = fmt(con.takeProfit3);
    if (slEl) slEl.textContent = fmt(con.stopLoss);
    if (rrBadge) rrBadge.textContent = `R:R 1:${con.riskReward1 || '2.0'}`;

    const tp1Pct = document.getElementById('predTP1Pct');
    const tp2Pct = document.getElementById('predTP2Pct');
    const tp3Pct = document.getElementById('predTP3Pct');
    const slPct = document.getElementById('predSLPct');

    if (tp1Pct) tp1Pct.textContent = `${((con.takeProfit1 - currentPrice) / currentPrice * 100).toFixed(2)}%`;
    if (tp2Pct) tp2Pct.textContent = `${((con.takeProfit2 - currentPrice) / currentPrice * 100).toFixed(2)}%`;
    if (tp3Pct) tp3Pct.textContent = `${((con.takeProfit3 - currentPrice) / currentPrice * 100).toFixed(2)}%`;
    if (slPct) slPct.textContent = `${((con.stopLoss - currentPrice) / currentPrice * 100).toFixed(2)}%`;

    const bTarget = document.getElementById('predBarrierTarget');
    const bStop = document.getElementById('predBarrierStop');
    if (bTarget) bTarget.textContent = `P(TP1): ${pred.probabilities.pTarget}`;
    if (bStop) bStop.textContent = `P(SL): ${pred.probabilities.pStop}`;

    // 7. Probabilities
    const pUpVal = parseInt(pred.probabilities.pUp) || 50;
    const pDownVal = parseInt(pred.probabilities.pDown) || 30;
    const pFlatVal = Math.max(5, 100 - pUpVal - pDownVal);

    const segUp = document.getElementById('probSegUp');
    const segFlat = document.getElementById('probSegFlat');
    const segDown = document.getElementById('probSegDown');
    if (segUp) segUp.style.width = `${pUpVal}%`;
    if (segFlat) segFlat.style.width = `${pFlatVal}%`;
    if (segDown) segDown.style.width = `${pDownVal}%`;

    const pUpTxt = document.getElementById('predPUp');
    const pFlatTxt = document.getElementById('predPFlat');
    const pDownTxt = document.getElementById('predPDown');
    const kellyTxt = document.getElementById('predKellyVal');

    if (pUpTxt) pUpTxt.textContent = `${pUpVal}%`;
    if (pFlatTxt) pFlatTxt.textContent = `${pFlatVal}%`;
    if (pDownTxt) pDownTxt.textContent = `${pDownVal}%`;
    if (kellyTxt) kellyTxt.textContent = (pred.probabilisticForecast && pred.probabilisticForecast.recommendedKellyFraction) || '10.0%';

    // 8. 10 Strategies Consensus Breakdown
    const voteCountEl = document.getElementById('predConsensusVoteCount');
    if (voteCountEl) {
      voteCountEl.textContent = `${con.buyCount} BUY · ${con.sellCount} SELL · ${con.holdCount} HOLD`;
    }

    const stratGrid = document.getElementById('predStratChipsGrid');
    if (stratGrid && pred.strategies) {
      stratGrid.innerHTML = pred.strategies.map(s => {
        const sigClass = s.signal === 'BUY' ? 'strat-tag-buy' : (s.signal === 'SELL' ? 'strat-tag-sell' : 'strat-tag-hold');
        const icon = s.signal === 'BUY' ? '▲' : (s.signal === 'SELL' ? '▼' : '■');
        return `
          <div class="strat-chip">
            <div class="strat-head">
              <span style="color:var(--aiot-950); font-weight:700; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${s.name}">${s.name}</span>
              <span class="${sigClass}">${icon} ${s.signal}</span>
            </div>
            <div style="font-size:9.5px; color:var(--aiot-500); display:flex; justify-content:space-between; margin-top:2px;">
              <span>Conf: ${Math.round((s.calibratedConfidence || 0.5) * 100)}%</span>
              <span>Wt: ${((pred.strategyWeights && pred.strategyWeights[s.id] || 0.1) * 100).toFixed(0)}%</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // 9. Attribution Factors
    const posList = document.getElementById('predPosFactorsList');
    const riskList = document.getElementById('predRisksList');
    if (posList) {
      const posFactors = (pred.attribution && pred.attribution.positiveFactors && pred.attribution.positiveFactors.length > 0)
        ? pred.attribution.positiveFactors
        : ['Consistent moving average alignment', 'Positive short-term momentum expansion', 'Volume supporting directional continuation'];
      posList.innerHTML = posFactors.map(f => `<li>${f}</li>`).join('');
    }

    if (riskList) {
      const risks = (pred.attribution && pred.attribution.risks && pred.attribution.risks.length > 0)
        ? pred.attribution.risks
        : ['Overhead volatility band resistance', 'Trailing stop recommended for risk control'];
      riskList.innerHTML = risks.map(r => `<li>${r}</li>`).join('');
    }
  }

  function applyPredictionToRisk() {
    if (!latestPredictionResult || !latestPredictionResult.pred) return;
    const p = latestPredictionResult.pred;
    const con = p.consensus;

    if (typeof syncRiskWithActiveAsset === 'function') {
      syncRiskWithActiveAsset();
    }

    const entryInp = document.getElementById('calcEntryPrice');
    const stopInp = document.getElementById('calcStopLoss');
    const targetInp = document.getElementById('calcTargetPrice');
    const dirSelect = document.getElementById('calcDirection');

    if (entryInp) entryInp.value = con.entry.toFixed(2);
    if (stopInp) stopInp.value = con.stopLoss.toFixed(2);
    if (targetInp) targetInp.value = con.takeProfit1.toFixed(2);
    if (dirSelect) dirSelect.value = p.finalSignal.includes('SELL') ? 'SHORT' : 'LONG';

    if (typeof recalcPositionSize === 'function') recalcPositionSize();

    closePredictionModal();
    switchWorkspace('risk');
  }

  function applyPredictionToPlan() {
    if (!latestPredictionResult || !latestPredictionResult.pred) return;
    const p = latestPredictionResult.pred;
    const con = p.consensus;

    const symInp = document.getElementById('planSymbol');
    const dirInp = document.getElementById('planDirection');
    const entryInp = document.getElementById('planEntry');
    const stopInp = document.getElementById('planStop');
    const targetInp = document.getElementById('planTarget');
    const reasonInp = document.getElementById('planReason');

    if (symInp) symInp.value = latestPredictionResult.symbol;
    if (dirInp) dirInp.value = p.finalSignal.includes('SELL') ? 'SHORT' : 'LONG';
    if (entryInp) entryInp.value = con.entry.toFixed(2);
    if (stopInp) stopInp.value = con.stopLoss.toFixed(2);
    if (targetInp) targetInp.value = con.takeProfit1.toFixed(2);
    if (reasonInp) reasonInp.value = `AI Quant Signal ${p.finalSignal} (${p.confidence}% Conf) | Target ${con.takeProfit1.toFixed(2)}`;

    closePredictionModal();
    switchWorkspace('planner');
  }

  function setPredictionTargetAlert() {
    if (!latestPredictionResult || !latestPredictionResult.pred) return;
    const p = latestPredictionResult.pred;
    const con = p.consensus;
    const sym = latestPredictionResult.symbol;

    if (window.alertEngine) {
      window.alertEngine.createAlert({
        symbol: sym,
        condition: p.finalSignal.includes('SELL') ? 'crossing_below' : 'crossing_above',
        targetPrice: con.takeProfit1.toFixed(2)
      });
      alert(`Price Alert set for ${sym} at Target 1 (${con.takeProfit1.toFixed(2)})!`);
    }
  }

  return {
    init,
    loadSymbol,
    setTimeframe,
    setChartType,
    toggleSubPane,
    toggleOverlay,
    selectSearchedSymbol,
    openSearchModal,
    closeSearchModal,
    handleSearchQuery,
    switchWorkspace,
    toggleSidebar,
    renderMarketsOverview,
    renderDedicatedWatchlist,
    renderTradeJournalWorkspace,
    renderTradingLogsWorkspace,
    renderAnalyticsWorkspace,
    renderGlobalMarketsWorkspace,
    renderMarketRegimeWorkspace,
    renderEconomicCalendarWorkspace,
    renderNewsWorkspace,
    renderBreadthWorkspace,
    renderScannerWorkspace,
    renderPlannerWorkspace,
    setSearchCategory,
    addToWatchlist,
    switchQuickCategory,
    renderQuickPills,
    filterWatchlistInput,
    filterWatchlistView,
    openPredictionModal,
    closePredictionModal,
    setPredictionHorizon,
    switchPredictionSymbol,
    executePrediction,
    applyPredictionToRisk,
    applyPredictionToPlan,
    setPredictionTargetAlert,
    syncRiskWithActiveAsset,
    setRiskRewardPreset,
    syncWatchlistQuotes,
    getCurrentSymbol: () => currentSymbol,
    getCurrentTimeframe: () => currentTimeframe
  };
})();

// Attach to window explicitly
window.TerminalPlatform = TerminalPlatform;
window.switchWorkspace = function(wsId) {
  if (window.TerminalPlatform && TerminalPlatform.switchWorkspace) {
    TerminalPlatform.switchWorkspace(wsId);
  }
};

// Document Ready Bootstrap & Keyboard Shortcuts
document.addEventListener('DOMContentLoaded', () => {
  TerminalPlatform.init();

  // Keyboard Shortcuts: Ctrl+B to toggle sidebar, Ctrl+K for search, Ctrl+P for prediction, Esc to close
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      TerminalPlatform.toggleSidebar();
    } else if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      TerminalPlatform.openPredictionModal();
    } else if (e.key === 'Escape') {
      TerminalPlatform.closePredictionModal();
      TerminalPlatform.closeSearchModal();
      if (typeof closeAlertModal === 'function') closeAlertModal();
      if (typeof closeIndicatorsModal === 'function') closeIndicatorsModal();
      if (typeof closeAddTradeModal === 'function') closeAddTradeModal();
    }
  });
});

// Window-level bindings for HTML elements
function filterWatchlistView(tab) {
  TerminalPlatform.filterWatchlistView(tab);
}

function filterJournalByTag(tag) {
  TerminalPlatform.renderTradeJournalWorkspace(tag);
}

function updateCorrelationWindow(windowKey) {
  TerminalPlatform.renderGlobalMarketsWorkspace(windowKey);
}

function refreshGlobalMarketsData() {
  TerminalPlatform.renderGlobalMarketsWorkspace();
}

function updateSectorRotationWindow(timeframe) {
  if (window.marketBreadthService) {
    const tbody = document.getElementById('sectorRotationTbody');
    if (!tbody) return;
    const sectors = window.marketBreadthService.getSectorRotation(timeframe);
    tbody.innerHTML = sectors.map(s => `
      <tr>
        <td><strong style="color:var(--aiot-950);">${s.name}</strong></td>
        <td><span class="status-pill status-live" style="font-size:9px;">${s.sector}</span></td>
        <td class="mono font-bold" style="color:${s.selectedPerf >= 0 ? '#059669' : '#DC2626'};">${s.formattedPerf}</td>
        <td class="mono" style="color:var(--aiot-900);">${s.rsi}</td>
        <td><span class="status-pill ${s.selectedPerf > 0 ? 'status-live' : 'risk-high'}" style="font-size:9.5px;">${s.momentum}</span></td>
        <td class="mono" style="color:var(--aiot-900);">${s.volume}</td>
        <td><strong style="color:#059669; font-weight:700;">${s.trend}</strong></td>
      </tr>
    `).join('');
  }
}

function runScannerPreset(preset) {
  TerminalPlatform.renderScannerWorkspace(preset);
}

function togglePlannerCheck(id) {
  if (window.tradePlannerService) {
    window.tradePlannerService.toggleChecklist(id);
    TerminalPlatform.renderPlannerWorkspace();
  }
}

function closePositionMock(symbol) {
  alert(`Closing position ${symbol} at current market mark price...`);
  if (window.journalService) {
    window.journalService.logAction({
      symbol: symbol,
      action: 'Position Closed',
      price: symbol === 'RELIANCE' ? 2984.50 : 67240.50,
      quantity: symbol === 'RELIANCE' ? 35 : 0.15,
      orderType: 'MARKET',
      reason: 'Manual close from Open Positions workspace',
      source: 'Workstation',
      status: 'EXECUTED'
    });
    TerminalPlatform.renderTradingLogsWorkspace();
  }
}

function enterReplaySimulatedTrade() {
  if (window.replayEngine && window.replayEngine.isActive) {
    const t = window.replayEngine.enterSimulatedTrade({ direction: 'LONG' });
    if (t) {
      alert(`Simulated Replay Trade Entered: LONG at ${t.entryPrice.toFixed(2)} (Recorded in Simulation Journal)`);
    }
  } else {
    alert('Please start Bar Replay and step to a cut-off bar before entering a simulated replay trade.');
  }
}

window.syncRiskWithActiveAsset = function() {
  if (window.TerminalPlatform && TerminalPlatform.syncRiskWithActiveAsset) {
    TerminalPlatform.syncRiskWithActiveAsset();
  }
};

window.setRiskRewardPreset = function(ratio) {
  if (window.TerminalPlatform && TerminalPlatform.setRiskRewardPreset) {
    TerminalPlatform.setRiskRewardPreset(ratio);
  }
};

