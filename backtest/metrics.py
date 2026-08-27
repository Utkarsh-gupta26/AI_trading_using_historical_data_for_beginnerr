"""
Quantitative Performance and Risk Metrics Calculator.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List

def calculate_performance_metrics(
    equity_curve: pd.Series,
    trade_log: pd.DataFrame,
    initial_capital: float = 100000.0,
    annualization_factor: int = 252
) -> Dict[str, Any]:
    """Computes all key quantitative risk and return metrics."""
    if trade_log.empty or len(trade_log) == 0:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "expectancy": 0.0,
            "net_pnl": 0.0,
            "total_return_pct": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "calmar_ratio": 0.0,
            "max_drawdown_pct": 0.0,
            "recovery_factor": 0.0
        }

    pnls = trade_log['net_pnl'].values
    returns = trade_log['return_pct'].values
    wins = pnls[pnls > 0]
    losses = pnls[pnls <= 0]

    total_trades = len(pnls)
    winning_trades = len(wins)
    losing_trades = len(losses)
    win_rate = float(winning_trades / total_trades) if total_trades > 0 else 0.0

    gross_profit = float(wins.sum()) if len(wins) > 0 else 0.0
    gross_loss = float(abs(losses.sum())) if len(losses) > 0 else 0.0
    profit_factor = float(gross_profit / gross_loss) if gross_loss > 0 else (999.0 if gross_profit > 0 else 0.0)

    avg_win = float(wins.mean()) if len(wins) > 0 else 0.0
    avg_loss = float(abs(losses.mean())) if len(losses) > 0 else 0.0
    reward_risk_ratio = float(avg_win / avg_loss) if avg_loss > 0 else 0.0

    expectancy = float((win_rate * avg_win) - ((1 - win_rate) * avg_loss))
    net_pnl = float(pnls.sum())
    total_return_pct = float(net_pnl / initial_capital)

    # Consecutive wins / losses
    consec_wins = 0
    max_consec_wins = 0
    consec_losses = 0
    max_consec_losses = 0
    for p in pnls:
        if p > 0:
            consec_wins += 1
            consec_losses = 0
            max_consec_wins = max(max_consec_wins, consec_wins)
        else:
            consec_losses += 1
            consec_wins = 0
            max_consec_losses = max(max_consec_losses, consec_losses)

    # Equity curve metrics
    eq = equity_curve.values
    peak = np.maximum.accumulate(eq)
    drawdown = (eq - peak) / peak
    max_dd = float(abs(drawdown.min())) if len(drawdown) > 0 else 0.0
    avg_dd = float(abs(drawdown.mean())) if len(drawdown) > 0 else 0.0
    recovery_factor = float(net_pnl / (max_dd * initial_capital + 1e-8))

    # Periodic returns for Sharpe / Sortino
    eq_returns = equity_curve.pct_change().dropna()
    mean_ret = eq_returns.mean()
    std_ret = eq_returns.std()
    
    ann_factor = np.sqrt(annualization_factor)
    sharpe = float((mean_ret / (std_ret + 1e-8)) * ann_factor) if std_ret > 0 else 0.0

    # Downside std for Sortino
    downside_ret = eq_returns[eq_returns < 0]
    downside_std = downside_ret.std()
    sortino = float((mean_ret / (downside_std + 1e-8)) * ann_factor) if downside_std > 0 else 0.0

    # CAGR & Calmar
    days = max(1, (equity_curve.index[-1] - equity_curve.index[0]).days) if len(equity_curve) > 1 else 1
    years = days / 365.25
    final_val = eq[-1] if len(eq) > 0 else initial_capital
    cagr = float(((final_val / initial_capital) ** (1.0 / max(years, 0.1))) - 1.0) if final_val > 0 else -1.0
    calmar = float(cagr / (max_dd + 1e-8)) if max_dd > 0 else 0.0

    return {
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": win_rate,
        "average_win": avg_win,
        "average_loss": avg_loss,
        "reward_risk_ratio": reward_risk_ratio,
        "expectancy": expectancy,
        "profit_factor": profit_factor,
        "gross_profit": gross_profit,
        "gross_loss": gross_loss,
        "net_pnl": net_pnl,
        "total_return_pct": total_return_pct,
        "cagr": cagr,
        "sharpe_ratio": sharpe,
        "sortino_ratio": sortino,
        "calmar_ratio": calmar,
        "max_drawdown_pct": max_dd,
        "average_drawdown_pct": avg_dd,
        "recovery_factor": recovery_factor,
        "max_consecutive_wins": max_consec_wins,
        "max_consecutive_losses": max_consec_losses,
        "annualized_volatility": float(std_ret * ann_factor) if std_ret > 0 else 0.0
    }
