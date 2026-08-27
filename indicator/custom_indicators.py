"""
Custom Indicator Implementations.
Contains reference and production implementations of custom trading indicators
for ML testing, validation, and optimization.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional
from .base_adapter import BaseIndicatorAdapter

class CustomTrendMomentumIndicator(BaseIndicatorAdapter):
    """
    Sophisticated Custom Indicator:
    Combines Adaptive Exponential Moving Average (EMA) Ribbon, Dynamic RSI Range Filter,
    MACD Histogram Expansion, and Normalized Volatility Squeeze.
    
    Produces distinct BUY (+1) and SELL (-1) signals with continuous signal strength metrics
    and custom indicator state features.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        params = self.config.get("params", {}) if self.config else {}
        self.fast_period = params.get("fast_period", 12)
        self.slow_period = params.get("slow_period", 26)
        self.signal_period = params.get("signal_period", 9)
        self.rsi_period = params.get("rsi_period", 14)
        self.rsi_ob = params.get("rsi_overbought", 70)
        self.rsi_os = params.get("rsi_oversold", 30)

    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        close = df['close']
        high = df['high']
        low = df['low']
        volume = df['volume']

        # 1. EMAs
        ema_fast = close.ewm(span=self.fast_period, adjust=False).mean()
        ema_slow = close.ewm(span=self.slow_period, adjust=False).mean()
        ema_trend = close.ewm(span=50, adjust=False).mean()
        ema_diff = (ema_fast - ema_slow) / (close + 1e-8)

        # 2. RSI
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=self.rsi_period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.rsi_period).mean()
        rs = gain / (loss + 1e-8)
        rsi = 100 - (100 / (1 + rs))

        # 3. MACD
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=self.signal_period, adjust=False).mean()
        macd_hist = macd_line - signal_line

        # 4. Volatility (ATR)
        tr = np.maximum(high - low, np.maximum((high - close.shift(1)).abs(), (low - close.shift(1)).abs()))
        atr = tr.rolling(window=14).mean()
        norm_atr = atr / (close + 1e-8)

        # 5. Signal Logic
        signals_df = pd.DataFrame(index=df.index)
        signals_df['signal'] = 0
        signals_df['signal_strength'] = 0.0
        signals_df['entry_price'] = close
        signals_df['indicator_state'] = 'NEUTRAL'

        # Long conditions: Fast EMA > Slow EMA, Price > Trend EMA, MACD hist crossing up, RSI not overbought
        long_condition = (
            (ema_fast > ema_slow) & 
            (close > ema_trend) & 
            (macd_hist > 0) & 
            (macd_hist.shift(1) <= 0) & 
            (rsi < self.rsi_ob) & 
            (rsi > 45)
        )

        # Short conditions: Fast EMA < Slow EMA, Price < Trend EMA, MACD hist crossing down, RSI not oversold
        short_condition = (
            (ema_fast < ema_slow) & 
            (close < ema_trend) & 
            (macd_hist < 0) & 
            (macd_hist.shift(1) >= 0) & 
            (rsi > self.rsi_os) & 
            (rsi < 55)
        )

        signals_df.loc[long_condition, 'signal'] = 1
        signals_df.loc[long_condition, 'indicator_state'] = 'BULLISH_EXPANSION'
        signals_df.loc[short_condition, 'signal'] = -1
        signals_df.loc[short_condition, 'indicator_state'] = 'BEARISH_EXPANSION'

        # Calculate Signal Strength (0.0 to 1.0)
        strength = np.abs(ema_diff) * 100 + np.abs(macd_hist / (close + 1e-8)) * 500
        signals_df['signal_strength'] = strength.clip(0.1, 1.0).fillna(0.0)

        # Custom Indicator-Specific Features for ML
        signals_df['ind_ema_diff'] = ema_diff
        signals_df['ind_rsi'] = rsi / 100.0
        signals_df['ind_macd_hist'] = macd_hist / (close + 1e-8)
        signals_df['ind_norm_atr'] = norm_atr
        signals_df['ind_trend_dist'] = (close - ema_trend) / (close + 1e-8)

        return self.validate_signals(signals_df, df)


class CustomSwingBreakoutIndicator(BaseIndicatorAdapter):
    """
    Swing High/Low Breakout Indicator with Volume Spike Confirmation.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.lookback = 20

    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        high = df['high']
        low = df['low']
        close = df['close']
        volume = df['volume']

        swing_high = high.shift(1).rolling(window=self.lookback).max()
        swing_low = low.shift(1).rolling(window=self.lookback).min()
        vol_ma = volume.rolling(window=self.lookback).mean()
        vol_spike = volume > (vol_ma * 1.3)

        signals_df = pd.DataFrame(index=df.index)
        signals_df['signal'] = 0
        signals_df['signal_strength'] = 0.5
        signals_df['entry_price'] = close
        signals_df['indicator_state'] = 'CONSOLIDATION'

        long_cond = (close > swing_high) & vol_spike
        short_cond = (close < swing_low) & vol_spike

        signals_df.loc[long_cond, 'signal'] = 1
        signals_df.loc[long_cond, 'indicator_state'] = 'SWING_HIGH_BREAKOUT'
        signals_df.loc[short_cond, 'signal'] = -1
        signals_df.loc[short_cond, 'indicator_state'] = 'SWING_LOW_BREAKDOWN'

        signals_df['ind_breakout_dist'] = (close - swing_high) / (close + 1e-8)
        signals_df['ind_rel_volume'] = volume / (vol_ma + 1e-8)

        return self.validate_signals(signals_df, df)
