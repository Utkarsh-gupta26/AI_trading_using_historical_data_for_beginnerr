"""
Multi-Model Tournament and Comparative Benchmarking Suite.
Inspired by Technical Indicator Analysis ML (ccroft6).
Runs cross-model competition (RandomForest, GradientBoosting, SVM, AdaBoost, NaiveBayes, LogisticRegression)
under strict Purged Walk-Forward Cross-Validation to determine the optimal machine learning architecture.
"""
import numpy as np
import pandas as pd
import logging
from typing import Dict, Any, List, Optional
from sklearn.metrics import accuracy_score, precision_score, roc_auc_score, brier_score_loss

from models.registry import get_model
from models.calibration import ProbabilityCalibrator
from backtest.engine import BacktestEngine

logger = logging.getLogger(__name__)

TOURNAMENT_MODELS = [
    {"name": "RandomForest", "display": "Random Forest", "desc": "Ensemble Decision Trees"},
    {"name": "GradientBoosting", "display": "Gradient Boosting", "desc": "Gradient Boosted Trees"},
    {"name": "SVM", "display": "Support Vector Machine (RBF)", "desc": "Max-margin Kernel Classifier"},
    {"name": "AdaBoost", "display": "AdaBoost Classifier", "desc": "Adaptive Boosting Ensemble"},
    {"name": "NaiveBayes", "display": "Gaussian Naive Bayes", "desc": "Probabilistic Bayesian Classifier"},
    {"name": "LogisticRegression", "display": "Logistic Regression (L2)", "desc": "Linear Baseline Classifier"}
]


class ModelTournamentSuite:
    """
    Executes a head-to-head tournament across all candidate ML architectures.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.m_cfg = self.config.get("models", {})
        self.backtest_engine = BacktestEngine(self.config)

    def run_tournament(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        raw_df: pd.DataFrame,
        signals_df: pd.DataFrame,
        train_idx: np.ndarray,
        test_idx: np.ndarray,
        symbol: str = "GC=F"
    ) -> Dict[str, Any]:
        """
        Trains and backtests each model on out-of-sample fold data, returning a ranked leaderboard.
        """
        logger.info("⚔️ Running Multi-Model ML Tournament across candidate classifiers...")
        
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        threshold = self.m_cfg.get("ml_threshold", 0.60)
        scaler_name = self.m_cfg.get("scaler", "robust")

        leaderboard: List[Dict[str, Any]] = []
        equity_curves: Dict[str, List[float]] = {}
        model_predictions: Dict[str, np.ndarray] = {}

        # 1. Base Unfiltered Backtest benchmark
        bt_base = self.backtest_engine.run_backtest(raw_df, signals_df, probabilities=None, threshold=0.0, symbol=symbol)
        base_wr = bt_base["metrics"].get("win_rate", 0.0)
        base_pf = bt_base["metrics"].get("profit_factor", 0.0)

        for m_info in TOURNAMENT_MODELS:
            m_key = m_info["name"]
            display_name = m_info["display"]
            
            try:
                # Instantiate model with active config & scaler
                model_cfg = {"scaler": scaler_name}
                model = get_model(m_key, model_cfg)
                model.fit(X_train, y_train)

                # Calibrate probabilities
                calibrator = ProbabilityCalibrator(method="isotonic")
                train_raw_p = model.predict_proba(X_train)
                calibrator.fit(train_raw_p, y_train.values)

                test_raw_p = model.predict_proba(X_test)
                test_cal_p = calibrator.predict_proba(test_raw_p)
                model_predictions[m_key] = test_cal_p

                # Classification Metrics
                y_pred_binary = (test_cal_p >= threshold).astype(int)
                acc = accuracy_score(y_test, y_pred_binary)
                try:
                    auc = roc_auc_score(y_test, test_cal_p) if len(np.unique(y_test)) > 1 else 0.5
                except Exception:
                    auc = 0.5
                brier = brier_score_loss(y_test, test_cal_p)

                # Map probabilities back to full candle timeseries for backtest
                full_probas = np.zeros(len(raw_df))
                for idx_pos, test_sample_idx in enumerate(test_idx):
                    dt = X.index[test_sample_idx]
                    if dt in raw_df.index:
                        raw_loc = raw_df.index.get_loc(dt)
                        full_probas[raw_loc] = test_cal_p[idx_pos]

                bt_res = self.backtest_engine.run_backtest(raw_df, signals_df, probabilities=full_probas, threshold=threshold, symbol=symbol)
                m_metrics = bt_res["metrics"]
                
                win_rate = m_metrics.get("win_rate", 0.0)
                pf = m_metrics.get("profit_factor", 0.0)
                sharpe = m_metrics.get("sharpe_ratio", 0.0)
                trades = m_metrics.get("total_trades", 0)
                net_pnl = m_metrics.get("net_pnl", 0.0)
                max_dd = m_metrics.get("max_drawdown_pct", 0.0)

                # Composite Tournament Score
                score = (win_rate * 0.40) + (min(pf, 5.0) / 5.0 * 0.35) + (max(sharpe, 0.0) * 0.15) + (acc * 0.10)

                leaderboard.append({
                    "model_key": m_key,
                    "model_name": display_name,
                    "description": m_info["desc"],
                    "scaler": scaler_name,
                    "win_rate": win_rate,
                    "win_rate_delta": win_rate - base_wr,
                    "profit_factor": pf,
                    "sharpe_ratio": sharpe,
                    "total_trades": trades,
                    "net_pnl": net_pnl,
                    "max_drawdown": max_dd,
                    "accuracy": acc,
                    "auc_roc": auc,
                    "brier_score": brier,
                    "tournament_score": score
                })

            except Exception as e:
                logger.warning(f"Tournament model '{m_key}' encountered evaluation issue: {e}")
                leaderboard.append({
                    "model_key": m_key,
                    "model_name": display_name,
                    "description": m_info["desc"],
                    "scaler": scaler_name,
                    "win_rate": 0.0,
                    "win_rate_delta": 0.0,
                    "profit_factor": 0.0,
                    "sharpe_ratio": 0.0,
                    "total_trades": 0,
                    "net_pnl": 0.0,
                    "max_drawdown": 0.0,
                    "accuracy": 0.0,
                    "auc_roc": 0.5,
                    "brier_score": 1.0,
                    "tournament_score": 0.0
                })

        # Rank models by composite tournament score
        leaderboard = sorted(leaderboard, key=lambda x: x["tournament_score"], reverse=True)
        for rank, row in enumerate(leaderboard, 1):
            row["rank"] = rank

        champion = leaderboard[0] if leaderboard else None
        logger.info(f"🏆 Tournament Champion: {champion['model_name']} (Win Rate: {champion['win_rate']:.1%}, PF: {champion['profit_factor']:.2f})")

        return {
            "leaderboard": leaderboard,
            "champion": champion,
            "base_benchmark": {
                "win_rate": base_wr,
                "profit_factor": base_pf,
                "total_trades": bt_base["metrics"].get("total_trades", 0),
                "net_pnl": bt_base["metrics"].get("net_pnl", 0.0)
            }
        }
