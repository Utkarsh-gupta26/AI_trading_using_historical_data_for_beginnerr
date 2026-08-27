"""
FastAPI REST API Service for Quantitative Indicator ML Validator.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os
import yaml
import json

app = FastAPI(
    title="Quantitative Indicator ML Validator API",
    description="REST API for testing, backtesting, walk-forward validation, and AI critique of trading indicators.",
    version="1.0.0"
)

CONFIG_PATH = "configs/default_config.yaml"
REPORT_PATH = "reports/latest_summary.json"

class PredictRequest(BaseModel):
    features: Dict[str, float]
    indicator_signal: int
    signal_strength: float = 1.0

class BacktestRequest(BaseModel):
    symbol: str = "GC=F"
    timeframe: str = "1d"
    ml_threshold: float = 0.60

@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "service": "indicator-ml-validator"}

@app.get("/metrics")
def get_latest_metrics():
    if not os.path.exists(REPORT_PATH):
        raise HTTPException(status_code=404, detail="No run metrics found. Please run the validation pipeline first.")
    with open(REPORT_PATH, 'r') as f:
        return json.load(f)

@app.get("/report")
def get_final_report():
    report_md = "reports/final_report.md"
    if not os.path.exists(report_md):
        raise HTTPException(status_code=404, detail="No report generated yet.")
    with open(report_md, 'r', encoding='utf-8') as f:
        return {"markdown_report": f.read()}

@app.post("/prediction")
def predict_signal_quality(req: PredictRequest):
    # Quick probability heuristic / model inference hook
    prob = 0.50
    if req.indicator_signal == 1:
        prob = 0.72 if req.features.get("feat_trend_regime", 0) > 0 else 0.48
    elif req.indicator_signal == -1:
        prob = 0.68 if req.features.get("feat_trend_regime", 0) < 0 else 0.42
        
    return {
        "signal": req.indicator_signal,
        "probability_of_success": float(prob),
        "recommendation": "TAKE" if prob >= 0.60 else "REJECT"
    }
