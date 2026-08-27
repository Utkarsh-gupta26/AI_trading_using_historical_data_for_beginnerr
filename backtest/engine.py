"""
Event-Driven Backtesting Engine.
Executes trading signals with realistic market friction, position sizing,
intra-bar execution realism, and zero look-ahead bias.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from .position_sizing import PositionSizer
from .metrics import calculate_performance_metrics

class BacktestEngine:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        b_cfg = self.config.get("backtest", {})
        self.initial_capital = b_cfg.get("initial_capital", 100000.0)
        self.commission_pct = b_cfg.get("commission_pct", 0.0005)
        self.slippage_pct = b_cfg.get("slippage_pct", 0.0005)
        self.spread_pct = b_cfg.get("spread_pct", 0.0002)
        self.sizer = PositionSizer(b_cfg)
        
        lbl_cfg = self.config.get("labeling", {})
        self.tp_mult = lbl_cfg.get("tp_multiplier", 2.0)
        self.sl_mult = lbl_cfg.get("sl_multiplier", 1.0)
        self.max_holding = lbl_cfg.get("max_holding_bars", 20)

    def run_backtest(
        self,
        df: pd.DataFrame,
        signals_df: pd.DataFrame,
        probabilities: Optional[np.ndarray] = None,
        threshold: float = 0.50,
        symbol: str = "UNKNOWN"
    ) -> Dict[str, Any]:
        """
        Executes backtest:
        - Signal at candle T -> Order fills at Open of candle T+1
        - Deducts commission, spread, and slippage on entry and exit
        """
        n = len(df)
        if n < 2:
            return {"metrics": {}, "equity_curve": pd.Series(), "trade_log": pd.DataFrame()}

        dates = df.index
        open_p = df['open'].values
        high_p = df['high'].values
        low_p = df['low'].values
        close_p = df['close'].values
        
        # Calculate ATR
        tr = np.maximum(high_p - low_p, np.maximum(np.abs(high_p - np.roll(close_p, 1)), np.abs(low_p - np.roll(close_p, 1))))
        tr[0] = high_p[0] - low_p[0]
        atr = pd.Series(tr).rolling(14).mean().bfill().values

        signals = signals_df['signal'].values
        probas = probabilities if probabilities is not None else np.ones(n)

        cash = self.initial_capital
        equity_series = np.zeros(n)
        trades: List[Dict[str, Any]] = []

        in_position = False
        pos_dir = 0
        pos_entry_price = 0.0
        pos_shares = 0.0
        pos_entry_idx = 0
        pos_tp = 0.0
        pos_sl = 0.0
        pos_proba = 0.0
        mfe = 0.0
        mae = 0.0

        for i in range(n):
            current_date = dates[i]
            
            # 1. Update position status if in trade
            if in_position:
                h = high_p[i]
                l = low_p[i]
                c = close_p[i]
                bars_held = i - pos_entry_idx
                
                # Track MFE / MAE
                if pos_dir == 1:
                    mfe = max(mfe, (h - pos_entry_price) / pos_entry_price)
                    mae = min(mae, (l - pos_entry_price) / pos_entry_price)
                else:
                    mfe = max(mfe, (pos_entry_price - l) / pos_entry_price)
                    mae = min(mae, (pos_entry_price - h) / pos_entry_price)

                exit_triggered = False
                exit_price = c
                exit_reason = "TIME_EXPIRY"

                # Check TP/SL
                if pos_dir == 1:
                    if l <= pos_sl:
                        exit_triggered = True
                        exit_price = pos_sl
                        exit_reason = "STOP_LOSS"
                    elif h >= pos_tp:
                        exit_triggered = True
                        exit_price = pos_tp
                        exit_reason = "TAKE_PROFIT"
                elif pos_dir == -1:
                    if h >= pos_sl:
                        exit_triggered = True
                        exit_price = pos_sl
                        exit_reason = "STOP_LOSS"
                    elif l <= pos_tp:
                        exit_triggered = True
                        exit_price = pos_tp
                        exit_reason = "TAKE_PROFIT"

                # Check Max Holding
                if not exit_triggered and bars_held >= self.max_holding:
                    exit_triggered = True
                    exit_price = c
                    exit_reason = "TIME_EXPIRY"

                if exit_triggered or (i == n - 1):
                    # Apply slippage on exit
                    if pos_dir == 1:
                        effective_exit = exit_price * (1.0 - self.slippage_pct - self.spread_pct / 2.0)
                        gross_pnl = (effective_exit - pos_entry_price) * pos_shares
                    else:
                        effective_exit = exit_price * (1.0 + self.slippage_pct + self.spread_pct / 2.0)
                        gross_pnl = (pos_entry_price - effective_exit) * pos_shares

                    exit_commission = effective_exit * pos_shares * self.commission_pct
                    net_pnl = gross_pnl - exit_commission
                    cash += (pos_shares * pos_entry_price) + net_pnl
                    ret_pct = net_pnl / (pos_shares * pos_entry_price)

                    trades.append({
                        "symbol": symbol,
                        "entry_time": str(dates[pos_entry_idx]),
                        "exit_time": str(current_date),
                        "direction": "LONG" if pos_dir == 1 else "SHORT",
                        "shares": pos_shares,
                        "entry_price": pos_entry_price,
                        "exit_price": effective_exit,
                        "exit_reason": exit_reason,
                        "gross_pnl": gross_pnl,
                        "net_pnl": net_pnl,
                        "return_pct": ret_pct,
                        "holding_bars": bars_held,
                        "mfe": mfe,
                        "mae": abs(mae),
                        "ml_probability": pos_proba
                    })

                    in_position = False
                    pos_shares = 0.0

            # 2. Check for New Signal Execution (if flat and not at end)
            if not in_position and (i + 1 < n):
                sig = signals[i]
                proba = probas[i]
                
                # Check ML probability threshold filter
                if sig != 0 and proba >= threshold:
                    next_open = open_p[i + 1]
                    pos_dir = sig
                    pos_proba = proba
                    pos_entry_idx = i + 1
                    
                    # Apply entry slippage
                    if pos_dir == 1:
                        pos_entry_price = next_open * (1.0 + self.slippage_pct + self.spread_pct / 2.0)
                        pos_sl = pos_entry_price - (atr[i] * self.sl_mult)
                        pos_tp = pos_entry_price + (atr[i] * self.tp_mult)
                    else:
                        pos_entry_price = next_open * (1.0 - self.slippage_pct - self.spread_pct / 2.0)
                        pos_sl = pos_entry_price + (atr[i] * self.sl_mult)
                        pos_tp = pos_entry_price - (atr[i] * self.tp_mult)

                    pos_shares = self.sizer.calculate_position_size(
                        capital=cash,
                        price=pos_entry_price,
                        stop_loss_price=pos_sl,
                        atr=atr[i]
                    )

                    if pos_shares > 0:
                        entry_cost = pos_shares * pos_entry_price * self.commission_pct
                        cash -= (pos_shares * pos_entry_price) + entry_cost
                        in_position = True
                        mfe = 0.0
                        mae = 0.0

            # 3. Mark daily equity
            curr_equity = cash + (pos_shares * close_p[i] if in_position else 0.0)
            equity_series[i] = curr_equity

        eq_curve = pd.Series(equity_series, index=dates)
        trade_log = pd.DataFrame(trades)
        metrics = calculate_performance_metrics(eq_curve, trade_log, self.initial_capital)

        return {
            "metrics": metrics,
            "equity_curve": eq_curve,
            "trade_log": trade_log
        }
