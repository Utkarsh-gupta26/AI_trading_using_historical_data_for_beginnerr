"""
AI Quantitative Advisor, Critic, and Indicator Enhancer.
Supports:
  - 100% Free Local Ollama (Qwen 2.5 / 3.8 / DeepSeek / Llama via http://127.0.0.1:11434/api/chat or /v1)
  - Free Cloud APIs (Groq, Cerebras, OpenRouter, Hugging Face)
  - Quantitative Expert Fallback Engine
"""
import os
import json
import logging
import requests
import socket
from urllib.parse import urlparse
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class QwenQuantitativeCritic:
    """
    Connects to local Qwen 2.5/3.8 via Ollama / vLLM / OpenAI-compatible API / Groq / OpenRouter
    or falls back to deep deterministic analytical critique.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        ai_cfg = self.config.get("ai_advisor", {})
        self.endpoint = os.getenv("LOCAL_LLM_URL", ai_cfg.get("endpoint", "http://127.0.0.1:11434"))
        self.model_name = os.getenv("LOCAL_LLM_MODEL", ai_cfg.get("model_name", "qwen2.5:latest"))
        self.timeout = float(os.getenv("LOCAL_LLM_TIMEOUT", ai_cfg.get("timeout_seconds", 1.5)))
        
        # Free Cloud API Keys
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.cerebras_api_key = os.getenv("CEREBRAS_API_KEY", "")

    def _is_local_service_ready(self) -> bool:
        """Fast non-blocking socket check for local LLM availability."""
        try:
            parsed = urlparse(self.endpoint)
            host = parsed.hostname or "127.0.0.1"
            if host in ["localhost", "127.0.0.1", "0.0.0.0"]:
                port = parsed.port or 11434
                with socket.create_connection(("127.0.0.1", port), timeout=0.15):
                    return True
            return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            return False

    def query_llm(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        """
        Attempts to query:
        1. Local Ollama native API (http://127.0.0.1:11434/api/chat)
        2. Local Ollama OpenAI endpoint (http://127.0.0.1:11434/v1/chat/completions)
        3. Groq Free Cloud API (if GROQ_API_KEY provided)
        4. OpenRouter Free API (if OPENROUTER_API_KEY provided)
        """
        connect_timeout = (0.5, 3.0)

        # 1. Try Local Ollama if service port is ready
        if self._is_local_service_ready():
            # A) Ollama Native API (/api/chat)
            try:
                base_url = self.endpoint.rstrip('/')
                if base_url.endswith('/v1'):
                    base_url = base_url[:-3]
                ollama_url = f"{base_url}/api/chat"
                payload = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "stream": False
                }
                resp = requests.post(ollama_url, json=payload, timeout=connect_timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("message", {}).get("content", "")
                    if content:
                        logger.info(f"Successfully received response from Local Ollama ({self.model_name}).")
                        return content
            except Exception as e:
                logger.debug(f"Ollama native API /api/chat query failed: {e}")

            # B) OpenAI-compatible endpoint (/v1/chat/completions)
            try:
                v1_url = f"{self.endpoint.rstrip('/')}/v1/chat/completions" if not self.endpoint.endswith('/v1') else f"{self.endpoint.rstrip('/')}/chat/completions"
                payload = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2
                }
                resp = requests.post(v1_url, json=payload, headers={"Content-Type": "application/json"}, timeout=connect_timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if content:
                        logger.info(f"Successfully received response from OpenAI-compatible LLM ({self.model_name}).")
                        return content
            except Exception as e:
                logger.debug(f"OpenAI compatible endpoint query failed: {e}")

        # 2. Try Groq Free API if key is set
        if self.groq_api_key:
            try:
                groq_url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.groq_api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2
                }
                resp = requests.post(groq_url, json=payload, headers=headers, timeout=self.timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if content:
                        logger.info("Successfully received response from Groq Cloud API.")
                        return content
            except Exception as e:
                logger.debug(f"Groq API query failed: {e}")

        # 3. Try OpenRouter if key is set
        if self.openrouter_api_key:
            try:
                router_url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.openrouter_api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": "qwen/qwen-2.5-72b-instruct:free",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                }
                resp = requests.post(router_url, json=payload, headers=headers, timeout=self.timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    if content:
                        logger.info("Successfully received response from OpenRouter API.")
                        return content
            except Exception as e:
                logger.debug(f"OpenRouter query failed: {e}")

        return None

    def generate_critique(self, audit_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synthesizes backtest, walk-forward, Monte Carlo, and regime results
        into an executive critique with specific indicator improvements.
        """
        system_prompt = (
            "You are a world-class senior quantitative researcher, algorithmic trading engineer, "
            "and statistical modeler. Provide rigorous, objective, unvarnished critiques of trading "
            "indicators based on quantitative validation data."
        )
        summary_prompt = self._build_prompt(audit_data)
        
        ai_response = self.query_llm(system_prompt, summary_prompt)

        if not ai_response:
            logger.info("Local LLM/Cloud LLM not currently active. Generating expert quantitative critique engine output.")
            ai_response = self._generate_analytical_critique(audit_data)
            engine = "Quantitative Expert Critic Engine"
        else:
            engine = f"AI Advisor ({self.model_name})"

        verdict_data = self._derive_verdict_table(audit_data)

        return {
            "ai_critique_text": ai_response,
            "verdict_table": verdict_data,
            "engine_used": engine
        }

    def enhance_indicator_code(self, original_pine_code: str, audit_data: Dict[str, Any]) -> str:
        """
        Uses AI (or analytical heuristic generator) to produce an upgraded, enhanced Pine Script / Python indicator.
        """
        system_prompt = (
            "You are an elite Pine Script v5 and Python algorithmic trading developer. "
            "Your task is to take a custom indicator, diagnose its performance flaws based on "
            "backtest regime failures, and write an improved version with false-breakout filtering, "
            "volume confirmation, and volatility regime adaptivity."
        )
        user_prompt = f"""
Given this quantitative backtest audit:
- Symbol: {audit_data.get('symbol', 'NIFTY')}
- Base Win Rate: {audit_data.get('base_win_rate', 0):.2%}
- ML-Filtered Win Rate: {audit_data.get('ml_win_rate', 0):.2%}
- Base Profit Factor: {audit_data.get('base_pf', 0):.2f}
- Max Drawdown: {audit_data.get('max_drawdown', 0):.2%}

Original Indicator Logic / Code:
{original_pine_code}

Please provide an enhanced, complete Pine Script v5 indicator that:
1. Implements a 20-period volume expansion filter (Volume > 1.25x SMA 20).
2. Implements an ATR Volatility Squeeze gate (suppresses signals in dead chop).
3. Adds higher timeframe trend alignment (e.g. 50 EMA filter).
4. Provides dynamic ATR-based Stop Loss and Take Profit levels.
"""
        response = self.query_llm(system_prompt, user_prompt)
        if response:
            return response
        
        # Fallback high-quality Pine Script enhancement template
        return self._generate_enhanced_pinescript_template()

    def _build_prompt(self, audit_data: Dict[str, Any]) -> str:
        return f"""
Analyze this quantitative indicator validation experiment:
Dataset Symbol: {audit_data.get('symbol', 'N/A')}
Timeframe: {audit_data.get('timeframe', '1d')}

Key Performance Metrics:
- Base Indicator Win Rate: {audit_data.get('base_win_rate', 0):.2%}
- ML-Filtered Win Rate: {audit_data.get('ml_win_rate', 0):.2%}
- ML Win Rate Delta: {audit_data.get('win_rate_delta', 0):+.2%}
- Base Profit Factor: {audit_data.get('base_pf', 0):.2f}
- ML Profit Factor: {audit_data.get('ml_pf', 0):.2f}
- Base Sharpe Ratio: {audit_data.get('base_sharpe', 0):.2f}
- ML Sharpe Ratio: {audit_data.get('ml_sharpe', 0):.2f}
- Max Drawdown: {audit_data.get('max_drawdown', 0):.2%}
- 1000x Monte Carlo Worst-case DD (P95): {audit_data.get('mc_p95_dd', 0):.2f}%
- Risk of Ruin: {audit_data.get('risk_of_ruin', 0):.2f}%
- Statistical P-Value: {audit_data.get('p_value', 1.0):.4f}

Regime Failures:
{json.dumps(audit_data.get('regime_breakdown', {}), indent=2)}

Please provide:
1. Executive Assessment: Does this custom indicator have a genuine edge?
2. Detailed failure diagnosis (identify specific market regimes/conditions where it fails).
3. Specific, concrete improvements to the indicator logic (in Pine Script or Python) to enhance performance.
4. Final Research Verdict.
"""

    def _generate_analytical_critique(self, data: Dict[str, Any]) -> str:
        base_wr = data.get('base_win_rate', 0.5)
        ml_wr = data.get('ml_win_rate', 0.55)
        p_val = data.get('p_value', 0.05)
        pf = data.get('ml_pf', 1.2)
        sharpe = data.get('ml_sharpe', 0.8)
        p95_dd = data.get('mc_p95_dd', 25.0)
        
        has_edge = (base_wr > 0.52 and p_val < 0.05) or (ml_wr > 0.58 and pf > 1.3)

        return f"""### [AI ADVISOR REPORT] QUANTITATIVE RESEARCH CRITIQUE

#### 1. EXECUTIVE ASSESSMENT
The custom indicator demonstrated a **{'GENUINE EDGE' if has_edge else 'MARGINAL / STATISTICALLY WEAK EDGE'}** on out-of-sample data.
- **Unfiltered Indicator Win Rate**: {base_wr:.2%} (Profit Factor: {data.get('base_pf', 0):.2f})
- **ML-Filtered Meta-Classifier Win Rate**: {ml_wr:.2%} (Profit Factor: {pf:.2f})
- **Sharpe Ratio (Annualized)**: {sharpe:.2f} | **Statistical Significance (p-value)**: {p_val:.4f}

#### 2. FAILURE MODE DIAGNOSIS
- **Sideways / Range Compression**: False breakouts occur frequently during low-volatility compression regimes where volume confirmation is absent.
- **Counter-Trend Noise**: Short signals generated above key long-term EMAs (e.g. EMA 200) suffer from low reward/risk ratios and premature stop-outs.
- **Monte Carlo Stress Profile**: In 1,000 randomized resamplings, the 95th percentile worst-case drawdown reached **{p95_dd:.1f}%**.

#### 3. ACTIONABLE ENHANCEMENTS FOR THE INDICATOR
1. **Dynamic Volatility Filter**: Suppress signal generation when ATR percentile is below the 25th percentile (consolidation phase).
2. **Volume Expansion Confirmation**: Require volume to exceed the 20-period moving average by at least 1.25x on signal trigger bars.
3. **Multi-Timeframe Trend Alignment**: Enforce higher-timeframe trend alignment (e.g. only take LONGs when price > Daily EMA 50).
4. **Adaptive ATR Trailing Stops**: Tighten trailing stop distances to 1.2x ATR after 1.5x ATR profit is achieved to protect open gains against sharp reversals.
"""

    def _derive_verdict_table(self, data: Dict[str, Any]) -> Dict[str, str]:
        p_val = data.get('p_value', 0.05)
        ml_wr = data.get('ml_win_rate', 0.5)
        base_wr = data.get('base_win_rate', 0.5)
        pf = data.get('ml_pf', 1.0)
        p95_dd = data.get('mc_p95_dd', 25.0)

        edge = "YES" if (base_wr > 0.52 and p_val < 0.05) else ("UNCERTAIN" if base_wr > 0.50 else "NO")
        ml_imp = "YES" if (ml_wr > base_wr + 0.04 and pf > 1.2) else ("UNCERTAIN" if ml_wr > base_wr else "NO")
        oos_rob = "STRONG" if (pf > 1.4 and p95_dd < 20) else ("MODERATE" if pf > 1.15 else "WEAK")
        overfit = "LOW" if p_val < 0.05 else ("MEDIUM" if p_val < 0.10 else "HIGH")
        status = "PRODUCTION CANDIDATE" if (edge == "YES" and ml_imp == "YES" and oos_rob == "STRONG") else (
            "PROMISING" if (edge in ["YES", "UNCERTAIN"] and ml_imp == "YES") else "NEEDS IMPROVEMENT"
        )

        return {
            "CUSTOM INDICATOR EDGE": edge,
            "ML IMPROVEMENT": ml_imp,
            "OUT-OF-SAMPLE ROBUSTNESS": oos_rob,
            "OVERFITTING RISK": overfit,
            "COST SENSITIVITY": "MODERATE",
            "REGIME DEPENDENCY": "MEDIUM",
            "GENERALIZATION": "GOOD" if pf > 1.2 else "MODERATE",
            "RESEARCH STATUS": status
        }

    def _generate_enhanced_pinescript_template(self) -> str:
        return """//@version=5
indicator("AI-Enhanced Trend Momentum Strategy [Quantitative ML Edition]", overlay=true)

// --- Inputs ---
fastLen = input.int(12, "Fast EMA Length")
slowLen = input.int(26, "Slow EMA Length")
trendLen = input.int(50, "Trend Filter EMA")
volMaLen = input.int(20, "Volume SMA Length")
volMult = input.float(1.20, "Volume Expansion Multiplier")
atrLen = input.int(14, "ATR Length")
atrSqueezePcnt = input.float(25.0, "ATR Min Percentile Gate")

// --- Core Calculations ---
fastEma = ta.ema(close, fastLen)
slowEma = ta.ema(close, slowLen)
trendEma = ta.ema(close, trendLen)
atrVal = ta.atr(atrLen)
volSma = ta.sma(volume, volMaLen)

// --- Filters ---
volumeConfirm = volume > (volSma * volMult)
trendBullish = close > trendEma
trendBearish = close < trendEma
volatilityActive = atrVal > ta.percentile_linear_interpolation(atrVal, 100, atrSqueezePcnt)

// --- Signals ---
rawLong = ta.crossover(fastEma, slowEma) and (close > fastEma)
rawShort = ta.crossunder(fastEma, slowEma) and (close < fastEma)

longSignal = rawLong and trendBullish and volumeConfirm and volatilityActive
shortSignal = rawShort and trendBearish and volumeConfirm and volatilityActive

// --- Plots & Shapes ---
plot(fastEma, color=color.green, title="Fast EMA")
plot(slowEma, color=color.red, title="Slow EMA")
plot(trendEma, color=color.blue, linewidth=2, title="Trend Filter (50 EMA)")

plotshape(longSignal, title="AI Confirmed LONG", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="AI LONG")
plotshape(shortSignal, title="AI Confirmed SHORT", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="AI SHORT")
"""
