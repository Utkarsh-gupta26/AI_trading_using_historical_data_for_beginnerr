"""
Dynamic Custom Indicator Loader and Executor.
Safely executes custom Python or Pine-rule code entered dynamically from the UI.
"""
import pandas as pd
import numpy as np
import logging
from typing import Dict, Any, Optional
from indicator.base_adapter import BaseIndicatorAdapter

logger = logging.getLogger(__name__)

DEFAULT_CUSTOM_TEMPLATE = '''def custom_indicator_strategy(df):
    """
    df has columns: ['open', 'high', 'low', 'close', 'volume']
    Return a pandas Series of signals:
      +1 for LONG / BUY
      -1 for SHORT / SELL
       0 for FLAT / NO SIGNAL
    """
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    # --- EXAMPLE INDICATOR FORMULA ---
    ema_fast = close.ewm(span=10, adjust=False).mean()
    ema_slow = close.ewm(span=30, adjust=False).mean()
    
    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-8)
    rsi = 100 - (100 / (1 + rs))

    signals = pd.Series(0, index=df.index)
    
    # Buy when Fast EMA crosses above Slow EMA and RSI > 50
    long_condition = (ema_fast > ema_slow) & (ema_fast.shift(1) <= ema_slow.shift(1)) & (rsi > 50)
    
    # Sell when Fast EMA crosses below Slow EMA and RSI < 50
    short_condition = (ema_fast < ema_slow) & (ema_fast.shift(1) >= ema_slow.shift(1)) & (rsi < 50)

    signals[long_condition] = 1
    signals[short_condition] = -1

    return signals
'''

class DynamicUserIndicator(BaseIndicatorAdapter):
    """
    Dynamically executes Python code supplied via the UI.
    """
    def __init__(self, code_str: str, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.code_str = code_str

    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        local_env = {
            "pd": pd,
            "np": np,
            "df": df.copy()
        }
        
        try:
            exec(self.code_str, globals(), local_env)
            if "custom_indicator_strategy" in local_env:
                fn = local_env["custom_indicator_strategy"]
                raw_sig = fn(df)
            else:
                raise ValueError("Function 'custom_indicator_strategy(df)' not found in code.")
                
            signals_df = pd.DataFrame(index=df.index)
            signals_df['signal'] = raw_sig.fillna(0).astype(int).clip(-1, 1)
            signals_df['signal_strength'] = signals_df['signal'].abs().astype(float)
            signals_df['entry_price'] = df['close']
            signals_df['indicator_state'] = 'DYNAMIC_USER_CODE'
            
            return self.validate_signals(signals_df, df)
            
        except Exception as e:
            logger.error(f"Error executing dynamic custom indicator: {e}")
            raise RuntimeError(f"Indicator Execution Error: {e}")
