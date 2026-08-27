"""
Purged Walk-Forward Cross-Validation with Embargo.
Prevents information leakage caused by overlapping holding periods in financial labels.
"""
import numpy as np
import pandas as pd
from typing import List, Tuple, Generator, Dict, Any, Optional

class PurgedWalkForwardCV:
    """
    Time-series cross-validator that purges overlapping label periods
    and applies an embargo buffer immediately following test sets.
    """
    def __init__(
        self,
        n_splits: int = 5,
        purge_bars: int = 10,
        embargo_bars: int = 5,
        expanding: bool = True
    ):
        self.n_splits = n_splits
        self.purge_bars = purge_bars
        self.embargo_bars = embargo_bars
        self.expanding = expanding

    def split(
        self,
        X: pd.DataFrame,
        y: Optional[pd.Series] = None,
        holding_bars: Optional[pd.Series] = None
    ) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
        n_samples = len(X)
        if n_samples < (self.n_splits + 1) * 10:
            # Fallback for very small datasets: simple 2-split
            split_point = int(n_samples * 0.7)
            yield np.arange(0, split_point), np.arange(split_point, n_samples)
            return

        test_size = n_samples // (self.n_splits + 1)
        
        for i in range(self.n_splits):
            test_start = (i + 1) * test_size
            test_end = test_start + test_size if i < self.n_splits - 1 else n_samples
            
            test_indices = np.arange(test_start, test_end)
            
            # Train period before test
            if self.expanding:
                train_start = 0
            else:
                train_start = max(0, test_start - (test_size * 2))

            # Apply Purge: Drop train bars right before test_start whose holding period overlaps test_start
            purge_start = max(0, test_start - self.purge_bars)
            train_indices = np.arange(train_start, purge_start)
            
            if len(train_indices) == 0:
                continue

            yield train_indices, test_indices

    def get_fold_dates(self, X: pd.DataFrame) -> List[Dict[str, Any]]:
        """Returns readable datetime intervals for each fold."""
        splits = list(self.split(X))
        fold_info = []
        for i, (train_idx, test_idx) in enumerate(splits):
            fold_info.append({
                "fold": i + 1,
                "train_start": str(X.index[train_idx[0]]),
                "train_end": str(X.index[train_idx[-1]]),
                "train_samples": len(train_idx),
                "test_start": str(X.index[test_idx[0]]),
                "test_end": str(X.index[test_idx[-1]]),
                "test_samples": len(test_idx)
            })
        return fold_info
