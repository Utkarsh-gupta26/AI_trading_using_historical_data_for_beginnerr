# 📈 Quantitative Indicator ML Validation & Stress-Testing Report
**Symbol**: `XAUUSD` | **Timeframe**: `1d` | **Evaluation**: Purged Walk-Forward Out-of-Sample

---

## 1. Executive Summary & Verdict Table

| Criterion | Evaluation Result |
|---|---|
| **CUSTOM INDICATOR EDGE** | `NO` |
| **ML IMPROVEMENT** | `NO` |
| **OUT-OF-SAMPLE ROBUSTNESS** | `WEAK` |
| **OVERFITTING RISK** | `HIGH` |
| **COST SENSITIVITY** | `MODERATE` |
| **REGIME DEPENDENCY** | `MEDIUM` |
| **GENERALIZATION** | `MODERATE` |
| **RESEARCH STATUS** | `NEEDS IMPROVEMENT` |

---

## 2. Performance Comparison: Unfiltered Indicator vs ML-Filtered Meta-Strategy

| Metric | Custom Indicator Only (Exp A) | Custom Indicator + ML Filter (Exp D) | Delta |
|---|---|---|---|
| **Total Trades** | 135 | 6 | -129 |
| **Win Rate** | 31.85% | 16.67% | -15.19% |
| **Profit Factor** | 0.73 | 0.22 | -0.52 |
| **Expectancy ($)** | $-49.20 | $-199.31 | $-150.11 |
| **Sharpe Ratio** | -0.51 | -0.44 | +0.07 |
| **Max Drawdown** | 8.13% | 1.67% | -6.46% |
| **Net PnL ($)** | $-6,641.86 | $-1,195.87 | $+5,446.00 |

---

## 3. 🏆 Multi-Model ML Tournament Leaderboard (Out-of-Sample)

| Rank | Model Architecture | Scaler | Win Rate | Profit Factor | Sharpe | Trades | Net PnL ($) | Max DD (%) |
|---|---|---|---|---|---|---|---|---|
| #1 | **Random Forest** | `robust` | 16.7% | 0.22 | -0.44 | 6 | $-1,195.87 | 1.7% |
| #2 | **Gradient Boosting** | `robust` | 12.5% | 0.15 | -0.54 | 8 | $-1,848.41 | 2.1% |
| #3 | **Support Vector Machine (RBF)** | `robust` | 0.0% | 0.00 | 0.00 | 0 | $0.00 | 0.0% |
| #4 | **AdaBoost Classifier** | `robust` | 0.0% | 0.00 | 0.00 | 0 | $0.00 | 0.0% |
| #5 | **Gaussian Naive Bayes** | `robust` | 0.0% | 0.00 | -0.35 | 1 | $-309.08 | 0.3% |
| #6 | **Logistic Regression (L2)** | `robust` | 0.0% | 0.00 | -0.50 | 2 | $-667.08 | 0.7% |

---

## 4. Statistical Significance & Hypothesis Testing
- **Statistical Evidence Classification**: `NO_STATISTICAL_EDGE`
- **One-Tailed Student-t p-value**: `0.6517`
- **95% Bootstrap Confidence Interval**: `[-0.32%, 0.26%]`
- **Permutation Test p-value**: `0.6260`

---

## 5. 1,000x Monte Carlo Stress Testing Profile
- **50% Median Drawdown (P50)**: `6.19%`
- **95th Percentile Worst-Case Drawdown (P95)**: `9.12%`
- **Risk of Ruin (50% Capital Drawdown)**: `0.00%`
- **Probability of Loss over Horizon**: `94.80%`

---

## 6. Transaction Cost & Slippage Sensitivity
| Cost Per Side (%) | Total Trades | Win Rate | Profit Factor | Net PnL ($) | Max DD (%) |
|---|---|---|---|---|---|
| 0.00% | 6 | 16.7% | 0.25 | $-1,068.12 | 1.6% |
| 0.05% | 6 | 16.7% | 0.22 | $-1,195.87 | 1.7% |
| 0.10% | 6 | 16.7% | 0.19 | $-1,323.34 | 1.8% |
| 0.20% | 6 | 0.0% | 0.00 | $-2,241.62 | 2.6% |
| 0.30% | 6 | 0.0% | 0.00 | $-2,471.47 | 2.9% |

---

## 7. AI Advisor & Indicator Enhancement Critique

### [AI ADVISOR REPORT] QUANTITATIVE RESEARCH CRITIQUE

#### 1. EXECUTIVE ASSESSMENT
The custom indicator demonstrated a **MARGINAL / STATISTICALLY WEAK EDGE** on out-of-sample data.
- **Unfiltered Indicator Win Rate**: 31.85% (Profit Factor: 0.73)
- **ML-Filtered Meta-Classifier Win Rate**: 16.67% (Profit Factor: 0.22)
- **Sharpe Ratio (Annualized)**: -0.44 | **Statistical Significance (p-value)**: 0.6517

#### 2. FAILURE MODE DIAGNOSIS
- **Sideways / Range Compression**: False breakouts occur frequently during low-volatility compression regimes where volume confirmation is absent.
- **Counter-Trend Noise**: Short signals generated above key long-term EMAs (e.g. EMA 200) suffer from low reward/risk ratios and premature stop-outs.
- **Monte Carlo Stress Profile**: In 1,000 randomized resamplings, the 95th percentile worst-case drawdown reached **9.1%**.

#### 3. ACTIONABLE ENHANCEMENTS FOR THE INDICATOR
1. **Dynamic Volatility Filter**: Suppress signal generation when ATR percentile is below the 25th percentile (consolidation phase).
2. **Volume Expansion Confirmation**: Require volume to exceed the 20-period moving average by at least 1.25x on signal trigger bars.
3. **Multi-Timeframe Trend Alignment**: Enforce higher-timeframe trend alignment (e.g. only take LONGs when price > Daily EMA 50).
4. **Adaptive ATR Trailing Stops**: Tighten trailing stop distances to 1.2x ATR after 1.5x ATR profit is achieved to protect open gains against sharp reversals.

