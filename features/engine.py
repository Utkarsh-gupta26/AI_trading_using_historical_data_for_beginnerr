"""
Master Feature Engineering Pipeline.
Orchestrates price, trend, momentum, volatility, volume, market structure,
and custom indicator features into a unified, leak-free feature matrix.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

from .price import compute_price_features
from .trend import compute_trend_features
from .momentum import compute_momentum_features
from .volatility import compute_volatility_features
from .volume import compute_volume_features
from .market_structure import compute_market_structure_features
from .regime import compute_regime_features

class FeatureEngine:
    """
    Master feature extractor.
    Enforces strict chronological feature generation with zero forward leakage.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    def extract_features(self, df: pd.DataFrame, signals_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        feature_blocks = []
        
        # 1. Core Market Features
        feature_blocks.append(compute_price_features(df))
        feature_blocks.append(compute_trend_features(df))
        feature_blocks.append(compute_momentum_features(df))
        feature_blocks.append(compute_volatility_features(df))
        feature_blocks.append(compute_volume_features(df))
        feature_blocks.append(compute_market_structure_features(df))
        feature_blocks.append(compute_regime_features(df))
        
        # 2. Indicator-Specific Features & Signal Context
        if signals_df is not None:
            sig_feats = pd.DataFrame(index=df.index)
            sig_feats['feat_indicator_signal'] = signals_df['signal']
            sig_feats['feat_signal_strength'] = signals_df['signal_strength']
            
            # Signal dynamics (time since last signal, signal frequency)
            sig_active = (signals_df['signal'] != 0).astype(int)
            sig_feats['feat_signals_in_last_10'] = sig_active.rolling(10).sum()
            sig_feats['feat_signals_in_last_30'] = sig_active.rolling(30).sum()
            
            # Incorporate custom indicator variables (e.g., ind_*)
            for col in signals_df.columns:
                if col.startswith('ind_') or col.startswith('custom_'):
                    sig_feats[f"feat_{col}"] = signals_df[col]
                    
            feature_blocks.append(sig_feats)

        # Combine all feature blocks
        all_features = pd.concat(feature_blocks, axis=1)
        
        # Forward fill clean and replace any remaining NaNs in initial burn-in with 0
        all_features = all_features.replace([np.inf, -np.inf], np.nan)
        all_features = all_features.bfill().fillna(0.0)
        
        return all_features
