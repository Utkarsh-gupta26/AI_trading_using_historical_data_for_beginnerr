import os
import json
import datetime
import urllib.request

months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

def format_date_str(dt):
    return f"{dt.day:02d}-{months[dt.month-1]}-{dt.year}"

# 1. Start with existing local CSV datasets
csv_configs = [
    ('NIFTY_50', 'Nifty 50', 'NSE', 'INR', '₹', r'C:\Users\utkar\Downloads\NIFTY 50-15-08-2025-to-12-08-2026.csv'),
    ('NIFTY_200', 'Nifty 200', 'NSE', 'INR', '₹', r'C:\Users\utkar\Downloads\NIFTY 200-15-08-2025-to-12-08-2026.csv'),
    ('NIFTY_FIN_SERVICES', 'Nifty Fin Services', 'NSE', 'INR', '₹', r'C:\Users\utkar\Downloads\NIFTY FINANCIAL SERVICES-15-08-2025-to-12-08-2026.csv'),
    ('NIFTY_CEMENT', 'Nifty Cement', 'NSE', 'INR', '₹', r'C:\Users\utkar\Downloads\NIFTY CEMENT-15-08-2025-to-12-08-2026.csv'),
]

out = ['var MARKET_DATA = typeof globalThis !== "undefined" ? (globalThis.MARKET_DATA = {}) : {};\n']

for key, name, category, currency, curr_sym, path in csv_configs:
    if not os.path.exists(path):
        print(f"Warning: {path} not found!")
        continue
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    
    entries = []
    for line in reversed(lines[1:]):
        parts = [p.strip() for p in line.strip().split(',')]
        if len(parts) < 5 or not parts[4]:
            continue
        d = parts[0]
        o, h, l, c = parts[1], parts[2], parts[3], parts[4]
        v = parts[5] if len(parts) > 5 and parts[5] else '0'
        t = parts[6] if len(parts) > 6 and parts[6] else '0'
        
        if not o or not h or not l:
            entries.append(f'{{d:"{d}",o:{c},h:{c},l:{c},c:{c},v:0,t:0}}')
        else:
            entries.append(f'{{d:"{d}",o:{o},h:{h},l:{l},c:{c},v:{v},t:{t}}}')
            
    out.append(f'MARKET_DATA["{key}"] = {{ name: "{name}", category: "{category}", currency: "{currency}", symbol: "{curr_sym}", data: [\n  ' + ',\n  '.join(entries) + '\n] };\n')
    print(f"Processed {key}: {len(entries)} items")

# 2. Fetch Yahoo Finance symbols: SENSEX (^BSESN), BANK NIFTY (^NSEBANK), GOLD (GC=F)
yahoo_configs = [
    ('SENSEX', 'BSE Sensex', 'BSE', 'INR', '₹', '%5EBSESN'),
    ('BANKNIFTY', 'Bank Nifty', 'NSE', 'INR', '₹', '%5ENSEBANK'),
    ('XAUUSD', 'Gold / USD (XAU)', 'Commodities', 'USD', '$', 'GC=F'),
]

for key, name, category, currency, curr_sym, yahoo_sym in yahoo_configs:
    try:
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?range=1y&interval=1d'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())
            result = data['chart']['result'][0]
            timestamps = result['timestamp']
            q = result['indicators']['quote'][0]
            entries = []
            for i in range(len(timestamps)):
                c = q['close'][i]
                o = q['open'][i]
                h = q['high'][i]
                l = q['low'][i]
                v = q['volume'][i] or 0
                if c is not None and o is not None and h is not None and l is not None:
                    dt = datetime.datetime.fromtimestamp(timestamps[i])
                    d_str = format_date_str(dt)
                    entries.append(f'{{d:"{d_str}",o:{round(o, 2)},h:{round(h, 2)},l:{round(l, 2)},c:{round(c, 2)},v:{int(v)},t:0}}')
            out.append(f'MARKET_DATA["{key}"] = {{ name: "{name}", category: "{category}", currency: "{currency}", symbol: "{curr_sym}", data: [\n  ' + ',\n  '.join(entries) + '\n] };\n')
            print(f"Fetched {key} ({name}): {len(entries)} candles from Yahoo Finance")
    except Exception as e:
        print(f"Error fetching {key}: {e}")

# 3. Fetch Binance crypto: BTCUSDT, ETHUSDT
crypto_configs = [
    ('BTC', 'Bitcoin (BTC/USD)', 'Crypto', 'USD', '$', 'BTCUSDT'),
    ('ETH', 'Ethereum (ETH/USD)', 'Crypto', 'USD', '$', 'ETHUSDT'),
]

for key, name, category, currency, curr_sym, binance_sym in crypto_configs:
    try:
        url = f'https://api.binance.com/api/v3/klines?symbol={binance_sym}&interval=1d&limit=250'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as res:
            klines = json.loads(res.read().decode())
            entries = []
            for k in klines:
                dt = datetime.datetime.fromtimestamp(k[0] / 1000)
                d_str = format_date_str(dt)
                o, h, l, c, v = round(float(k[1]), 2), round(float(k[2]), 2), round(float(k[3]), 2), round(float(k[4]), 2), round(float(k[5]), 2)
                entries.append(f'{{d:"{d_str}",o:{o},h:{h},l:{l},c:{c},v:{v},t:0}}')
            out.append(f'MARKET_DATA["{key}"] = {{ name: "{name}", category: "{category}", currency: "{currency}", symbol: "{curr_sym}", data: [\n  ' + ',\n  '.join(entries) + '\n] };\n')
            print(f"Fetched {key} ({name}): {len(entries)} candles from Binance")
    except Exception as e:
        print(f"Error fetching {key}: {e}")

# Parser function
parser_func = """
function parseMarketData() {
  const m = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  for (const k in MARKET_DATA) {
    if (!MARKET_DATA[k] || !MARKET_DATA[k].data) continue;
    MARKET_DATA[k].data = MARKET_DATA[k].data.map(r => {
      const p = r.d.split('-');
      return {
        date: new Date(parseInt(p[2]), m[p[1]], parseInt(p[0])),
        dateStr: r.d,
        open: parseFloat(r.o),
        high: parseFloat(r.h),
        low: parseFloat(r.l),
        close: parseFloat(r.c),
        volume: parseFloat(r.v) || 0,
        turnover: parseFloat(r.t) || 0
      };
    }).filter(r => !isNaN(r.close));
  }
}
parseMarketData();
if (typeof globalThis !== 'undefined') globalThis.MARKET_DATA = MARKET_DATA;
if (typeof window !== 'undefined') window.MARKET_DATA = MARKET_DATA;
"""
out.append(parser_func)

target = r'c:\Users\utkar\OneDrive\Documents\Desktop\TradingI\data.js'
with open(target, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print("Successfully written data.js with all Indian Indices, Commodities/Gold, and Crypto!")
