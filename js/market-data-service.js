// ============================================================================
// js/market-data-service.js — Enterprise Market Data & Real-Time Streaming
// ============================================================================
'use strict';

const MarketDataService = (() => {
  // Supported timeframes in minutes/days
  const TIMEFRAMES = {
    '1m':  { label: '1m',  seconds: 60,       category: 'intraday', deltaRes: '1m',  yahooInterval: '1m',  yahooRange: '2d' },
    '3m':  { label: '3m',  seconds: 180,      category: 'intraday', deltaRes: '3m',  yahooInterval: '2m',  yahooRange: '5d' },
    '5m':  { label: '5m',  seconds: 300,      category: 'intraday', deltaRes: '5m',  yahooInterval: '5m',  yahooRange: '5d' },
    '10m': { label: '10m', seconds: 600,      category: 'intraday', deltaRes: '15m', yahooInterval: '5m',  yahooRange: '5d' },
    '15m': { label: '15m', seconds: 900,      category: 'intraday', deltaRes: '15m', yahooInterval: '15m', yahooRange: '5d' },
    '30m': { label: '30m', seconds: 1800,     category: 'intraday', deltaRes: '30m', yahooInterval: '30m', yahooRange: '1mo' },
    '45m': { label: '45m', seconds: 2700,     category: 'intraday', deltaRes: '1h',  yahooInterval: '15m', yahooRange: '1mo' },
    '1H':  { label: '1H',  seconds: 3600,     category: 'hourly',   deltaRes: '1h',  yahooInterval: '60m', yahooRange: '1mo' },
    '2H':  { label: '2H',  seconds: 7200,     category: 'hourly',   deltaRes: '2h',  yahooInterval: '60m', yahooRange: '3mo' },
    '3H':  { label: '3H',  seconds: 10800,    category: 'hourly',   deltaRes: '4h',  yahooInterval: '60m', yahooRange: '3mo' },
    '4H':  { label: '4H',  seconds: 14400,    category: 'hourly',   deltaRes: '4h',  yahooInterval: '60m', yahooRange: '6mo' },
    '1D':  { label: '1D',  seconds: 86400,    category: 'daily',    deltaRes: '1d',  yahooInterval: '1d',  yahooRange: '2y' },
    '1W':  { label: '1W',  seconds: 604800,   category: 'weekly',   deltaRes: '1w',  yahooInterval: '1wk', yahooRange: '5y' },
    '1M':  { label: '1M',  seconds: 2592000,  category: 'monthly',  deltaRes: '1w',  yahooInterval: '1mo', yahooRange: 'max' }
  };

  const DELTA_SYMBOL_MAP = {
    'BTC': 'BTCUSD', 'BTCUSD': 'BTCUSD',
    'ETH': 'ETHUSD', 'ETHUSD': 'ETHUSD',
    'SOL': 'SOLUSD', 'SOLUSD': 'SOLUSD',
    'XRP': 'XRPUSD', 'XRPUSD': 'XRPUSD',
    'XAUTUSD': 'XAUTUSD', 'GOLD': 'XAUTUSD',
    'DOGE': 'DOGEUSD', 'DOGEUSD': 'DOGEUSD',
    'ADA': 'ADAUSD', 'ADAUSD': 'ADAUSD',
    'AVAX': 'AVAXUSD', 'AVAXUSD': 'AVAXUSD',
    'LINK': 'LINKUSD', 'LINKUSD': 'LINKUSD',
    'SUI': 'SUIUSD', 'SUIUSD': 'SUIUSD',
    'PEPE': 'PEPEUSD', 'PEPEUSD': 'PEPEUSD'
  };

  const YAHOO_MAP = {
    // ── Global Indices ──
    'NIFTY_50': '%5ENSEI',
    'NIFTY 50': '%5ENSEI',
    'NIFTY': '%5ENSEI',
    '^NSEI': '%5ENSEI',
    'BANKNIFTY': '%5ENSEBANK',
    'BANK NIFTY': '%5ENSEBANK',
    '^NSEBANK': '%5ENSEBANK',
    'SENSEX': '%5EBSESN',
    '^BSESN': '%5EBSESN',
    'NIFTY_200': '%5EN200',
    'NIFTY_FIN_SERVICES': 'NIFTY_FIN_SERVICE.NS',
    'FINNIFTY': 'NIFTY_FIN_SERVICE.NS',
    'SPX': '%5EGSPC',
    '^GSPC': '%5EGSPC',
    'S&P 500': '%5EGSPC',
    'NDX': '%5ENDX',
    '^NDX': '%5ENDX',
    'NASDAQ': '%5EIXIC',
    '^IXIC': '%5EIXIC',
    'NASDAQ 100': '%5ENDX',
    'DJI': '%5EDJI',
    '^DJI': '%5EDJI',
    'DAX': '%5EGDAXI',
    '^GDAXI': '%5EGDAXI',
    'FTSE': '%5EFTSE',
    '^FTSE': '%5EFTSE',

    // ── Crypto & Commodities ──
    'XAUUSD': 'GC=F',
    'GOLD': 'GC=F',
    'CRUDEOIL': 'CL=F',
    'USOIL': 'CL=F',
    'SILVER': 'SI=F',
    'BTCUSD': 'BTC-USD',
    'BTC': 'BTC-USD',
    'ETHUSD': 'ETH-USD',
    'ETH': 'ETH-USD',
    'SOLUSD': 'SOL-USD',
    'SOL': 'SOL-USD',

    // ── US Tech & ETFs ──
    'AAPL': 'AAPL',
    'NVDA': 'NVDA',
    'MSFT': 'MSFT',
    'TSLA': 'TSLA',
    'AMZN': 'AMZN',
    'GOOGL': 'GOOGL',
    'GOOG': 'GOOGL',
    'META': 'META',
    'AMD': 'AMD',
    'PLTR': 'PLTR',
    'NFLX': 'NFLX',
    'COIN': 'COIN',
    'INTC': 'INTC',
    'QQQ': 'QQQ',
    'SPY': 'SPY',
    'DIA': 'DIA',
    'IWM': 'IWM',

    // ── Indian Bluechips ──
    'RELIANCE': 'RELIANCE.NS',
    'TCS': 'TCS.NS',
    'HDFCBANK': 'HDFCBANK.NS',
    'INFY': 'INFY.NS',
    'ICICIBANK': 'ICICIBANK.NS',
    'SBIN': 'SBIN.NS',
    'TATAMOTORS': 'TATAMOTORS.NS',
    'BHARTIARTL': 'BHARTIARTL.NS',
    'ITC': 'ITC.NS',
    'LT': 'LT.NS',
    'WIPRO': 'WIPRO.NS',
    'MARUTI': 'MARUTI.NS',
    'SUNPHARMA': 'SUNPHARMA.NS',
    'TITAN': 'TITAN.NS',
    'BAJFINANCE': 'BAJFINANCE.NS',
    'ADANIENT': 'ADANIENT.NS',
    'ADANIPORTS': 'ADANIPORTS.NS',
    'TATASTEEL': 'TATASTEEL.NS',
    'HINDUNILVR': 'HINDUNILVR.NS',
    'AXISBANK': 'AXISBANK.NS',
    'KOTAKBANK': 'KOTAKBANK.NS'
  };

  const US_SYMBOLS_SET = new Set([
    'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'AMD', 'PLTR',
    'NFLX', 'COIN', 'INTC', 'QQQ', 'SPY', 'DIA', 'IWM', 'SOXX', 'NDX', 'SPX', 'DJI'
  ]);

  function resolveYahooSymbol(symbol) {
    if (!symbol) return '^NSEI';
    let upper = symbol.toUpperCase().trim();
    if (upper.endsWith('.NS')) {
      const root = upper.replace('.NS', '');
      if (US_SYMBOLS_SET.has(root) || YAHOO_MAP[root]) upper = root;
    }
    if (YAHOO_MAP[upper]) return YAHOO_MAP[upper];
    if (US_SYMBOLS_SET.has(upper)) return upper;
    if (upper.startsWith('^') || upper.includes('.') || upper.includes('=') || upper.includes('-') || upper.includes('/')) {
      return upper.replace('/', '');
    }
    return `${upper}.NS`;
  }

  // Memory cache of datasets: key -> Array of candle objects { time, open, high, low, close, volume }
  const dataCache = new Map();
  let activeWs = null;
  let pollingTimer = null;
  let currentSymbol = 'BTCUSD';
  let currentTimeframe = '1m';
  let isFetchingOlder = false;
  let listeners = [];
  let connectionStatus = 'DISCONNECTED'; // LIVE, DELAYED, RECONNECTING, DISCONNECTED

  function isDeltaAsset(symbol) {
    const s = (symbol || '').toUpperCase();
    if (s in DELTA_SYMBOL_MAP) return true;
    if (s.endsWith('USD') || s.endsWith('USDT') || s.includes('PERP')) return true;
    return false;
  }

  function getCacheKey(symbol, timeframe) {
    return `${symbol.toUpperCase()}_${timeframe}`;
  }

  // ── 1. Fetch Initial Historical Candles ──────────────────────────────────
  async function loadCandles(symbol, timeframe = '1m', limit = 300) {
    const key = getCacheKey(symbol, timeframe);
    const tfConfig = TIMEFRAMES[timeframe] || TIMEFRAMES['1m'];
    currentSymbol = symbol;
    currentTimeframe = timeframe;

    notifyStatus('CONNECTING');

    try {
      let candles = [];
      if (isDeltaAsset(symbol)) {
        const deltaSym = DELTA_SYMBOL_MAP[symbol.toUpperCase()] || symbol;
        const res = tfConfig.deltaRes || '1m';
        const url = `/api/delta/candles?symbol=${encodeURIComponent(deltaSym)}&resolution=${res}&limit=${limit}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.candles && json.candles.length > 0) {
            candles = json.candles.map(c => ({
              time: Number(c.t),
              open: Number(c.o),
              high: Number(c.h),
              low: Number(c.l),
              close: Number(c.c),
              volume: Number(c.v)
            }));
          }
        }
      } else {
        // Indian Stock or Index or Global Asset via Yahoo Proxy
        const ySym = resolveYahooSymbol(symbol);
        const yInt = tfConfig.yahooInterval || '1m';
        const yRange = tfConfig.yahooRange || '5d';
        const url = `/api/live?symbol=${encodeURIComponent(ySym)}&interval=${yInt}&range=${yRange}&limit=${limit}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          if (json.candles && json.candles.length > 0) {
            candles = json.candles.map(c => ({
              time: Number(c.t),
              open: Number(c.o),
              high: Number(c.h),
              low: Number(c.l),
              close: Number(c.c),
              volume: Number(c.v)
            }));
          }
        }
      }

      // Deduplicate & Sort strictly ascending by time
      candles = deduplicateAndSort(candles);

      if (candles.length > 0) {
        dataCache.set(key, candles);
        notifyStatus('LIVE');
        startRealtimeStream(symbol, timeframe);
        return { success: true, symbol, timeframe, candles };
      } else {
        notifyStatus('DATA_UNAVAILABLE');
        return { success: false, error: 'No candles returned for this asset or timeframe.' };
      }
    } catch (err) {
      console.error('[MarketDataService] Load candles failed:', err);
      notifyStatus('ERROR');
      return { success: false, error: err.message };
    }
  }

  // ── 2. Backward Infinite Scrolling (Load Older Candles) ─────────────────
  async function loadOlderCandles(symbol, timeframe, limit = 200) {
    if (isFetchingOlder) return null;
    const key = getCacheKey(symbol, timeframe);
    const existing = dataCache.get(key) || [];
    if (existing.length === 0) return null;

    const earliestTime = existing[0].time; // in ms
    const tfConfig = TIMEFRAMES[timeframe] || TIMEFRAMES['1m'];
    const secPerCandle = tfConfig.seconds || 60;
    const endSeconds = Math.floor(earliestTime / 1000) - 1;
    const startSeconds = endSeconds - (secPerCandle * limit);

    isFetchingOlder = true;
    try {
      let olderCandles = [];
      if (isDeltaAsset(symbol)) {
        const deltaSym = DELTA_SYMBOL_MAP[symbol.toUpperCase()] || symbol;
        const res = tfConfig.deltaRes || '1m';
        const url = `/api/delta/candles?symbol=${encodeURIComponent(deltaSym)}&resolution=${res}&start=${startSeconds}&end=${endSeconds}&limit=${limit}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          if (json.success && json.candles && json.candles.length > 0) {
            olderCandles = json.candles.map(c => ({
              time: Number(c.t),
              open: Number(c.o),
              high: Number(c.h),
              low: Number(c.l),
              close: Number(c.c),
              volume: Number(c.v)
            }));
          }
        }
      } else {
        const ySym = resolveYahooSymbol(symbol);
        const yInt = tfConfig.yahooInterval || '1m';
        const url = `/api/live?symbol=${encodeURIComponent(ySym)}&interval=${yInt}&period1=${startSeconds}&period2=${endSeconds}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          if (json.candles && json.candles.length > 0) {
            olderCandles = json.candles.map(c => ({
              time: Number(c.t),
              open: Number(c.o),
              high: Number(c.h),
              low: Number(c.l),
              close: Number(c.c),
              volume: Number(c.v)
            }));
          }
        }
      }

      if (olderCandles.length > 0) {
        // Merge without duplicates and sort
        const merged = deduplicateAndSort([...olderCandles, ...existing]);
        const newCount = merged.length - existing.length;
        dataCache.set(key, merged);
        isFetchingOlder = false;
        return { success: true, addedCount: newCount, totalCount: merged.length, candles: merged };
      }
    } catch (e) {
      console.warn('[MarketDataService] Error loading older candles:', e);
    }
    isFetchingOlder = false;
    return { success: false, addedCount: 0 };
  }

  // ── 3. Real-Time Streaming & Candle Aggregation ──────────────────────────
  function startRealtimeStream(symbol, timeframe) {
    stopRealtimeStream();
    const tfConfig = TIMEFRAMES[timeframe] || TIMEFRAMES['1m'];

    if (isDeltaAsset(symbol)) {
      // Connect to genuine Delta Exchange India WebSocket
      try {
        const deltaSym = DELTA_SYMBOL_MAP[symbol.toUpperCase()] || symbol;
        const dRes = tfConfig.deltaRes || '1m';
        activeWs = new WebSocket("wss://public-socket.india.delta.exchange");

        activeWs.onopen = () => {
          notifyStatus('LIVE');
          const subMsg = {
            type: "subscribe",
            payload: {
              channels: [
                { name: `candlestick_${dRes}`, symbols: [deltaSym] },
                { name: "l2_updates", symbols: [deltaSym] }
              ]
            }
          };
          activeWs.send(JSON.stringify(subMsg));
        };

        activeWs.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.channel && msg.channel.startsWith('candlestick_')) {
              handleIncomingCandleUpdate(symbol, timeframe, {
                time: Math.floor(msg.timestamp / 1000) * 1000,
                open: Number(msg.open),
                high: Number(msg.high),
                low: Number(msg.low),
                close: Number(msg.close),
                volume: Number(msg.volume || 0)
              });
            } else if (msg.type === 'l2_updates' || msg.price) {
              const tickPrice = Number(msg.price || msg.mark_price);
              if (!isNaN(tickPrice) && tickPrice > 0) {
                handlePriceTick(symbol, timeframe, tickPrice);
              }
            }
          } catch (err) {}
        };

        activeWs.onerror = () => {
          notifyStatus('RECONNECTING');
        };

        activeWs.onclose = () => {
          if (currentSymbol === symbol) {
            notifyStatus('RECONNECTING');
            setTimeout(() => {
              if (currentSymbol === symbol) startRealtimeStream(symbol, timeframe);
            }, 3000);
          }
        };
      } catch (err) {
        console.warn('[MarketDataService] WebSocket stream error:', err);
      }
    } else {
      // Indian equity / index polling loop (every 15 seconds)
      const pollIntervalMs = 15000;
      pollingTimer = setInterval(async () => {
        try {
          const ySym = resolveYahooSymbol(symbol);
          const yInt = tfConfig.yahooInterval || '1m';
          const url = `/api/live?symbol=${encodeURIComponent(ySym)}&interval=${yInt}&range=1d&limit=5`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            if (data.candles && data.candles.length > 0) {
              const latest = data.candles[data.candles.length - 1];
              handleIncomingCandleUpdate(symbol, timeframe, {
                time: Number(latest.t),
                open: Number(latest.o),
                high: Number(latest.h),
                low: Number(latest.l),
                close: Number(latest.c),
                volume: Number(latest.v)
              });
            }
          }
        } catch (e) {}
      }, pollIntervalMs);
    }
  }

  function stopRealtimeStream() {
    if (activeWs) {
      try { activeWs.close(); } catch (e) {}
      activeWs = null;
    }
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  // ── 4. Incremental Tick & Active Candle Updater ──────────────────────────
  function handleIncomingCandleUpdate(symbol, timeframe, update) {
    const key = getCacheKey(symbol, timeframe);
    let candles = dataCache.get(key);
    if (!candles || candles.length === 0) return;

    // Safety filter against corrupt or wildly deviated ticks (>15% jump on 1m is corrupt)
    if (last && Math.abs(update.close - last.close) / last.close > 0.15) {
      return;
    }

    const tfConfig = TIMEFRAMES[timeframe] || TIMEFRAMES['1m'];
    const periodMs = (tfConfig.seconds || 60) * 1000;

    let isNew = false;
    if (update.time >= last.time + periodMs) {
      // New candle roll-over
      const newCandle = {
        time: update.time,
        open: update.open || last.close,
        high: update.high || update.open || last.close,
        low: update.low || update.open || last.close,
        close: update.close,
        volume: update.volume || 0
      };
      candles.push(newCandle);
      isNew = true;
    } else {
      // In-place incremental update of active candle
      last.high = Math.max(last.high, update.high || update.close);
      last.low = Math.min(last.low, update.low || update.close);
      last.close = update.close;
      if (update.volume) last.volume = update.volume;
    }

    emit('tick', { symbol, timeframe, candle: candles[candles.length - 1], isNew, candles });
  }

  function handlePriceTick(symbol, timeframe, price) {
    const key = getCacheKey(symbol, timeframe);
    const candles = dataCache.get(key);
    if (!candles || candles.length === 0) return;

    const last = candles[candles.length - 1];
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;

    emit('tick', { symbol, timeframe, candle: last, isNew: false, candles });
  }

  // ── Helpers & Listeners ──────────────────────────────────────────────────
  function deduplicateAndSort(candles) {
    const map = new Map();
    for (const c of candles) {
      if (c && !isNaN(c.close) && c.time) {
        map.set(c.time, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }

  function notifyStatus(status) {
    connectionStatus = status;
    emit('status', { status });
  }

  function on(eventName, callback) {
    listeners.push({ eventName, callback });
    return () => {
      listeners = listeners.filter(l => l.callback !== callback);
    };
  }

  function emit(eventName, data) {
    for (const l of listeners) {
      if (l.eventName === eventName) {
        try { l.callback(data); } catch (e) { console.error(e); }
      }
    }
  }

  function getCandles(symbol, timeframe) {
    const key = getCacheKey(symbol, timeframe);
    return dataCache.get(key) || [];
  }

  return {
    TIMEFRAMES,
    DELTA_SYMBOL_MAP,
    YAHOO_MAP,
    isDeltaAsset,
    loadCandles,
    loadOlderCandles,
    getCandles,
    stopRealtimeStream,
    on,
    getStatus: () => connectionStatus
  };
})();

if (typeof window !== 'undefined') window.MarketDataService = MarketDataService;
