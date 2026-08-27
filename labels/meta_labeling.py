"""
Meta-Labeling Dataset Builder.
Transforms indicator signals into a structured ML classification dataset:
P(Y = 1 | Indicator Signal at time T, Market Features at time T)
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional

class MetaLabelingDatasetBuilder:
    """
    Constructs the feature matrix X and target vector y for meta-labeling.
    Filters exclusively on moments where the custom indicator triggered a signal.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    def build_meta_dataset(
        self,
        features_df: pd.DataFrame,
        signals_df: pd.DataFrame,
        labels_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
        """
        Combines features, signals, and triple-barrier outcomes into:
        - X: Feature matrix for active signal bars
        - y: Binary meta-label (1 = profitable trade, 0 = unprofitable)
        - meta_df: Full aligned audit DataFrame with trade details (return, MFE, MAE, barrier_hit)
        """
        # Active signals filter
        active_mask = (signals_df['signal'] != 0) & (~labels_df['label'].isna())
        
        # Combined DataFrame
        meta_df = features_df[active_mask].copy()
        meta_df['signal'] = signals_df.loc[active_mask, 'signal']
        meta_df['signal_strength'] = signals_df.loc[active_mask, 'signal_strength']
        meta_df['label'] = labels_df.loc[active_mask, 'label'].astype(int)
        meta_df['return_pct'] = labels_df.loc[active_mask, 'return_pct']
        meta_df['barrier_hit'] = labels_df.loc[active_mask, 'barrier_hit']
        meta_df['holding_bars'] = labels_df.loc[active_mask, 'holding_bars']
        meta_df['mfe'] = labels_df.loc[active_mask, 'mfe']
        meta_df['mae'] = labels_df.loc[active_mask, 'mae']

        # Drop any leakage/target columns from X
        feature_cols = [c for c in features_df.columns if not c.startswith('label') and not c.startswith('target')]
        X = meta_df[feature_cols].copy()
        y = meta_df['label'].copy()

        return X, y, meta_df
