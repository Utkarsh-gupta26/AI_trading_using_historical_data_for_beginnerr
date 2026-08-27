"""
Monte Carlo Stress-Testing and Simulation Engine.
Executes 1000+ randomized reshuffles, parameter perturbations,
and generates percentile risk profiles (P5 to P95) and risk of ruin.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

class MonteCarloSimulator:
    """
    Simulates thousands of alternative sequence paths from completed trades
    to estimate real-world risk, worst-case drawdown, and confidence bands.
    """
    def __init__(self, num_simulations: int = 1000, initial_capital: float = 100000.0):
        self.num_simulations = num_simulations
        self.initial_capital = initial_capital

    def run_simulation(
        self,
        trade_log: pd.DataFrame,
        confidence_levels: List[int] = [5, 25, 50, 75, 95]
    ) -> Dict[str, Any]:
        if trade_log.empty or len(trade_log) < 5:
            return {
                "num_simulations": 0,
                "error": "Insufficient trade count for Monte Carlo simulation",
                "simulated_max_dd": {},
                "simulated_final_equity": {},
                "risk_of_ruin_pct": 0.0
            }

        returns = trade_log['return_pct'].values
        n_trades = len(returns)
        
        sim_final_equities = np.zeros(self.num_simulations)
        sim_max_drawdowns = np.zeros(self.num_simulations)
        sim_cagrs = np.zeros(self.num_simulations)
        ruin_count = 0
        ruin_threshold = self.initial_capital * 0.50 # 50% capital drawdown = ruin

        all_equity_paths = np.zeros((self.num_simulations, n_trades + 1))
        all_equity_paths[:, 0] = self.initial_capital

        for s in range(self.num_simulations):
            # Reshuffle trade returns with replacement (Bootstrap)
            sampled_returns = np.random.choice(returns, size=n_trades, replace=True)
            
            # Apply slight execution friction noise (-0.05% to +0.05%)
            friction_noise = np.random.normal(0, 0.0005, size=n_trades)
            effective_returns = sampled_returns + friction_noise
            
            # Reconstruct equity curve
            equity_path = np.zeros(n_trades + 1)
            equity_path[0] = self.initial_capital
            
            for t in range(n_trades):
                equity_path[t + 1] = equity_path[t] * (1.0 + effective_returns[t])
                if equity_path[t + 1] <= ruin_threshold:
                    ruin_count += 1
                    break
            
            all_equity_paths[s, :] = equity_path
            
            # Calculate drawdown for this path
            peak = np.maximum.accumulate(equity_path)
            dd = (equity_path - peak) / peak
            max_dd = abs(dd.min())
            
            sim_final_equities[s] = equity_path[-1]
            sim_max_drawdowns[s] = max_dd
            sim_cagrs[s] = (equity_path[-1] - self.initial_capital) / self.initial_capital

        # Percentile metrics
        dd_percentiles = {f"P{p}": float(np.percentile(sim_max_drawdowns, p) * 100) for p in confidence_levels}
        equity_percentiles = {f"P{p}": float(np.percentile(sim_final_equities, p)) for p in confidence_levels}
        cagr_percentiles = {f"P{p}": float(np.percentile(sim_cagrs, p) * 100) for p in confidence_levels}

        # Probability of loss (final equity < initial capital)
        prob_of_loss = float((sim_final_equities < self.initial_capital).mean() * 100)
        risk_of_ruin = float((ruin_count / self.num_simulations) * 100)

        return {
            "num_simulations": self.num_simulations,
            "total_trades_resampled": n_trades,
            "drawdown_percentiles_pct": dd_percentiles,
            "final_equity_percentiles": equity_percentiles,
            "return_percentiles_pct": cagr_percentiles,
            "probability_of_loss_pct": prob_of_loss,
            "risk_of_ruin_pct": risk_of_ruin,
            "sample_paths": all_equity_paths[:50].tolist() # 50 representative sample curves
        }
