// ==========================================================================
// live_engine.js — Real-time Live Market Data & Delta Exchange Engine
// ==========================================================================

const LiveEngine = (() => {
  let activeWs = null;
  let pollInterval = null;
  let currentInterval = '1m'; // 1m, 5m, 15m, 1h, 1D
  let lastPrice = null;
  let onTickCallback = null;

  // Delta Exchange India symbol mapping
  const DELTA_MAP = {
    'BTC': 'BTCUSD',
    'BTCUSD': 'BTCUSD',
    'ETH': 'ETHUSD',
    'ETHUSD': 'ETHUSD',
    'XAUUSD': 'XAUTUSD',
    'XAUTUSD': 'XAUTUSD',
    'SOL': 'SOLUSD',
    'SOLUSD': 'SOLUSD',
    'XRP': 'XRPUSD',
    'XRPUSD': 'XRPUSD'
  };

  const DELTA_INTERVALS = {
    '1m': '1m',
    '3m': '3m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '2h': '2h',
    '4h': '4h',
    '1D': '1d',
    '1W': '1w'
  };

  function isDeltaAsset(symbol) {
    if (symbol in DELTA_MAP) return true;
    const s = (symbol || '').toUpperCase();
    if (s.endsWith('USD') || s.endsWith('USDT') || s.includes('PERP')) return true;
    return false;
  }

  function isCryptoOrGold(symbol) {
    return isDeltaAsset(symbol);
  }

  // ── Format helpers ───────────────────────────────────────────────────────
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function formatDateStr(d) {
    return `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
  }
  function formatTimeStr(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ── Connect Live Feed ────────────────────────────────────────────────────
  function connect(symbol, interval, onTick) {
    disconnect();
    currentInterval = interval || currentInterval;
    onTickCallback = onTick;

    updateStatusUI('connecting', 'Connecting...');

    if (isDeltaAsset(symbol)) {
      connectDeltaLive(symbol, currentInterval);
    } else {
      connectIndianLive(symbol, currentInterval);
    }
  }

  function disconnect() {
    if (activeWs) {
      try { activeWs.close(); } catch(e) {}
      activeWs = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    lastPrice = null;
  }

  // ── 1. Delta Exchange Live WebSocket & Authenticated REST ────────────────
  async function connectDeltaLive(symbol, interval) {
    const deltaSym = DELTA_MAP[symbol] || symbol;
    const dInterval = DELTA_INTERVALS[interval] || '1m';

    // 1. Fetch initial candles from Delta Exchange proxy
    try {
      updateStatusUI('connecting', 'Loading Delta candles...');
      const url = `/api/delta/candles?symbol=${encodeURIComponent(deltaSym)}&resolution=${encodeURIComponent(dInterval)}&limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const raw = await res.json();
        if (raw.success && raw.candles && raw.candles.length > 0) {
          const candles = raw.candles.map(k => {
            const dt = new Date(k.t);
            return {
              date: dt,
              dateStr: dInterval === '1d' ? formatDateStr(dt) : formatTimeStr(dt),
              open: k.o,
              high: k.h,
              low: k.l,
              close: k.c,
              volume: k.v,
              turnover: 0
            };
          });

          MARKET_DATA[symbol].data = candles;
          const latestPrice = candles[candles.length - 1].close;
          handlePriceUpdate(symbol, latestPrice, candles);
        }
      }
    } catch(e) {
      console.warn("Could not fetch Delta REST candles:", e);
    }

    // 2. Connect Delta Exchange India Public WebSocket
    try {
      const wsUrl = "wss://public-socket.india.delta.exchange";
      activeWs = new WebSocket(wsUrl);

      activeWs.onopen = () => {
        updateStatusUI('live-ws', '⚡ DELTA LIVE (<50ms)');
        // Subscribe to candlestick channel
        const subMsg = {
          type: "subscribe",
          payload: {
            channels: [
              {
                name: `candlestick_${dInterval}`,
                symbols: [deltaSym]
              }
            ]
          }
        };
        activeWs.send(JSON.stringify(subMsg));
      };

      activeWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type && msg.type.startsWith('candlestick_') && msg.sy === deltaSym) {
            // Timestamp: cst is microseconds
            const timeMs = msg.cst ? Math.floor(msg.cst / 1000) : Date.now();
            const dt = new Date(timeMs);
            const candle = {
              date: dt,
              dateStr: dInterval === '1d' ? formatDateStr(dt) : formatTimeStr(dt),
              open: parseFloat(msg.o),
              high: parseFloat(msg.h),
              low: parseFloat(msg.l),
              close: parseFloat(msg.c),
              volume: parseFloat(msg.v || 0),
              turnover: 0
            };

            const dataArr = MARKET_DATA[symbol].data;
            if (dataArr.length > 0) {
              const lastCandle = dataArr[dataArr.length - 1];
              if (Math.abs(lastCandle.date.getTime() - candle.date.getTime()) < 50000) {
                // Update in place
                dataArr[dataArr.length - 1] = candle;
              } else if (candle.date.getTime() > lastCandle.date.getTime()) {
                dataArr.push(candle);
                if (dataArr.length > 150) dataArr.shift();
              }
            } else {
              dataArr.push(candle);
            }

            handlePriceUpdate(symbol, candle.close, dataArr);
          }
        } catch(err) {
          console.error("Delta WS parse error:", err);
        }
      };

      activeWs.onerror = (err) => {
        console.warn("Delta WS error, falling back to REST poll:", err);
        updateStatusUI('poll', 'DELTA (Polling)');
        startDeltaPolling(symbol, interval);
      };

      activeWs.onclose = () => {
        console.log("Delta WS closed");
      };

    } catch(e) {
      console.error("Error setting up Delta WS:", e);
      startDeltaPolling(symbol, interval);
    }
  }

  function startDeltaPolling(symbol, interval) {
    const deltaSym = DELTA_MAP[symbol] || symbol;
    const dInterval = DELTA_INTERVALS[interval] || '1m';
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/delta/candles?symbol=${encodeURIComponent(deltaSym)}&resolution=${encodeURIComponent(dInterval)}&limit=5`);
        if (res.ok) {
          const d = await res.json();
          if (d.success && d.candles && d.candles.length > 0) {
            const latest = d.candles[d.candles.length - 1];
            const dataArr = MARKET_DATA[symbol].data;
            if (dataArr.length > 0) {
              const last = dataArr[dataArr.length - 1];
              last.close = latest.c;
              last.high = Math.max(last.high, latest.h);
              last.low = Math.min(last.low, latest.l);
              last.volume = latest.v;
              handlePriceUpdate(symbol, latest.c, dataArr);
            }
          }
        }
      } catch(e) {}
    }, 2000);
  }

  // ── 2. Indian Market Live Polling Feed ──────────────────────────────────
  async function connectIndianLive(symbol, interval) {
    updateStatusUI('poll', 'NSE Live / Daily');
    const meta = MARKET_DATA[symbol];
    if (meta && meta.data && meta.data.length > 0) {
      const last = meta.data[meta.data.length - 1];
      handlePriceUpdate(symbol, last.c || last.close, meta.data);
    }
    
    // Fetch quotes / candles from /api/live
    try {
      const res = await fetch(`/api/live?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
      if (res.ok) {
        const d = await res.json();
        if (d.candles && d.candles.length > 0) {
          const candles = d.candles.map(c => {
            const dt = new Date(c.t);
            return {
              date: dt,
              dateStr: interval === '1D' || interval === '1d' ? formatDateStr(dt) : formatTimeStr(dt),
              open: c.o,
              high: c.h,
              low: c.l,
              close: c.c,
              volume: c.v,
              turnover: 0
            };
          });
          if (!MARKET_DATA[symbol]) {
            MARKET_DATA[symbol] = { name: symbol, category: "NSE", currency: "INR", symbol: "₹", data: [] };
          }
          MARKET_DATA[symbol].data = candles;
          handlePriceUpdate(symbol, d.price || candles[candles.length - 1].close, candles);
        }
      }
    } catch(e) {
      console.warn("Could not fetch Indian live data:", e);
    }
  }

  // ── Price update handler ─────────────────────────────────────────────────
  function handlePriceUpdate(symbol, price, dataArr) {
    const priceEl = document.getElementById('currentPrice');
    if (priceEl && lastPrice !== null && lastPrice !== price) {
      priceEl.classList.remove('tick-up', 'tick-down');
      void priceEl.offsetWidth; // trigger reflow
      priceEl.classList.add(price > lastPrice ? 'tick-up' : 'tick-down');
    }
    lastPrice = price;

    // Online calibration resolution loop
    if (typeof PredictionEngine !== 'undefined' && PredictionEngine.calStore) {
      try {
        for (const [id, rec] of PredictionEngine.calStore.predictionLog.entries()) {
          if (!rec.resolved && Date.now() - rec.timestamp > 20000) {
            PredictionEngine.calStore.recordOutcome(id, price);
          }
        }
      } catch(e) {}
    }

    if (onTickCallback) {
      onTickCallback(symbol, price, dataArr);
    }
  }

  // ── Fetch Delta Account Summary ──────────────────────────────────────────
  async function fetchDeltaAccount() {
    try {
      const res = await fetch('/api/delta/account');
      if (res.ok) {
        return await res.json();
      }
    } catch(e) {
      console.warn("Could not fetch Delta account:", e);
    }
    return null;
  }

  // ── Status UI Indicator ──────────────────────────────────────────────────
  function updateStatusUI(type, text) {
    const el = document.getElementById('liveIndicator');
    if (!el) return;
    el.className = 'badge ' + type;
    el.innerHTML = text;
  }

  return {
    connect,
    disconnect,
    isCryptoOrGold,
    isDeltaAsset,
    fetchDeltaAccount
  };
})();

if (typeof globalThis !== 'undefined') globalThis.LiveEngine = LiveEngine;
if (typeof window !== 'undefined') window.LiveEngine = LiveEngine;
