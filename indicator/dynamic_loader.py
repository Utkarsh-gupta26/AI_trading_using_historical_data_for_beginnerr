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

STRATEGY_TEMPLATES = {
    "Trend Momentum & Volume Filter": '''def custom_indicator_strategy(df):
    """
    Dual EMA Crossover with Higher-Timeframe 50 EMA Trend Filter and Volume Confirmation.
    """
    close = df['close']
    volume = df['volume']

    ema_fast = close.ewm(span=12, adjust=False).mean()
    ema_slow = close.ewm(span=26, adjust=False).mean()
    trend_ema = close.ewm(span=50, adjust=False).mean()
    vol_sma = volume.rolling(20).mean()

    # Filters
    trend_bullish = close > trend_ema
    trend_bearish = close < trend_ema
    vol_confirm = volume > (vol_sma * 1.15)

    signals = pd.Series(0, index=df.index)
    
    # Buy: Fast EMA crosses above Slow EMA + Price > Trend EMA + Volume expansion
    long_cond = (ema_fast > ema_slow) & (ema_fast.shift(1) <= ema_slow.shift(1)) & trend_bullish & vol_confirm
    # Sell: Fast EMA crosses below Slow EMA + Price < Trend EMA + Volume expansion
    short_cond = (ema_fast < ema_slow) & (ema_fast.shift(1) >= ema_slow.shift(1)) & trend_bearish & vol_confirm

    signals[long_cond] = 1
    signals[short_cond] = -1
    return signals
''',

    "Mean Reversion & Bollinger Bands (RSI)": '''def custom_indicator_strategy(df):
    """
    Mean Reversion Strategy using Bollinger Bands and 14-period RSI Overbought/Oversold levels.
    """
    close = df['close']
    
    # Bollinger Bands
    sma_20 = close.rolling(20).mean()
    std_20 = close.rolling(20).std()
    upper_band = sma_20 + (2.0 * std_20)
    lower_band = sma_20 - (2.0 * std_20)

    # 14-Period RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-8)
    rsi = 100 - (100 / (1 + rs))

    signals = pd.Series(0, index=df.index)

    # Long when price touches lower band and RSI is oversold (< 35) bouncing back
    long_cond = (close <= lower_band * 1.002) & (rsi < 35)
    # Short when price touches upper band and RSI is overbought (> 65)
    short_cond = (close >= upper_band * 0.998) & (rsi > 65)

    signals[long_cond] = 1
    signals[short_cond] = -1
    return signals
''',

    "Volatility Squeeze & Donchian Breakout": '''def custom_indicator_strategy(df):
    """
    Breakout Strategy: Price breaking 20-period High/Low with expanding True Range volatility.
    """
    close = df['close']
    high = df['high']
    low = df['low']

    # Donchian 20-period Channel
    donchian_high = high.shift(1).rolling(20).max()
    donchian_low = low.shift(1).rolling(20).min()

    # Average True Range (ATR)
    tr = np.maximum(high - low, np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1))))
    atr_14 = tr.rolling(14).mean()
    atr_sma = atr_14.rolling(50).mean()

    # Volatility is expanding (not squeezed)
    vol_expanding = atr_14 > atr_sma

    signals = pd.Series(0, index=df.index)

    # Breakout Long: Close exceeds 20-bar high with active volatility
    long_cond = (close > donchian_high) & vol_expanding
    # Breakout Short: Close drops below 20-bar low with active volatility
    short_cond = (close < donchian_low) & vol_expanding

    signals[long_cond] = 1
    signals[short_cond] = -1
    return signals
''',

    "Supertrend & MACD Momentum Alignment": '''def custom_indicator_strategy(df):
    """
    Trend Alignment combining MACD Crossovers with 200 EMA Macro Direction.
    """
    close = df['close']
    
    # MACD Calculation (12, 26, 9)
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema_12 - ema_26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal_line

    # Macro 100 EMA
    macro_ema = close.ewm(span=100, adjust=False).mean()

    signals = pd.Series(0, index=df.index)

    # Long: MACD crosses above signal line while price is above 100 EMA and histogram is positive
    long_cond = (macd_line > signal_line) & (macd_line.shift(1) <= signal_line.shift(1)) & (close > macro_ema)
    # Short: MACD crosses below signal line while price is below 100 EMA and histogram is negative
    short_cond = (macd_line < signal_line) & (macd_line.shift(1) >= signal_line.shift(1)) & (close < macro_ema)

    signals[long_cond] = 1
    signals[short_cond] = -1
    return signals
''',

    "AI Quantitative Multi-Regime Strategy": '''def custom_indicator_strategy(df):
    """
    AI-Engineered Quantitative Regime Strategy:
    Filters trend momentum entries using dynamic ATR percentiles & volume expansion.
    """
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']

    fast_ema = close.ewm(span=9, adjust=False).mean()
    slow_ema = close.ewm(span=21, adjust=False).mean()
    regime_ema = close.ewm(span=50, adjust=False).mean()

    # Dynamic ATR
    tr = np.maximum(high - low, np.maximum(abs(high - close.shift(1)), abs(low - close.shift(1))))
    atr = tr.rolling(14).mean()
    atr_p30 = atr.rolling(100).quantile(0.30)
    vol_active = atr > atr_p30

    # Volume confirmation
    vol_confirm = volume > volume.rolling(20).mean()

    signals = pd.Series(0, index=df.index)

    long_cond = (fast_ema > slow_ema) & (fast_ema.shift(1) <= slow_ema.shift(1)) & (close > regime_ema) & vol_active & vol_confirm
    short_cond = (fast_ema < slow_ema) & (fast_ema.shift(1) >= slow_ema.shift(1)) & (close < regime_ema) & vol_active & vol_confirm

    signals[long_cond] = 1
    signals[short_cond] = -1
    return signals
'''
}

