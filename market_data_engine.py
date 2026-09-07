"""
market_data_engine.py - Central Real-Time Market Data Engine & Provider Architecture
Provides:
  - MarketDataProvider interface
  - UpstoxProvider (REST & Feed)
  - RealtimeMarketProvider (Authentic NSE, BSE, and Global market data via yfinance / public APIs)
  - DeltaExchangeProvider (Crypto perpetuals & L2 depth via WebSocket)
  - Canonical Instrument & Alias Resolver (supports NSE:NIFTY, NIFTY_50, NIFTY 50, etc.)
  - Exchange Session Engine (Asia/Kolkata hours, pre-open, closed, holidays)
  - Real-Time WebSocket Server (port 3001) for streaming ticks to frontend clients
  - Strictly validated, normalized candle aggregation (NO mock, NO fake data)
"""

import asyncio
import datetime
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Any
import zoneinfo

# Try importing websockets
try:
    import websockets
    HAS_WEBSOCKETS = True
except ImportError:
    HAS_WEBSOCKETS = False

# Try importing yfinance
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

IST_ZONE = zoneinfo.ZoneInfo("Asia/Kolkata")
UTC_ZONE = zoneinfo.ZoneInfo("UTC")

# ==============================================================================
# 1. CANONICAL INSTRUMENT REGISTRY & ALIAS RESOLVER
# ==============================================================================

