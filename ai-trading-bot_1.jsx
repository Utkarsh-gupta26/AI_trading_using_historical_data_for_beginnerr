import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  bg: "#0F1420",
  panel: "#161D2E",
  panelAlt: "#1C2438",
  border: "#2A3350",
  borderSoft: "#232C44",
  text: "#E8EBF3",
  muted: "#8993AC",
  mutedDim: "#5D6784",
  gold: "#D3A94A",
  bull: "#4FAE8B",
  bullSoft: "rgba(79,174,139,0.14)",
  bear: "#D2624B",
  bearSoft: "rgba(210,98,75,0.14)",
  info: "#6C87C4",
};

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

// ---------------------------------------------------------------------------
// Symbol universe
// ---------------------------------------------------------------------------
const SYMBOLS = [
  { id: "BTC", name: "Bitcoin", base: 62400, vol: 0.006, drift: 0.00004 },
  { id: "ETH", name: "Ethereum", base: 3080, vol: 0.007, drift: 0.00002 },
  { id: "AAPL", name: "Apple Inc.", base: 227.4, vol: 0.0022, drift: 0.00001 },
  { id: "TSLA", name: "Tesla Inc.", base: 268.1, vol: 0.0045, drift: -0.00002 },
  { id: "NIFTY", name: "Nifty 50", base: 24850, vol: 0.0018, drift: 0.00001 },
];
const HISTORY_LEN = 140;

