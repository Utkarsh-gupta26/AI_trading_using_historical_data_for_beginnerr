import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import time
import unittest
import websockets
import market_data_engine as mde

class TestMarketDataEngine(unittest.TestCase):

    def test_alias_resolution(self):
        aliases = ["NSE:NIFTY", "NIFTY", "NIFTY50", "NIFTY_50", "NIFTY 50", "^NSEI"]
        for a in aliases:
            meta = mde.resolve_canonical_instrument(a)
            self.assertIsNotNone(meta, f"Failed to resolve alias: {a}")
            self.assertEqual(meta["canonicalSymbol"], "NIFTY_50", f"Alias {a} did not resolve to NIFTY_50")
            self.assertEqual(meta["displaySymbol"], "NIFTY 50")
            self.assertEqual(meta["exchange"], "NSE")

        reliance_aliases = ["NSE:RELIANCE", "RELIANCE", "RELIANCE.NS"]
        for a in reliance_aliases:
            meta = mde.resolve_canonical_instrument(a)
            self.assertIsNotNone(meta)
            self.assertEqual(meta["canonicalSymbol"], "RELIANCE")

    def test_exchange_session_awareness(self):
        nse_sess = mde.get_exchange_session("NSE")
        self.assertIn("session", nse_sess)
        self.assertIn(nse_sess["session"], ["MARKET_OPEN", "PRE_OPEN", "MARKET_CLOSED"])
        self.assertIn("timeZone", nse_sess)
        self.assertEqual(nse_sess["timeZone"], "Asia/Kolkata")

        crypto_sess = mde.get_exchange_session("DELTA")
        self.assertEqual(crypto_sess["session"], "MARKET_OPEN")

    def test_candle_validator(self):
        valid = {"t": 1788757260000, "o": 100.5, "h": 105.0, "l": 98.0, "c": 102.0, "v": 1000}
        norm = mde.validate_and_normalize_candle(valid)
        self.assertIsNotNone(norm)
        self.assertEqual(norm["t"], 1788757260000)
        self.assertEqual(norm["h"], 105.0)

        # Inverted high/low
        inverted = {"t": 1788757260000, "o": 100.0, "h": 90.0, "l": 110.0, "c": 95.0, "v": 500}
        norm2 = mde.validate_and_normalize_candle(inverted)
        self.assertIsNotNone(norm2)
        self.assertGreaterEqual(norm2["h"], norm2["o"])
        self.assertLessEqual(norm2["l"], norm2["c"])

        # Invalid timestamp or zero price
        invalid = {"t": 0, "o": 0, "h": 0, "l": 0, "c": 0}
        self.assertIsNone(mde.validate_and_normalize_candle(invalid))

    def test_historical_candles_nifty(self):
        res = mde.market_data_engine.get_historical_candles("NSE:NIFTY", interval="1m", limit=10)
        self.assertTrue(res["success"], f"Failed to get candles: {res.get('error')}")
        self.assertEqual(res["canonicalSymbol"], "NIFTY_50")
        candles = res["candles"]
        self.assertGreater(len(candles), 0, "Candles list is empty")
        # Assert candles are strictly ascending by time
        for i in range(1, len(candles)):
            self.assertGreater(candles[i]["t"], candles[i-1]["t"], "Candles not sorted ascending")
            self.assertGreater(candles[i]["c"], 0, "Close price must be positive")

    def test_websocket_server_handshake(self):
        port = 3009
        mde.market_data_engine.start_websocket_server(port=port)
        time.sleep(0.5)

        async def run_client():
            uri = f"ws://localhost:{port}/ws"
            async with websockets.connect(uri) as ws:
                welcome_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                welcome = eval(welcome_raw) if isinstance(welcome_raw, dict) else json_loads(welcome_raw)
                self.assertEqual(welcome.get("type"), "connection_established")

                # Test Subscribe
                sub_cmd = json_dumps({"action": "subscribe", "symbols": ["NSE:NIFTY"]})
                await ws.send(sub_cmd)
                resp_raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
                resp = json_loads(resp_raw)
                self.assertIn(resp.get("type"), ["subscribed", "quote"])

        def json_dumps(d):
            import json
            return json.dumps(d)

        def json_loads(s):
            import json
            return json.loads(s)

        asyncio.run(run_client())

if __name__ == "__main__":
    unittest.main()