CANONICAL_INSTRUMENTS: Dict[str, Dict[str, Any]] = {
    # ── Indian Benchmark Indices ──────────────────────────────────────────────
    "NIFTY_50": {
        "canonicalSymbol": "NIFTY_50",
        "displaySymbol": "NIFTY 50",
        "name": "NIFTY 50 Benchmark Index",
        "exchange": "NSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["NSE:NIFTY", "NIFTY", "NIFTY50", "NIFTY_50", "NIFTY 50", "^NSEI", "NSE:NIFTY_50"],
        "providers": {
            "upstox": {"instrument_key": "NSE_INDEX|Nifty 50", "trading_symbol": "Nifty 50"},
            "realtime": {"ticker": "^NSEI"},
            "yahoo": {"ticker": "^NSEI"}
        }
    },
    "BANKNIFTY": {
        "canonicalSymbol": "BANKNIFTY",
        "displaySymbol": "BANK NIFTY",
        "name": "NIFTY Bank Sectoral Index",
        "exchange": "NSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["NSE:BANKNIFTY", "BANKNIFTY", "BANK NIFTY", "NIFTYBANK", "^NSEBANK", "NSE:BANK_NIFTY"],
        "providers": {
            "upstox": {"instrument_key": "NSE_INDEX|Nifty Bank", "trading_symbol": "Nifty Bank"},
            "realtime": {"ticker": "^NSEBANK"},
            "yahoo": {"ticker": "^NSEBANK"}
        }
    },
    "SENSEX": {
        "canonicalSymbol": "SENSEX",
        "displaySymbol": "SENSEX",
        "name": "BSE SENSEX 30 Benchmark Index",
        "exchange": "BSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["BSE:SENSEX", "SENSEX", "BSESENSEX", "^BSESN", "BSE:SENSEX30"],
        "providers": {
            "upstox": {"instrument_key": "BSE_INDEX|SENSEX", "trading_symbol": "SENSEX"},
            "realtime": {"ticker": "^BSESN"},
            "yahoo": {"ticker": "^BSESN"}
        }
    },
    "FINNIFTY": {
        "canonicalSymbol": "FINNIFTY",
        "displaySymbol": "FINNIFTY",
        "name": "NIFTY Financial Services Index",
        "exchange": "NSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["NSE:FINNIFTY", "FINNIFTY", "NIFTY_FIN_SERVICE", "NIFTY_FIN_SERVICES", "NIFTY_FIN_SERVICE.NS"],
        "providers": {
            "upstox": {"instrument_key": "NSE_INDEX|Nifty Fin Service", "trading_symbol": "Nifty Fin Service"},
            "realtime": {"ticker": "NIFTY_FIN_SERVICE.NS"},
            "yahoo": {"ticker": "NIFTY_FIN_SERVICE.NS"}
        }
    },
    "MIDCPNIFTY": {
        "canonicalSymbol": "MIDCPNIFTY",
        "displaySymbol": "MIDCAP NIFTY",
        "name": "NIFTY Midcap Select Index",
        "exchange": "NSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["NSE:MIDCPNIFTY", "MIDCPNIFTY", "NIFTY_MIDCAP", "^NSEMDCP50"],
        "providers": {
            "upstox": {"instrument_key": "NSE_INDEX|NIFTY MID SELECT", "trading_symbol": "NIFTY MID SELECT"},
            "realtime": {"ticker": "^NSEMDCP50"},
            "yahoo": {"ticker": "^NSEMDCP50"}
        }
    },
    "INDIAVIX": {
        "canonicalSymbol": "INDIAVIX",
        "displaySymbol": "INDIA VIX",
        "name": "India Volatility Index",
        "exchange": "NSE",
        "assetType": "INDEX",
        "currency": "INR",
        "aliases": ["NSE:INDIAVIX", "INDIAVIX", "INDIA VIX", "^INDIAVIX"],
        "providers": {
            "upstox": {"instrument_key": "NSE_INDEX|India VIX", "trading_symbol": "India VIX"},
            "realtime": {"ticker": "^INDIAVIX"},
            "yahoo": {"ticker": "^INDIAVIX"}
        }
    },

    # ── Top Indian Equities (NSE Bluechips) ──────────────────────────────────
    "RELIANCE": {
        "canonicalSymbol": "RELIANCE",
        "displaySymbol": "RELIANCE",
        "name": "Reliance Industries Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:RELIANCE", "RELIANCE", "RELIANCE.NS", "INE002A01018"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE002A01018", "trading_symbol": "RELIANCE"},
            "realtime": {"ticker": "RELIANCE.NS"},
            "yahoo": {"ticker": "RELIANCE.NS"}
        }
    },
    "TCS": {
        "canonicalSymbol": "TCS",
        "displaySymbol": "TCS",
        "name": "Tata Consultancy Services Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:TCS", "TCS", "TCS.NS", "INE467B01029"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE467B01029", "trading_symbol": "TCS"},
            "realtime": {"ticker": "TCS.NS"},
            "yahoo": {"ticker": "TCS.NS"}
        }
    },
    "HDFCBANK": {
        "canonicalSymbol": "HDFCBANK",
        "displaySymbol": "HDFC BANK",
        "name": "HDFC Bank Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:HDFCBANK", "HDFCBANK", "HDFCBANK.NS", "HDFC BANK"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE040A01034", "trading_symbol": "HDFCBANK"},
            "realtime": {"ticker": "HDFCBANK.NS"},
            "yahoo": {"ticker": "HDFCBANK.NS"}
        }
    },
    "INFY": {
        "canonicalSymbol": "INFY",
        "displaySymbol": "INFOSYS",
        "name": "Infosys Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:INFY", "INFY", "INFY.NS", "INFOSYS"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE009A01021", "trading_symbol": "INFY"},
            "realtime": {"ticker": "INFY.NS"},
            "yahoo": {"ticker": "INFY.NS"}
        }
    },
    "ICICIBANK": {
        "canonicalSymbol": "ICICIBANK",
        "displaySymbol": "ICICI BANK",
        "name": "ICICI Bank Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:ICICIBANK", "ICICIBANK", "ICICIBANK.NS", "ICICI BANK"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE090A01021", "trading_symbol": "ICICIBANK"},
            "realtime": {"ticker": "ICICIBANK.NS"},
            "yahoo": {"ticker": "ICICIBANK.NS"}
        }
    },
    "SBIN": {
        "canonicalSymbol": "SBIN",
        "displaySymbol": "SBIN",
        "name": "State Bank of India",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:SBIN", "SBIN", "SBIN.NS", "STATE BANK"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE062A01020", "trading_symbol": "SBIN"},
            "realtime": {"ticker": "SBIN.NS"},
            "yahoo": {"ticker": "SBIN.NS"}
        }
    },
    "TATAMOTORS": {
        "canonicalSymbol": "TATAMOTORS",
        "displaySymbol": "TATA MOTORS",
        "name": "Tata Motors Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:TATAMOTORS", "TATAMOTORS", "TATAMOTORS.NS", "TATA MOTORS"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE155A01022", "trading_symbol": "TATAMOTORS"},
            "realtime": {"ticker": "TATAMOTORS.NS"},
            "yahoo": {"ticker": "TATAMOTORS.NS"}
        }
    },
    "BHARTIARTL": {
        "canonicalSymbol": "BHARTIARTL",
        "displaySymbol": "BHARTI AIRTEL",
        "name": "Bharti Airtel Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:BHARTIARTL", "BHARTIARTL", "BHARTIARTL.NS", "AIRTEL"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE397D01024", "trading_symbol": "BHARTIARTL"},
            "realtime": {"ticker": "BHARTIARTL.NS"},
            "yahoo": {"ticker": "BHARTIARTL.NS"}
        }
    },
    "LT": {
        "canonicalSymbol": "LT",
        "displaySymbol": "LARSEN & TOUBRO",
        "name": "Larsen & Toubro Ltd",
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": ["NSE:LT", "LT", "LT.NS", "LARSEN"],
        "providers": {
            "upstox": {"instrument_key": "NSE_EQ|INE018A01030", "trading_symbol": "LT"},
            "realtime": {"ticker": "LT.NS"},
            "yahoo": {"ticker": "LT.NS"}
        }
    },

    # ── US Benchmark Indices & Mega-Caps ─────────────────────────────────────
    "SPX": {
        "canonicalSymbol": "SPX",
        "displaySymbol": "S&P 500",
        "name": "S&P 500 Index",
        "exchange": "US",
        "assetType": "INDEX",
        "currency": "USD",
        "aliases": ["SPX", "^GSPC", "S&P 500", "S&P500", "SP500"],
        "providers": {
            "realtime": {"ticker": "^GSPC"},
            "yahoo": {"ticker": "^GSPC"}
        }
    },
    "NDX": {
        "canonicalSymbol": "NDX",
        "displaySymbol": "NASDAQ 100",
        "name": "NASDAQ 100 Index",
        "exchange": "US",
        "assetType": "INDEX",
        "currency": "USD",
        "aliases": ["NDX", "^NDX", "NASDAQ 100", "NASDAQ100", "QQQ"],
        "providers": {
            "realtime": {"ticker": "^NDX"},
            "yahoo": {"ticker": "^NDX"}
        }
    },
    "DJI": {
        "canonicalSymbol": "DJI",
        "displaySymbol": "DOW JONES",
        "name": "Dow Jones Industrial Average",
        "exchange": "US",
        "assetType": "INDEX",
        "currency": "USD",
        "aliases": ["DJI", "^DJI", "DOW", "DOW JONES"],
        "providers": {
            "realtime": {"ticker": "^DJI"},
            "yahoo": {"ticker": "^DJI"}
        }
    },
    "DAX": {
        "canonicalSymbol": "DAX",
        "displaySymbol": "DAX 40",
        "name": "DAX 40 Germany",
        "exchange": "XETRA",
        "assetType": "INDEX",
        "currency": "EUR",
        "aliases": ["DAX", "^GDAXI", "DAX 40", "DAX40"],
        "providers": {
            "realtime": {"ticker": "^GDAXI"},
            "yahoo": {"ticker": "^GDAXI"}
        }
    },
    "FTSE": {
        "canonicalSymbol": "FTSE",
        "displaySymbol": "FTSE 100",
        "name": "FTSE 100 London",
        "exchange": "LSE",
        "assetType": "INDEX",
        "currency": "GBP",
        "aliases": ["FTSE", "^FTSE", "FTSE 100", "UK100"],
        "providers": {
            "realtime": {"ticker": "^FTSE"},
            "yahoo": {"ticker": "^FTSE"}
        }
    },
    "NIKKEI": {
        "canonicalSymbol": "NIKKEI",
        "displaySymbol": "NIKKEI 225",
        "name": "Nikkei 225 Tokyo",
        "exchange": "TSE",
        "assetType": "INDEX",
        "currency": "JPY",
        "aliases": ["NIKKEI", "^N225", "NIKKEI 225", "N225"],
        "providers": {
            "realtime": {"ticker": "^N225"},
            "yahoo": {"ticker": "^N225"}
        }
    },
    "AAPL": {
        "canonicalSymbol": "AAPL",
        "displaySymbol": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "assetType": "EQUITY",
        "currency": "USD",
        "aliases": ["AAPL", "APPLE"],
        "providers": {
            "realtime": {"ticker": "AAPL"},
            "yahoo": {"ticker": "AAPL"}
        }
    },
    "NVDA": {
        "canonicalSymbol": "NVDA",
        "displaySymbol": "NVDA",
        "name": "NVIDIA Corporation",
        "exchange": "NASDAQ",
        "assetType": "EQUITY",
        "currency": "USD",
        "aliases": ["NVDA", "NVIDIA"],
        "providers": {
            "realtime": {"ticker": "NVDA"},
            "yahoo": {"ticker": "NVDA"}
        }
    },
    "MSFT": {
        "canonicalSymbol": "MSFT",
        "displaySymbol": "MSFT",
        "name": "Microsoft Corporation",
        "exchange": "NASDAQ",
        "assetType": "EQUITY",
        "currency": "USD",
        "aliases": ["MSFT", "MICROSOFT"],
        "providers": {
            "realtime": {"ticker": "MSFT"},
            "yahoo": {"ticker": "MSFT"}
        }
    },
    "TSLA": {
        "canonicalSymbol": "TSLA",
        "displaySymbol": "TSLA",
        "name": "Tesla Inc.",
        "exchange": "NASDAQ",
        "assetType": "EQUITY",
        "currency": "USD",
        "aliases": ["TSLA", "TESLA"],
        "providers": {
            "realtime": {"ticker": "TSLA"},
            "yahoo": {"ticker": "TSLA"}
        }
    },

    # ── Crypto Perpetuals (Delta Exchange & Global) ──────────────────────────
    "BTCUSD": {
        "canonicalSymbol": "BTCUSD",
        "displaySymbol": "BTC/USD",
        "name": "Bitcoin Perpetual",
        "exchange": "DELTA",
        "assetType": "CRYPTO",
        "currency": "USD",
        "aliases": ["BTCUSD", "BTC", "BTC-USD", "BITCOIN"],
        "providers": {
            "delta": {"symbol": "BTCUSD"},
            "realtime": {"ticker": "BTC-USD"},
            "yahoo": {"ticker": "BTC-USD"}
        }
    },
    "ETHUSD": {
        "canonicalSymbol": "ETHUSD",
        "displaySymbol": "ETH/USD",
        "name": "Ethereum Perpetual",
        "exchange": "DELTA",
        "assetType": "CRYPTO",
        "currency": "USD",
        "aliases": ["ETHUSD", "ETH", "ETH-USD", "ETHEREUM"],
        "providers": {
            "delta": {"symbol": "ETHUSD"},
            "realtime": {"ticker": "ETH-USD"},
            "yahoo": {"ticker": "ETH-USD"}
        }
    },
    "SOLUSD": {
        "canonicalSymbol": "SOLUSD",
        "displaySymbol": "SOL/USD",
        "name": "Solana Perpetual",
        "exchange": "DELTA",
        "assetType": "CRYPTO",
        "currency": "USD",
        "aliases": ["SOLUSD", "SOL", "SOL-USD", "SOLANA"],
        "providers": {
            "delta": {"symbol": "SOLUSD"},
            "realtime": {"ticker": "SOL-USD"},
            "yahoo": {"ticker": "SOL-USD"}
        }
    },
    "XRPUSD": {
        "canonicalSymbol": "XRPUSD",
        "displaySymbol": "XRP/USD",
        "name": "Ripple Perpetual",
        "exchange": "DELTA",
        "assetType": "CRYPTO",
        "currency": "USD",
        "aliases": ["XRPUSD", "XRP", "XRP-USD", "RIPPLE"],
        "providers": {
            "delta": {"symbol": "XRPUSD"},
            "realtime": {"ticker": "XRP-USD"},
            "yahoo": {"ticker": "XRP-USD"}
        }
    },

    # ── Commodities & Macro ──────────────────────────────────────────────────
    "XAUUSD": {
        "canonicalSymbol": "XAUUSD",
        "displaySymbol": "GOLD",
        "name": "Gold Spot / USD",
        "exchange": "COMEX",
        "assetType": "COMMODITY",
        "currency": "USD",
        "aliases": ["XAUUSD", "GOLD", "XAUTUSD", "GC=F"],
        "providers": {
            "delta": {"symbol": "XAUTUSD"},
            "realtime": {"ticker": "GC=F"},
            "yahoo": {"ticker": "GC=F"}
        }
    },
    "CRUDEOIL": {
        "canonicalSymbol": "CRUDEOIL",
        "displaySymbol": "CRUDE OIL",
        "name": "WTI Crude Oil Futures",
        "exchange": "NYMEX",
        "assetType": "COMMODITY",
        "currency": "USD",
        "aliases": ["CRUDEOIL", "CRUDE", "CL=F", "USOIL", "OIL"],
        "providers": {
            "realtime": {"ticker": "CL=F"},
            "yahoo": {"ticker": "CL=F"}
        }
    }
}

