"""
Feature Importance and Explanatory Power Analyzer.
Computes Tree Gini Importance, Permutation Importance, and Mutual Information.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from sklearn.inspection import permutation_importance
from sklearn.feature_selection import mutual_info_classif

class FeatureImportanceAnalyzer:
    def __init__(self):
        pass

    def compute_importance(
        self,
        model: Any,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series
    ) -> Dict[str, Any]:
        features = list(X_train.columns)
        tree_imp_dict = {}
        
        # 1. Native Model Feature Importance
        clf = getattr(model, 'clf', None)
        if clf and hasattr(clf, 'feature_importances_'):
            importances = clf.feature_importances_
            for feat, imp in zip(features, importances):
                tree_imp_dict[feat] = float(imp)

        # 2. Permutation Importance on Out-Of-Sample Test
        perm_dict = {}
        try:
            r = permutation_importance(clf if clf else model, X_test.fillna(0), y_test, n_repeats=5, random_state=42)
            for feat, mean_imp in zip(features, r.importances_mean):
                perm_dict[feat] = float(mean_imp)
        except Exception:
            perm_dict = tree_imp_dict

        # 3. Mutual Information
        mi_dict = {}
        try:
            mi_scores = mutual_info_classif(X_train.fillna(0), y_train, random_state=42)
            for feat, score in zip(features, mi_scores):
                mi_dict[feat] = float(score)
        except Exception:
            pass

        # Sort and rank
        sorted_tree = sorted(tree_imp_dict.items(), key=lambda x: x[1], reverse=True)
        sorted_perm = sorted(perm_dict.items(), key=lambda x: x[1], reverse=True)
        
        # Indicator feature contribution share
        ind_features = [f for f in features if 'ind_' in f or 'signal' in f]
        ind_share = sum([tree_imp_dict.get(f, 0.0) for f in ind_features])

        return {
            "tree_importance_ranking": sorted_tree[:15],
            "permutation_importance_ranking": sorted_perm[:15],
            "mutual_info_ranking": sorted(mi_dict.items(), key=lambda x: x[1], reverse=True)[:15],
            "indicator_features_share_pct": float(ind_share * 100),
            "top_predictor": sorted_tree[0][0] if sorted_tree else "N/A"
        }
