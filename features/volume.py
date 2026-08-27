"""
Volume Dynamics Feature Generator.
"""
import pandas as pd
import numpy as np

def compute_volume_features(df: pd.DataFrame) -> pd.DataFrame:
    feats = pd.DataFrame(index=df.index)
    volume = df['volume']
    close = df['close']
    
    vol_ma20 = volume.rolling(20).mean()
    vol_ma50 = volume.rolling(50).mean()
    
    feats['feat_volume_change_1'] = volume.pct_change(1).clip(-5, 5)
    feats['feat_rel_volume_20'] = (volume / (vol_ma20 + 1e-8)).clip(0, 10)
    feats['feat_volume_ma_ratio'] = (vol_ma20 / (vol_ma50 + 1e-8)).clip(0, 10)
    
    # On-Balance Volume (OBV) trend
    direction = np.sign(close.diff()).fillna(0)
    obv = (direction * volume).cumsum()
    obv_ema20 = obv.ewm(span=20, adjust=False).mean()
    feats['feat_obv_trend'] = np.sign(obv - obv_ema20)
    
    # Volume Percentile
    feats['feat_vol_rank_100'] = volume.rolling(100).apply(
        lambda x: pd.Series(x).rank().iloc[-1] / len(x) if len(x) > 0 else 0.5, raw=False
    )
    
    return feats
