"""
Unit Tests for Triple Barrier Labeling, Intra-Bar Logic, and MFE/MAE.
"""
import unittest
import pandas as pd
import numpy as np
from labels.triple_barrier import TripleBarrierLabeler

class TestTripleBarrier(unittest.TestCase):
    def test_triple_barrier_long_take_profit(self):
        dates = pd.date_range("2023-01-01", periods=10, freq="D")
        df = pd.DataFrame({
            "open": [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
            "high": [100, 105, 106, 100, 100, 100, 100, 100, 100, 100],
            "low": [98, 99, 99, 99, 99, 99, 99, 99, 99, 99],
            "close": [100, 104, 105, 100, 100, 100, 100, 100, 100, 100],
            "volume": [1000]*10
        }, index=dates)

        signals_df = pd.DataFrame({
            "signal": [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "signal_strength": [1.0]*10,
            "entry_price": [100.0]*10,
            "indicator_state": ["BULL"]*10
        }, index=dates)

        labeler = TripleBarrierLabeler({
            "use_atr_barriers": False,
            "fixed_tp_pct": 0.04, # TP = 104
            "fixed_sl_pct": 0.02, # SL = 98
            "max_holding_bars": 5
        })

        out = labeler.label_events(df, signals_df)
        self.assertEqual(out.iloc[0]['label'], 1.0)
        self.assertEqual(out.iloc[0]['barrier_hit'], 'TP')
        self.assertGreaterEqual(out.iloc[0]['return_pct'], 0.04)

if __name__ == "__main__":
    unittest.main()
