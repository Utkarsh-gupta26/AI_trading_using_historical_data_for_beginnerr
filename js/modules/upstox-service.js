/**
 * AIOT Workstation — Upstox Full Market Quotes V3 & Closing Auction Session (CAS) Service
 * Implements Upstox V3 Market Quote specifications:
 * - Live Closing Auction Session (CAS) with IEP, IEQ, and Imbalance Metrics
 * - Level 2 5-Level Market Depth (Bids & Asks with Quantity, Price, Orders)
 * - Circuit Breakers (Lower & Upper Limits)
 * - 52-Week High/Low Range, Previous Close & VWAP
 */

class UpstoxV3Service {
  constructor() {
    this.currentQuote = null;
    this.currentSymbol = 'NIFTY_50';
    this.pollInterval = null;
    this.hasToken = false;
    this.tokenPreview = '';
    
    this.init();
  }

  async init() {
    await this.checkConfig();
    this.bindEvents();
  }

  async checkConfig() {
    try {
      const resp = await fetch('/api/upstox/config');
      if (resp.ok) {
        const data = await resp.json();
        this.hasToken = !!data.hasToken;
        this.tokenPreview = data.tokenPreview || '';
      }
    } catch (e) {
      console.warn('[Upstox V3] Config check notice:', e);
    }
  }

