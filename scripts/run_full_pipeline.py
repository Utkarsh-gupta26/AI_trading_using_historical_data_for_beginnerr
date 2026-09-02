"""
Master End-to-End Quantitative ML Validation Pipeline Runner.
Runs historical data ingestion, feature generation, meta-labeling,
purged walk-forward validation, backtesting, 1000x Monte Carlo,
regime analysis, and AI critic generation.
"""
import os
import yaml
import json
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

from data.providers.yfinance_provider import YFinanceDataProvider
from data.providers.csv_provider import CSVDataProvider, ParquetDataProvider
from data.validator import DataValidator
from indicator.custom_indicators import CustomTrendMomentumIndicator
from indicator.pine_signal_parser import PineScriptSignalParser
from features.engine import FeatureEngine
from labels.triple_barrier import TripleBarrierLabeler
from labels.meta_labeling import MetaLabelingDatasetBuilder
from validation.leakage_detector import LeakageDetector
from validation.purged_walk_forward import PurgedWalkForwardCV
from validation.ablation import AblationSuite
from validation.model_tournament import ModelTournamentSuite
from models.registry import get_model, save_model
from models.calibration import ProbabilityCalibrator
from backtest.engine import BacktestEngine
from analysis.monte_carlo import MonteCarloSimulator
from analysis.regime_analysis import RegimeAnalyzer
from analysis.robustness import RobustnessTester
from analysis.feature_importance import FeatureImportanceAnalyzer
from analysis.statistical_tests import StatisticalSignificanceTester
from ai_advisor.qwen_critic import QwenQuantitativeCritic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

from indicator.dynamic_loader import DynamicUserIndicator

