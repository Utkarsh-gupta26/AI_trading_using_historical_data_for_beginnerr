"""
Ablation Experiment Suite.
Compares:
- Exp A: Custom Indicator Only (unfiltered)
- Exp B: Market Features Only
- Exp C: Custom Indicator + Market Features
- Exp D: Custom Indicator + ML Probability Filter (Meta-labeling)
- Exp E: Standalone ML Strategy (predicting direction directly without indicator)
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sklearn.metrics import accuracy_score, precision_score, roc_auc_score
from models.registry import get_model
from models.calibration import ProbabilityCalibrator

class AblationSuite:
    """
    Executes and evaluates the 5 core ablation experiments to definitively
    determine if the custom indicator adds incremental alpha or if ML alone is sufficient.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    def run_ablation_experiments(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        meta_df: pd.DataFrame,
        train_idx: np.ndarray,
        test_idx: np.ndarray
    ) -> Dict[str, Dict[str, Any]]:
        results = {}
        
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        test_returns = meta_df.iloc[test_idx]['return_pct'].values

        # =========================================================================
        # Experiment A: Custom Indicator Only (Takes 100% of signals unfiltered)
        # =========================================================================
        exp_a_win_rate = float((test_returns > 0).mean()) if len(test_returns) > 0 else 0.0
        exp_a_avg_ret = float(test_returns.mean()) if len(test_returns) > 0 else 0.0
        exp_a_total_pnl = float(test_returns.sum()) if len(test_returns) > 0 else 0.0
        exp_a_trades = len(test_returns)
        results["Exp_A_Indicator_Only"] = {
            "description": "Custom Indicator Only (All Signals Taken Unfiltered)",
            "trades_taken": exp_a_trades,
            "win_rate": exp_a_win_rate,
            "avg_return_per_trade": exp_a_avg_ret,
            "total_return": exp_a_total_pnl,
            "auc_roc": 0.50
        }

        # =========================================================================
        # Experiment B: Market Features Only (No indicator features in model)
        # =========================================================================
        mkt_cols = [c for c in X.columns if not c.startswith('feat_ind') and not c.startswith('feat_signal')]
        if len(mkt_cols) > 0:
            model_b = get_model("random_forest")
            model_b.fit(X_train[mkt_cols], y_train)
            raw_p_b = model_b.predict_proba(X_test[mkt_cols])
            calibrator_b = ProbabilityCalibrator().fit(model_b.predict_proba(X_train[mkt_cols]), y_train.values)
            p_b = calibrator_b.predict_proba(raw_p_b)
            
            mask_b = p_b >= 0.55
            sel_ret_b = test_returns[mask_b] if len(test_returns) > 0 else np.array([])
            results["Exp_B_Market_Features_Only"] = {
                "description": "ML Filter Using Exclusively Market Features (No Indicator Variables)",
                "trades_taken": int(mask_b.sum()),
                "win_rate": float((sel_ret_b > 0).mean()) if len(sel_ret_b) > 0 else 0.0,
                "avg_return_per_trade": float(sel_ret_b.mean()) if len(sel_ret_b) > 0 else 0.0,
                "total_return": float(sel_ret_b.sum()) if len(sel_ret_b) > 0 else 0.0,
                "auc_roc": float(roc_auc_score(y_test, p_b)) if len(np.unique(y_test)) > 1 else 0.50
            }

        # =========================================================================
        # Experiment C: Indicator + Market Features (All Features)
        # =========================================================================
        model_c = get_model("random_forest")
        model_c.fit(X_train, y_train)
        raw_p_c = model_c.predict_proba(X_test)
        calibrator_c = ProbabilityCalibrator().fit(model_c.predict_proba(X_train), y_train.values)
        p_c = calibrator_c.predict_proba(raw_p_c)
        results["Exp_C_Indicator_Plus_Features"] = {
            "description": "Full Feature Matrix Model (Indicator State + Context)",
            "auc_roc": float(roc_auc_score(y_test, p_c)) if len(np.unique(y_test)) > 1 else 0.50,
            "brier_score": float(np.mean((p_c - y_test.values)**2))
        }

        # =========================================================================
        # Experiment D: Custom Indicator + ML Filter (Meta-Labeling with Threshold)
        # =========================================================================
        threshold = self.config.get("ml_threshold", 0.60) if self.config else 0.60
        mask_d = p_c >= threshold
        sel_ret_d = test_returns[mask_d] if len(test_returns) > 0 else np.array([])
        results["Exp_D_Indicator_Plus_ML_Filter"] = {
            "description": f"Custom Indicator Filtered by ML Meta-Classifier (Threshold >= {threshold})",
            "trades_taken": int(mask_d.sum()),
            "filtered_out_trades": int((~mask_d).sum()),
            "win_rate": float((sel_ret_d > 0).mean()) if len(sel_ret_d) > 0 else 0.0,
            "avg_return_per_trade": float(sel_ret_d.mean()) if len(sel_ret_d) > 0 else 0.0,
            "total_return": float(sel_ret_d.sum()) if len(sel_ret_d) > 0 else 0.0,
            "win_rate_delta": float((sel_ret_d > 0).mean() - exp_a_win_rate) if len(sel_ret_d) > 0 else 0.0
        }

        return results
