"""
Market Structure and Swings Feature Generator.
Computes Higher Highs (HH), Lower Lows (LL), Swing Breakouts, and S/R distances.
"""
import pandas as pd
import numpy as np

def compute_market_structure_features(df: pd.DataFrame, lookback: int = 20) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    high = df['high']
    low = df['low']
    close = df['close']
    
    # Rolling swing highs/lows (shifted by 1 to strictly prevent look-ahead bias)
    rolling_high = high.shift(1).rolling(lookback).max()
    rolling_low = low.shift(1).rolling(lookback).min()
    prev_rolling_high = high.shift(lookback + 1).rolling(lookback).max()
    prev_rolling_low = low.shift(lookback + 1).rolling(lookback).min()
    
    # Swing Structure
    is_higher_high = rolling_high > prev_rolling_high
    is_lower_low = rolling_low < prev_rolling_low
    is_higher_low = rolling_low > prev_rolling_low
    is_lower_high = rolling_high < prev_rolling_high
    
    feats['feat_struct_hh'] = is_higher_high.astype(int)
    feats['feat_struct_ll'] = is_lower_low.astype(int)
    feats['feat_struct_hl'] = is_higher_low.astype(int)
    feats['feat_struct_lh'] = is_lower_high.astype(int)
    
    # Distance to Swing High and Low
    feats['feat_dist_to_swing_high'] = (rolling_high - close) / (close + 1e-8)
    feats['feat_dist_to_swing_low'] = (close - rolling_low) / (close + 1e-8)
    
    # Breakout status
    feats['feat_is_breakout_high'] = (close > rolling_high).astype(int)
    feats['feat_is_breakdown_low'] = (close < rolling_low).astype(int)
    
    return feats
