"""
Robustness and Sensitivity Sweeper.
Evaluates parameter perturbation stability and transaction cost sensitivity.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from backtest.engine import BacktestEngine

class RobustnessTester:
    """
    Tests strategy resistance against parameter variations and escalating fee tiers.
    """
    def __init__(self, base_config: Dict[str, Any]):
        self.base_config = base_config

    def test_cost_sensitivity(
        self,
        df: pd.DataFrame,
        signals_df: pd.DataFrame,
        probabilities: Optional[np.ndarray] = None,
        threshold: float = 0.50,
        cost_tiers: List[float] = [0.000, 0.0005, 0.0010, 0.0020, 0.0030]
    ) -> List[Dict[str, Any]]:
        results = []
        for cost in cost_tiers:
            test_cfg = dict(self.base_config)
            test_cfg['backtest'] = dict(test_cfg.get('backtest', {}))
            test_cfg['backtest']['commission_pct'] = cost
            test_cfg['backtest']['slippage_pct'] = cost

            engine = BacktestEngine(test_cfg)
            bt_res = engine.run_backtest(df, signals_df, probabilities, threshold)
            m = bt_res['metrics']

            results.append({
                "cost_per_side_pct": cost * 100,
                "total_trades": m.get("total_trades", 0),
                "win_rate": m.get("win_rate", 0.0),
                "profit_factor": m.get("profit_factor", 0.0),
                "net_pnl": m.get("net_pnl", 0.0),
                "sharpe_ratio": m.get("sharpe_ratio", 0.0),
                "max_drawdown_pct": m.get("max_drawdown_pct", 0.0)
            })
        return results

    def test_threshold_sensitivity(
        self,
        df: pd.DataFrame,
        signals_df: pd.DataFrame,
        probabilities: np.ndarray,
        thresholds: List[float] = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]
    ) -> List[Dict[str, Any]]:
        results = []
        engine = BacktestEngine(self.base_config)
        for th in thresholds:
            bt_res = engine.run_backtest(df, signals_df, probabilities, threshold=th)
            m = bt_res['metrics']
            results.append({
                "ml_threshold": th,
                "total_trades": m.get("total_trades", 0),
                "win_rate": m.get("win_rate", 0.0),
                "profit_factor": m.get("profit_factor", 0.0),
                "net_pnl": m.get("net_pnl", 0.0),
                "sharpe_ratio": m.get("sharpe_ratio", 0.0),
                "max_drawdown_pct": m.get("max_drawdown_pct", 0.0)
            })
        return results
