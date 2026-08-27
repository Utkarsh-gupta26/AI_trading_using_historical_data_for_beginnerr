"""
Market Regime and Contextual Performance Breakdown.
Evaluates indicator performance across Bull/Bear/Sideways, Volatility, and Day-of-Week conditions.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any

class RegimeAnalyzer:
    """Analyzes trade win rates, expectancy, and returns conditioned on market context."""
    def __init__(self):
        pass

    def analyze_regimes(self, meta_df: pd.DataFrame, signals_df: pd.DataFrame) -> Dict[str, Any]:
        if meta_df.empty:
            return {}

        results = {}
        
        # 1. Trend Regime Breakdown
        if 'feat_trend_regime' in meta_df.columns:
            trend_map = {2: 'Strong Bullish', 1: 'Bullish', 0: 'Neutral/Sideways', -1: 'Bearish', -2: 'Strong Bearish'}
            trend_groups = {}
            for val, name in trend_map.items():
                subset = meta_df[meta_df['feat_trend_regime'] == val]
                n = len(subset)
                if n > 0:
                    win_rate = float((subset['return_pct'] > 0).mean())
                    avg_ret = float(subset['return_pct'].mean())
                    trend_groups[name] = {
                        "trades": n,
                        "win_rate": win_rate,
                        "avg_return": avg_ret,
                        "total_return": float(subset['return_pct'].sum())
                    }
            results["trend_regime_breakdown"] = trend_groups

        # 2. Volatility Regime Breakdown
        if 'feat_high_vol_regime' in meta_df.columns:
            vol_groups = {}
            for val, name in [(1, 'High Volatility'), (0, 'Normal/Low Volatility')]:
                subset = meta_df[meta_df['feat_high_vol_regime'] == val]
                n = len(subset)
                if n > 0:
                    vol_groups[name] = {
                        "trades": n,
                        "win_rate": float((subset['return_pct'] > 0).mean()),
                        "avg_return": float(subset['return_pct'].mean())
                    }
            results["volatility_regime_breakdown"] = vol_groups

        # 3. Directional Signal Breakdown (Long vs Short)
        dir_groups = {}
        for sig_val, name in [(1, 'LONG Signals'), (-1, 'SHORT Signals')]:
            subset = meta_df[meta_df['signal'] == sig_val]
            n = len(subset)
            if n > 0:
                dir_groups[name] = {
                    "trades": n,
                    "win_rate": float((subset['return_pct'] > 0).mean()),
                    "avg_return": float(subset['return_pct'].mean()),
                    "avg_mfe": float(subset['mfe'].mean()),
                    "avg_mae": float(subset['mae'].mean())
                }
        results["direction_breakdown"] = dir_groups

        return results
