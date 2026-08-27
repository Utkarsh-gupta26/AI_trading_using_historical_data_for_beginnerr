"""
Market Regime Classification Feature Generator.
Provides categorical and one-hot encoded market regime identifiers.
"""
import pandas as pd
import numpy as np

def compute_regime_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    close = df['close']
    high = df['high']
    low = df['low']
    
    # 1. Trend Regime
    ema20 = close.ewm(span=20, adjust=False).mean()
    ema50 = close.ewm(span=50, adjust=False).mean()
    ema200 = close.ewm(span=200, adjust=False).mean()
    
    trend_regime = np.zeros(len(df), dtype=int)
    # Strong Bull: Close > EMA20 > EMA50 > EMA200
    strong_bull = (close > ema20) & (ema20 > ema50) & (ema50 > ema200)
    # Bull: Close > EMA50 > EMA200
    bull = (close > ema50) & (ema50 > ema200) & (~strong_bull)
    # Strong Bear: Close < EMA20 < EMA50 < EMA200
    strong_bear = (close < ema20) & (ema20 < ema50) & (ema50 < ema200)
    # Bear: Close < EMA50 < EMA200
    bear = (close < ema50) & (ema50 < ema200) & (~strong_bear)
    
    trend_regime[strong_bull] = 2
    trend_regime[bull] = 1
    trend_regime[bear] = -1
    trend_regime[strong_bear] = -2
    feats['feat_trend_regime'] = trend_regime
    
    # 2. Volatility Regime
    tr = np.maximum(high - low, np.maximum((high - close.shift(1)).abs(), (low - close.shift(1)).abs()))
    atr14 = tr.rolling(14).mean()
    norm_atr = atr14 / (close + 1e-8)
    vol_median = norm_atr.rolling(100).median()
    feats['feat_high_vol_regime'] = (norm_atr > vol_median).astype(int)
    
    # 3. Trending vs Ranging (ADX approximation)
    dx = (atr14 / (tr.rolling(14).std() + 1e-8)).rolling(14).mean()
    feats['feat_trending_regime'] = (dx > dx.rolling(50).median()).astype(int)
    
    # 4. Compression vs Expansion (Bollinger Bandwidth Squeeze)
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_width = (4 * std20) / (sma20 + 1e-8)
    bb_sqz = bb_width < bb_width.rolling(50).quantile(0.20)
    feats['feat_compression_regime'] = bb_sqz.astype(int)
    
    return feats
