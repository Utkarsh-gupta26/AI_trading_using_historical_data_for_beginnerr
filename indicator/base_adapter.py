"""
Base Indicator Adapter Contract.
Enables plug-and-play integration for any custom trading indicator
(Pine Script exports, Python strategies, CSV logs, Webhooks).
"""
from abc import ABC, abstractmethod
import pandas as pd
from typing import Dict, Any, Optional

class BaseIndicatorAdapter(ABC):
    """
    Standard interface for custom indicators.
    Enforces a strict signal schema while allowing arbitrary indicator-specific metadata.
    """
    REQUIRED_SIGNAL_COLS = ['signal', 'signal_strength', 'entry_price', 'indicator_state']

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        """
        Processes market OHLCV data and returns a signals DataFrame aligned with df.index.
        
        Must produce columns:
        - signal: int (-1 for SHORT/SELL, 0 for FLAT/HOLD, +1 for LONG/BUY)
        - signal_strength: float (e.g. 0.0 to 1.0)
        - entry_price: float (close or execution benchmark at signal candle)
        - indicator_state: int/str (indicator sub-state, e.g. 'BULL_CROSS', 'OVERBOUGHT_REVERSAL')
        Plus optional custom fields (e.g., custom_feature_1, custom_feature_2, etc.)
        """
        pass

    def validate_signals(self, signals_df: pd.DataFrame, raw_df: pd.DataFrame) -> pd.DataFrame:
        """
        Validates signal integrity and prevents premature execution indices.
        """
        if not signals_df.index.equals(raw_df.index):
            signals_df = signals_df.reindex(raw_df.index).fillna(0)
            
        for col in self.REQUIRED_SIGNAL_COLS:
            if col not in signals_df.columns:
                if col == 'signal':
                    raise ValueError(f"Signals DataFrame is missing required column: {col}")
                elif col == 'signal_strength':
                    signals_df['signal_strength'] = signals_df['signal'].abs().astype(float)
                elif col == 'entry_price':
                    signals_df['entry_price'] = raw_df['close']
                elif col == 'indicator_state':
                    signals_df['indicator_state'] = 'DEFAULT'

        # Ensure signal is strictly -1, 0, or 1
        signals_df['signal'] = signals_df['signal'].fillna(0).astype(int).clip(-1, 1)
        signals_df['entry_price'] = signals_df['entry_price'].fillna(raw_df['close'])
        signals_df['signal_strength'] = signals_df['signal_strength'].fillna(0.0).astype(float)
        return signals_df
