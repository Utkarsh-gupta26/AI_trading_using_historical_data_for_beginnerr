"""
AI-Driven Trading Indicator Analysis & Automated Code Enhancer.
Analyzes indicator performance across market regimes and uses AI (Local Ollama / Free Cloud LLMs)
to generate mathematically enhanced Pine Script & Python indicators.
"""
import os
import sys
import argparse
import logging
import json
import pandas as pd

# Ensure Windows stdout handles utf-8 characters smoothly
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add workspace to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.run_full_pipeline import run_pipeline
from ai_advisor.qwen_critic import QwenQuantitativeCritic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def enhance_indicator(
    symbol: str = "NIFTY",
    config_path: str = "configs/default_config.yaml",
    model_name: str = "qwen2.5:latest",
    endpoint: str = "http://localhost:11434"
):
    print("=" * 80)
    print("[*] QUANTITATIVE TRADING INDICATOR AI ANALYZER & ENHANCER")
    print(f"[*] Dataset / Symbol: {symbol}")
    print(f"[*] AI Engine: Ollama / Local LLM ({endpoint}) -> Model: {model_name}")
    print("=" * 80)

    # 1. Run Quantitative Pipeline & Backtest Audit
    audit_summary = run_pipeline(
        config_path=config_path,
        symbol_override=symbol
    )

    # 2. AI Indicator Critique & Enhancement Generation
    critic = QwenQuantitativeCritic()
    critic.endpoint = endpoint
    critic.model_name = model_name

    print("\n" + "=" * 80)
    print("[*] RUNNING AI REGIME DIAGNOSIS & CODE ENHANCEMENT...")
    print("=" * 80)

    original_indicator_sample = """
// Original Custom Trend Momentum Indicator Logic
fastEMA = ta.ema(close, 12)
slowEMA = ta.ema(close, 26)
trendEMA = ta.ema(close, 50)
longSignal = ta.crossover(fastEMA, slowEMA) and close > trendEMA
shortSignal = ta.crossunder(fastEMA, slowEMA) and close < trendEMA
"""

    enhanced_code = critic.enhance_indicator_code(original_indicator_sample, audit_summary)

    # Save enhanced indicator script
    os.makedirs("reports/enhanced_indicators", exist_ok=True)
    out_file = "reports/enhanced_indicators/enhanced_indicator.pine"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(enhanced_code)

    print(f"\n[+] AI-Enhanced Indicator saved to: {out_file}")
    print("\n" + "-" * 80)
    print("[+] AI QUANTITATIVE CRITIQUE & REGIME DIAGNOSIS:")
    print("-" * 80)
    print(audit_summary.get("ai_critique_text", ""))
    print("\n" + "-" * 80)
    print("[+] ENHANCED PINE SCRIPT CODE (READY TO PASTE IN TRADINGVIEW):")
    print("-" * 80)
    print(enhanced_code)
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Indicator Analyzer and Enhancer")
    parser.add_argument("--symbol", default="NIFTY", help="Symbol name (e.g. NIFTY, ^NSEI, GC=F)")
    parser.add_argument("--config", default="configs/default_config.yaml", help="Path to config")
    parser.add_argument("--model", default="qwen2.5:latest", help="Ollama model name (e.g. qwen2.5:latest, deepseek-r1:latest, qwen3)")
    parser.add_argument("--endpoint", default="http://localhost:11434", help="Ollama / Local LLM endpoint URL")
    args = parser.parse_args()

    enhance_indicator(
        symbol=args.symbol,
        config_path=args.config,
        model_name=args.model,
        endpoint=args.endpoint
    )