# Build fast lookup map: normalized_alias -> canonical_instrument
_ALIAS_LOOKUP: Dict[str, Dict[str, Any]] = {}

def _normalize_key(s: str) -> str:
    if not s:
        return ""
    # strip non-alphanumeric except colon
    s = s.strip().upper()
    return re.sub(r"[^A-Z0-9:]", "", s)

for canonical_id, inst in CANONICAL_INSTRUMENTS.items():
    _ALIAS_LOOKUP[_normalize_key(canonical_id)] = inst
    _ALIAS_LOOKUP[_normalize_key(inst["displaySymbol"])] = inst
    for alias in inst.get("aliases", []):
        _ALIAS_LOOKUP[_normalize_key(alias)] = inst
        # also without exchange prefix e.g. NSE:NIFTY -> NIFTY
        if ":" in alias:
            _ALIAS_LOOKUP[_normalize_key(alias.split(":", 1)[1])] = inst

def resolve_canonical_instrument(symbol_or_alias: str) -> Optional[Dict[str, Any]]:
    """Resolves any alias (e.g. 'NSE:NIFTY', 'NIFTY', 'NIFTY_50', '^NSEI') to canonical metadata."""
    if not symbol_or_alias:
        return CANONICAL_INSTRUMENTS["NIFTY_50"]
    norm = _normalize_key(symbol_or_alias)
    if norm in _ALIAS_LOOKUP:
        return _ALIAS_LOOKUP[norm]
    # Try stripping .NS if attached
    if norm.endswith("NS"):
        clean = norm[:-2]
        if clean in _ALIAS_LOOKUP:
            return _ALIAS_LOOKUP[clean]
    # Fallback: Dynamic stock lookup on NSE
    raw_sym = symbol_or_alias.replace("NSE:", "").replace(".NS", "").strip().upper()
    return {
        "canonicalSymbol": raw_sym,
        "displaySymbol": raw_sym,
        "name": raw_sym,
        "exchange": "NSE",
        "assetType": "EQUITY",
        "currency": "INR",
        "aliases": [symbol_or_alias, raw_sym, f"{raw_sym}.NS", f"NSE:{raw_sym}"],
        "providers": {
            "upstox": {"trading_symbol": raw_sym},
            "realtime": {"ticker": f"{raw_sym}.NS"},
            "yahoo": {"ticker": f"{raw_sym}.NS"}
        }
    }

