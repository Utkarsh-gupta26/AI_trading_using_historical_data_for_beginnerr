"""
TradingView / Pine Script Signal Parser.
Parses TradingView Strategy Tester CSV logs, webhook payload histories,
and custom Pine Script export files into standardized signal frames.
"""
import os
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional
from .base_adapter import BaseIndicatorAdapter

logger = logging.getLogger(__name__)

class PineScriptSignalParser(BaseIndicatorAdapter):
    """
    Parses Pine Script CSV/Parquet signal exports.
    Maps common TradingView headers ('Type', 'Signal', 'Action', 'Price', etc.)
    into the unified validation schema.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.csv_path = self.config.get("pine_csv_path", "data/external/pine_signals.csv")

    def generate_signals(self, df: pd.DataFrame, symbol: str, timeframe: str) -> pd.DataFrame:
        signals_df = pd.DataFrame(index=df.index)
        signals_df['signal'] = 0
        signals_df['signal_strength'] = 0.0
        signals_df['entry_price'] = df['close']
        signals_df['indicator_state'] = 'INACTIVE'

        if not os.path.exists(self.csv_path):
            logger.info(f"No external Pine Script signal file found at {self.csv_path}. Initializing empty signal frame.")
            return self.validate_signals(signals_df, df)

        try:
            external_df = pd.read_csv(self.csv_path)
            # Standardize date column
            date_col = next((c for c in external_df.columns if 'time' in c.lower() or 'date' in c.lower()), None)
            if date_col:
                external_df['datetime'] = pd.to_datetime(external_df[date_col])
                external_df.set_index('datetime', inplace=True)
                if external_df.index.tz is not None:
                    external_df.index = external_df.index.tz_convert(None)

            # Map signal/type column
            sig_col = next((c for c in external_df.columns if c.lower() in ['signal', 'type', 'action', 'order_type']), None)
            if sig_col:
                mapped_sigs = []
                for val in external_df[sig_col]:
                    val_str = str(val).upper().strip()
                    if 'BUY' in val_str or 'LONG' in val_str or val_str == '1':
                        mapped_sigs.append(1)
                    elif 'SELL' in val_str or 'SHORT' in val_str or val_str == '-1':
                        mapped_sigs.append(-1)
                    else:
                        mapped_sigs.append(0)
                external_df['mapped_signal'] = mapped_sigs
                
                # Align with df index using merge_asof or nearest reindex
                aligned = external_df[['mapped_signal']].reindex(df.index, method='ffill').fillna(0)
                signals_df['signal'] = aligned['mapped_signal'].astype(int)
                signals_df['signal_strength'] = 1.0

            # Map custom features if present
            for col in external_df.columns:
                if col.startswith('custom_') or col.startswith('ind_'):
                    signals_df[col] = external_df[col].reindex(df.index).fillna(method='ffill')

        except Exception as e:
            logger.error(f"Error parsing Pine Script file {self.csv_path}: {e}")

        return self.validate_signals(signals_df, df)
