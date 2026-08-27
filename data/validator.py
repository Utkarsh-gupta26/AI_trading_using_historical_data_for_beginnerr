"""
Data Quality Validation Engine.
Performs rigorous audit of financial time-series data before feature extraction or training.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List

class DataValidator:
    """
    Validates OHLCV dataset integrity and detects corruption, gaps,
    chronological inconsistencies, and abnormal volatility spikes.
    """
    def __init__(self, df: pd.DataFrame, symbol: str = "UNKNOWN"):
        self.df = df
        self.symbol = symbol
        self.report: Dict[str, Any] = {}

    def run_full_audit(self) -> Dict[str, Any]:
        """Runs all checks and returns a comprehensive health dictionary."""
        total_rows = len(self.df)
        if total_rows == 0:
            return {"status": "FAILED", "error": "Dataset is empty", "total_candles": 0}

        # 1. Check index type and monotonic ordering
        is_datetime = isinstance(self.df.index, pd.DatetimeIndex)
        is_monotonic = self.df.index.is_monotonic_increasing if is_datetime else False
        
        # 2. Duplicate timestamps
        duplicates_count = int(self.df.index.duplicated().sum()) if is_datetime else 0
        
        # 3. NaN or Inf check
        nan_counts = self.df.isna().sum().to_dict()
        inf_counts = {col: int(np.isinf(self.df[col]).sum()) for col in self.df.select_dtypes(include=[np.number]).columns}
        
        # 4. OHLC logical consistency
        # High must be >= max(Open, Close) and Low <= min(Open, Close)
        invalid_high = int((self.df['high'] < self.df[['open', 'close']].max(axis=1) - 1e-6).sum())
        invalid_low = int((self.df['low'] > self.df[['open', 'close']].min(axis=1) + 1e-6).sum())
        negative_prices = int((self.df[['open', 'high', 'low', 'close']] <= 0).sum().sum())
        
        # 5. Volume check
        zero_volume_count = int((self.df['volume'] <= 0).sum())
        abnormal_volume_spike = int((self.df['volume'] > (self.df['volume'].median() * 50)).sum())
        
        # 6. Returns and extreme jumps check
        ret = self.df['close'].pct_change().dropna()
        extreme_jumps = int((ret.abs() > 0.30).sum()) # > 30% single candle moves
        
        # 7. Overall health score (0-100)
        penalty = (
            (0 if is_monotonic else 30) +
            min(duplicates_count * 5, 20) +
            min(invalid_high * 10 + invalid_low * 10, 30) +
            min(negative_prices * 20, 20) +
            (10 if sum(nan_counts.values()) > 0 else 0)
        )
        health_score = max(0, 100 - penalty)
        status = "PASSED" if health_score >= 80 else ("WARNING" if health_score >= 50 else "FAILED")

        self.report = {
            "symbol": self.symbol,
            "status": status,
            "health_score": health_score,
            "total_candles": total_rows,
            "start_time": str(self.df.index[0]),
            "end_time": str(self.df.index[-1]),
            "is_monotonic_increasing": bool(is_monotonic),
            "duplicate_timestamps": duplicates_count,
            "invalid_high_bars": invalid_high,
            "invalid_low_bars": invalid_low,
            "negative_prices": negative_prices,
            "zero_volume_bars": zero_volume_count,
            "abnormal_volume_spikes": abnormal_volume_spike,
            "extreme_price_jumps": extreme_jumps,
            "nan_counts": nan_counts,
            "inf_counts": inf_counts
        }
        return self.report

    def get_summary_text(self) -> str:
        """Returns human-readable formatted validation summary."""
        if not self.report:
            self.run_full_audit()
        r = self.report
        lines = [
            f"================ DATA QUALITY REPORT: {r.get('symbol')} ================",
            f"Status: {r.get('status')} (Health Score: {r.get('health_score')}/100)",
            f"Total Candles: {r.get('total_candles')} [{r.get('start_time')} to {r.get('end_time')}]",
            f"Monotonic Time Ordering: {'VALID' if r.get('is_monotonic_increasing') else 'INVALID'}",
            f"Duplicate Timestamps: {r.get('duplicate_timestamps')}",
            f"OHLC Integrity Violations (High/Low): {r.get('invalid_high_bars') + r.get('invalid_low_bars')}",
            f"Negative/Zero Prices: {r.get('negative_prices')}",
            f"Zero Volume Candles: {r.get('zero_volume_bars')}",
            f"Extreme Price Jumps (>30%): {r.get('extreme_price_jumps')}",
            f"NaN / Missing Values: {sum(r.get('nan_counts', {}).values())}",
            "================================================================="
        ]
        return "\n".join(lines)