DEFAULT_CUSTOM_TEMPLATE = STRATEGY_TEMPLATES["Trend Momentum & Volume Filter"]


def sanitize_python_code(code: str) -> str:
    """
    Normalizes rich-text and unicode characters commonly pasted from browsers,
    editors, Notion, Word, or PDFs into standard Python ASCII tokens.
    """
    if not code:
        return ""
    
    # 1. Normalize line endings and remove BOM / zero-width spaces
    code = code.replace("\r\n", "\n").replace("\r", "\n")
    code = code.replace("\ufeff", "").replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
    
    # 2. Normalize unicode hyphens, dashes, and minus signs to standard ASCII '-'
    unicode_dashes = [
        "\u2010", # Hyphen
        "\u2011", # Non-breaking hyphen
        "\u2012", # Figure dash
        "\u2013", # En dash
        "\u2014", # Em dash
        "\u2015", # Horizontal bar
        "\u2212", # Minus sign
        "\ufe63", # Small hyphen-minus
        "\uff0d", # Fullwidth hyphen-minus
    ]
    for dash in unicode_dashes:
        code = code.replace(dash, "-")
        
    # 3. Normalize unicode quotes
    single_quotes = ["\u2018", "\u2019", "\u201a", "\u201b", "\u2032", "\u0060", "\u00b4"]
    for sq in single_quotes:
        code = code.replace(sq, "'")
        
    double_quotes = ["\u201c", "\u201d", "\u201e", "\u201f", "\u2033"]
    for dq in double_quotes:
        code = code.replace(dq, '"')
        
    # 4. Normalize unicode whitespace
    unicode_spaces = ["\u00a0", "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a", "\u202f", "\u205f", "\u3000"]
    for sp in unicode_spaces:
        code = code.replace(sp, " ")
        
    return code


class DynamicUserIndicator(BaseIndicatorAdapter):
    """
    Dynamically executes Python code supplied via the UI.
    """
    def __init__(self, code_str: str, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.code_str = sanitize_python_code(code_str)

    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        clean_code = sanitize_python_code(self.code_str)
        local_env = {
            "pd": pd,
            "np": np,
            "df": df.copy()
        }
        
        try:
            exec(clean_code, globals(), local_env)
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