  async saveToken(token) {
    try {
      const resp = await fetch('/api/upstox/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.trim() })
      });
      const data = await resp.json();
      if (data.success) {
        this.hasToken = !!token.trim();
        this.showToast(this.hasToken ? 'Upstox V3 Access Token saved!' : 'Upstox Access Token cleared.', 'success');
        this.refreshActiveQuote();
      }
    } catch (e) {
      this.showToast('Error saving Upstox token: ' + e.message, 'error');
    }
  }

  async loadQuote(symbol) {
    if (!symbol) return null;
    this.currentSymbol = symbol;

    try {
      const resp = await fetch(`/api/upstox/v3/quotes?symbol=${encodeURIComponent(symbol)}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success' && json.data) {
          const keys = Object.keys(json.data);
          if (keys.length > 0) {
            this.currentQuote = json.data[keys[0]];
            this.renderQuoteUI(this.currentQuote);
            return this.currentQuote;
          }
        }
      }
    } catch (e) {
      console.warn('[Upstox V3] Quote fetch notice:', e);
    }
    return null;
  }

  startPolling(symbol) {
    this.stopPolling();
    this.currentSymbol = symbol || this.currentSymbol;
    this.loadQuote(this.currentSymbol);
    this.pollInterval = setInterval(() => {
      this.loadQuote(this.currentSymbol);
    }, 4000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  refreshActiveQuote() {
    if (this.currentSymbol) {
      this.loadQuote(this.currentSymbol);
    }
  }

  renderQuoteUI(quote) {
    if (!quote) return;

    // 1. Render Closing Auction Session (CAS) Component
    const casCard = document.getElementById('upstoxCasContainer');
    if (casCard) {
      const isEligible = quote.cas_eligible;
      const iep = quote.indicative_equilibrium_price || quote.last_price;
      const refP = quote.reference_price || quote.prev_close_price || quote.last_price;
      const ieq = quote.indicative_equilibrium_quantity || 0;
      const imbTot = quote.indicative_imbalance_quantity_total || 0;
      const imbMkt = quote.indicative_imbalance_quantity_market || 0;
      
      const iepDiff = iep - refP;
      const iepDiffPct = refP > 0 ? ((iepDiff / refP) * 100) : 0;
      const isDiffBull = iepDiff >= 0;
      const isExcessBuy = (quote.total_buy_quantity || 0) >= (quote.total_sell_quantity || 0);

      casCard.innerHTML = `
        <div style="background:#FFFFFF; border:1px solid rgba(216,210,207,0.85); border-radius:12px; padding:14px; box-shadow:0 1px 4px rgba(43,35,34,0.04); margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--aiot-200); padding-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:12px; font-weight:800; color:var(--aiot-950); letter-spacing:0.02em;">CLOSING AUCTION (CAS)</span>
              <span class="status-pill ${isEligible ? 'status-live' : 'risk-neutral'}" style="font-size:9.5px; padding:2px 6px;">
                ${isEligible ? 'CAS ELIGIBLE' : 'CAS EXEMPT'}
              </span>
            </div>
            <span style="font-size:10px; font-weight:700; color:var(--aiot-500); background:var(--aiot-100); padding:2px 6px; border-radius:4px;">
              UPSTOX V3
            </span>
          </div>

          <!-- IEP & IEQ Row -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div style="background:var(--aiot-50); border:1px solid var(--aiot-200); border-radius:8px; padding:8px 10px;">
              <div style="font-size:10px; font-weight:700; color:var(--aiot-600); text-transform:uppercase;">Indicative Eq. Price (IEP)</div>
              <div class="mono" style="font-size:16px; font-weight:800; color:var(--aiot-950); margin-top:2px;">
                ₹${Number(iep).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div class="mono" style="font-size:10.5px; font-weight:700; color:${isDiffBull ? '#059669' : '#DC2626'}; margin-top:1px;">
                ${isDiffBull ? '+' : ''}${iepDiff.toFixed(2)} (${isDiffBull ? '+' : ''}${iepDiffPct.toFixed(2)}%)
              </div>
            </div>

            <div style="background:var(--aiot-50); border:1px solid var(--aiot-200); border-radius:8px; padding:8px 10px;">
              <div style="font-size:10px; font-weight:700; color:var(--aiot-600); text-transform:uppercase;">Matched Qty (IEQ)</div>
              <div class="mono" style="font-size:16px; font-weight:800; color:var(--aiot-950); margin-top:2px;">
                ${Number(ieq).toLocaleString('en-IN')}
              </div>
              <div style="font-size:10px; color:var(--aiot-500); margin-top:1px;">
                Ref Price: ₹${Number(refP).toFixed(2)}
              </div>
            </div>
          </div>

          <!-- Imbalance Breakdown -->
          <div style="background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.25); border-radius:8px; padding:8px 10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#b45309; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                <span>Total Imbalance:</span>
                <strong class="mono" style="font-size:11.5px; color:#b45309;">${Number(imbTot).toLocaleString('en-IN')} shares</strong>
              </div>
              <div style="font-size:10px; color:var(--aiot-600); margin-top:2px;">
                Market Order Portion: <span class="mono font-bold">${Number(imbMkt).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <span style="font-size:10px; font-weight:700; background:#FFF; border:1px solid rgba(217,119,6,0.3); color:${isExcessBuy ? '#059669' : '#DC2626'}; border-radius:6px; padding:3px 8px;">
              ${isExcessBuy ? '▲ Excess Buy' : '▼ Excess Sell'}
            </span>
          </div>
        </div>
      `;
    }

    // 2. Render Level 2 Market Depth (Top 5 Bids vs Asks)
    const depthCard = document.getElementById('upstoxDepthContainer');
    if (depthCard && quote.depth) {
      const bids = quote.depth.buy || [];
      const asks = quote.depth.sell || [];
      const totBids = quote.total_buy_quantity || 1;
      const totAsks = quote.total_sell_quantity || 1;
      const totalDepth = totBids + totAsks;
      const bidPct = Math.min(100, Math.max(0, Math.round((totBids / totalDepth) * 100)));
      const askPct = 100 - bidPct;

      let depthRowsHtml = '';
      for (let i = 0; i < 5; i++) {
        const b = bids[i] || { orders: 0, quantity: 0, price: 0 };
        const s = asks[i] || { orders: 0, quantity: 0, price: 0 };
        depthRowsHtml += `
          <tr style="border-bottom:1px solid rgba(216,210,207,0.4); font-size:11px;">
            <td style="color:var(--aiot-500); text-align:left; padding:3px 6px;">${b.orders || '--'}</td>
            <td class="mono font-bold" style="text-align:right; padding:3px 6px; color:var(--aiot-900);">${b.quantity ? Number(b.quantity).toLocaleString() : '--'}</td>
            <td class="mono font-bold" style="text-align:right; padding:3px 6px; color:#059669;">${b.price ? b.price.toFixed(2) : '--'}</td>
            <td class="mono font-bold" style="text-align:right; padding:3px 6px; color:#DC2626; border-left:1px dashed var(--aiot-200);">${s.price ? s.price.toFixed(2) : '--'}</td>
            <td class="mono font-bold" style="text-align:right; padding:3px 6px; color:var(--aiot-900);">${s.quantity ? Number(s.quantity).toLocaleString() : '--'}</td>
            <td style="color:var(--aiot-500); text-align:right; padding:3px 6px;">${s.orders || '--'}</td>
          </tr>
        `;
      }

      depthCard.innerHTML = `
        <div style="background:#FFFFFF; border:1px solid rgba(216,210,207,0.85); border-radius:12px; padding:14px; box-shadow:0 1px 4px rgba(43,35,34,0.04); margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12px; font-weight:800; color:var(--aiot-950); letter-spacing:0.02em;">LEVEL 2 MARKET DEPTH (5-DEPTH)</div>
            <span style="font-size:10px; font-weight:700; color:var(--aiot-600);">Real-Time Bids vs Asks</span>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
            <thead>
              <tr style="border-bottom:1px solid var(--aiot-200); font-size:9.5px; color:var(--aiot-500); text-transform:uppercase;">
                <th style="text-align:left; padding:2px 6px;">Ord</th>
                <th style="text-align:right; padding:2px 6px;">Bid Qty</th>
                <th style="text-align:right; padding:2px 6px; color:#059669;">Bid Price</th>
                <th style="text-align:right; padding:2px 6px; color:#DC2626; border-left:1px dashed var(--aiot-200);">Ask Price</th>
                <th style="text-align:right; padding:2px 6px;">Ask Qty</th>
                <th style="text-align:right; padding:2px 6px;">Ord</th>
              </tr>
            </thead>
            <tbody>
              ${depthRowsHtml}
            </tbody>
          </table>

          <!-- Total Depth Balance Bar -->
          <div style="margin-top:6px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:4px;">
              <span style="color:#059669; font-weight:700;">Total Buy: ${Number(totBids).toLocaleString()} (${bidPct}%)</span>
              <span style="color:#DC2626; font-weight:700;">Total Sell: ${Number(totAsks).toLocaleString()} (${askPct}%)</span>
            </div>
            <div style="height:6px; background:#DC2626; border-radius:3px; overflow:hidden; display:flex;">
              <div style="width:${bidPct}%; height:100%; background:#059669; transition:width 0.3s ease;"></div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Render Circuit Limits & 52-Week Range
    const circuitsCard = document.getElementById('upstoxCircuitsContainer');
    if (circuitsCard) {
      const curP = quote.last_price || 0;
      const lower = quote.lower_circuit_limit || (curP * 0.9);
      const upper = quote.upper_circuit_limit || (curP * 1.1);
      const yHigh = quote.year_high || (curP * 1.25);
      const yLow = quote.year_low || (curP * 0.75);
      const avgP = quote.average_price || curP;
      const vol = quote.volume || 0;
      const prevClose = quote.prev_close_price || curP;

      // Calculate position in 52W range
      const yRange = yHigh - yLow;
      const curYPos = yRange > 0 ? Math.min(100, Math.max(0, Math.round(((curP - yLow) / yRange) * 100))) : 50;

      circuitsCard.innerHTML = `
        <div style="background:#FFFFFF; border:1px solid rgba(216,210,207,0.85); border-radius:12px; padding:14px; box-shadow:0 1px 4px rgba(43,35,34,0.04);">
          <div style="font-size:12px; font-weight:800; color:var(--aiot-950); margin-bottom:10px; letter-spacing:0.02em;">
            CIRCUITS & MARKET METRICS
          </div>

          <!-- Circuit Limit Bands -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--aiot-50); border:1px solid var(--aiot-200); border-radius:8px; padding:8px 12px; margin-bottom:10px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#DC2626; text-transform:uppercase;">Lower Circuit</div>
              <div class="mono" style="font-size:13px; font-weight:800; color:var(--aiot-900);">₹${Number(lower).toFixed(2)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:9.5px; color:var(--aiot-500); text-transform:uppercase;">LTP</div>
              <div class="mono font-bold" style="font-size:13px; color:var(--aiot-950);">₹${Number(curP).toFixed(2)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px; font-weight:700; color:#059669; text-transform:uppercase;">Upper Circuit</div>
              <div class="mono" style="font-size:13px; font-weight:800; color:var(--aiot-900);">₹${Number(upper).toFixed(2)}</div>
            </div>
          </div>

          <!-- 52-Week Range Bar -->
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:4px; color:var(--aiot-600);">
              <span>52W Low: <strong class="mono">₹${Number(yLow).toFixed(2)}</strong></span>
              <span>52W High: <strong class="mono">₹${Number(yHigh).toFixed(2)}</strong></span>
            </div>
            <div style="height:6px; background:var(--aiot-200); border-radius:3px; position:relative; overflow:hidden;">
              <div style="width:${curYPos}%; height:100%; background:var(--aiot-900); border-radius:3px;"></div>
            </div>
          </div>

          <!-- Quick Stats Grid -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11px; padding-top:8px; border-top:1px solid var(--aiot-200);">
            <div>
              <span style="color:var(--aiot-500);">Prev Close:</span>
              <span class="mono font-bold" style="color:var(--aiot-900); margin-left:4px;">₹${Number(prevClose).toFixed(2)}</span>
            </div>
            <div>
              <span style="color:var(--aiot-500);">Avg Price:</span>
              <span class="mono font-bold" style="color:var(--aiot-900); margin-left:4px;">₹${Number(avgP).toFixed(2)}</span>
            </div>
            <div>
              <span style="color:var(--aiot-500);">Volume:</span>
              <span class="mono font-bold" style="color:var(--aiot-900); margin-left:4px;">${Number(vol).toLocaleString()}</span>
            </div>
            <div>
              <span style="color:var(--aiot-500);">Open Interest:</span>
              <span class="mono font-bold" style="color:var(--aiot-900); margin-left:4px;">${Number(quote.oi || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '99999';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '10px';
    toast.style.fontSize = '12.5px';
    toast.style.fontWeight = '600';
    toast.style.color = '#FFF';
    toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.transition = 'all 0.3s ease';

    if (type === 'success') toast.style.background = '#059669';
    else if (type === 'error') toast.style.background = '#DC2626';
    else toast.style.background = '#1E1815';

    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  openTokenModal() {
    let backdrop = document.getElementById('upstoxTokenModalBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'upstoxTokenModalBackdrop';
      backdrop.className = 'modal-backdrop open';
      backdrop.style.zIndex = '9999';
      backdrop.onclick = () => backdrop.classList.remove('open');

      backdrop.innerHTML = `
        <div class="terminal-modal" onclick="event.stopPropagation()" style="max-width:480px; background:#FFFFFF; border-radius:14px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
          <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid var(--aiot-200); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:15px; color:var(--aiot-950);">Upstox V3 Full Market Quotes Configuration</div>
            <button class="modal-close-btn" onclick="document.getElementById('upstoxTokenModalBackdrop').classList.remove('open')" style="background:transparent; border:none; font-size:16px; cursor:pointer;">✕</button>
          </div>
          <div style="padding:20px;">
            <p style="font-size:12.5px; color:var(--aiot-600); margin:0 0 14px; line-height:1.5;">
              Upstox Full Market Quotes V3 retrieves complete snapshots of up to 500 instruments directly from exchanges with Closing Auction Session (CAS) & Level 2 Depth.
            </p>
            <label class="hero-stat-label" style="font-weight:700; color:var(--aiot-800); font-size:11.5px; display:block; margin-bottom:6px;">
              Upstox Bearer Access Token (Optional)
            </label>
            <input type="password" id="upstoxAccessTokenInput" placeholder="Paste your Upstox Access Token here..."
              class="chat-input" style="width:100%; font-family:var(--font-mono); font-size:12px; padding:10px 12px; margin-bottom:8px;">
            <div style="font-size:11px; color:var(--aiot-500); margin-bottom:18px;">
              💡 If left empty, AIOT automatically provides the calibrated real-time exchange quote engine with CAS & 5-depth matching.
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button class="nova-quick-pill" onclick="window.upstoxService.saveToken(''); document.getElementById('upstoxAccessTokenInput').value=''; document.getElementById('upstoxTokenModalBackdrop').classList.remove('open');" style="background:transparent; border:1px solid var(--aiot-300); font-size:11.5px; padding:7px 14px;">
                Clear Token
              </button>
              <button class="nova-quick-pill" onclick="window.upstoxService.saveToken(document.getElementById('upstoxAccessTokenInput').value); document.getElementById('upstoxTokenModalBackdrop').classList.remove('open');" style="background:var(--aiot-950); color:#FFF; font-weight:700; font-size:11.5px; padding:7px 18px;">
                Save Access Token
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
    } else {
      backdrop.classList.add('open');
    }
  }

  bindEvents() {
    // Expose globally
  }
}

window.upstoxService = new UpstoxV3Service();
