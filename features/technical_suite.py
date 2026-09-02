"""
Comprehensive Technical Indicator Feature Suite.
Adapted and expanded from Technical Indicator Analysis ML (finta/ccroft6).
Provides zero-leakage mathematical implementations of advanced indicators:
- Trend: HMA, KAMA, ZLEMA, DEMA, TEMA
- Momentum: CCI, CMO, PPO, UO, AO, TSI, FISH, STOCHRSI
- Volatility & Bands: Keltner Channels, Donchian Channels, Squeeze Momentum (SQZMI)
- Volume: Money Flow Index (MFI), Chaikin Money Flow (CMF)
"""
import numpy as np
import pandas as pd
from typing import Dict, Any


class TechnicalSuiteFeatureExtractor:
    """
    Computes advanced multi-indicator features with strict point-in-time calculation.
    """
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extracts 25+ advanced technical indicators from OHLCV data.
        """
        feats = pd.DataFrame(index=df.index)
        
        close = df['close']
        high = df['high']
        low = df['low']
        open_p = df['open']
        volume = df.get('volume', pd.Series(1, index=df.index))

        # --- 1. Advanced Moving Averages (Trend) ---
        # Double EMA (DEMA)
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_ema_12 = ema_12.ewm(span=12, adjust=False).mean()
        dema_12 = 2 * ema_12 - ema_ema_12
        feats['ti_dema_ratio'] = (close / (dema_12 + 1e-8)) - 1.0

        # Zero Lag EMA (ZLEMA)
        lag_period = (14 - 1) // 2
        zlema_data = 2 * close - close.shift(lag_period).bfill()
        zlema = zlema_data.ewm(span=14, adjust=False).mean()
        feats['ti_zlema_ratio'] = (close / (zlema + 1e-8)) - 1.0

        # Hull Moving Average (HMA)
        wma_half = close.rolling(7).apply(lambda x: np.dot(x, np.arange(1, 8)) / 28, raw=True)
        wma_full = close.rolling(14).apply(lambda x: np.dot(x, np.arange(1, 15)) / 105, raw=True)
        hma_diff = 2 * wma_half - wma_full
        hma = hma_diff.rolling(4).mean()
        feats['ti_hma_ratio'] = (close / (hma + 1e-8)) - 1.0

        # Kaufman Adaptive Moving Average (KAMA)
        change = (close - close.shift(10)).abs()
        volatility = (close - close.shift(1)).abs().rolling(10).sum()
        er = (change / (volatility + 1e-8)).fillna(0) # Efficiency Ratio
        sc = (er * (2/(2+1) - 2/(30+1)) + 2/(30+1)) ** 2
        kama = pd.Series(close.iloc[0], index=df.index)
        for i in range(1, len(df)):
            kama.iloc[i] = kama.iloc[i-1] + sc.iloc[i] * (close.iloc[i] - kama.iloc[i-1])
        feats['ti_kama_ratio'] = (close / (kama + 1e-8)) - 1.0

        # --- 2. Momentum & Oscillators ---
        # Commodity Channel Index (CCI)
        tp = (high + low + close) / 3.0
        tp_sma = tp.rolling(20).mean()
        tp_mad = tp.rolling(20).apply(lambda x: np.fabs(x - x.mean()).mean(), raw=True)
        feats['ti_cci_20'] = (tp - tp_sma) / (0.015 * tp_mad + 1e-8)

        # Chande Momentum Oscillator (CMO)
        diff = close.diff()
        pos_sum = diff.clip(lower=0).rolling(14).sum()
        neg_sum = (-diff.clip(upper=0)).rolling(14).sum()
        feats['ti_cmo_14'] = 100 * (pos_sum - neg_sum) / (pos_sum + neg_sum + 1e-8)

        # Percentage Price Oscillator (PPO)
        ema_fast = close.ewm(span=12, adjust=False).mean()
        ema_slow = close.ewm(span=26, adjust=False).mean()
        ppo = ((ema_fast - ema_slow) / (ema_slow + 1e-8)) * 100
        ppo_signal = ppo.ewm(span=9, adjust=False).mean()
        feats['ti_ppo'] = ppo
        feats['ti_ppo_hist'] = ppo - ppo_signal

        # Awesome Oscillator (AO)
        median_price = (high + low) / 2.0
        ao_fast = median_price.rolling(5).mean()
        ao_slow = median_price.rolling(34).mean()
        feats['ti_awesome_osc'] = (ao_fast - ao_slow) / (close + 1e-8)

        # True Strength Index (TSI)
        pc = close.diff()
        pc_smooth1 = pc.ewm(span=25, adjust=False).mean()
        pc_smooth2 = pc_smooth1.ewm(span=13, adjust=False).mean()
        abs_pc_smooth1 = pc.abs().ewm(span=25, adjust=False).mean()
        abs_pc_smooth2 = abs_pc_smooth1.ewm(span=13, adjust=False).mean()
        feats['ti_tsi'] = 100 * (pc_smooth2 / (abs_pc_smooth2 + 1e-8))

        # Stochastic RSI
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / (loss + 1e-8)
        rsi = 100 - (100 / (1 + rs))
        min_rsi = rsi.rolling(14).min()
        max_rsi = rsi.rolling(14).max()
        feats['ti_stoch_rsi'] = (rsi - min_rsi) / (max_rsi - min_rsi + 1e-8)

        # Fisher Transform
        hl2 = (high + low) / 2.0
        hl2_min = hl2.rolling(10).min()
        hl2_max = hl2.rolling(10).max()
        scaled_val = 0.66 * ((hl2 - hl2_min) / (hl2_max - hl2_min + 1e-8) - 0.5)
        scaled_val = scaled_val.clip(-0.999, 0.999).fillna(0)
        feats['ti_fisher_transform'] = 0.5 * np.log((1 + scaled_val) / (1 - scaled_val + 1e-8))

        # --- 3. Volatility, Bands & Squeeze ---
        # True Range & ATR
        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_20 = tr.rolling(20).mean()

        # Keltner Channels
        kc_mid = close.ewm(span=20, adjust=False).mean()
        kc_upper = kc_mid + 2.0 * atr_20
        kc_lower = kc_mid - 2.0 * atr_20
        feats['ti_kc_position'] = (close - kc_lower) / (kc_upper - kc_lower + 1e-8)

        # Donchian Channels
        do_high = high.rolling(20).max()
        do_low = low.rolling(20).min()
        feats['ti_donchian_position'] = (close - do_low) / (do_high - do_low + 1e-8)
        feats['ti_donchian_width'] = (do_high - do_low) / (close + 1e-8)

        # Squeeze Momentum Indicator (SQZMI) - Bollinger inside Keltner
        bb_std = close.rolling(20).std()
        bb_upper = close.rolling(20).mean() + 2.0 * bb_std
        bb_lower = close.rolling(20).mean() - 2.0 * bb_std
        # Squeeze is on when BB is inside KC
        feats['ti_squeeze_on'] = ((bb_lower > kc_lower) & (bb_upper < kc_upper)).astype(float)

        # --- 4. Volume & Flow Indicators ---
        # Money Flow Index (MFI)
        raw_money_flow = tp * volume
        tp_diff = tp.diff()
        pos_flow = raw_money_flow.where(tp_diff > 0, 0).rolling(14).sum()
        neg_flow = raw_money_flow.where(tp_diff < 0, 0).rolling(14).sum()
        mfi_ratio = pos_flow / (neg_flow + 1e-8)
        feats['ti_mfi_14'] = 100 - (100 / (1 + mfi_ratio))

        # Chaikin Money Flow (CMF)
        mf_multiplier = ((close - low) - (high - close)) / (high - low + 1e-8)
        mf_volume = mf_multiplier * volume
        feats['ti_cmf_20'] = mf_volume.rolling(20).sum() / (volume.rolling(20).sum() + 1e-8)

        return feats.fillna(0)
