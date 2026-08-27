"""
Unit Tests for Look-Ahead Bias and Feature Leakage Detection.
"""
import unittest
import pandas as pd
import numpy as np
from validation.leakage_detector import LeakageDetector

class TestLeakageDetector(unittest.TestCase):
    def test_leakage_detector_flags_forbidden_names(self):
        dates = pd.date_range("2023-01-01", periods=100, freq="D")
        raw_df = pd.DataFrame({
            "open": np.linspace(100, 150, 100),
            "high": np.linspace(101, 151, 100),
            "low": np.linspace(99, 149, 100),
            "close": np.linspace(100.5, 150.5, 100),
            "volume": np.full(100, 1000.0)
        }, index=dates)

        # Synthetic X with deliberate forward leakage feature name
        X = pd.DataFrame({
            "feat_rsi": np.random.uniform(20, 80, 100),
            "future_return_5": np.random.uniform(-0.05, 0.05, 100) # LEAKAGE!
        }, index=dates)
        y = pd.Series(np.random.choice([0, 1], 100), index=dates)

        detector = LeakageDetector(X, y, raw_df)
        report = detector.run_leakage_audit()
        self.assertEqual(report["status"], "FAILED")
        self.assertGreater(len(report["violations"]), 0)

    def test_leakage_detector_passes_clean_features(self):
        dates = pd.date_range("2023-01-01", periods=100, freq="D")
        raw_df = pd.DataFrame({
            "open": np.linspace(100, 150, 100),
            "high": np.linspace(101, 151, 100),
            "low": np.linspace(99, 149, 100),
            "close": np.linspace(100.5, 150.5, 100),
            "volume": np.full(100, 1000.0)
        }, index=dates)

        X = pd.DataFrame({
            "feat_rsi": np.random.uniform(20, 80, 100),
            "feat_ema_slope": np.random.normal(0, 0.01, 100)
        }, index=dates)
        y = pd.Series(np.random.choice([0, 1], 100), index=dates)

        detector = LeakageDetector(X, y, raw_df)
        report = detector.run_leakage_audit()
        self.assertEqual(report["status"], "PASSED")

if __name__ == "__main__":
    unittest.main()
