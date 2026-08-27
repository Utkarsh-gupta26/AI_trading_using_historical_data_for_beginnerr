"""
Volatility Feature Generator.
Calculates ATR, Bollinger Bands, realized volatility, and volatility regimes.
"""
import pandas as pd
import numpy as np

def compute_volatility_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    close = df['close']
    high = df['high']
    low = df['low']
    
    # 1. True Range & ATR
    tr = np.maximum(high - low, np.maximum((high - close.shift(1)).abs(), (low - close.shift(1)).abs()))
    atr14 = tr.rolling(14).mean()
    atr50 = tr.rolling(50).mean()
    
    feats['feat_atr_norm'] = atr14 / (close + 1e-8)
    feats['feat_atr_ratio_14_50'] = atr14 / (atr50 + 1e-8) # Volatility compression/expansion
    
    # 2. Bollinger Bands (20, 2)
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    bb_width = (bb_upper - bb_lower) / (sma20 + 1e-8)
    
    feats['feat_bb_width'] = bb_width
    feats['feat_bb_position'] = (close - bb_lower) / (bb_upper - bb_lower + 1e-8)
    
    # 3. Realized Historical Volatility (20-day annualized log returns)
    log_ret = np.log(close / close.shift(1))
    feats['feat_realized_vol_20'] = log_ret.rolling(20).std() * np.sqrt(252)
    
    # 4. Volatility Percentile (100-bar rolling rank)
    feats['feat_vol_percentile_100'] = feats['feat_atr_norm'].rolling(100).apply(
        lambda x: pd.Series(x).rank().iloc[-1] / len(x) if len(x) > 0 else 0.5, raw=False
    )
    
    return feats
