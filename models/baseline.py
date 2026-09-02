"""
ML Model Architecture and Implementations.
Includes baseline classifiers and tree ensembles with graceful fallbacks.
"""
from abc import ABC, abstractmethod
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    AdaBoostClassifier,
    ExtraTreesClassifier
)
from sklearn.svm import SVC
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import (
    StandardScaler,
    RobustScaler,
    MinMaxScaler,
    PowerTransformer,
    QuantileTransformer,
    MaxAbsScaler
)

def get_scaler(scaler_name: str = "robust"):
    """Instantiates requested scikit-learn feature scaler."""
    name = (scaler_name or "robust").lower().replace(" ", "_").replace("-", "_")
    if "robust" in name:
        return RobustScaler()
    elif "standard" in name:
        return StandardScaler()
    elif "minmax" in name or "min_max" in name:
        return MinMaxScaler(feature_range=(-1, 1))
    elif "quantile" in name:
        return QuantileTransformer(output_distribution="normal", random_state=42)
    elif "power" in name:
        return PowerTransformer()
    elif "maxabs" in name:
        return MaxAbsScaler()
    return RobustScaler()


class BaseModel(ABC):
    """Abstract interface for signal-quality meta-classifiers."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.is_fitted = False
        scaler_choice = self.config.get("scaler", "robust")
        self.scaler = get_scaler(scaler_choice)

    @abstractmethod
    def fit(self, X: pd.DataFrame, y: pd.Series) -> "BaseModel":
        pass

    @abstractmethod
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Returns probability of class 1 (successful trade)."""
        pass

    def predict(self, X: pd.DataFrame, threshold: float = 0.5) -> np.ndarray:
        probas = self.predict_proba(X)
        return (probas >= threshold).astype(int)


class BaselineAlwaysTakeModel(BaseModel):
    """Benchmark: accepts 100% of custom indicator signals with P=1.0."""
    def fit(self, X: pd.DataFrame, y: pd.Series) -> "BaselineAlwaysTakeModel":
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return np.ones(len(X), dtype=float)


class BaselineRandomModel(BaseModel):
    """Benchmark: assigns random probabilities between 0 and 1."""
    def fit(self, X: pd.DataFrame, y: pd.Series) -> "BaselineRandomModel":
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return np.random.uniform(0.0, 1.0, len(X))


class LogisticRegressionModel(BaseModel):
    """Calibrated L2 Regularized Logistic Regression."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = LogisticRegression(C=0.1, max_iter=1000, random_state=42)

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "LogisticRegressionModel":
        X_scaled = self.scaler.fit_transform(X.fillna(0))
        self.clf.fit(X_scaled, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_scaled = self.scaler.transform(X.fillna(0))
        return self.clf.predict_proba(X_scaled)[:, 1]


class RandomForestModel(BaseModel):
    """Random Forest Classifier with controlled max depth to prevent overfitting."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = RandomForestClassifier(
            n_estimators=150,
            max_depth=5,
            min_samples_leaf=10,
            random_state=42,
            n_jobs=-1
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "RandomForestModel":
        self.clf.fit(X.fillna(0), y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict_proba(X.fillna(0))[:, 1]


class GradientBoostingModel(BaseModel):
    """Gradient Boosted Decision Trees."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.03,
            max_depth=3,
            min_samples_leaf=10,
            random_state=42
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "GradientBoostingModel":
        self.clf.fit(X.fillna(0), y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict_proba(X.fillna(0))[:, 1]


class HistGradientBoostingModel(BaseModel):
    """Fast Histogram-based Gradient Boosting (LightGBM equivalent in scikit-learn)."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = HistGradientBoostingClassifier(
            max_iter=100,
            learning_rate=0.03,
            max_depth=4,
            min_samples_leaf=15,
            random_state=42
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "HistGradientBoostingModel":
        self.clf.fit(X.fillna(0), y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict_proba(X.fillna(0))[:, 1]


class SVMModel(BaseModel):
    """Support Vector Machine Classifier (SVC) with RBF kernel and calibrated probabilities."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        kernel = self.config.get("svm_kernel", "rbf")
        c_val = self.config.get("svm_c", 1.0)
        self.clf = SVC(
            C=c_val,
            kernel=kernel,
            probability=True,
            random_state=42
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "SVMModel":
        X_scaled = self.scaler.fit_transform(X.fillna(0))
        self.clf.fit(X_scaled, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_scaled = self.scaler.transform(X.fillna(0))
        return self.clf.predict_proba(X_scaled)[:, 1]


class AdaBoostModel(BaseModel):
    """AdaBoost Classifier with adaptive decision stumps."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = AdaBoostClassifier(
            n_estimators=self.config.get("adaboost_estimators", 80),
            learning_rate=self.config.get("adaboost_lr", 0.05),
            random_state=42
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "AdaBoostModel":
        X_scaled = self.scaler.fit_transform(X.fillna(0))
        self.clf.fit(X_scaled, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_scaled = self.scaler.transform(X.fillna(0))
        return self.clf.predict_proba(X_scaled)[:, 1]


class NaiveBayesModel(BaseModel):
    """Gaussian Naive Bayes Probabilistic Classifier."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = GaussianNB()

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "NaiveBayesModel":
        X_scaled = self.scaler.fit_transform(X.fillna(0))
        self.clf.fit(X_scaled, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_scaled = self.scaler.transform(X.fillna(0))
        return self.clf.predict_proba(X_scaled)[:, 1]


class ExtraTreesModel(BaseModel):
    """Extremely Randomized Trees Classifier."""
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.clf = ExtraTreesClassifier(
            n_estimators=120,
            max_depth=5,
            min_samples_leaf=10,
            random_state=42,
            n_jobs=-1
        )

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "ExtraTreesModel":
        self.clf.fit(X.fillna(0), y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict_proba(X.fillna(0))[:, 1]
