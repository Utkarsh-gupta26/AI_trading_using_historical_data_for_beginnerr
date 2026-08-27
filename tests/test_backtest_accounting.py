"""
Unit Tests for Backtest Accounting, Friction, Calibration, and Walk-Forward Splits.
"""
import unittest
import pandas as pd
import numpy as np
from backtest.engine import BacktestEngine
from models.calibration import ProbabilityCalibrator
from validation.purged_walk_forward import PurgedWalkForwardCV

class TestBacktestAccounting(unittest.TestCase):
    def test_backtest_engine_fee_deduction(self):
        dates = pd.date_range("2023-01-01", periods=10, freq="D")
        df = pd.DataFrame({
            "open": [100, 100, 105, 100, 100, 100, 100, 100, 100, 100],
            "high": [100, 106, 107, 100, 100, 100, 100, 100, 100, 100],
            "low": [99, 99, 99, 99, 99, 99, 99, 99, 99, 99],
            "close": [100, 105, 106, 100, 100, 100, 100, 100, 100, 100],
            "volume": [1000]*10
        }, index=dates)

        signals_df = pd.DataFrame({
            "signal": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "signal_strength": [1.0]*10,
            "entry_price": [100.0]*10,
            "indicator_state": ["BULL"]*10
        }, index=dates)

        config = {
            "backtest": {
                "initial_capital": 10000.0,
                "commission_pct": 0.001,
                "slippage_pct": 0.001,
                "spread_pct": 0.0005,
                "position_sizing": "fixed_capital",
                "risk_per_trade": 0.10,
                "max_position_pct": 0.20
            },
            "labeling": {
                "tp_multiplier": 2.0,
                "sl_multiplier": 1.0,
                "max_holding_bars": 5
            }
        }

        engine = BacktestEngine(config)
        res = engine.run_backtest(df, signals_df)
        self.assertFalse(res['trade_log'].empty)
        # Net PnL must be less than gross PnL due to slippage + commission
        trade = res['trade_log'].iloc[0]
        self.assertLess(trade['net_pnl'], trade['gross_pnl'])

    def test_probability_calibrator(self):
        y_true = np.array([0, 0, 0, 1, 1, 1])
        raw_p = np.array([0.1, 0.2, 0.4, 0.6, 0.8, 0.9])
        calibrator = ProbabilityCalibrator(method="isotonic")
        calibrator.fit(raw_p, y_true)
        cal_p = calibrator.predict_proba(raw_p)
        self.assertEqual(len(cal_p), 6)
        self.assertLessEqual(cal_p[0], cal_p[-1])

    def test_purged_walk_forward_cv(self):
        dates = pd.date_range("2020-01-01", periods=100, freq="D")
        X = pd.DataFrame({"feat_1": np.random.randn(100)}, index=dates)
        y = pd.Series(np.random.choice([0, 1], 100), index=dates)

        cv = PurgedWalkForwardCV(n_splits=4, purge_bars=5, embargo_bars=2)
        splits = list(cv.split(X, y))
        self.assertGreater(len(splits), 0)
        for train_idx, test_idx in splits:
            # Guarantee no train index overlaps or comes after test index in expanding mode
            self.assertLess(train_idx[-1], test_idx[0])

if __name__ == "__main__":
    unittest.main()
