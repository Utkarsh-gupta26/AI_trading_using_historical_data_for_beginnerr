# AIOT — All-in-One Trading App

**AIOT** is a high-performance, institutional-grade web trading terminal and quantitative analysis suite. It integrates multi-asset live charting, quantitative candlestick forecasting, an automated risk management and position sizing engine, an AI trading copilot, and discipline-enforcing execution tools into a single cohesive interface.

---

## Key Features

### 1. Multi-Asset Live Market Terminal
- **Universal Coverage**: Real-time quotes and tracking across Global Benchmark Indices (S&P 500, NASDAQ 100, Dow Jones, DAX, NIFTY 50, Bank Nifty, SENSEX), US Mega-Caps (AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL, META, AMD), Top Indian Equities (Reliance, TCS, HDFC Bank, Infosys, etc.), Crypto Perpetuals (BTC, ETH, SOL), and Commodities/FX (Gold, Crude Oil, Silver).
- **Live Quote Feed**: Zero synthetic prices — streams authentic market updates directly to terminal watchlists and header tickers.

### 2. Multi-Timeframe Charting Engine
- Professional candlestick charts with dynamic crosshairs, timeframe toggles, and responsive layouts.
- Comprehensive technical indicator library: Exponential & Simple Moving Averages (EMA 9, 21, 50, 200), RSI (14), MACD, Bollinger Bands, Average True Range (ATR), Volume Weighted Average Price (VWAP), Supertrend, and Pivot Points.

### 3. Quantitative Candlestick & Target Prediction Terminal (`Ctrl+P`)
- **Bayesian Multi-Strategy Consensus**: Combines 10 quantitative algorithmic strategies:
  1. Momentum / Breakout Trading
  2. Swing Pullback to Moving Averages
  3. Range Mean-Reversion
  4. CAN SLIM Growth
  5. Sector Rotation & Relative Strength
  6. Opening Range Breakout (ORB)
  7. Livermore Trend Following
  8. MACD Histogram Divergence
  9. Bollinger Squeeze (TTM Squeeze)
  10. Multi-Timeframe Trend Confluence
- **Actionable Projections**: Generates 1-bar directional probability, calibrated take-profit targets (TP1, TP2, TP3), protective invalidation stop-loss, and news headline sentiment confluence.

### 4. Automated Risk Management Calculator
- **Active Asset Auto-Sync**: Automatically populates live entry prices, recognizes asset currency (₹ or $), and loads correct market lot sizes.
- **Dynamic Position Sizing**: Formulates optimal position size based on account balance and risk percentage limit (e.g., strictly 1.0% account risk).
- **Auto-Directional Awareness**: Dynamically detects LONG vs SHORT setups, with 1-click Risk:Reward presets (1:1.5, 1:2.0, 1:3.0) for rapid execution planning.

### 5. AI Quantitative Copilot (`Ctrl+J`)
- Instant slide-out AI assistant drawer and dedicated workspace for direct platform intelligence.
- Automated Market Regime Audits (expansion, contraction, trend strength, volatility state).
- Pre-trade risk audits, strategy win-rate analytics, and macro driver summaries.

### 6. Disciplined Execution Suite
- **Pre-Trade Readiness Checklist**: Enforces discipline gating before any capital is committed.
- **Locked Trade Plans**: Formulate trade parameters (entry, stop, targets, invalidation level) and lock the plan to prevent emotional alterations during live market sessions.
- **Trade Journal & Analytics**: Full performance tracking, win rate calculation, profit factor analysis, and equity curve visualizations.
- **Economic Calendar & Macro Drivers**: Real-time tracking of interest rate decisions, CPI prints, GDP numbers, and global sovereign bond yields.

---

## Design System

AIOT is styled with a bespoke, distraction-free **Warm Stone & Deep Espresso** palette:
- **Surface**: Clean warm stone backgrounds (`#FAFAF9` / `#F5F5F4`)
- **Cards & Panels**: Crisp white panels (`#FFFFFF`) with subtle stone borders
- **Typography**: High-contrast deep espresso text (`#0D0908` / `#1C1917`) featuring Plus Jakarta Sans, Space Grotesk, and IBM Plex Mono
- **Icons**: 100% monochrome SVG vector icons for a sleek, clutter-free institutional feel

---

## Getting Started

### Prerequisites
- Python 3.8+ (for local HTTP server and live market quote proxy)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Installation & Launch

1. Clone this repository:
   ```bash
   git clone https://github.com/Utkarsh-gupta26/AI_trading_using_historical_data_for_beginnerr.git
   cd AI_trading_using_historical_data_for_beginnerr
   ```

2. Start the local server:
   ```bash
   python server.py
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

### Key Keyboard Shortcuts
- `Ctrl + K`: Open Global Asset Search Modal
- `Ctrl + P`: Open Quantitative Predictor Modal
- `Ctrl + J`: Toggle AI Copilot Slide-Out Drawer
- `Escape`: Close open drawers and dialogs

---

## Project Structure

```
AIOT/
├── index.html                  # Master application container and workstation panels
├── styles.css                  # Comprehensive design system, themes, and responsive layouts
├── server.py                   # Python HTTP server & live market quote aggregation API
├── data.js                     # Historical candle datasets for offline / fallback mode
├── indicators.js               # Technical indicator mathematical calculation engine
├── strategies.js               # 10 quantitative algorithmic strategy models
├── prediction.js               # Bayesian candlestick prediction & signal aggregation
├── js/
│   ├── platform.js             # Master platform orchestrator, routing & live UI binding
│   ├── chart-engine.js         # Interactive candlestick charting canvas
│   ├── indicator-engine.js     # Real-time indicator renderer
│   ├── drawing-engine.js       # Chart annotation and measurement tools
│   ├── replay-engine.js        # Historical market bar replay simulator
│   ├── alert-engine.js         # Client-side price alert engine
│   ├── market-data-service.js  # Live quotes and symbol mapping service
│   ├── icons.js                # Clean monochrome SVG icon library
│   └── modules/
│       ├── live-chat.js        # AI Quantitative Copilot slide-out drawer
│       ├── risk-manager.js     # Position sizing & risk calculator
│       ├── trade-planner.js    # Pre-trade discipline checklist & plan locker
│       ├── journal-service.js  # Trade journal storage and calculation
│       ├── market-regime.js    # Quantitative 8-regime detection engine
│       ├── global-markets.js   # Global correlation & macro yields matrix
│       ├── economic-calendar.js# Macroeconomic events feed
│       ├── market-breadth.js   # Advance/Decline breadth matrix
│       └── backtest-engine.js  # Historical backtesting simulation engine
└── storage.json                # Local journal and preferences store
```

---

## License
MIT License. Created for quantitative traders and technical market analysts.
