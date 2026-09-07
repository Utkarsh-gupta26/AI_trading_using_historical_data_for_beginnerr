# Connecting Upstox (real NSE/BSE market data)

This app now sources Indian stock & index data from Upstox instead of the
old TradingView-embed + Yahoo-scrape combination. Upstox is a licensed
broker with legitimate rights to NSE/BSE data, so prices and charts for
Indian instruments will be accurate once connected — until then, the app
automatically falls back to the previous Yahoo-based feed and clearly
labels it as delayed/fallback data instead of pretending it's live.

## 1. Create an Upstox Developer app

1. Go to **https://developer.upstox.com** and log in with your regular
   Upstox trading account (you need an existing, active Upstox account —
   this is not a separate signup).
2. Open **Apps -> New App**.
3. Fill in a name/description (anything you like).
4. Set **Redirect URL** to exactly:
   ```
   http://localhost:3000/api/upstox/callback
   ```
   This must match character-for-character, including `http://` and the
   port, or Upstox will reject the login with `UDAPI100068`.
5. Save. You'll be shown an **API Key** (this is your `client_id`) and an
   **API Secret** (`client_secret`). Keep the secret private — never commit
   it to git.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env`:
```
UPSTOX_CLIENT_ID=your_api_key_here
UPSTOX_CLIENT_SECRET=your_api_secret_here
UPSTOX_REDIRECT_URI=http://localhost:3000/api/upstox/callback
```

## 3. Run the server and connect

```bash
python server.py
```

Open `http://localhost:3000`, go to the chart workspace, and click
**"Connect Upstox for live NSE/BSE data"** in the yellow banner (it only
appears when you're viewing an Indian instrument and Upstox isn't
connected yet). A popup will open Upstox's real login page — log in with
your Upstox credentials (2FA/TOTP as usual), approve access, and the
popup will close itself once the token exchange succeeds.

## Important: tokens expire daily

Upstox access tokens expire every day, around 3:30am IST, regardless of
activity — this is an Upstox platform rule, not a bug in this app. You'll
need to click "Connect Upstox" again each trading day. The app detects an
expired/missing token automatically and falls back to the delayed feed in
the meantime, so nothing breaks — you'll just see the fallback banner
again until you reconnect.

## What changed and why

- **Removed the TradingView embed.** NSE/BSE prohibit third-party
  widget embeds of their real data, so the old code silently substituted
  a *different* instrument (a generic CFD index, or a US ETF/ADR) for
  ~25 Indian stocks and all major Indian indices whenever you selected
  them — meaning the chart on screen frequently did not match the
  instrument you'd actually picked. This is very likely the source of the
  "wrong price" reports.
- **Chart panel now uses the app's own native canvas chart engine**
  (`ChartEngine`), which already existed in the codebase and was already
  wired to real per-symbol data — it was just hidden behind the
  TradingView iframe. It's fed by Upstox for Indian instruments (when
  connected) and by the existing Yahoo/Delta paths otherwise, so the
  chart and the price header always agree.
- **Honest fallback labeling.** When neither Upstox nor Yahoo can be
  reached, the server used to fabricate random-walk candles from a
  hardcoded price and label them as a normal live feed. It now marks
  these clearly as simulated/unavailable so you never mistake a
  placeholder for a real quote.
- **Removed the hardcoded Delta Exchange API key/secret** from source —
  see the security note in `.env.example`.