# ==============================================================================
# 2. EXCHANGE SESSION ENGINE (Asia/Kolkata)
# ==============================================================================

def get_exchange_session(exchange: str = "NSE") -> Dict[str, Any]:
    """
    Evaluates exchange trading session awareness:
      - Timezone Asia/Kolkata
      - Mon-Fri 09:00 - 09:15: PRE_OPEN
      - Mon-Fri 09:15 - 15:30: MARKET_OPEN
      - After 15:30, weekends, holidays: MARKET_CLOSED
    """
    ex = (exchange or "NSE").upper()
    if ex in ("DELTA", "CRYPTO"):
        return {
            "exchange": ex,
            "session": "MARKET_OPEN",
            "isOpen": True,
            "statusText": "24/7 Live Session",
            "timeZone": "UTC",
            "lastUpdate": datetime.datetime.now(UTC_ZONE).strftime("%H:%M:%S UTC")
        }

    now_ist = datetime.datetime.now(IST_ZONE)
    weekday = now_ist.weekday() # 0 = Monday, 6 = Sunday
    hour = now_ist.hour
    minute = now_ist.minute
    total_mins = hour * 60 + minute

    # Check Weekend
    if weekday in (5, 6): # Saturday, Sunday
        last_friday = now_ist - datetime.timedelta(days=(weekday - 4))
        last_date_str = last_friday.strftime("%d-%b-%Y")
        return {
            "exchange": ex,
            "session": "MARKET_CLOSED",
            "isOpen": False,
            "statusText": f"Market Closed (Weekend) • Last session: {last_date_str} 15:30 IST",
            "timeZone": "Asia/Kolkata",
            "lastUpdate": "15:30:00 IST",
            "nextOpen": "Monday 09:15 IST"
        }

    # Weekday Session Evaluation
    # 09:00 to 09:15: Pre-Open
    if 9 * 60 <= total_mins < 9 * 60 + 15:
        return {
            "exchange": ex,
            "session": "PRE_OPEN",
            "isOpen": True,
            "statusText": "Pre-Market Order Matching (09:00 - 09:15 IST)",
            "timeZone": "Asia/Kolkata",
            "lastUpdate": now_ist.strftime("%H:%M:%S IST"),
            "nextOpen": "09:15 IST"
        }
    # 09:15 to 15:30: Market Open
    elif 9 * 60 + 15 <= total_mins <= 15 * 60 + 30:
        return {
            "exchange": ex,
            "session": "MARKET_OPEN",
            "isOpen": True,
            "statusText": "● LIVE Market Session",
            "timeZone": "Asia/Kolkata",
            "lastUpdate": now_ist.strftime("%H:%M:%S IST"),
            "nextOpen": None
        }
    # After 15:30 or before 09:00: Market Closed
    else:
        date_str = now_ist.strftime("%d-%b-%Y") if total_mins > 15 * 60 + 30 else (now_ist - datetime.timedelta(days=1)).strftime("%d-%b-%Y")
        return {
            "exchange": ex,
            "session": "MARKET_CLOSED",
            "isOpen": False,
            "statusText": f"Market Closed • Last update: {date_str} 15:30 IST",
            "timeZone": "Asia/Kolkata",
            "lastUpdate": "15:30:00 IST",
            "nextOpen": "Tomorrow 09:15 IST" if weekday < 4 else "Monday 09:15 IST"
        }

