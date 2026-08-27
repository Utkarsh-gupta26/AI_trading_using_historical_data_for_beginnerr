"""
Momentum and Oscillator Feature Generator.
"""
import pandas as pd
import numpy as np

def compute_momentum_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    close = df['close']
    high = df['high']
    low = df['low']
    
    # 1. RSI (14)
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-8)
    rsi = 100 - (100 / (1 + rs))
    feats['feat_rsi_14'] = rsi / 100.0
    feats['feat_rsi_slope_3'] = (rsi - rsi.shift(3)) / 100.0
    
    # 2. MACD
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line
    
    feats['feat_macd_norm'] = macd_line / (close + 1e-8)
    feats['feat_macd_hist_norm'] = macd_hist / (close + 1e-8)
    feats['feat_macd_hist_diff'] = macd_hist.diff() / (close + 1e-8)
    
    # 3. Stochastic Oscillator (14, 3)
    low14 = low.rolling(14).min()
    high14 = high.rolling(14).max()
    stoch_k = 100 * (close - low14) / (high14 - low14 + 1e-8)
    stoch_d = stoch_k.rolling(3).mean()
    feats['feat_stoch_k'] = stoch_k / 100.0
    feats['feat_stoch_d'] = stoch_d / 100.0
    
    # 4. Rate of Change (ROC)
    feats['feat_roc_5'] = (close - close.shift(5)) / (close.shift(5) + 1e-8)
    feats['feat_roc_12'] = (close - close.shift(12)) / (close.shift(12) + 1e-8)
    
    return feats
