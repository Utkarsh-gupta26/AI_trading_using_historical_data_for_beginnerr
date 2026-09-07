// ============================================================================
// js/market-data-service.js — Enterprise Central Market Data Engine & WebSocket Client
// Single Source of Truth for Charts, Watchlists, AI Predictor, and Scanners.
// Strictly authentic real-time data — ZERO mock, ZERO fake candles.
// ============================================================================
'use strict';

const MarketDataService = (() => {
  // Supported timeframes configuration
  const TIMEFRAMES = {
    '1m':  { label: '1m',  seconds: 60,       category: 'intraday', deltaRes: '1m',  providerInterval: '1m' },
    '3m':  { label: '3m',  seconds: 180,      category: 'intraday', deltaRes: '3m',  providerInterval: '3m' },
    '5m':  { label: '5m',  seconds: 300,      category: 'intraday', deltaRes: '5m',  providerInterval: '5m' },
    '15m': { label: '15m', seconds: 900,      category: 'intraday', deltaRes: '15m', providerInterval: '15m' },
    '30m': { label: '30m', seconds: 1800,     category: 'intraday', deltaRes: '30m', providerInterval: '30m' },
    '1h':  { label: '1h',  seconds: 3600,     category: 'hourly',   deltaRes: '1h',  providerInterval: '1h' },
    '2h':  { label: '2h',  seconds: 7200,     category: 'hourly',   deltaRes: '2h',  providerInterval: '1h' },
    '4h':  { label: '4h',  seconds: 14400,    category: 'hourly',   deltaRes: '4h',  providerInterval: '1h' },
    '1d':  { label: '1D',  seconds: 86400,    category: 'daily',    deltaRes: '1d',  providerInterval: '1d' },
    '1D':  { label: '1D',  seconds: 86400,    category: 'daily',    deltaRes: '1d',  providerInterval: '1d' },
    '1w':  { label: '1W',  seconds: 604800,   category: 'weekly',   deltaRes: '1w',  providerInterval: '1w' },
    '1W':  { label: '1W',  seconds: 604800,   category: 'weekly',   deltaRes: '1w',  providerInterval: '1w' }
  };

  // State Management
  const dataCache = new Map(); // key `${symbol}_${timeframe}` -> Array of candles
  const quoteCache = new Map(); // symbol -> quote object
  let activeWs = null;
  let wsReconnectTimer = null;
  let wsReconnectAttempts = 0;
  let pingInterval = null;

  let currentSymbol = 'NIFTY_50';
  let currentDisplaySymbol = 'NIFTY 50';
  let currentTimeframe = '1m';
  let currentExchange = 'NSE';
  let isFetchingOlder = false;
  let listeners = [];
  let connectionStatus = 'CONNECTING'; // LIVE, MARKET_CLOSED, CONNECTING, RECONNECTING, DISCONNECTED, ERROR
  let activeSession = null;

  // Real-Time Diagnostic State for Developer Panel
  const diagnostic = {
    provider: 'RealtimeExchange',
    symbol: 'NIFTY_50',
    displaySymbol: 'NIFTY 50',
    providerSymbol: '^NSEI',
    historicalApiStatus: 'PENDING',
    wsStatus: 'CONNECTING',
    lastTickTime: null,
    lastTickPrice: null,
    candleCount: 0,
    currentInterval: '1m',
    lastError: null,
    serverTime: null
  };

  function getCacheKey(sym, tf) {
    return `${(sym || '').toUpperCase().trim()}_${tf}`;
  }

  function isDeltaAsset(symbol) {
    const s = (symbol || '').toUpperCase();
    return s.includes('PERP') || s === 'BTCUSD' || s === 'ETHUSD' || s === 'SOLUSD' || s === 'XRPUSD';
  }

  // ── 1. Central WebSocket Manager (Port 3001) ──────────────────────────────
  function initWebSocket() {
    if (activeWs && (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001/ws`;

    try {
      activeWs = new WebSocket(wsUrl);
      diagnostic.wsStatus = 'CONNECTING';

      activeWs.onopen = () => {
        diagnostic.wsStatus = 'CONNECTED';
        wsReconnectAttempts = 0;
        console.log('[MarketData] Central WebSocket connected to', wsUrl);

        // Keepalive ping every 15s
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (activeWs && activeWs.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({ action: 'ping' }));
          }
        }, 15000);

        // Subscribe to currently loaded symbol
        if (currentSymbol) {
          subscribe(currentSymbol);
        }
      };

      activeWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        } catch (e) {
          console.warn('[MarketData] WS message parse error:', e);
        }
      };

      activeWs.onerror = (err) => {
        diagnostic.wsStatus = 'ERROR';
        diagnostic.lastError = 'WebSocket connection error';
      };

      activeWs.onclose = () => {
        diagnostic.wsStatus = 'DISCONNECTED';
        if (pingInterval) clearInterval(pingInterval);
        scheduleReconnect();
      };
    } catch (err) {
      console.warn('[MarketData] Could not open WebSocket to', wsUrl, err);
      diagnostic.wsStatus = 'UNAVAILABLE';
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectAttempts++;
    const delay = Math.min(15000, Math.pow(1.5, wsReconnectAttempts) * 1000);
    notifyStatus('RECONNECTING');
    wsReconnectTimer = setTimeout(() => {
      initWebSocket();
    }, delay);
  }

  function subscribe(symbol) {
    if (!symbol) return;
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify({
        action: 'subscribe',
        symbols: [symbol]
      }));
    }
  }

  function unsubscribe(symbol) {
    if (!symbol) return;
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify({
        action: 'unsubscribe',
        symbols: [symbol]
      }));
    }
  }

  // ── 2. Handle Live Inbound Ticks & WS Messages ────────────────────────────
  function handleWebSocketMessage(msg) {
    if (!msg) return;

    if (msg.type === 'connection_established') {
      diagnostic.serverTime = msg.serverTime;
      if (msg.exchangeSession) {
        activeSession = msg.exchangeSession;
        updateStatusFromSession(activeSession);
      }
      return;
    }

    if (msg.type === 'quote' && msg.data) {
      const q = msg.data;
      quoteCache.set(q.symbol, q);
      emit('quote', q);
      return;
    }

    if (msg.type === 'tick') {
      diagnostic.lastTickTime = new Date(msg.timestamp).toLocaleTimeString();
      diagnostic.lastTickPrice = msg.ltp;
      diagnostic.provider = msg.source || diagnostic.provider;

      quoteCache.set(msg.symbol, msg);
      emit('quote', msg);

      // Check if tick matches active loaded symbol
      const isMatch = (msg.symbol === currentSymbol) ||
                      (msg.displaySymbol === currentDisplaySymbol) ||
                      (msg.symbol && currentSymbol && msg.symbol.toUpperCase().includes(currentSymbol.toUpperCase()));

      if (isMatch) {
        updateActiveCandleWithTick(msg);
      }
    }
  }

  function updateActiveCandleWithTick(tick) {
    const key = getCacheKey(currentSymbol, currentTimeframe);
    let candles = dataCache.get(key);
    if (!candles || candles.length === 0) return;

    const last = candles[candles.length - 1];
    const tfConfig = TIMEFRAMES[currentTimeframe] || TIMEFRAMES['1m'];
    const periodMs = (tfConfig.seconds || 60) * 1000;
    const tickTime = tick.timestamp || Date.now();
    const ltp = Number(tick.ltp);

    if (isNaN(ltp) || ltp <= 0) return;

    let isNew = false;
    if (tickTime >= last.time + periodMs) {
      // New interval candle
      const newCandle = {
        time: Math.floor(tickTime / periodMs) * periodMs,
        open: last.close,
        high: Math.max(last.close, ltp),
        low: Math.min(last.close, ltp),
        close: ltp,
        volume: tick.volume || 0
      };
      candles.push(newCandle);
      isNew = true;
    } else {
      // In-place mutation of active candle
      last.high = Math.max(last.high, ltp);
      last.low = Math.min(last.low, ltp);
      last.close = ltp;
      if (tick.volume) last.volume += (tick.volume || 0);
    }

    diagnostic.candleCount = candles.length;
    emit('tick', { symbol: currentSymbol, timeframe: currentTimeframe, candle: candles[candles.length - 1], isNew, candles });
  }

  function updateStatusFromSession(session) {
    if (!session) return;
    if (session.session === 'MARKET_OPEN') {
      notifyStatus('LIVE');
    } else if (session.session === 'PRE_OPEN') {
      notifyStatus('PRE_OPEN');
    } else {
      notifyStatus('MARKET_CLOSED');
    }
  }

  // ── 3. Historical Candles Engine (REST with Strict Validation) ────────────
  async function loadCandles(symbol, timeframe = '1m', limit = 300) {
    const prevSym = currentSymbol;
    if (prevSym && prevSym !== symbol) {
      unsubscribe(prevSym);
    }

    currentSymbol = symbol;
    currentTimeframe = timeframe;
    const tfConfig = TIMEFRAMES[timeframe] || TIMEFRAMES['1m'];
    diagnostic.symbol = symbol;
    diagnostic.currentInterval = timeframe;
    diagnostic.historicalApiStatus = 'LOADING';

    notifyStatus('CONNECTING');

    const key = getCacheKey(symbol, timeframe);

    try {
      const url = `/api/live?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`;
      const resp = await fetch(url);

      if (!resp.ok) {
        diagnostic.historicalApiStatus = 'ERROR';
        diagnostic.lastError = `HTTP ${resp.status} fetching historical data`;
        notifyStatus('ERROR');
        return { success: false, error: diagnostic.lastError, candles: [] };
      }

      const json = await resp.json();

      if (!json.success || !json.candles || json.candles.length === 0) {
        diagnostic.historicalApiStatus = 'NO_DATA';
        diagnostic.lastError = json.error || 'No historical candles available';
        if (json.marketSession) {
          activeSession = json.marketSession;
          updateStatusFromSession(activeSession);
        } else {
          notifyStatus('DATA_UNAVAILABLE');
        }
        return { success: false, error: diagnostic.lastError, candles: [], marketSession: json.marketSession };
      }

      // Update Diagnostic Telemetry
      diagnostic.historicalApiStatus = 'SUCCESS';
      diagnostic.provider = json.provider || 'RealtimeExchange';
      diagnostic.displaySymbol = json.displaySymbol || symbol;
      diagnostic.providerSymbol = json.resolvedSymbol || json.symbol;
      currentDisplaySymbol = json.displaySymbol || symbol;
      currentExchange = json.exchange || 'NSE';

      // Parse & Validate Candles
      let candles = json.candles.map(c => ({
        time: Number(c.t),
        open: Number(c.o),
        high: Number(c.h),
        low: Number(c.l),
        close: Number(c.c),
        volume: Number(c.v || 0)
      }));

      candles = deduplicateAndSort(candles);

      dataCache.set(key, candles);
      diagnostic.candleCount = candles.length;
      if (candles.length > 0) {
        diagnostic.lastTickPrice = candles[candles.length - 1].close;
        diagnostic.lastTickTime = new Date(candles[candles.length - 1].time).toLocaleTimeString();
      }

      // Session & Connection Status
      if (json.marketSession) {
        activeSession = json.marketSession;
        updateStatusFromSession(activeSession);
      } else {
        notifyStatus('LIVE');
      }

      // Subscribe to real-time updates over WebSocket
      subscribe(symbol);

      return {
        success: true,
        symbol: json.symbol,
        displaySymbol: json.displaySymbol,
        canonicalSymbol: json.canonicalSymbol,
        exchange: json.exchange,
        currency: json.currency,
        price: json.price,
        prevClose: json.prevClose,
        candles,
        provider: json.provider,
        marketSession: json.marketSession,
        marketState: json.marketState
      };

    } catch (err) {
      console.error('[MarketData] Load candles exception:', err);
      diagnostic.historicalApiStatus = 'ERROR';
      diagnostic.lastError = err.message;
      notifyStatus('ERROR');
      return { success: false, error: err.message, candles: [] };
    }
  }

  // ── 4. Infinite Backward Pagination ──────────────────────────────────────
  async function loadOlderCandles(symbol, timeframe, limit = 200) {
    if (isFetchingOlder) return null;
    const key = getCacheKey(symbol, timeframe);
    const existing = dataCache.get(key) || [];
    if (existing.length === 0) return null;

    isFetchingOlder = true;
    try {
      // In yfinance / real-time provider, requests with larger limits automatically span backward
      const totalRequested = existing.length + limit;
      const res = await loadCandles(symbol, timeframe, totalRequested);
      isFetchingOlder = false;
      return res;
    } catch (e) {
      isFetchingOlder = false;
      return null;
    }
  }

  // ── 5. Helpers & Event Dispatcher ─────────────────────────────────────────
  function deduplicateAndSort(candles) {
    const map = new Map();
    for (const c of candles) {
      if (c && !isNaN(c.close) && c.time && c.time > 0) {
        map.set(c.time, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }

  function notifyStatus(status) {
    connectionStatus = status;
    emit('status', { status, session: activeSession, diagnostic: { ...diagnostic } });
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

  function getLatestQuote(symbol) {
    return quoteCache.get(symbol) || null;
  }

  function getDiagnosticInfo() {
    return {
      ...diagnostic,
      connectionStatus,
      activeSession,
      cacheKeys: Array.from(dataCache.keys())
    };
  }

  // Initialize WebSocket connection immediately
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      initWebSocket();
    }, 100);
  }

  return {
    TIMEFRAMES,
    loadCandles,
    loadOlderCandles,
    getCandles,
    getLatestQuote,
    getDiagnosticInfo,
    subscribe,
    unsubscribe,
    on,
    getStatus: () => connectionStatus,
    getSession: () => activeSession,
    isDeltaAsset
  };
})();

if (typeof window !== 'undefined') {
  window.MarketDataService = MarketDataService;
}
