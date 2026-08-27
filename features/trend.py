"""
Trend Feature Generator.
Calculates moving averages, slopes, ribbons, and trend persistence.
"""
import pandas as pd
import numpy as np

def compute_trend_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    close = df['close']
    
    # EMAs
    ema9 = close.ewm(span=9, adjust=False).mean()
    ema21 = close.ewm(span=21, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()
    
    # Distance from EMAs
    feats['feat_dist_ema9'] = (close - ema9) / (close + 1e-8)
    feats['feat_dist_ema21'] = (close - ema21) / (close + 1e-8)
    feats['feat_dist_ema50'] = (close - ema50) / (close + 1e-8)
    feats['feat_dist_ema200'] = (close - ema200) / (close + 1e-8)
    
    # EMA Slopes (5-bar lookback)
    feats['feat_slope_ema9'] = (ema9 - ema9.shift(5)) / (close + 1e-8)
    feats['feat_slope_ema21'] = (ema21 - ema21.shift(5)) / (close + 1e-8)
    feats['feat_slope_ema50'] = (ema50 - ema50.shift(5)) / (close + 1e-8)
    
    # EMA Alignment (1 = Perfect Bullish 9>21>50>200, -1 = Perfect Bearish, 0 = Mixed)
    bull_align = (ema9 > ema21) & (ema21 > ema50) & (ema50 > ema200)
    bear_align = (ema9 < ema21) & (ema21 < ema50) & (ema50 < ema200)
    feats['feat_ema_alignment'] = 0
    feats.loc[bull_align, 'feat_ema_alignment'] = 1
    feats.loc[bear_align, 'feat_ema_alignment'] = -1
    
    # Trend persistence (% of last 20 bars close > ema50)
    feats['feat_trend_persistence_20'] = (close > ema50).rolling(20).mean()
    
    return feats
