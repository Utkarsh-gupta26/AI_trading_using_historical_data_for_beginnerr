# 📈 Quantitative Trading Indicator ML Validation & Stress-Testing Platform

A production-grade algorithmic research and machine learning validation system designed to objectively determine whether custom trading indicators possess a statistically defensible trading edge, identify when and why they fail, and optimize signal quality through ML meta-labeling.

---

## 🚀 Key Features

- **Strict Zero Look-Ahead Bias**: Order execution fills at next-candle open (`T+1`); automated feature leakage detector audits every dataset.
- **Triple-Barrier & Meta-Labeling**: Dynamic ATR-based TP/SL with conservative intra-bar resolution; ML learns $P(\text{Profitable} \mid \text{Signal}, \text{Market Context})$.
- **Purged Walk-Forward Cross-Validation**: Expanding and rolling time-series folds with embargo periods to prevent overlapping label leakage.
- **5 Core Ablation Experiments**: Separates indicator signal alpha from general market dynamics and standalone ML.
- **1,000x Monte Carlo Stress Testing**: Reshuffling simulations, P5–P95 worst-case drawdowns, probability of loss, and risk of ruin.
- **Side-by-Side Local AI Quantitative Advisor**: Connects directly to local **Qwen 2.5 / 3.8 Max** (via Ollama/vLLM) to diagnose failure modes and suggest exact Pine Script/Python enhancements.
- **Multi-Asset & Timeframe Engine**: Pre-configured fetchers for Gold (`GC=F`), Nifty 50 (`^NSEI`), S&P 500 (`^GSPC`), Crypto (`BTC-USD`), and equities.
- **Interactive Visual Dashboard**: Plotly + Streamlit interface with equity curves, regime breakdowns, and trade audits.

---

## 🛠️ Installation & Setup

```bash
# 1. Clone repository / navigate to project directory
cd TradingI

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Optional) Connect to Local Qwen AI in Ollama
# Ensure Ollama is running: ollama run qwen2.5:latest
```

---

## ⚡ CLI Quickstart

```bash
# 1. Run Complete End-to-End Validation Pipeline on Gold (GC=F)
python main.py full-run --symbol GC=F

# 2. Run Validation Pipeline on Nifty 50 (^NSEI)
python main.py full-run --symbol ^NSEI

# 3. Launch Interactive Plotly / Streamlit Dashboard
python main.py dashboard

# 4. Launch FastAPI REST Server
python main.py api --port 8000
```

---

## 🧩 How to Plug In Your Custom Indicator

### Option A: Python Indicator Strategy
Edit or add your indicator class in `indicator/custom_indicators.py`:
```python
from indicator.base_adapter import BaseIndicatorAdapter

class MyCustomIndicator(BaseIndicatorAdapter):
    def generate_signals(self, df, symbol, timeframe):
        signals_df = pd.DataFrame(index=df.index)
        # Your custom mathematical logic here:
        signals_df['signal'] = 1  # 1 for LONG, -1 for SHORT, 0 for FLAT
        signals_df['signal_strength'] = 0.85
        signals_df['entry_price'] = df['close']
        signals_df['indicator_state'] = 'BULLISH_BREAKOUT'
        return self.validate_signals(signals_df, df)
```

### Option B: Pine Script CSV Signal Export
1. In TradingView, export your strategy trades to CSV or log webhook alert signals.
2. Place the CSV in `data/external/pine_signals.csv`.
3. In `configs/default_config.yaml`, set `source_type: "pine_csv"`.

---

## 🧪 Running Automated Unit & Leakage Tests

```bash
pytest tests/ -v
```
Verifies zero look-ahead bias, triple-barrier hit logic, fee accounting, probability calibration, and purged walk-forward splits.
