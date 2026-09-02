"""
Multi-Asset Ingestion and Batch AI Validation Suite.
Ingests:
  1. XAUUSD (Gold 1D)
  2. BTC_USD (Bitcoin 1D)
  3. NIFTY_1D (Nifty 50 Index)
  4. NIFTY_BANK (26k Index)
  5. NIFTY_IT (14k Index)
  6. NIFTY_MIDCAP (15k Index)
Runs full purged walk-forward ML tournaments and generates AI indicator evaluations.
"""
import os
import sys
import logging
import requests
import pandas as pd
from typing import Dict, Any

# Configure encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scripts.run_full_pipeline import run_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

def fetch_and_save_remote_datasets():
    os.makedirs("data/raw", exist_ok=True)

    # 1. Fetch XAUUSD Gold Data (from simom1/XAUUSD-history)
    xau_url = "https://raw.githubusercontent.com/simom1/XAUUSD-history/main/Gold-Cash/XAUUSD/XAUUSD_D1.csv"
    try:
        logger.info(f"Downloading XAUUSD Gold D1 data from {xau_url}...")
        resp = requests.get(xau_url, timeout=15)
        if resp.status_code == 200:
            with open("data/raw/XAUUSD_1d.csv", "w", encoding="utf-8") as f:
                f.write(resp.text)
            with open("data/raw/XAUUSD_D1.csv", "w", encoding="utf-8") as f:
                f.write(resp.text)
            logger.info("Saved XAUUSD_1d.csv and XAUUSD_D1.csv successfully.")
    except Exception as e:
        logger.warning(f"Failed to fetch remote XAUUSD: {e}")


    # 2. Fetch BTC-USD Bitcoin Data
    btc_url = "https://raw.githubusercontent.com/jptrustlearning/btc/main/btc_prices.csv"
    try:
        logger.info(f"Downloading BTC-USD data from {btc_url}...")
        resp = requests.get(btc_url, timeout=10)
        if resp.status_code == 200:
            with open("data/raw/BTC_USD_1d.csv", "w", encoding="utf-8") as f:
                f.write(resp.text)
            logger.info("Saved BTC_USD_1d.csv successfully.")
    except Exception as e:
        logger.warning(f"Failed to fetch remote BTC: {e}")

def run_multi_asset_validation():
    fetch_and_save_remote_datasets()

    symbols = ["XAUUSD", "BTC_USD", "NIFTY"]
    results = {}

    print("=" * 80)
    print("[*] STARTING MULTI-ASSET QUANTITATIVE ML INDICATOR AUDIT")
    print("=" * 80)

    for sym in symbols:
        print(f"\n>>> Validating Indicator on Asset: {sym} <<<")
        try:
            summary = run_pipeline(symbol_override=sym)
            results[sym] = summary
            print(f"[+] {sym} Audit Verdict: {summary.get('verdict_table', {}).get('RESEARCH STATUS', 'DONE')}")
        except Exception as e:
            logger.error(f"Error validating {sym}: {e}", exc_info=True)

    print("\n" + "=" * 80)
    print("MULTI-ASSET PERFORMANCE SUMMARY MATRIX:")
    print("=" * 80)
    print(f"{'Asset Symbol':<15} | {'Base Win Rate':<15} | {'ML Win Rate':<15} | {'Base PF':<10} | {'ML PF':<10} | {'Status':<15}")
    print("-" * 80)
    for sym, res in results.items():
        base_wr = f"{res.get('base_win_rate', 0):.2%}"
        ml_wr = f"{res.get('ml_win_rate', 0):.2%}"
        base_pf = f"{res.get('base_pf', 0):.2f}"
        ml_pf = f"{res.get('ml_pf', 0):.2f}"
        status = res.get('verdict_table', {}).get('RESEARCH STATUS', 'N/A')
        print(f"{sym:<15} | {base_wr:<15} | {ml_wr:<15} | {base_pf:<10} | {ml_pf:<10} | {status:<15}")
    print("=" * 80)

if __name__ == "__main__":
    run_multi_asset_validation()
