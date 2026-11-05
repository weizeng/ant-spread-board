/* ANT Spread Board — vanilla JS, no framework, no build step.
 * Read-only: only public GET (OKX) and POST (Hyperliquid info) requests. No Binance requests. */
(function () {
  'use strict';

  var CONFIG = {
    refreshMs: 30000,
    timeoutMs: 8000,
    maxPoints: 50,
    ioDivisor: 16.7, // fully diluted ~167B shares: price * 10 / 167
    scenarios: [12.3, 12.7, 13.1],
    storageKey: 'ant-spread-board:history:v1'
  };

  var URLS = {
    okxTicker: 'https://www.okx.com/api/v5/market/ticker?instId=ANTHROPIC-USDT-SWAP',
    okxFunding: 'https://www.okx.com/api/v5/public/funding-rate?instId=ANTHROPIC-USDT-SWAP',
    hl: 'https://api.hyperliquid.xyz/info'
  };

  // Stale reference snapshot (2026-11-04 09:59 Beijing). Sample mode ONLY.
  var SAMPLE = { xyz: 110.52, io: 1773.5, okx: 166.57, binance: 1647.26, asOf: '2026-11-04 09:59 北京时间(旧快照)' };

  var state = {
    scenario: 12.7,
    mode: 'live', // 'live' | 'sample'
    chartMode: 'price',
    refreshing: false,
    lastUpdated: null,
    binanceManual: null, // {price, at} — memory only
    src: {
      okx: blank(), xyz: blank(), io: blank()
    }
  };
  function blank() {
    return { status: 'loading', error: null, price: null, mark: null, funding: null, fetchedAt: null, bid: null, ask: null, exchangeTs: null };
  }

  /* ---------- pure math (also exported for tests) ---------- */
  function okxPerShare(price, S) { return price == null || !(S > 0) ? null : price * 10 / S; }
  function binancePerShare(price, S) { return price == null || !(S > 0) ? null : price * 1 / S; }
  function xyzPerShare(price) { return price == null ? null : price; }
  function ioPerShare(price) { return price == null ? null : price / CONFIG.ioDivisor; }
  function spread(perShare, xyz) {
    if (perShare == null || xyz == null || !(xyz > 0)) return null;
    return { abs: perShare - xyz, pct: (perShare - xyz) / xyz };
  }

  /* ---------- formatting ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n, d) { return n == null || !isFinite(n) ? null : Number(n).toFixed(d); }
  function usd(n, d) { var s = num(Math.abs(n), d == null ? 2 : d); return s == null ? 'no data' : (n < 0 ? '-$' : '$') + s; }
  function signedUsd(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n).toFixed(2); }
  function signedPct(f) { return (f >= 0 ? '+' : '') + (f * 100).toFixed(2) + '%'; }
  function utc(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }
  function toNum(v, field) {
    var n = parseFloat(v);
    if (v === undefined || v === null || v === '' || !isFinite(n)) throw new Error('字段缺失或无效: ' + field);
    return n;
  }

  /* ---------- networking ---------- */
  function withTimeout(url, opts) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, CONFIG.timeoutMs);
    opts = opts || {};
    opts.signal = ctl.signal;
    opts.credentials = 'omit';
    return fetch(url, opts).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') throw new Error('请求超时 (' + CONFIG.timeoutMs / 1000 + 's)');
      throw new Error('网络错误: ' + (e && e.message ? e.message : e));
    });
  }
  function retryOnce(fn) {
    return fn().catch(function () { return fn(); });
  }

  function fetchOkx() {
    return retryOnce(function () {
      return Promise.all([
        withTimeout(URLS.okxTicker),
        withTimeout(URLS.okxFunding).then(function (j) { return { j: j }; }, function (e) { return { err: e }; })
      ]);
    }).then(function (res) {
      var t = res[0];
      if (!t || t.code !== '0' || !t.data || !t.data[0]) throw new Error('OKX 行情响应异常: ' + (t && t.msg ? t.msg : 'data[0] 缺失'));
      var d = t.data[0];
      var out = {
        price: toNum(d.last, 'data[0].last'),
        bid: d.bidPx ? parseFloat(d.bidPx) : null,
        ask: d.askPx ? parseFloat(d.askPx) : null,
        exchangeTs: d.ts ? new Date(Number(d.ts)).toISOString() : null,
        funding: null, fundingError: null
      };
      if (res[1].err) {
        out.fundingError = res[1].err.message;
      } else {
        var f = res[1].j;
        if (f && f.data && f.data[0] && f.data[0].fundingRate !== undefined) out.funding = String(f.data[0].fundingRate);
        else out.fundingError = '资金费率字段缺失: data[0].fundingRate';
      }
      return out;
    });
  }

  function fetchHl(dex, name) {
    return retryOnce(function () {
      return withTimeout(URLS.hl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: dex })
      });
    }).then(function (j) {
      if (!Array.isArray(j) || !j[0] || !Array.isArray(j[0].universe) || !Array.isArray(j[1])) throw new Error('Hyperliquid 响应结构异常');
      var idx = -1;
      j[0].universe.forEach(function (u, i) { if (u && u.name === name) idx = i; });
      if (idx < 0) throw new Error('未找到 ' + name);
      var c = j[1][idx];
      if (!c) throw new Error(name + ' 的 asset context 缺失');
      return {
        price: toNum(c.midPx, name + '.midPx'),
        mark: toNum(c.markPx, name + '.markPx'),
        funding: c.funding !== undefined ? String(c.funding) : null
      };
    });
  }

  function applyResult(key, p) {
    var now = new Date().toISOString();
    var s = state.src[key];
    if (p.status === 'fulfilled') {
      var v = p.value;
      state.src[key] = {
        status: 'live', error: null, price: v.price, mark: v.mark == null ? null : v.mark,
        funding: v.funding, fundingError: v.fundingError || null, fetchedAt: now,
        bid: v.bid == null ? null : v.bid, ask: v.ask == null ? null : v.ask, exchangeTs: v.exchangeTs || null
      };
    } else {
      var msg = p.reason && p.reason.message ? p.reason.message : String(p.reason);
      var unreachable = /网络错误|超时/.test(msg);
      // Do not keep an old price as if live.
      state.src[key] = blank();
      state.src[key].status = unreachable ? 'unreachable' : 'error';
      state.src[key].error = msg;
      state.src[key].fetchedAt = now;
    }
    void s;
  }

  function refresh() {
    if (state.mode === 'sample' || state.refreshing) return Promise.resolve();
    state.refreshing = true;
    var btn = document.getElementById('refreshBtn');
    if (btn) { btn.disabled = true; }
    return Promise.allSettled([fetchOkx(), fetchHl('xyz', 'xyz:ANT'), fetchHl('io', 'io:ANTH')]).then(function (r) {
      applyResult('okx', r[0]);
      applyResult('xyz', r[1]);
      applyResult('io', r[2]);
      state.lastUpdated = new Date().toISOString();
      recordHistory();
    }).then(function () {
      state.refreshing = false;
      if (btn) btn.disabled = false;
      render();
    });
  }

  /* ---------- computed rows ---------- */
  function computeRows() {
    var S = state.scenario;
    var sample = state.mode === 'sample';
    var rows = [];
    var xyzP = state.src.xyz.price;
    var xyzPS = xyzPerShare(xyzP);

    function mk(o) { o.sample = sample; return o; }

    rows.push(mk({
      key: 'xyz', name: 'Hyperliquid xyz:ANT', source: 'Hyperliquid API (dex xyz)',
      status: state.src.xyz.status, error: state.src.xyz.error, quoted: xyzP,
      quotedNote: '中间价 mid;1 合约 = 1 股', shares: '1 合约 = 1 股(基准)',
      perShare: xyzPS, formula: '每股 = mid', mark: state.src.xyz.mark,
      funding: state.src.xyz.funding, fundingError: null, at: state.src.xyz.fetchedAt, isBase: true
    }));
    var o = state.src.okx;
    rows.push(mk({
      key: 'okx', name: 'OKX ANTHROPIC-USDT-SWAP', source: 'OKX API',
      status: o.status, error: o.error, quoted: o.price,
      quotedNote: '最新价 last;按每 10B 股报价', shares: S + 'B(情景)',
      perShare: okxPerShare(o.price, S), formula: 'last × 10 ÷ ' + S,
      funding: o.funding, fundingError: o.fundingError, at: o.fetchedAt, exchangeTs: o.exchangeTs
    }));
    var i = state.src.io;
    rows.push(mk({
      key: 'io', name: 'Entropy io:ANTH', source: 'Hyperliquid API (dex io)',
      status: i.status, error: i.error, quoted: i.price,
      quotedNote: '中间价 mid;按市值报价', shares: '≈167B(完全稀释,固定)',
      perShare: ioPerShare(i.price), formula: 'mid ÷ 16.7', mark: i.mark,
      funding: i.funding, fundingError: null, at: i.fetchedAt
    }));
    var b = state.binanceManual;
    var bp = state.mode === 'sample' ? SAMPLE.binance : (b ? b.price : null);
    rows.push(mk({
      key: 'binance', name: 'Binance(手动)', source: state.mode === 'sample' ? '示例快照' : '用户手动输入',
      status: state.mode === 'sample' ? 'sample' : (b ? 'manual' : 'unreachable'),
      error: bp == null ? '来源不可达:本应用不请求 Binance' : null, quoted: bp,
      quotedNote: '按每 1B 股报价', shares: S + 'B(情景)',
      perShare: binancePerShare(bp, S), formula: '价格 × 1 ÷ ' + S,
      funding: null, fundingError: null, at: b && state.mode !== 'sample' ? b.at : null, noPrice: bp == null
    }));
    rows.forEach(function (r) { r.spread = r.isBase ? null : spread(r.perShare, xyzPS); });
    return rows;
  }

  /* ---------- history ---------- */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      var h = raw ? JSON.parse(raw) : {};
      return h && typeof h === 'object' ? h : {};
    } catch (e) { return {}; }
  }
  function saveHistory(h) { try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(h)); } catch (e) { /* storage unavailable */ } }
  function recordHistory() {
    if (state.mode !== 'live') return;
    var h = loadHistory();
    var rows = computeRows();
    var t = state.lastUpdated;
    rows.forEach(function (r) {
      if (r.key === 'binance') return; // manual, not persisted
      if (r.status !== 'live' || r.perShare == null) return;
      var arr = Array.isArray(h[r.key]) ? h[r.key] : [];
      arr.push({ t: t, source: r.key, scenarioShares: state.scenario, perShare: r.perShare, spread: r.spread ? r.spread.pct : null });
      h[r.key] = arr.slice(-CONFIG.maxPoints);
    });
    saveHistory(h);
  }

  /* ---------- rendering ---------- */
  var STATUS_LABEL = { live: '实时 live', error: '错误 error', unreachable: '不可达 unreachable', manual: '手动 manual', sample: '示例 sample', loading: '加载中…' };

  function badge(r) { return r.sample ? '<span class="sample-badge">SAMPLE DATA</span>' : ''; }

  function renderRow(r) {
    var hasPrice = r.quoted != null;
    var asOf = state.mode === 'sample' ? 'as of ' + SAMPLE.asOf : (r.at ? 'as of ' + utc(r.at) : '');
    var quotedCell;
    if (!hasPrice) {
      var msg = r.key === 'binance' ? '暂无价格(来源不可达)' : 'no data';
      quotedCell = '<span class="nodata">' + esc(msg) + '</span>';
    } else {
      quotedCell = '<span class="num">' + usd(r.quoted) + '</span>' + badge(r) +
        '<span class="sub2">' + esc(r.quotedNote) + '</span>' +
        (r.mark != null && !r.sample ? '<span class="sub2">mark ' + usd(r.mark) + '(仅参考)</span>' : '');
    }
    quotedCell += '<span class="sub2">' + esc(r.source) + (asOf ? ' · ' + esc(asOf) : '') + '</span>';

    var perCell, spreadAbs, spreadPct;
    if (r.perShare == null) {
      perCell = spreadAbs = spreadPct = '<span class="nodata">no data</span>';
    } else {
      perCell = '<span class="num">' + usd(r.perShare) + '</span>' + badge(r) +
        '<span class="sub2">' + esc(r.formula) + '</span>';
      if (r.isBase) {
        spreadAbs = spreadPct = '<span class="nodata">基准 base</span>';
      } else if (!r.spread) {
        spreadAbs = spreadPct = '<span class="nodata">no data</span>';
      } else {
        var cls = r.spread.abs >= 0 ? 'pos' : 'neg';
        spreadAbs = '<span class="num ' + cls + '">' + signedUsd(r.spread.abs) + '</span>' + badge(r);
        spreadPct = '<span class="num ' + cls + '">' + signedPct(r.spread.pct) + '</span>' + badge(r);
      }
    }

    var fund;
    if (r.sample) fund = '<span class="nodata">示例中无</span>';
    else if (r.funding != null) fund = '<span class="num">' + esc(r.funding) + '</span><span class="sub2">原始值,未年化 · ' + esc(r.source) + ' · ' + esc(utc(r.at)) + '</span>';
    else if (r.fundingError) fund = '<span class="nodata">no data</span><span class="sub2">' + esc(r.fundingError) + '</span>';
    else fund = '<span class="nodata">—</span>';

    var st = '<span class="pill ' + esc(r.status) + '">' + esc(STATUS_LABEL[r.status] || r.status) + '</span>';
    if (r.error) st += '<span class="sub2">' + esc(r.error) + '</span>';

    return '<tr data-row="' + esc(r.key) + '"><td><strong>' + esc(r.name) + '</strong></td><td>' + quotedCell +
      '</td><td>' + esc(r.shares) + '</td><td>' + perCell + '</td><td>' + spreadAbs + '</td><td>' + spreadPct +
      '</td><td>' + fund + '</td><td>' + st + '</td></tr>';
  }

  function renderStatusLine(rows) {
    var el = document.getElementById('statusLine');
    if (state.mode === 'sample') {
      el.textContent = '示例数据,非实时 — 当前显示的是 2026-11-04 的旧快照';
      return;
    }
    var live = rows.filter(function (r) { return r.key !== 'binance' && r.status === 'live'; }).length;
    var loading = rows.some(function (r) { return r.status === 'loading'; });
    if (loading) { el.textContent = '正在获取数据…'; return; }
    var bin = state.binanceManual ? 'Binance:手动价格' : 'Binance:不可达(可手动输入)';
    el.textContent = '实时来源 ' + live + '/3 在线 · ' + bin;
  }

  function render() {
    var rows = computeRows();
    document.getElementById('spreadBody').innerHTML = rows.map(renderRow).join('');
    renderStatusLine(rows);
    var sample = state.mode === 'sample';
    document.getElementById('sampleBanner').hidden = !sample;
    document.getElementById('sampleBtn').hidden = sample;
    document.getElementById('liveBtn').hidden = !sample;
    document.getElementById('lastUpdated').textContent = sample ? '示例快照 ' + SAMPLE.asOf : (state.lastUpdated ? utc(state.lastUpdated) : '—');
    document.getElementById('formulaNote').textContent =
      '公式(份额单位 B = 十亿,当前 S = ' + state.scenario + '):OKX = last × 10 ÷ S;Binance = 价格 × 1 ÷ S;xyz:ANT = mid(1 合约 = 1 股);io:ANTH = mid ÷ 16.7(与 S 无关);价差 = (每股价 − xyz 每股价) ÷ xyz 每股价。';
    drawChart();
  }

  /* ---------- chart ---------- */
  var COLORS = { xyz: '#0071e3', okx: '#e8590c', io: '#7048e8' };
  var LABELS = { xyz: 'xyz:ANT', okx: 'OKX', io: 'io:ANTH' };

  function drawChart() {
    var cv = document.getElementById('chart');
    if (!cv || !cv.getContext) return;
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || 800, hgt = cv.clientHeight || 300;
    cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

    var hist = loadHistory();
    var keys = state.chartMode === 'price' ? ['xyz'] : ['okx', 'io'];
    var series = keys.map(function (k) {
      var pts = (Array.isArray(hist[k]) ? hist[k] : []).map(function (p) {
        return { t: Date.parse(p.t), v: state.chartMode === 'price' ? p.perShare : (p.spread == null ? null : p.spread * 100) };
      }).filter(function (p) { return isFinite(p.t) && p.v != null && isFinite(p.v); });
      return { k: k, pts: pts };
    });
    var all = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p); }); });
    var note = document.getElementById('chartNote');

    if (all.length === 0) {
      ctx.fillStyle = '#6e6e73'; ctx.textAlign = 'center';
      ctx.fillText('暂无历史数据。实时数据刷新成功后会开始记录。', w / 2, hgt / 2);
      note.textContent = '';
      return;
    }
    var pad = { l: 56, r: 12, t: 14, b: 28 };
    var minV = Math.min.apply(null, all.map(function (p) { return p.v; }));
    var maxV = Math.max.apply(null, all.map(function (p) { return p.v; }));
    if (minV === maxV) { minV -= 1; maxV += 1; }
    var m = (maxV - minV) * 0.1; minV -= m; maxV += m;
    var minT = Math.min.apply(null, all.map(function (p) { return p.t; }));
    var maxT = Math.max.apply(null, all.map(function (p) { return p.t; }));
    if (minT === maxT) maxT = minT + 1;
    var X = function (t) { return pad.l + (t - minT) / (maxT - minT) * (w - pad.l - pad.r); };
    var Y = function (v) { return pad.t + (1 - (v - minV) / (maxV - minV)) * (hgt - pad.t - pad.b); };

    ctx.strokeStyle = '#e5e5ea'; ctx.fillStyle = '#6e6e73'; ctx.lineWidth = 1; ctx.textAlign = 'right';
    for (var i = 0; i <= 4; i++) {
      var v = minV + (maxV - minV) * i / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(state.chartMode === 'price' ? '$' + v.toFixed(2) : v.toFixed(1) + '%', pad.l - 6, y + 4);
    }
    ctx.textAlign = 'left';
    ctx.fillText(new Date(minT).toISOString().slice(11, 19) + ' UTC', pad.l, hgt - 8);
    ctx.textAlign = 'right';
    ctx.fillText(new Date(maxT).toISOString().slice(11, 19) + ' UTC', w - pad.r, hgt - 8);

    var lx = pad.l + 8;
    series.forEach(function (s) {
      ctx.strokeStyle = COLORS[s.k]; ctx.fillStyle = COLORS[s.k]; ctx.lineWidth = 2;
      ctx.beginPath();
      s.pts.forEach(function (p, idx) { var x = X(p.t), y = Y(p.v); if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      s.pts.forEach(function (p) { ctx.beginPath(); ctx.arc(X(p.t), Y(p.v), 2.5, 0, Math.PI * 2); ctx.fill(); });
      ctx.textAlign = 'left';
      ctx.fillText('● ' + LABELS[s.k] + ' (' + s.pts.length + ')', lx, pad.t + 12);
      lx += 120;
    });
    note.textContent = state.chartMode === 'spread'
      ? '价差历史按记录当时选择的份额情景计算,切换情景后旧点不会重算。'
      : '';
  }

  /* ---------- wiring ---------- */
  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="scenario"]'), function (el) {
      el.checked = parseFloat(el.value) === state.scenario;
      el.addEventListener('change', function () {
        if (el.checked) { state.scenario = parseFloat(el.value); render(); }
      });
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      if (state.mode === 'sample') return;
      refresh();
    });
    document.getElementById('sampleBtn').addEventListener('click', function () {
      state.mode = 'sample';
      state.src.xyz = { status: 'sample', error: null, price: SAMPLE.xyz, mark: null, funding: null, fetchedAt: null };
      state.src.okx = { status: 'sample', error: null, price: SAMPLE.okx, mark: null, funding: null, fetchedAt: null };
      state.src.io = { status: 'sample', error: null, price: SAMPLE.io, mark: null, funding: null, fetchedAt: null };
      render();
    });
    document.getElementById('liveBtn').addEventListener('click', function () {
      state.mode = 'live';
      state.src = { okx: blank(), xyz: blank(), io: blank() };
      render();
      refresh();
    });
    document.getElementById('binanceForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = parseFloat(document.getElementById('binanceInput').value);
      if (!isFinite(v) || v <= 0) { alert('请输入大于 0 的数字'); return; }
      state.binanceManual = { price: v, at: new Date().toISOString() };
      render();
    });
    document.getElementById('binanceClear').addEventListener('click', function () {
      state.binanceManual = null;
      document.getElementById('binanceInput').value = '';
      render();
    });
    document.getElementById('chartMode').addEventListener('change', function (e) {
      state.chartMode = e.target.value; drawChart();
    });
    document.getElementById('clearHistory').addEventListener('click', function () {
      try { localStorage.removeItem(CONFIG.storageKey); } catch (e) { /* ignore */ }
      drawChart();
    });
    window.addEventListener('resize', drawChart);

    render();
    refresh();
    setInterval(refresh, CONFIG.refreshMs);
  }

  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { okxPerShare: okxPerShare, binancePerShare: binancePerShare, xyzPerShare: xyzPerShare, ioPerShare: ioPerShare, spread: spread };
  }
})();