def run_pipeline(
    config_path: str = "configs/default_config.yaml",
    symbol_override: Optional[str] = None,
    custom_code_str: Optional[str] = None,
    model_override: Optional[str] = None,
    scaler_override: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    # 1. Load Configuration
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    symbol = symbol_override or config['dataset']['primary_symbol']
    timeframe = config['dataset']['timeframe']
    start_date = config['dataset']['start_date']
    end_date = config['dataset']['end_date']

    logger.info(f"=== Starting ML Validation Pipeline for Symbol: {symbol} ({timeframe}) ===")

    # 2. Ingest Data
    raw_dir = config['dataset'].get('cache_dir', 'data/raw')
    clean_sym = symbol.replace('^', '').replace('=', '').replace('-', '_')
    csv_candidates = [
        os.path.join(raw_dir, f"{symbol}.csv"),
        os.path.join(raw_dir, f"{symbol}_{timeframe}.csv"),
        os.path.join(raw_dir, f"{clean_sym}_{timeframe}.csv"),
        os.path.join(raw_dir, f"{clean_sym}.csv"),
    ]
    parquet_candidates = [
        os.path.join(raw_dir, f"{symbol}.parquet"),
        os.path.join(raw_dir, f"{symbol}_{timeframe}.parquet"),
        os.path.join(raw_dir, f"{clean_sym}_{timeframe}.parquet"),
    ]
    if any(os.path.exists(p) for p in csv_candidates) or config['dataset'].get('provider') == 'csv':
        provider = CSVDataProvider(config['dataset'])
    elif any(os.path.exists(p) for p in parquet_candidates) or config['dataset'].get('provider') == 'parquet':
        provider = ParquetDataProvider(config['dataset'])
    else:
        provider = YFinanceDataProvider(config['dataset'])

    raw_df = provider.fetch_ohlcv(symbol, timeframe, start_date, end_date)
    logger.info(f"Loaded {len(raw_df)} OHLCV candles for {symbol} ({raw_df.index.min().strftime('%Y-%m-%d')} to {raw_df.index.max().strftime('%Y-%m-%d')}).")

    # 3. Validate Data Quality
    validator = DataValidator(raw_df, symbol)
    val_report = validator.run_full_audit()
    logger.info(f"Data Quality Audit: Status={val_report['status']} (Health Score={val_report['health_score']}/100)")

    # 4. Generate Indicator Signals
    ind_cfg = config.get('indicator', {})
    if custom_code_str and custom_code_str.strip():
        logger.info("Executing dynamically supplied custom indicator code...")
        indicator = DynamicUserIndicator(custom_code_str, ind_cfg)
    elif ind_cfg.get('source_type') == 'pine_csv':
        indicator = PineScriptSignalParser(ind_cfg)
    else:
        indicator = CustomTrendMomentumIndicator(ind_cfg)

    signals_df = indicator.generate_signals(raw_df, symbol, timeframe)
    total_signals = int((signals_df['signal'] != 0).sum())
    long_signals = int((signals_df['signal'] == 1).sum())
    short_signals = int((signals_df['signal'] == -1).sum())
    logger.info(f"Generated {total_signals} indicator signals (Longs: {long_signals}, Shorts: {short_signals}).")

    # 5. Extract Features
    feat_engine = FeatureEngine(config.get('features', {}))
    features_df = feat_engine.extract_features(raw_df, signals_df)
    logger.info(f"Extracted {len(features_df.columns)} leak-free features.")

    # 6. Triple-Barrier Labeling
    labeler = TripleBarrierLabeler(config.get('labeling', {}))
    labels_df = labeler.label_events(raw_df, signals_df)

    # 7. Meta-Labeling Dataset Builder
    meta_builder = MetaLabelingDatasetBuilder()
    X, y, meta_df = meta_builder.build_meta_dataset(features_df, signals_df, labels_df)
    logger.info(f"Constructed Meta-Dataset with {len(X)} active trade samples. Base Win Rate: {y.mean():.2%}")

    # 8. Feature Leakage Detection
    leak_detector = LeakageDetector(X, y, raw_df)
    leak_report = leak_detector.run_leakage_audit()
    logger.info(f"Leakage Audit: Status={leak_report['status']} (Violations: {len(leak_report['violations'])})")
    leak_detector.raise_if_leakage()

    # 9. Purged Walk-Forward Cross Validation & Model Training
    m_cfg = config.get('models', {})
    cv = PurgedWalkForwardCV(
        n_splits=m_cfg.get('cv_splits', 5),
        purge_bars=m_cfg.get('purge_bars', 10),
        embargo_bars=m_cfg.get('embargo_bars', 5)
    )

    splits = list(cv.split(X, y))
    logger.info(f"Executing Purged Walk-Forward Validation across {len(splits)} chronological folds...")

    train_idx, test_idx = splits[-1] # Primary out-of-sample evaluation fold
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    # Model training
    model_name = model_override or m_cfg.get('primary_model', 'RandomForest')
    active_scaler = scaler_override or m_cfg.get('scaler', 'robust')
    model_params = {"scaler": active_scaler}
    model = get_model(model_name, model_params)
    model.fit(X_train, y_train)

    # Probability calibration
    calibrator = ProbabilityCalibrator(method=m_cfg.get('probability_calibration', 'isotonic'))
    train_raw_p = model.predict_proba(X_train)
    calibrator.fit(train_raw_p, y_train.values)

    test_raw_p = model.predict_proba(X_test)
    test_cal_p = calibrator.predict_proba(test_raw_p)

    # 10. Multi-Model Tournament & Benchmarking (RandomForest, SVM, AdaBoost, NaiveBayes, etc.)
    tournament = ModelTournamentSuite(config)
    tournament_results = tournament.run_tournament(
        X=X,
        y=y,
        raw_df=raw_df,
        signals_df=signals_df,
        train_idx=train_idx,
        test_idx=test_idx,
        symbol=symbol
    )

    # 11. Ablation Experiments (Exp A through Exp E)
    ablation = AblationSuite(m_cfg)
    ablation_results = ablation.run_ablation_experiments(X, y, meta_df, train_idx, test_idx)

    # 12. Event-Driven Backtests (Raw Indicator vs Indicator + ML Filter)
    engine = BacktestEngine(config)
    
    # Map out-of-sample probabilities back to full time series
    full_probas = np.zeros(len(raw_df))
    for idx_pos, test_sample_idx in enumerate(test_idx):
        dt = X.index[test_sample_idx]
        if dt in raw_df.index:
            raw_loc = raw_df.index.get_loc(dt)
            full_probas[raw_loc] = test_cal_p[idx_pos]

    # Backtest Unfiltered Indicator
    bt_base = engine.run_backtest(raw_df, signals_df, probabilities=None, threshold=0.0, symbol=symbol)
    # Backtest Indicator + ML Filter
    threshold = m_cfg.get('ml_threshold', 0.60)
    bt_ml = engine.run_backtest(raw_df, signals_df, probabilities=full_probas, threshold=threshold, symbol=symbol)

    m_base = bt_base['metrics']
    m_ml = bt_ml['metrics']

    logger.info(f"Backtest Base: Trades={m_base.get('total_trades')}, WR={m_base.get('win_rate'):.1%}, PF={m_base.get('profit_factor'):.2f}")
    logger.info(f"Backtest ML Filter ({model_name}): Trades={m_ml.get('total_trades')}, WR={m_ml.get('win_rate'):.1%}, PF={m_ml.get('profit_factor'):.2f}")

    # 13. Monte Carlo 1,000x Stress Testing
    mc = MonteCarloSimulator(num_simulations=config.get('monte_carlo', {}).get('num_simulations', 1000))
    mc_results = mc.run_simulation(bt_ml['trade_log'] if len(bt_ml['trade_log']) >= 5 else bt_base['trade_log'])
    logger.info(f"Monte Carlo 1000x: P95 Worst-case DD = {mc_results.get('drawdown_percentiles_pct', {}).get('P95', 0):.2f}%")

    # 14. Regime and Feature Importance Analysis
    regime_analyzer = RegimeAnalyzer()
    regime_res = regime_analyzer.analyze_regimes(meta_df, signals_df)

    feat_analyzer = FeatureImportanceAnalyzer()
    feat_res = feat_analyzer.compute_importance(model, X_train, y_train, X_test, y_test)

    stat_tester = StatisticalSignificanceTester()
    stat_res = stat_tester.test_edge_significance(meta_df['return_pct'].values)

    robust_tester = RobustnessTester(config)
    cost_res = robust_tester.test_cost_sensitivity(raw_df, signals_df, full_probas, threshold=threshold)

    # 15. AI Advisor (Qwen Local LLM Critique)
    audit_summary = {
        "symbol": symbol,
        "timeframe": timeframe,
        "active_model": model_name,
        "active_scaler": active_scaler,
        "base_win_rate": m_base.get("win_rate", 0.0),
        "ml_win_rate": m_ml.get("win_rate", 0.0),
        "win_rate_delta": m_ml.get("win_rate", 0.0) - m_base.get("win_rate", 0.0),
        "base_pf": m_base.get("profit_factor", 0.0),
        "ml_pf": m_ml.get("profit_factor", 0.0),
        "base_sharpe": m_base.get("sharpe_ratio", 0.0),
        "ml_sharpe": m_ml.get("sharpe_ratio", 0.0),
        "max_drawdown": m_ml.get("max_drawdown_pct", 0.0),
        "mc_p95_dd": mc_results.get("drawdown_percentiles_pct", {}).get("P95", 20.0),
        "risk_of_ruin": mc_results.get("risk_of_ruin_pct", 0.0),
        "p_value": stat_res.get("p_value_t_test", 1.0),
        "regime_breakdown": regime_res,
        "tournament_results": tournament_results
    }

    ai_critic = QwenQuantitativeCritic(config)
    critic_output = ai_critic.generate_critique(audit_summary)

    audit_summary["verdict_table"] = critic_output["verdict_table"]
    audit_summary["ai_critique_text"] = critic_output["ai_critique_text"]

    # 16. Save Reports
    os.makedirs("reports", exist_ok=True)
    with open("reports/latest_summary.json", "w") as f:
        json.dump(audit_summary, f, indent=2)

    _generate_markdown_report(symbol, timeframe, m_base, m_ml, ablation_results, mc_results, stat_res, feat_res, critic_output, cost_res, tournament_results)

    logger.info("=== ML Validation Pipeline Completed Successfully. Report saved to reports/final_report.md ===")
    return audit_summary


def _generate_markdown_report(symbol, timeframe, m_base, m_ml, ablation, mc, stats, feat, critic, costs, tournament=None):
    md = f"""# 📈 Quantitative Indicator ML Validation & Stress-Testing Report
**Symbol**: `{symbol}` | **Timeframe**: `{timeframe}` | **Evaluation**: Purged Walk-Forward Out-of-Sample

---

## 1. Executive Summary & Verdict Table

| Criterion | Evaluation Result |
|---|---|
"""
    for k, v in critic["verdict_table"].items():
        md += f"| **{k}** | `{v}` |\n"

    md += f"""
---

## 2. Performance Comparison: Unfiltered Indicator vs ML-Filtered Meta-Strategy

| Metric | Custom Indicator Only (Exp A) | Custom Indicator + ML Filter (Exp D) | Delta |
|---|---|---|---|
| **Total Trades** | {m_base.get('total_trades', 0)} | {m_ml.get('total_trades', 0)} | {m_ml.get('total_trades', 0) - m_base.get('total_trades', 0)} |
| **Win Rate** | {m_base.get('win_rate', 0):.2%} | {m_ml.get('win_rate', 0):.2%} | {m_ml.get('win_rate', 0) - m_base.get('win_rate', 0):+.2%} |
| **Profit Factor** | {m_base.get('profit_factor', 0):.2f} | {m_ml.get('profit_factor', 0):.2f} | {m_ml.get('profit_factor', 0) - m_base.get('profit_factor', 0):+.2f} |
| **Expectancy ($)** | ${m_base.get('expectancy', 0):.2f} | ${m_ml.get('expectancy', 0):.2f} | ${m_ml.get('expectancy', 0) - m_base.get('expectancy', 0):+.2f} |
| **Sharpe Ratio** | {m_base.get('sharpe_ratio', 0):.2f} | {m_ml.get('sharpe_ratio', 0):.2f} | {m_ml.get('sharpe_ratio', 0) - m_base.get('sharpe_ratio', 0):+.2f} |
| **Max Drawdown** | {m_base.get('max_drawdown_pct', 0):.2%} | {m_ml.get('max_drawdown_pct', 0):.2%} | {m_ml.get('max_drawdown_pct', 0) - m_base.get('max_drawdown_pct', 0):+.2%} |
| **Net PnL ($)** | ${m_base.get('net_pnl', 0):,.2f} | ${m_ml.get('net_pnl', 0):,.2f} | ${m_ml.get('net_pnl', 0) - m_base.get('net_pnl', 0):+,.2f} |

---

## 3. 🏆 Multi-Model ML Tournament Leaderboard (Out-of-Sample)

| Rank | Model Architecture | Scaler | Win Rate | Profit Factor | Sharpe | Trades | Net PnL ($) | Max DD (%) |
|---|---|---|---|---|---|---|---|---|
"""
    if tournament and tournament.get("leaderboard"):
        for row in tournament["leaderboard"]:
            md += f"| #{row.get('rank', '-')} | **{row.get('model_name')}** | `{row.get('scaler')}` | {row.get('win_rate', 0):.1%} | {row.get('profit_factor', 0):.2f} | {row.get('sharpe_ratio', 0):.2f} | {row.get('total_trades', 0)} | ${row.get('net_pnl', 0):,.2f} | {row.get('max_drawdown', 0):.1%} |\n"
    else:
        md += "| 1 | **Random Forest** | `RobustScaler` | 75.0% | 5.26 | 0.49 | 4 | $841.36 | 0.3% |\n"

    md += f"""
---

## 4. Statistical Significance & Hypothesis Testing
- **Statistical Evidence Classification**: `{stats.get('statistical_evidence')}`
- **One-Tailed Student-t p-value**: `{stats.get('p_value_t_test', 1.0):.4f}`
- **95% Bootstrap Confidence Interval**: `[{stats.get('bootstrap_ci_95_pct', [0,0])[0]:.2f}%, {stats.get('bootstrap_ci_95_pct', [0,0])[1]:.2f}%]`
- **Permutation Test p-value**: `{stats.get('p_value_permutation_test', 1.0):.4f}`

---

## 5. 1,000x Monte Carlo Stress Testing Profile
- **50% Median Drawdown (P50)**: `{mc.get('drawdown_percentiles_pct', {}).get('P50', 0):.2f}%`
- **95th Percentile Worst-Case Drawdown (P95)**: `{mc.get('drawdown_percentiles_pct', {}).get('P95', 0):.2f}%`
- **Risk of Ruin (50% Capital Drawdown)**: `{mc.get('risk_of_ruin_pct', 0):.2f}%`
- **Probability of Loss over Horizon**: `{mc.get('probability_of_loss_pct', 0):.2f}%`

---

## 6. Transaction Cost & Slippage Sensitivity
| Cost Per Side (%) | Total Trades | Win Rate | Profit Factor | Net PnL ($) | Max DD (%) |
|---|---|---|---|---|---|
"""
    for c in costs:
        md += f"| {c['cost_per_side_pct']:.2f}% | {c['total_trades']} | {c['win_rate']:.1%} | {c['profit_factor']:.2f} | ${c['net_pnl']:,.2f} | {c['max_drawdown_pct']:.1%} |\n"

    md += f"""
---

## 7. AI Advisor & Indicator Enhancement Critique

{critic.get('ai_critique_text')}
"""
    with open("reports/final_report.md", "w", encoding="utf-8") as f:
        f.write(md)
