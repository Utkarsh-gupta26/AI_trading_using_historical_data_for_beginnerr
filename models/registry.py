"""
Model Factory and Registry.
"""
import os
import joblib
from typing import Dict, Any, Type
from .baseline import (
    BaseModel,
    BaselineAlwaysTakeModel,
    BaselineRandomModel,
    LogisticRegressionModel,
    RandomForestModel,
    GradientBoostingModel,
    HistGradientBoostingModel,
    SVMModel,
    AdaBoostModel,
    NaiveBayesModel,
    ExtraTreesModel
)

MODEL_REGISTRY: Dict[str, Type[BaseModel]] = {
    "always_take": BaselineAlwaysTakeModel,
    "random": BaselineRandomModel,
    "logistic_regression": LogisticRegressionModel,
    "logisticregression": LogisticRegressionModel,
    "random_forest": RandomForestModel,
    "randomforest": RandomForestModel,
    "gradient_boosting": GradientBoostingModel,
    "gradientboosting": GradientBoostingModel,
    "hist_gradient_boosting": HistGradientBoostingModel,
    "histgradientboosting": HistGradientBoostingModel,
    "svm": SVMModel,
    "svc": SVMModel,
    "support_vector_machine": SVMModel,
    "adaboost": AdaBoostModel,
    "ada_boost": AdaBoostModel,
    "naive_bayes": NaiveBayesModel,
    "naivebayes": NaiveBayesModel,
    "gaussian_nb": NaiveBayesModel,
    "extra_trees": ExtraTreesModel,
    "extratrees": ExtraTreesModel,
}

def get_model(name: str, config: Dict[str, Any] = None) -> BaseModel:
    """Instantiates a model by its registry name."""
    clean_name = name.lower().replace(" ", "_").replace("-", "_")
    if clean_name not in MODEL_REGISTRY:
        raise ValueError(f"Model '{name}' not found in registry. Available: {list(MODEL_REGISTRY.keys())}")
    return MODEL_REGISTRY[clean_name](config)

def save_model(model: BaseModel, path: str):
    """Serializes model to disk."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(model, path)

def load_model(path: str) -> BaseModel:
    """Loads serialized model from disk."""
    return joblib.load(path)
