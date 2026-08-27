"""
Automated Feature Leakage and Look-Ahead Bias Detector.
Scans datasets for future contamination, illegal forward shifts,
and suspicious feature-target correlations.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List

class LeakageDetector:
    """
    Validates that no future information leaks into features at time T.
    """
    SUSPICIOUS_KEYWORDS = [
        'future', 'next', 'lead', 'target', 'label', 'outcome',
        'forward_shift', 't_plus', 'barrier_hit', 'return_pct'
    ]

    def __init__(self, X: pd.DataFrame, y: pd.Series, raw_df: pd.DataFrame):
        self.X = X
        self.y = y
        self.raw_df = raw_df
        self.report: Dict[str, Any] = {}

    def run_leakage_audit(self) -> Dict[str, Any]:
        """Runs all leakage checks."""
        violations = []
        warnings = []
        
        # 1. Suspicious column names in X
        for col in self.X.columns:
            col_lower = col.lower()
            for kw in self.SUSPICIOUS_KEYWORDS:
                if kw in col_lower:
                    violations.append(f"Suspicious column name detected: '{col}' containing forbidden token '{kw}'")

        # 2. Perfect correlation with future return
        future_1_return = self.raw_df['close'].pct_change(-1)
        aligned_future_ret = future_1_return.reindex(self.X.index)
        
        for col in self.X.columns:
            if np.issubdtype(self.X[col].dtype, np.number):
                valid_mask = ~(self.X[col].isna() | aligned_future_ret.isna())
                if valid_mask.sum() > 20:
                    corr = float(abs(np.corrcoef(self.X.loc[valid_mask, col], aligned_future_ret.loc[valid_mask])[0, 1]))
                    if np.isnan(corr):
                        continue
                    if corr > 0.95:
                        violations.append(f"Extreme correlation (r={corr:.4f}) between feature '{col}' and future candle return (T+1).")
                    elif corr > 0.70:
                        warnings.append(f"High correlation (r={corr:.4f}) between feature '{col}' and future candle return (T+1).")

        # 3. Target variable leakage in X
        for col in self.X.columns:
            if np.issubdtype(self.X[col].dtype, np.number):
                valid_mask = ~(self.X[col].isna() | self.y.isna())
                if valid_mask.sum() > 20:
                    corr_target = float(abs(np.corrcoef(self.X.loc[valid_mask, col], self.y.loc[valid_mask])[0, 1]))
                    if not np.isnan(corr_target) and corr_target > 0.98:
                        violations.append(f"Feature '{col}' has near-perfect correlation (r={corr_target:.4f}) with target label y.")

        passed = len(violations) == 0
        self.report = {
            "status": "PASSED" if passed else "FAILED",
            "passed": passed,
            "violations": violations,
            "warnings": warnings,
            "total_features_checked": len(self.X.columns),
            "total_samples_checked": len(self.X)
        }
        return self.report

    def raise_if_leakage(self):
        """Raises RuntimeError if critical look-ahead violations exist."""
        if not self.report:
            self.run_leakage_audit()
        if not self.report["passed"]:
            raise RuntimeError(f"CRITICAL TEMPORAL LEAKAGE DETECTED:\n" + "\n".join(self.report["violations"]))