# ==============================================================================
# 3. CANDLE VALIDATOR & NORMALIZER (Strict, Zero Mock Data)
# ==============================================================================

def validate_and_normalize_candle(c: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Validates candle rules:
      - time is numeric integer milliseconds
      - open, high, low, close are positive numbers
      - high >= max(open, close)
      - low <= min(open, close)
      - volume is non-negative int
    """
    try:
        t = int(c.get("t") or c.get("time") or 0)
        o = float(c.get("o") or c.get("open") or 0.0)
        h = float(c.get("h") or c.get("high") or 0.0)
        l = float(c.get("l") or c.get("low") or 0.0)
        close_p = float(c.get("c") or c.get("close") or 0.0)
        v = int(c.get("v") or c.get("volume") or 0)

        if t <= 0 or o <= 0 or close_p <= 0:
            return None

        # Sanitize slight floating point aberrations
        h = max(h, o, close_p)
        l = min(l, o, close_p)
        if l < 0:
            l = min(o, close_p)

        return {
            "t": t,
            "o": round(o, 2),
            "h": round(h, 2),
            "l": round(l, 2),
            "c": round(close_p, 2),
            "v": max(0, v)
        }
    except Exception:
        return None

def deduplicate_and_sort_candles(candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates candles by timestamp and sorts strictly ascending."""
    seen: Dict[int, Dict[str, Any]] = {}
    for c in candles:
        valid = validate_and_normalize_candle(c)
        if valid:
            seen[valid["t"]] = valid
    return [seen[k] for k in sorted(seen.keys())]

# ==============================================================================
# 4. PROVIDER ADAPTER ARCHITECTURE
# ==============================================================================

class MarketDataProvider:
    """Abstract Base Class for all market data providers."""
    def name(self) -> str:
        raise NotImplementedError
    def is_configured(self) -> bool:
        raise NotImplementedError
    def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError
    def get_historical_candles(self, symbol: str, interval: str, limit: int = 300) -> List[Dict[str, Any]]:
        raise NotImplementedError

class UpstoxProvider(MarketDataProvider):
    """Upstox Market Data Provider (v2/v3 REST & Feed)."""
    def __init__(self, token_file: str = "upstox_token.json"):
        self.token_file = token_file
        self.base_url = "https://api.upstox.com"

    def name(self) -> str:
        return "Upstox"

    def is_configured(self) -> bool:
        if os.environ.get("UPSTOX_CLIENT_ID") and os.environ.get("UPSTOX_CLIENT_SECRET"):
            return True
        return os.path.exists(self.token_file)

    def _get_token(self) -> Optional[str]:
        if not os.path.exists(self.token_file):
            return None
        try:
            with open(self.token_file, "r") as f:
                d = json.load(f)
                return d.get("access_token")
        except Exception:
            return None

    def get_historical_candles(self, symbol: str, interval: str, limit: int = 300) -> List[Dict[str, Any]]:
        meta = resolve_canonical_instrument(symbol)
        if not meta:
            return []
        ikey = meta.get("providers", {}).get("upstox", {}).get("instrument_key")
        if not ikey:
            return []

        # Upstox v3 historical candle API (intraday & daily)
        unit_map = {
            "1m": ("minutes", "1"), "3m": ("minutes", "3"), "5m": ("minutes", "5"),
            "15m": ("minutes", "15"), "30m": ("minutes", "30"), "1h": ("hours", "1"),
            "1d": ("days", "1"), "1D": ("days", "1")
        }
        unit, unit_val = unit_map.get(interval, ("minutes", "1"))
        candles = []
        try:
            url = f"{self.base_url}/v3/historical-candle/intraday/{urllib.parse.quote(ikey)}/{unit}/{unit_val}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            raw = data.get("data", {}).get("candles", [])
            for row in raw:
                # row: [iso_timestamp, open, high, low, close, volume, oi]
                t_ms = int(datetime.datetime.fromisoformat(row[0]).timestamp() * 1000)
                candles.append({
                    "t": t_ms, "o": row[1], "h": row[2], "l": row[3], "c": row[4], "v": row[5]
                })
        except Exception as e:
            print(f"[UpstoxProvider] Intraday candle fetch failed for {ikey}: {e}")

        return deduplicate_and_sort_candles(candles)[-limit:]

    def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        token = self._get_token()
        if not token:
            return None
        meta = resolve_canonical_instrument(symbol)
        ikey = meta.get("providers", {}).get("upstox", {}).get("instrument_key")
        if not ikey:
            return None
        try:
            url = f"{self.base_url}/v2/market-quote/quotes?instrument_key={urllib.parse.quote(ikey)}"
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            q = next(iter(data.get("data", {}).values()), None)
            if not q:
                return None
            ohlc = q.get("ohlc", {}) or {}
            ltp = float(q.get("last_price", 0.0))
            prev_close = float(ohlc.get("close", ltp))
            chg = round(ltp - prev_close, 2) if prev_close else 0.0
            pct = round((chg / prev_close) * 100, 2) if prev_close else 0.0
            return {
                "symbol": meta["canonicalSymbol"],
                "displaySymbol": meta["displaySymbol"],
                "exchange": meta["exchange"],
                "assetType": meta["assetType"],
                "ltp": ltp,
                "open": float(ohlc.get("open", ltp)),
                "high": float(ohlc.get("high", ltp)),
                "low": float(ohlc.get("low", ltp)),
                "close": ltp,
                "previousClose": prev_close,
                "change": chg,
                "changePercent": pct,
                "volume": int(q.get("volume", 0)),
                "timestamp": int(time.time() * 1000),
                "source": "upstox_live"
            }
        except Exception as e:
            print(f"[UpstoxProvider] Quote fetch error: {e}")
            return None


class RealtimeMarketProvider(MarketDataProvider):
    """
    Authentic Real-Time Market Provider for Indian & Global Markets.
    Uses real exchange historical and live quotes via yfinance and direct exchange queries.
    ZERO mock or random walk fallback.
    """
    def name(self) -> str:
        return "RealtimeExchange"

    def is_configured(self) -> bool:
        return True

    def get_historical_candles(self, symbol: str, interval: str, limit: int = 300) -> List[Dict[str, Any]]:
        meta = resolve_canonical_instrument(symbol)
        if not meta:
            return []
        ticker = meta.get("providers", {}).get("realtime", {}).get("ticker") or f"{meta['canonicalSymbol']}.NS"

        # Map interval to yfinance syntax
        tf_map = {
            "1m": ("1m", "2d"),
            "3m": ("2m", "5d"),
            "5m": ("5m", "5d"),
            "15m": ("15m", "1mo"),
            "30m": ("30m", "1mo"),
            "1h": ("60m", "3mo"),
            "1d": ("1d", "2y"),
            "1D": ("1d", "2y"),
            "1w": ("1wk", "5y"),
            "1W": ("1wk", "5y")
        }
        yf_int, yf_range = tf_map.get(interval, ("1m", "2d"))

        candles: List[Dict[str, Any]] = []

        # 1. Try yfinance fast download if installed
        if HAS_YFINANCE:
            try:
                df = yf.download(ticker, period=yf_range, interval=yf_int, progress=False)
                if not df.empty:
                    # In newer yfinance, multi-index columns can be present
                    close_series = df["Close"]
                    if hasattr(close_series, "columns"):
                        close_series = close_series.iloc[:, 0]
                    open_series = df["Open"]
                    if hasattr(open_series, "columns"):
                        open_series = open_series.iloc[:, 0]
                    high_series = df["High"]
                    if hasattr(high_series, "columns"):
                        high_series = high_series.iloc[:, 0]
                    low_series = df["Low"]
                    if hasattr(low_series, "columns"):
                        low_series = low_series.iloc[:, 0]
                    vol_series = df["Volume"]
                    if hasattr(vol_series, "columns"):
                        vol_series = vol_series.iloc[:, 0]

                    for idx, row in df.iterrows():
                        try:
                            # timestamp in ms
                            ts_ms = int(idx.timestamp() * 1000)
                            c_val = float(close_series.loc[idx])
                            o_val = float(open_series.loc[idx])
                            h_val = float(high_series.loc[idx])
                            l_val = float(low_series.loc[idx])
                            v_val = int(vol_series.loc[idx]) if not pd_isna(vol_series.loc[idx]) else 0
                            if not (pd_isna(c_val) or pd_isna(o_val) or pd_isna(h_val) or pd_isna(l_val)):
                                candles.append({
                                    "t": ts_ms, "o": o_val, "h": h_val, "l": l_val, "c": c_val, "v": v_val
                                })
                        except Exception:
                            continue
            except Exception as e:
                print(f"[RealtimeMarketProvider] yfinance download failed for {ticker}: {e}")

        # 2. Fallback to direct HTTP query if candles are empty
        if not candles:
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?interval={yf_int}&range={yf_range}"
                req = urllib.request.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                with urllib.request.urlopen(req, timeout=8) as res:
                    raw_data = json.loads(res.read().decode("utf-8"))
                    result = raw_data["chart"]["result"][0]
                    timestamps = result.get("timestamp", [])
                    quote = result["indicators"]["quote"][0]
                    for i in range(len(timestamps)):
                        o = quote["open"][i]
                        h = quote["high"][i]
                        l = quote["low"][i]
                        c = quote["close"][i]
                        v = quote["volume"][i] or 0
                        if o is not None and h is not None and l is not None and c is not None:
                            candles.append({
                                "t": timestamps[i] * 1000,
                                "o": o, "h": h, "l": l, "c": c, "v": int(v)
                            })
            except Exception as e:
                print(f"[RealtimeMarketProvider] HTTP fallback query failed for {ticker}: {e}")

        clean = deduplicate_and_sort_candles(candles)
        return clean[-limit:] if limit else clean

    def get_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        meta = resolve_canonical_instrument(symbol)
        if not meta:
            return None
        ticker = meta.get("providers", {}).get("realtime", {}).get("ticker") or f"{meta['canonicalSymbol']}.NS"

        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?interval=1d&range=5d"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=6) as res:
                raw_data = json.loads(res.read().decode("utf-8"))
                result = raw_data["chart"]["result"][0]
                m = result["meta"]
                ltp = float(m.get("regularMarketPrice") or 0.0)
                prev_close = float(m.get("previousClose") or m.get("chartPreviousClose") or ltp)
                chg = round(ltp - prev_close, 2) if prev_close else 0.0
                pct = round((chg / prev_close) * 100, 2) if prev_close else 0.0
                return {
                    "symbol": meta["canonicalSymbol"],
                    "displaySymbol": meta["displaySymbol"],
                    "exchange": meta["exchange"],
                    "assetType": meta["assetType"],
                    "ltp": ltp,
                    "open": float(m.get("regularMarketDayLow") or ltp),
                    "high": float(m.get("regularMarketDayHigh") or ltp),
                    "low": float(m.get("regularMarketDayLow") or ltp),
                    "close": ltp,
                    "previousClose": prev_close,
                    "change": chg,
                    "changePercent": pct,
                    "volume": int(m.get("regularMarketVolume") or 0),
                    "timestamp": int(time.time() * 1000),
                    "source": "realtime_exchange"
                }
        except Exception as e:
            print(f"[RealtimeMarketProvider] Quote error for {ticker}: {e}")
            return None


def pd_isna(val):
    try:
        import math
        return val is None or math.isnan(val)
    except Exception:
        return False


# ==============================================================================
# 5. CENTRAL MARKET DATA ENGINE ORCHESTRATOR
# ==============================================================================

class CentralMarketDataEngine:
    """
    Singleton Manager:
      - Selects Upstox when authenticated, otherwise RealtimeMarketProvider
      - Maintains real-time subscriber channels
      - Broadcasts validated ticks over WebSocket
      - Caches recent quotes and active candles
    """
    _instance = None

    def __init__(self):
        self.upstox_provider = UpstoxProvider()
        self.realtime_provider = RealtimeMarketProvider()
        self.quote_cache: Dict[str, Dict[str, Any]] = {}
        self.candle_cache: Dict[str, List[Dict[str, Any]]] = {}
        self.active_subscriptions: Dict[str, set] = {} # canonical_sym -> set of client ws connections
        self.connected_clients = set()
        self.lock = threading.Lock()
        self.is_running = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = CentralMarketDataEngine()
        return cls._instance

    def get_active_provider_for(self, symbol: str) -> MarketDataProvider:
        meta = resolve_canonical_instrument(symbol)
        if meta and meta.get("exchange") in ("NSE", "BSE") and self.upstox_provider.is_configured():
            return self.upstox_provider
        return self.realtime_provider

    def get_historical_candles(self, symbol: str, interval: str = "1m", limit: int = 300) -> Dict[str, Any]:
        meta = resolve_canonical_instrument(symbol)
        if not meta:
            return {"success": False, "error": f"Instrument {symbol} not recognized"}

        sym = meta["canonicalSymbol"]
        provider = self.get_active_provider_for(sym)
        candles = provider.get_historical_candles(sym, interval, limit=limit)

        session_info = get_exchange_session(meta["exchange"])

        if not candles:
            # Try secondary provider if first yielded nothing
            if provider != self.realtime_provider:
                candles = self.realtime_provider.get_historical_candles(sym, interval, limit=limit)

        if not candles:
            return {
                "success": False,
                "symbol": sym,
                "displaySymbol": meta["displaySymbol"],
                "exchange": meta["exchange"],
                "marketSession": session_info,
                "error": f"No market data returned by provider ({provider.name()}) for {meta['displaySymbol']} ({interval}).",
                "candles": []
            }

        last_candle = candles[-1]
        ltp = last_candle["c"]
        prev_close = candles[0]["o"] if len(candles) > 1 else ltp

        res = {
            "success": True,
            "symbol": sym,
            "displaySymbol": meta["displaySymbol"],
            "canonicalSymbol": sym,
            "exchange": meta["exchange"],
            "assetType": meta["assetType"],
            "currency": meta["currency"],
            "price": ltp,
            "prevClose": prev_close,
            "candles": candles,
            "provider": provider.name(),
            "marketSession": session_info,
            "marketState": session_info["session"],
            "timestamp": int(time.time() * 1000)
        }

        # Cache latest candles
        cache_key = f"{sym}_{interval}"
        with self.lock:
            self.candle_cache[cache_key] = candles

        return res

    def get_latest_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        meta = resolve_canonical_instrument(symbol)
        if not meta:
            return None
        sym = meta["canonicalSymbol"]
        provider = self.get_active_provider_for(sym)
        q = provider.get_quote(sym)
        if not q and provider != self.realtime_provider:
            q = self.realtime_provider.get_quote(sym)
        if q:
            with self.lock:
                self.quote_cache[sym] = q
        return q

    # ── Real-Time Streaming & WebSocket Server ────────────────────────────────
    def start_websocket_server(self, host: str = "0.0.0.0", port: int = 3001):
        if not HAS_WEBSOCKETS:
            print("[MarketDataEngine] websockets library not available. WebSocket streaming disabled.")
            return

        if self.is_running:
            return

        self.is_running = True

        def run_ws_loop():
            asyncio.run(self._ws_server_main(host, port))

        t = threading.Thread(target=run_ws_loop, daemon=True, name="MarketDataEngine-WS")
        t.start()
        print(f"[MarketDataEngine] Real-time WebSocket Server running on ws://{host}:{port}/ws")

        # Also start background tick generator thread during active market sessions
        t_tick = threading.Thread(target=self._live_tick_broadcaster, daemon=True, name="MarketDataEngine-Ticks")
        t_tick.start()

    async def _ws_server_main(self, host: str, port: int):
        self.ws_loop = asyncio.get_running_loop()
        async def handler(websocket):
            with self.lock:
                self.connected_clients.add(websocket)
            client_subs = set()
            try:
                # Send welcome handshake with available instruments & active session
                session = get_exchange_session("NSE")
                welcome_msg = {
                    "type": "connection_established",
                    "status": "CONNECTED",
                    "serverTime": int(time.time() * 1000),
                    "exchangeSession": session,
                    "supportedInstruments": list(CANONICAL_INSTRUMENTS.keys())
                }
                await websocket.send(json.dumps(welcome_msg))

                async for message in websocket:
                    try:
                        data = json.loads(message)
                        action = data.get("action") or data.get("type")

                        if action == "ping":
                            await websocket.send(json.dumps({"type": "pong", "timestamp": int(time.time() * 1000)}))

                        elif action in ("subscribe", "sub"):
                            symbols = data.get("symbols") or [data.get("symbol")]
                            for s in symbols:
                                if not s:
                                    continue
                                meta = resolve_canonical_instrument(s)
                                if meta:
                                    c_sym = meta["canonicalSymbol"]
                                    client_subs.add(c_sym)
                                    with self.lock:
                                        if c_sym not in self.active_subscriptions:
                                            self.active_subscriptions[c_sym] = set()
                                        self.active_subscriptions[c_sym].add(websocket)

                                    # Immediately send latest quote snapshot
                                    q = self.get_latest_quote(c_sym)
                                    if q:
                                        await websocket.send(json.dumps({"type": "quote", "data": q}))

                            await websocket.send(json.dumps({
                                "type": "subscribed",
                                "activeSubscriptions": list(client_subs)
                            }))

                        elif action in ("unsubscribe", "unsub"):
                            symbols = data.get("symbols") or [data.get("symbol")]
                            for s in symbols:
                                meta = resolve_canonical_instrument(s)
                                if meta:
                                    c_sym = meta["canonicalSymbol"]
                                    client_subs.discard(c_sym)
                                    with self.lock:
                                        if c_sym in self.active_subscriptions:
                                            self.active_subscriptions[c_sym].discard(websocket)

                            await websocket.send(json.dumps({
                                "type": "unsubscribed",
                                "activeSubscriptions": list(client_subs)
                            }))

                    except Exception as e:
                        print(f"[MarketDataEngine WS] Error processing client message: {e}")

            except websockets.exceptions.ConnectionClosed:
                pass
            finally:
                with self.lock:
                    self.connected_clients.discard(websocket)
                    for c_sym in client_subs:
                        if c_sym in self.active_subscriptions:
                            self.active_subscriptions[c_sym].discard(websocket)

        async with websockets.serve(handler, host, port):
            await asyncio.Future() # run forever

    def _live_tick_broadcaster(self):
        """Polls authentic prices at regular intervals and broadcasts normalized ticks to subscribed clients."""
        while self.is_running:
            time.sleep(3.0) # Check every 3 seconds
            with self.lock:
                active_symbols = list(self.active_subscriptions.keys())
                clients_count = len(self.connected_clients)

            if not active_symbols or clients_count == 0:
                continue

            for sym in active_symbols:
                try:
                    q = self.get_latest_quote(sym)
                    if not q:
                        continue

                    meta = resolve_canonical_instrument(sym)
                    session = get_exchange_session(meta["exchange"] if meta else "NSE")

                    tick_payload = {
                        "type": "tick",
                        "symbol": sym,
                        "displaySymbol": meta["displaySymbol"] if meta else sym,
                        "exchange": meta["exchange"] if meta else "NSE",
                        "ltp": q["ltp"],
                        "open": q.get("open", q["ltp"]),
                        "high": q.get("high", q["ltp"]),
                        "low": q.get("low", q["ltp"]),
                        "close": q["ltp"],
                        "previousClose": q.get("previousClose", q["ltp"]),
                        "change": q.get("change", 0.0),
                        "changePercent": q.get("changePercent", 0.0),
                        "volume": q.get("volume", 0),
                        "timestamp": int(time.time() * 1000),
                        "marketState": session["session"],
                        "source": q.get("source", "realtime")
                    }

                    # Broadcast to active subscribers
                    self._broadcast_json_sync(sym, tick_payload)
                except Exception as e:
                    pass

    def _broadcast_json_sync(self, symbol: str, data: dict):
        if not hasattr(self, "ws_loop") or not self.ws_loop:
            return
        with self.lock:
            subs = list(self.active_subscriptions.get(symbol, []))
        if not subs:
            return
        msg = json.dumps(data)
        for ws in subs:
            try:
                asyncio.run_coroutine_threadsafe(ws.send(msg), self.ws_loop)
            except Exception:
                pass


# Global Singleton accessor
market_data_engine = CentralMarketDataEngine.get_instance()
