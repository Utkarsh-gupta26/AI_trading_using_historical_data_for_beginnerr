"""
Price Dynamics Feature Generator.
Strictly backward-looking price geometry and return features.
"""
import pandas as pd
import numpy as np

def compute_price_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    
    open_p = df['open']
    high_p = df['high']
    low_p = df['low']
    close_p = df['close']
    
    # 1. Returns
    feats['feat_return_1'] = close_p.pct_change(1)
    feats['feat_return_3'] = close_p.pct_change(3)
    feats['feat_return_5'] = close_p.pct_change(5)
    feats['feat_return_10'] = close_p.pct_change(10)
    feats['feat_log_return_1'] = np.log(close_p / close_p.shift(1))
    
    # 2. Candle Anatomy
    total_range = (high_p - low_p).replace(0, 1e-8)
    body = (close_p - open_p).abs()
    upper_wick = high_p - np.maximum(open_p, close_p)
    lower_wick = np.minimum(open_p, close_p) - low_p
    
    feats['feat_candle_body_ratio'] = body / total_range
    feats['feat_upper_wick_ratio'] = upper_wick / total_range
    feats['feat_lower_wick_ratio'] = lower_wick / total_range
    feats['feat_candle_direction'] = np.sign(close_p - open_p)
    
    # 3. Gap & Range
    feats['feat_gap_pct'] = (open_p - close_p.shift(1)) / close_p.shift(1)
    feats['feat_norm_range'] = total_range / close_p
    
    return feats
