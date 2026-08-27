"""
Triple-Barrier Labeling Engine.
Implements de Prado's Triple Barrier Method with realistic intra-bar resolution,
dynamic ATR bounds, MFE/MAE extraction, and zero look-ahead bias.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional

class TripleBarrierLabeler:
    """
    Labels each active indicator trade with the barrier hit first:
    - Upper Barrier (Take Profit)
    - Lower Barrier (Stop Loss)
    - Vertical Barrier (Time/Max Holding Period)
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.use_atr = self.config.get("use_atr_barriers", True)
        self.tp_mult = self.config.get("tp_multiplier", 2.0)
        self.sl_mult = self.config.get("sl_multiplier", 1.0)
        self.fixed_tp = self.config.get("fixed_tp_pct", 0.02)
        self.fixed_sl = self.config.get("fixed_sl_pct", 0.01)
        self.max_holding = self.config.get("max_holding_bars", 20)
        self.intra_bar_res = self.config.get("intra_bar_resolution", "conservative")

    def label_events(self, df: pd.DataFrame, signals_df: pd.DataFrame) -> pd.DataFrame:
        """
        Processes signals and generates full triple-barrier event outcomes.
        Returns a DataFrame containing:
        - label: 1 (Profitable/TP hit), 0 (Loss/SL hit or negative expiry)
        - barrier_hit: 'TP', 'SL', 'TIME'
        - return_pct: realized return percentage
        - holding_bars: duration in candles
        - mfe: Maximum Favorable Excursion (%)
        - mae: Maximum Adverse Excursion (%)
        """
        close = df['close'].values
        high = df['high'].values
        low = df['low'].values
        open_p = df['open'].values
        n = len(df)
        
        # Calculate ATR if needed
        tr = np.maximum(df['high'] - df['low'], np.maximum((df['high'] - df['close'].shift(1)).abs(), (df['low'] - df['close'].shift(1)).abs()))
        atr = tr.rolling(14).mean().bfill().values

        signals = signals_df['signal'].values
        
        labels = np.full(n, np.nan)
        returns = np.full(n, np.nan)
        barriers = np.array(['NONE'] * n, dtype=object)
        holding_bars = np.full(n, 0, dtype=int)
        mfes = np.full(n, np.nan)
        maes = np.full(n, np.nan)

        for i in range(n):
            sig = signals[i]
            if sig == 0 or (i + 1 >= n):
                continue
                
            # Execution benchmark: Next candle open (realistic execution)
            entry_price = open_p[i + 1] if (i + 1 < n) else close[i]
            if entry_price <= 0:
                continue

            # Compute TP and SL thresholds
            if self.use_atr:
                curr_atr = atr[i]
                tp_dist = curr_atr * self.tp_mult
                sl_dist = curr_atr * self.sl_mult
            else:
                tp_dist = entry_price * self.fixed_tp
                sl_dist = entry_price * self.fixed_sl

            if sig == 1: # LONG
                tp_price = entry_price + tp_dist
                sl_price = entry_price - sl_dist
            else: # SHORT
                tp_price = entry_price - tp_dist
                sl_price = entry_price + sl_dist

            # Traverse forward until barrier hit or max holding
            end_idx = min(i + 1 + self.max_holding, n)
            hit = 'TIME'
            exit_price = close[end_idx - 1]
            bars_held = end_idx - (i + 1)
            
            mfe = 0.0
            mae = 0.0

            for j in range(i + 1, end_idx):
                h = high[j]
                l = low[j]
                
                # MFE / MAE tracking
                if sig == 1:
                    mfe = max(mfe, (h - entry_price) / entry_price)
                    mae = min(mae, (l - entry_price) / entry_price)
                else:
                    mfe = max(mfe, (entry_price - l) / entry_price)
                    mae = min(mae, (entry_price - h) / entry_price)

                # Check Long Barriers
                if sig == 1:
                    tp_reached = h >= tp_price
                    sl_reached = l <= sl_price

                    if tp_reached and sl_reached:
                        # Intra-bar collision handling
                        if self.intra_bar_res == "conservative" or self.intra_bar_res == "pessimistic":
                            hit = 'SL'
                            exit_price = sl_price
                        else:
                            hit = 'TP'
                            exit_price = tp_price
                        bars_held = j - i
                        break
                    elif sl_reached:
                        hit = 'SL'
                        exit_price = sl_price
                        bars_held = j - i
                        break
                    elif tp_reached:
                        hit = 'TP'
                        exit_price = tp_price
                        bars_held = j - i
                        break

                # Check Short Barriers
                elif sig == -1:
                    tp_reached = l <= tp_price
                    sl_reached = h >= sl_price

                    if tp_reached and sl_reached:
                        if self.intra_bar_res == "conservative" or self.intra_bar_res == "pessimistic":
                            hit = 'SL'
                            exit_price = sl_price
                        else:
                            hit = 'TP'
                            exit_price = tp_price
                        bars_held = j - i
                        break
                    elif sl_reached:
                        hit = 'SL'
                        exit_price = sl_price
                        bars_held = j - i
                        break
                    elif tp_reached:
                        hit = 'TP'
                        exit_price = tp_price
                        bars_held = j - i
                        break

            # Compute realized trade return
            if sig == 1:
                ret = (exit_price - entry_price) / entry_price
            else:
                ret = (entry_price - exit_price) / entry_price

            labels[i] = 1.0 if ret > 0 else 0.0
            returns[i] = ret
            barriers[i] = hit
            holding_bars[i] = bars_held
            mfes[i] = mfe
            maes[i] = abs(mae)

        out_df = pd.DataFrame({
            'label': labels,
            'barrier_hit': barriers,
            'return_pct': returns,
            'holding_bars': holding_bars,
            'mfe': mfes,
            'mae': maes
        }, index=df.index)

        return out_df