function seedHistory(base) {
  const arr = [];
  let p = base;
  for (let i = 0; i < HISTORY_LEN; i++) {
    p = p * (1 + (Math.random() - 0.5) * 0.006);
    arr.push({ t: i, price: p });
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Indicator math
// ---------------------------------------------------------------------------
function sma(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function emaSeries(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const out = [closes.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < closes.length; i++) {
    out.push(closes[i] * k + out[out.length - 1] * (1 - k));
  }
  return out;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const slice = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(closes) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  if (!ema12.length || !ema26.length) return { line: 0, signal: 0, hist: 0 };
  const offset = ema12.length - ema26.length;
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v);
  const signalSeries = emaSeries(macdLine, 9);
  const line = macdLine[macdLine.length - 1] ?? 0;
  const signal = signalSeries[signalSeries.length - 1] ?? 0;
  return { line, signal, hist: line - signal };
}

function bollinger(closes, period = 20, mult = 2) {
  if (closes.length < period) return { mid: closes[closes.length - 1], pctB: 0.5 };
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid + mult * sd, lower = mid - mult * sd;
  const last = closes[closes.length - 1];
  const pctB = upper === lower ? 0.5 : (last - lower) / (upper - lower);
  return { mid, upper, lower, pctB };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function computeSignal(history) {
  const closes = history.map((p) => p.price);
  const last = closes[closes.length - 1];
  const s9 = sma(closes, 9);
  const s21 = sma(closes, 21);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const b = bollinger(closes, 20, 2);

  const trendScore = s9 && s21 ? clamp(((s9 - s21) / s21) * 40, -1, 1) : 0;
  const rsiScore = clamp((r - 50) / 45, -1, 1);
  const macdScore = clamp((m.hist / last) * 900, -1, 1);
  const bollScore = clamp((0.5 - b.pctB) * 1.4, -1, 1);

  const score = clamp(
    trendScore * 0.35 + rsiScore * 0.25 + macdScore * 0.25 + bollScore * 0.15,
    -1, 1
  );

  let label = "HOLD";
  if (score > 0.18) label = "BUY";
  else if (score < -0.18) label = "SELL";

  const confidence = Math.round(Math.abs(score) * 100);

  const regime =
    Math.abs(trendScore) > 0.35 ? (trendScore > 0 ? "Uptrend" : "Downtrend") : "Ranging";

  const reasons = [];
  reasons.push(
    s9 && s21
      ? `9/21-period average ${s9 > s21 ? "crossed above" : "sits below"} the slower average (${trendScore > 0 ? "bullish" : "bearish"} trend tilt).`
      : "Not enough history yet for the moving-average crossover."
  );
  reasons.push(
    r > 70 ? `RSI at ${r.toFixed(0)} — overbought territory.`
    : r < 30 ? `RSI at ${r.toFixed(0)} — oversold territory.`
    : `RSI at ${r.toFixed(0)} — neutral momentum.`
  );
  reasons.push(
    m.hist > 0 ? "MACD histogram positive — short-term momentum building up." : "MACD histogram negative — short-term momentum fading."
  );
  reasons.push(
    b.pctB > 1 ? "Price is trading above the upper Bollinger band."
    : b.pctB < 0 ? "Price is trading below the lower Bollinger band."
    : "Price is inside its normal Bollinger range."
  );

  return { last, s9, s21, rsi: r, macd: m, boll: b, score, label, confidence, regime, reasons };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const fmt = (n, d = 2) =>
  n === undefined || n === null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

const signalColor = (label) =>
  label === "BUY" ? COLORS.bull : label === "SELL" ? COLORS.bear : COLORS.gold;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TradingBot() {
  const [histories, setHistories] = useState(() => {
    const obj = {};
    SYMBOLS.forEach((s) => (obj[s.id] = seedHistory(s.base)));
    return obj;
  });
  const [symbolId, setSymbolId] = useState("BTC");
  const [running, setRunning] = useState(true);
  const [autoTrade, setAutoTrade] = useState(false);
  const [confThreshold, setConfThreshold] = useState(55);
  const [sizePct, setSizePct] = useState(25);
  const [stopLossPct, setStopLossPct] = useState(3);
  const [takeProfitPct, setTakeProfitPct] = useState(6);

  const [cash, setCash] = useState(10000);
  const [position, setPosition] = useState(null); // { symbol, qty, avgPrice }
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [trades, setTrades] = useState([]);
  const [equityHistory, setEquityHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const tickRef = useRef(0);

  const symbolMeta = SYMBOLS.find((s) => s.id === symbolId);
  const history = histories[symbolId];
  const signal = useMemo(() => computeSignal(history), [history]);

  const log = useCallback((msg, tone = "info") => {
    setAlerts((prev) => [{ id: Date.now() + Math.random(), msg, tone, time: new Date() }, ...prev].slice(0, 30));
  }, []);

  const execTrade = useCallback((side, price, sym, reason) => {
    if (side === "BUY") {
      const spend = cash * (sizePct / 100);
      if (spend < 10) return;
      const qty = spend / price;
      setCash((c) => c - spend);
      setPosition({ symbol: sym, qty, avgPrice: price });
      setTrades((t) => [{ id: Date.now(), side, sym, price, qty, reason, time: new Date() }, ...t].slice(0, 60));
      log(`Bought ${qty.toFixed(4)} ${sym} @ ${fmt(price)} — ${reason}`, "bull");
    } else if (side === "SELL" && position && position.symbol === sym) {
      const proceeds = position.qty * price;
      const cost = position.qty * position.avgPrice;
      const pnl = proceeds - cost;
      setCash((c) => c + proceeds);
      setRealizedPnl((p) => p + pnl);
      setTrades((t) => [{ id: Date.now(), side, sym, price, qty: position.qty, pnl, reason, time: new Date() }, ...t].slice(0, 60));
      log(`Sold ${position.qty.toFixed(4)} ${sym} @ ${fmt(price)} — ${reason} (P&L ${pnl >= 0 ? "+" : ""}${fmt(pnl)})`, pnl >= 0 ? "bull" : "bear");
      setPosition(null);
    }
  }, [cash, position, sizePct, log]);

  // live tick loop
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      tickRef.current += 1;
      setHistories((prev) => {
        const next = { ...prev };
        SYMBOLS.forEach((s) => {
          const arr = prev[s.id];
          const last = arr[arr.length - 1].price;
          const shock = (Math.random() - 0.5) * 2 * s.vol;
          const spike = Math.random() < 0.02 ? (Math.random() - 0.5) * s.vol * 6 : 0;
          const newPrice = Math.max(0.01, last * (1 + s.drift + shock + spike));
          const grown = [...arr, { t: arr[arr.length - 1].t + 1, price: newPrice }];
          next[s.id] = grown.length > HISTORY_LEN ? grown.slice(grown.length - HISTORY_LEN) : grown;
        });
        return next;
      });
    }, 1400);
    return () => clearInterval(iv);
  }, [running]);

  // decision loop — runs whenever the active symbol's price updates
  useEffect(() => {
    if (!running) return;
    const price = signal.last;

    // stop loss / take profit
    if (position && position.symbol === symbolId) {
      const change = (price - position.avgPrice) / position.avgPrice;
      if (change <= -stopLossPct / 100) {
        execTrade("SELL", price, symbolId, `Stop-loss triggered (${(change * 100).toFixed(1)}%)`);
        return;
      }
      if (change >= takeProfitPct / 100) {
        execTrade("SELL", price, symbolId, `Take-profit triggered (+${(change * 100).toFixed(1)}%)`);
        return;
      }
    }

    if (!autoTrade) return;
    if (!position && signal.label === "BUY" && signal.confidence >= confThreshold) {
      execTrade("BUY", price, symbolId, `Auto-signal BUY, ${signal.confidence}% confidence`);
    } else if (position && position.symbol === symbolId && signal.label === "SELL" && signal.confidence >= confThreshold) {
      execTrade("SELL", price, symbolId, `Auto-signal SELL, ${signal.confidence}% confidence`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // equity tracking
  useEffect(() => {
    const price = signal.last;
    const posValue = position ? position.qty * (position.symbol === symbolId ? price : (histories[position.symbol]?.slice(-1)[0]?.price ?? price)) : 0;
    const equity = cash + posValue;
    setEquityHistory((prev) => {
      const next = [...prev, { t: prev.length, equity }];
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const price = signal.last;
  const prevPrice = history[history.length - 2]?.price ?? price;
  const priceChangePct = ((price - prevPrice) / prevPrice) * 100;
  const posValue = position ? position.qty * price : 0;
  const equity = cash + posValue;
  const unrealizedPnl = position ? posValue - position.qty * position.avgPrice : 0;

  const chartData = history.map((p) => ({ t: p.t, price: p.price }));

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, fontFamily: "'Space Grotesk', sans-serif", minHeight: "600px", padding: "18px" }}>
      <style>{`
        ${FONT_IMPORT}
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .tb-scroll::-webkit-scrollbar { width: 6px; }
        .tb-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        button { font-family: inherit; cursor: pointer; }
        input[type=range] { accent-color: ${COLORS.gold}; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>Signal Desk</div>
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 2 }}>
            Paper-trading bot · simulated feed · technical-analysis signal engine
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "6px 10px",
            borderRadius: 20, background: running ? COLORS.bullSoft : COLORS.panelAlt,
            color: running ? COLORS.bull : COLORS.muted, border: `1px solid ${COLORS.borderSoft}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: running ? COLORS.bull : COLORS.mutedDim }} />
            {running ? "Feed live" : "Feed paused"}
          </span>
          <button
            onClick={() => setRunning((r) => !r)}
            style={{ padding: "7px 14px", borderRadius: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 13 }}
          >
            {running ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 280px", gap: 14 }}>
        {/* Left: symbol list + bot controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="Watchlist">
            {SYMBOLS.map((s) => {
              const h = histories[s.id];
              const p = h[h.length - 1].price;
              const pv = h[h.length - 2]?.price ?? p;
              const chg = ((p - pv) / pv) * 100;
              const active = s.id === symbolId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSymbolId(s.id)}
                  style={{
                    width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 8, marginBottom: 4,
                    background: active ? COLORS.panelAlt : "transparent",
                    border: `1px solid ${active ? COLORS.border : "transparent"}`,
                    color: COLORS.text,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span style={{ fontWeight: 600 }}>{s.id}</span>
                    <span className="mono" style={{ color: chg >= 0 ? COLORS.bull : COLORS.bear, fontSize: 12 }}>
                      {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{s.name}</div>
                </button>
              );
            })}
          </Panel>

          <Panel title="Bot controls">
            <Toggle label="Auto-trade" checked={autoTrade} onChange={setAutoTrade} />
            <Slider label="Confidence to act" value={confThreshold} onChange={setConfThreshold} min={40} max={90} suffix="%" />
            <Slider label="Position size" value={sizePct} onChange={setSizePct} min={5} max={100} suffix="%" />
            <Slider label="Stop-loss" value={stopLossPct} onChange={setStopLossPct} min={1} max={15} suffix="%" />
            <Slider label="Take-profit" value={takeProfitPct} onChange={setTakeProfitPct} min={1} max={25} suffix="%" />
          </Panel>
        </div>

        {/* Center: chart + signal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{symbolMeta.name}</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>
                  {price < 100 ? fmt(price, 2) : fmt(price, 0)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 14, color: priceChangePct >= 0 ? COLORS.bull : COLORS.bear }}>
                  {priceChangePct >= 0 ? "+" : ""}{priceChangePct.toFixed(3)}%
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 2 }}>{signal.regime}</div>
              </div>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: COLORS.muted, fontSize: 10 }} width={54} />
                  <Tooltip
                    contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12 }}
                    labelFormatter={() => ""}
                    formatter={(v) => [fmt(v, 2), "Price"]}
                  />
                  <Area type="monotone" dataKey="price" stroke={COLORS.gold} strokeWidth={1.6} fill="url(#priceFill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Signal engine">
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
              <div style={{
                fontSize: 22, fontWeight: 700, padding: "8px 18px", borderRadius: 10,
                background: signalColor(signal.label) + "22", color: signalColor(signal.label),
                border: `1px solid ${signalColor(signal.label)}55`,
              }}>
                {signal.label}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
                  <span>Confidence</span><span className="mono">{signal.confidence}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: COLORS.panelAlt, overflow: "hidden" }}>
                  <div style={{ width: `${signal.confidence}%`, height: "100%", background: signalColor(signal.label) }} />
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
              <Stat label="RSI (14)" value={signal.rsi.toFixed(1)} />
              <Stat label="SMA 9/21" value={signal.s9 && signal.s21 ? (signal.s9 > signal.s21 ? "Bullish" : "Bearish") : "—"} />
              <Stat label="MACD hist" value={fmt(signal.macd.hist, 3)} />
              <Stat label="Boll %B" value={fmt(signal.boll.pctB, 2)} />
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 6 }}>Why the bot thinks this</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: COLORS.text }}>
              {signal.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Panel>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => execTrade("BUY", price, symbolId, "Manual buy")}
              disabled={!!position}
              style={{ flex: 1, padding: "12px", borderRadius: 10, background: COLORS.bullSoft, color: COLORS.bull, border: `1px solid ${COLORS.bull}55`, fontWeight: 600, opacity: position ? 0.4 : 1 }}
            >
              Buy {symbolId}
            </button>
            <button
              onClick={() => execTrade("SELL", price, symbolId, "Manual close")}
              disabled={!position || position.symbol !== symbolId}
              style={{ flex: 1, padding: "12px", borderRadius: 10, background: COLORS.bearSoft, color: COLORS.bear, border: `1px solid ${COLORS.bear}55`, fontWeight: 600, opacity: !position || position.symbol !== symbolId ? 0.4 : 1 }}
            >
              Close position
            </button>
          </div>
        </div>

        {/* Right: portfolio + log */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Portfolio">
            <Stat label="Equity" value={`$${fmt(equity)}`} big />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <Stat label="Cash" value={`$${fmt(cash)}`} />
              <Stat label="Realized P&L" value={`${realizedPnl >= 0 ? "+" : ""}$${fmt(realizedPnl)}`} color={realizedPnl >= 0 ? COLORS.bull : COLORS.bear} />
            </div>
            {position ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.borderSoft}` }}>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>Open position</div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{position.symbol}</div>
                <div className="mono" style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  {position.qty.toFixed(4)} @ {fmt(position.avgPrice)}
                </div>
                <div className="mono" style={{ fontSize: 12.5, marginTop: 4, color: unrealizedPnl >= 0 ? COLORS.bull : COLORS.bear }}>
                  Unrealized {unrealizedPnl >= 0 ? "+" : ""}{fmt(unrealizedPnl)}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.mutedDim }}>No open position.</div>
            )}
            <div style={{ height: 70, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityHistory}>
                  <ReferenceLine y={10000} stroke={COLORS.borderSoft} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="equity" stroke={COLORS.info} dot={false} strokeWidth={1.6} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Activity">
            <div className="tb-scroll" style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {alerts.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.mutedDim }}>No activity yet.</div>}
              {alerts.map((a) => (
                <div key={a.id} style={{ fontSize: 12, padding: "7px 9px", borderRadius: 7, background: COLORS.panelAlt, borderLeft: `2px solid ${a.tone === "bull" ? COLORS.bull : a.tone === "bear" ? COLORS.bear : COLORS.info}` }}>
                  <div className="mono" style={{ color: COLORS.mutedDim, fontSize: 10.5 }}>
                    {a.time.toLocaleTimeString()}
                  </div>
                  <div>{a.msg}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 11.5, color: COLORS.mutedDim, lineHeight: 1.6 }}>
        Simulated price feed and paper portfolio only — not connected to any exchange or real funds. Signals come from
        standard technical indicators (moving averages, RSI, MACD, Bollinger Bands), not a market forecast, and technical
        analysis on random-walk-style data has no proven predictive edge on real markets. This is an educational sandbox,
        not financial advice.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function Panel({ title, children }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 12, padding: 14 }}>
      {title && <div style={{ fontSize: 12.5, color: COLORS.muted, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );
}

function Stat({ label, value, big, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: big ? 22 : 14, fontWeight: 600, color: color || COLORS.text }}>{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <span style={{ fontSize: 12.5 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 21, borderRadius: 11, background: checked ? COLORS.bull : COLORS.panelAlt,
          border: `1px solid ${checked ? COLORS.bull : COLORS.border}`, position: "relative", padding: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 19 : 2, width: 15, height: 15, borderRadius: "50%",
          background: COLORS.text, transition: "left 0.15s ease",
        }} />
      </button>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, suffix }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>
        <span>{label}</span>
        <span className="mono">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
