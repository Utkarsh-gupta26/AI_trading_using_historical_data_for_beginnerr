"""
Probability Calibration Engine.
Transforms uncalibrated classifier outputs into empirical trading probabilities.
Supports Platt Scaling (Sigmoid), Isotonic Regression, Brier score, and ECE.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional
from sklearn.calibration import CalibratedClassifierCV
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss

class ProbabilityCalibrator:
    """
    Calibrates raw model decision probabilities so that P(win) = 0.80
    empirically corresponds to ~80% winning trades.
    """
    def __init__(self, method: str = "isotonic"):
        self.method = method.lower()
        self.calibrator = None
        self.is_fitted = False

    def fit(self, raw_probas: np.ndarray, y_true: np.ndarray) -> "ProbabilityCalibrator":
        raw_probas = np.clip(raw_probas, 1e-6, 1 - 1e-6)
        if self.method == "isotonic":
            self.calibrator = IsotonicRegression(out_of_bounds="clip")
            self.calibrator.fit(raw_probas, y_true)
        elif self.method in ["sigmoid", "platt"]:
            self.calibrator = LogisticRegression(C=1.0)
            self.calibrator.fit(raw_probas.reshape(-1, 1), y_true)
        self.is_fitted = True
        return self

    def predict_proba(self, raw_probas: np.ndarray) -> np.ndarray:
        if not self.is_fitted or self.calibrator is None:
            return np.clip(raw_probas, 0.0, 1.0)
        
        raw_probas = np.clip(raw_probas, 1e-6, 1 - 1e-6)
        if self.method == "isotonic":
            calibrated = self.calibrator.predict(raw_probas)
        elif self.method in ["sigmoid", "platt"]:
            calibrated = self.calibrator.predict_proba(raw_probas.reshape(-1, 1))[:, 1]
        else:
            calibrated = raw_probas
            
        return np.clip(calibrated, 0.0, 1.0)

    @staticmethod
    def evaluate_calibration(y_true: np.ndarray, probas: np.ndarray, n_bins: int = 10) -> Dict[str, Any]:
        """
        Calculates Brier Score, Expected Calibration Error (ECE),
        and reliability diagram bucket points.
        """
        y_true = np.asarray(y_true)
        probas = np.clip(np.asarray(probas), 0.0, 1.0)
        
        brier = float(brier_score_loss(y_true, probas))
        
        bins = np.linspace(0.0, 1.0, n_bins + 1)
        bin_indices = np.digitize(probas, bins) - 1
        bin_indices = np.clip(bin_indices, 0, n_bins - 1)
        
        bin_centers = []
        true_proportions = []
        pred_proportions = []
        bin_counts = []
        ece = 0.0
        n_total = len(y_true)
        
        for i in range(n_bins):
            mask = bin_indices == i
            count = int(mask.sum())
            if count > 0:
                p_mean = float(probas[mask].mean())
                t_mean = float(y_true[mask].mean())
                bin_centers.append(float((bins[i] + bins[i+1]) / 2.0))
                true_proportions.append(t_mean)
                pred_proportions.append(p_mean)
                bin_counts.append(count)
                ece += (count / n_total) * abs(t_mean - p_mean)

        return {
            "brier_score": brier,
            "expected_calibration_error": float(ece),
            "bin_centers": bin_centers,
            "true_proportions": true_proportions,
            "pred_proportions": pred_proportions,
            "bin_counts": bin_counts
        }
