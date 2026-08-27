"""
Position Sizing Framework.
Supports Risk-Percentage, ATR-Volatility Sizing, Conservative Fractional Kelly, and Fixed Size.
"""
import numpy as np
from typing import Dict, Any, Optional

class PositionSizer:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.mode = self.config.get("position_sizing", "risk_percentage")
        self.risk_pct = self.config.get("risk_per_trade", 0.015)
        self.max_pos_pct = self.config.get("max_position_pct", 0.25)

    def calculate_position_size(
        self,
        capital: float,
        price: float,
        stop_loss_price: float,
        atr: float = 0.0,
        win_rate: float = 0.5,
        win_loss_ratio: float = 1.5
    ) -> float:
        if capital <= 0 or price <= 0:
            return 0.0

        max_capital_allowed = capital * self.max_pos_pct

        if self.mode == "fixed_capital":
            pos_capital = min(capital * 0.10, max_capital_allowed)
            return pos_capital / price

        elif self.mode == "risk_percentage":
            # Risk a fixed percentage of total capital
            sl_distance = abs(price - stop_loss_price)
            if sl_distance <= 0:
                sl_distance = price * 0.01
            risk_amount = capital * self.risk_pct
            shares = risk_amount / sl_distance
            pos_capital = shares * price
            if pos_capital > max_capital_allowed:
                shares = max_capital_allowed / price
            return max(0.0, float(shares))

        elif self.mode == "atr_volatility":
            # Position inversely proportional to ATR
            if atr <= 0:
                atr = price * 0.01
            risk_amount = capital * self.risk_pct
            shares = risk_amount / (atr * 1.5)
            pos_capital = shares * price
            if pos_capital > max_capital_allowed:
                shares = max_capital_allowed / price
            return max(0.0, float(shares))

        elif self.mode == "kelly":
            # Conservative Quarter-Kelly sizing
            if win_loss_ratio <= 0:
                return 0.0
            kelly_f = win_rate - ((1.0 - win_rate) / win_loss_ratio)
            fraction = max(0.0, min(kelly_f * 0.25, self.max_pos_pct))
            pos_capital = capital * fraction
            return max(0.0, float(pos_capital / price))

        else: # Default fixed units
            return float(max_capital_allowed / price)
