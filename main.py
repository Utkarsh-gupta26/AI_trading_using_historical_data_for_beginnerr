"""
Master CLI Interface for Quantitative Indicator ML Validator.
"""
import sys
import os
import argparse
import subprocess
import yaml
import json

# Add workspace to python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from scripts.run_full_pipeline import run_pipeline

def main():
    parser = argparse.ArgumentParser(
        description="Quantitative Trading Indicator ML Validator & Stress-Testing Platform"
    )
    parser.add_argument(
        "command",
        choices=[
            "full-run", "ingest", "validate-data", "build-dataset",
            "train", "validate", "backtest", "walk-forward",
            "robustness", "monte-carlo", "ai-critique", "report",
            "dashboard", "api"
        ],
        help="Command to execute"
    )
    parser.add_argument("--config", default="configs/default_config.yaml", help="Path to YAML configuration")
    parser.add_argument("--symbol", default=None, help="Override symbol (e.g. GC=F, ^NSEI, BTC-USD)")
    parser.add_argument("--port", default=8000, type=int, help="Port for API server")
    args = parser.parse_args()

    if args.command in ["full-run", "ingest", "validate-data", "build-dataset", "train", "validate", "backtest", "walk-forward", "robustness", "monte-carlo", "ai-critique", "report"]:
        print(f"[*] Executing pipeline command: '{args.command}'...")
        summary = run_pipeline(config_path=args.config, symbol_override=args.symbol)
        print("\n" + "="*70)
        print("FINAL QUANTITATIVE VERDICT:")
        for k, v in summary.get("verdict_table", {}).items():
            print(f"  {k:30s}: {v}")
        print("="*70)
        print(f"[*] Full report available in: reports/final_report.md")

    elif args.command == "dashboard":
        print("[*] Launching Streamlit Interactive Dashboard...")
        dashboard_path = os.path.join(os.path.dirname(__file__), "app", "dashboard", "app.py")
        subprocess.run(["streamlit", "run", dashboard_path])

    elif args.command == "api":
        print(f"[*] Launching FastAPI REST server on port {args.port}...")
        import uvicorn
        uvicorn.run("app.api.server:app", host="0.0.0.0", port=args.port, reload=True)

if __name__ == "__main__":
    main()
