"""
Statistical Significance and Hypothesis Testing Engine.
Computes Bootstrap Confidence Intervals, Student-t tests, and Permutation tests
to estimate the probability that observed indicator returns occurred purely by chance.
"""
import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Any, List

class StatisticalSignificanceTester:
    def __init__(self, n_bootstrap: int = 1000, alpha: float = 0.05):
        self.n_bootstrap = n_bootstrap
        self.alpha = alpha

    def test_edge_significance(self, trade_returns: np.ndarray) -> Dict[str, Any]:
        """
        Tests H0: Mean trade return <= 0 (No trading edge).
        """
        returns = np.asarray(trade_returns)
        returns = returns[~np.isnan(returns)]
        n = len(returns)
        
        if n < 5:
            return {
                "sample_size": n,
                "verdict": "INSUFFICIENT_DATA",
                "p_value_t_test": 1.0,
                "bootstrap_ci_lower": 0.0,
                "bootstrap_ci_upper": 0.0
            }

        mean_ret = float(np.mean(returns))
        std_ret = float(np.std(returns, ddof=1))
        
        # 1. One-Sample Student's t-test (one-tailed: mean > 0)
        t_stat, p_val_two_sided = stats.ttest_1samp(returns, 0.0)
        p_val_one_tailed = float(p_val_two_sided / 2.0) if t_stat > 0 else float(1.0 - (p_val_two_sided / 2.0))

        # 2. Non-parametric Bootstrap Confidence Interval for Mean Return
        boot_means = np.zeros(self.n_bootstrap)
        for b in range(self.n_bootstrap):
            resample = np.random.choice(returns, size=n, replace=True)
            boot_means[b] = np.mean(resample)

        ci_lower = float(np.percentile(boot_means, 100 * (self.alpha / 2.0)))
        ci_upper = float(np.percentile(boot_means, 100 * (1.0 - self.alpha / 2.0)))

        # 3. Permutation Test against Random Flip
        perm_means = np.zeros(self.n_bootstrap)
        for b in range(self.n_bootstrap):
            signs = np.random.choice([-1, 1], size=n)
            perm_means[b] = np.mean(returns * signs)
        p_val_perm = float((perm_means >= mean_ret).mean())

        # Determine evidence strength
        if p_val_one_tailed < 0.01 and ci_lower > 0:
            evidence = "STRONG_EVIDENCE_OF_EDGE"
        elif p_val_one_tailed < 0.05:
            evidence = "MODERATE_EVIDENCE_OF_EDGE"
        elif p_val_one_tailed < 0.10:
            evidence = "WEAK_INCONCLUSIVE_EDGE"
        else:
            evidence = "NO_STATISTICAL_EDGE"

        return {
            "sample_size": n,
            "sample_mean_return_pct": mean_ret * 100,
            "sample_std_return_pct": std_ret * 100,
            "t_statistic": float(t_stat),
            "p_value_t_test": p_val_one_tailed,
            "p_value_permutation_test": p_val_perm,
            "bootstrap_ci_95_pct": [ci_lower * 100, ci_upper * 100],
            "zero_included_in_ci": bool(ci_lower <= 0 <= ci_upper),
            "statistical_evidence": evidence
        }
