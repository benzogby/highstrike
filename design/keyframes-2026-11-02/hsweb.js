// highstrike.com in the reels v2 system: draws every data piece of the keyframe page from world.js (the homepage's own
// public data, fetched 2026-11-02 by make-world.mjs): the price field behind each dark room, the tape, the graded
// setup's live chart with its levels and price tag, this morning's report, the record, the desk and the market map.
// Deterministic: no Math.random, no clock reads except the bell line.
(function () {
  const W = window.WORLD;
  const NS = "http://www.w3.org/2000/svg";

  // ── Small utilities ────────────────────────────────────────────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k === "style") e.style.cssText = v;
      else e.setAttribute(k, v);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  const svg = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const fixed = (n, d = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n, d = 2) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(d) + "%";
  const money = (n) => "$" + (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "K" : fixed(n, 0));
  const tri = (up, color = "currentColor") =>
    `<svg class="tri" viewBox="0 0 12 10" aria-hidden="true"><path d="${up ? "M6 0.6 L11.4 9.4 L0.6 9.4 Z" : "M6 9.4 L11.4 0.6 L0.6 0.6 Z"}" fill="${color}"/></svg>`;
  const check = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 L4.9 9 L9.8 3.2" fill="none" stroke="#6FF5C1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const short = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };
  const weekday = (iso) => DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

  // The NYSE calendar (src/lib/marketCalendar.ts): price_history is a morning snapshot, so the row dated D holds the
  // close of the last session before D.
  const HOLIDAYS = new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"]);
  const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const isSession = (iso) => { const g = new Date(`${iso}T12:00:00Z`).getUTCDay(); return g !== 0 && g !== 6 && !HOLIDAYS.has(iso); };
  const sessionBefore = (iso) => { let d = addDays(iso, -1); while (!isSession(d)) d = addDays(d, -1); return d; };
  const sessions = (rows) => {
    const out = [];
    for (const r of [...rows].sort((a, b) => (a.price_date < b.price_date ? -1 : 1))) {
      const date = sessionBefore(r.price_date), close = Number(r.close);
      if (out.length && out[out.length - 1].date === date) out[out.length - 1] = { date, close };
      else out.push({ date, close });
    }
    return out;
  };

  const SPY = sessions(W.spy);
  const QQQ = sessions(W.series.QQQ);
  const HOOD = sessions(W.series.HOOD);
  const lastSession = SPY[SPY.length - 1].date; // Oct 30
  const report = W.weather[0];
  const stats = W.stats[0];
  const setup = W.closed.find((c) => c.ticker === "HOOD" && c.report_date === "2026-10-29");

  // ── The dark room's price field: SPY and QQQ's real closes, huge and out of focus, at two depths ────────────────
  function priceField(room, seed) {
    const f = $(".field", room);
    if (!f) return;
    const w = room.offsetWidth, h = room.offsetHeight;
    const r = rng(seed);
    const layer = (cls, series, top, height, color, width, opacity) => {
      const s = svg("svg", { class: cls, width: w + 400, height, viewBox: `0 0 ${w + 400} ${height}`, style: `left:-200px;top:${top}px` }, f);
      const lo = Math.min(...series.map((p) => p.close)), hi = Math.max(...series.map((p) => p.close));
      const pts = series.map((p, i) => [(i / (series.length - 1)) * (w + 400), height * 0.85 - ((p.close - lo) / (hi - lo)) * height * 0.7]);
      const d = "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
      svg("path", { d: d + ` L${w + 400} ${height} L0 ${height} Z`, fill: color, opacity: 0.06 }, s);
      svg("path", { d, fill: "none", stroke: color, "stroke-width": width, "stroke-linejoin": "round", opacity }, s);
      // Bars hanging off the line, each session's real move: green up, red down.
      for (let i = 1; i < series.length; i += 2) {
        const [x, y] = pts[i];
        const move = (series[i].close - series[i - 1].close) / series[i - 1].close;
        const bh = 18 + Math.min(90, Math.abs(move) * 2400);
        svg("rect", { x: x - 6, y: y - bh / 2, width: 12, height: bh, rx: 3, fill: move >= 0 ? "#1FBF86" : "#FF5D52", opacity: 0.5 }, s);
      }
    };
    layer("far", SPY, Math.round(h * 0.18), Math.round(h * 0.5), "#1FBF86", 10, 0.9);
    layer("near", QQQ.slice(-36), Math.round(h * 0.42), Math.round(h * 0.46), "#7FE9C3", 6, 0.75);
    for (let i = 0; i < 22; i++) {
      const x = r() * w, y = r() * h, size = 2 + r() * 4, depth = r();
      const lit = Math.max(0, 1 - Math.hypot((x - w * 0.18) / (w * 0.7), (y - 60) / (h * 0.9)));
      el("i", { class: "dust", style: `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;opacity:${(0.06 + lit * 0.42).toFixed(2)};filter:blur(${(depth * 2).toFixed(1)}px)` }, room);
    }
  }

  // ── The tape: the last session's movers ──────────────────────────────────────────────────────────────────────
  function tape() {
    const t = $("#tape");
    const items = W.movers.slice(0, 24).map((m) => {
      const up = m.change_pct >= 0;
      return `<span class="it"><b>${m.ticker}</b><span class="p num">${fixed(m.close)}</span><span class="c num ${up ? "up" : "dn"}">${tri(up)}${Math.abs(m.change_pct).toFixed(2)}%</span></span>`;
    }).join("");
    el("div", { class: "label", html: `<i></i>Movers · ${short(lastSession)} close` }, t);
    el("div", { class: "run", html: items }, t);
  }

  // ── A setup on its chart: closes, levels with their axis chips, the reward zone, the price tag on the head ─────
  // Drawn at the box's own pixel size, so nothing stretches. opts: { from, to, pad, crosshair, upTo, trade, headChip }
  function setupChart(box, series, s, opts) {
    const VW = box.offsetWidth, VH = box.offsetHeight;
    const phone = VW < 500;
    const P = Object.assign({ l: 22, r: phone ? 98 : 136, t: 26, b: 40 }, opts.pad || {});
    if (phone) P.r = Math.min(P.r, 98);
    const pts = series.filter((p) => p.date >= opts.from && p.date <= opts.to);
    const entryIdx = pts.findIndex((p) => p.date === sessionBefore(s.report_date));
    const trigger = Number((s.entry_criteria[0].match(/\$([\d.]+)/) || [])[1]);
    const entry = Number(s.entry_price), target = Number(s.target_price);
    const shortSide = s.direction === "short";
    const prices = pts.map((p) => p.close).concat([entry, target, trigger].filter(Boolean));
    const lo = Math.floor(Math.min(...prices) - 2.5), hi = Math.ceil(Math.max(...prices) + 2.5);
    const X = (i) => P.l + (i / (pts.length - 1)) * (VW - P.l - P.r);
    const Y = (v) => P.t + ((hi - v) / (hi - lo)) * (VH - P.t - P.b);
    const s0 = svg("svg", { viewBox: `0 0 ${VW} ${VH}`, width: "100%", height: "100%", preserveAspectRatio: "none", style: "position:absolute;inset:0" }, box);
    const defs = svg("defs", {}, s0);
    const g1 = svg("linearGradient", { id: `fade${opts.id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg("stop", { offset: "0%", "stop-color": "#FFFFFF", "stop-opacity": 0.1 }, g1);
    svg("stop", { offset: "100%", "stop-color": "#FFFFFF", "stop-opacity": 0 }, g1);
    const g2 = svg("linearGradient", { id: `gain${opts.id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg("stop", { offset: "0%", "stop-color": "#1FBF86", "stop-opacity": 0.3 }, g2);
    svg("stop", { offset: "100%", "stop-color": "#1FBF86", "stop-opacity": 0 }, g2);
    const glow = svg("filter", { id: `glow${opts.id}`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    svg("feGaussianBlur", { stdDeviation: 4, result: "b" }, glow);
    const m = svg("feMerge", {}, glow);
    svg("feMergeNode", { in: "b" }, m);
    svg("feMergeNode", { in: "SourceGraphic" }, m);

    // Price grid: a whisper of a line every $5, the price at the axis.
    const step = hi - lo > 30 ? 10 : 5;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      svg("line", { x1: P.l, x2: VW - P.r + 6, y1: Y(v), y2: Y(v), stroke: "#FFFFFF", "stroke-opacity": 0.05, "stroke-width": 1 }, s0);
      el("span", { class: "fine num", text: fixed(v, 0), style: `position:absolute;left:${((VW - P.r + 14) / VW) * 100}%;top:${(Y(v) / VH) * 100}%;transform:translateY(-50%)` }, box);
    }
    // Dates along the foot, one a week.
    pts.forEach((p, i) => {
      if (i === 0 || weekday(p.date) !== "Mon" || i > pts.length - 2) return;
      el("span", { class: "fine", text: short(p.date), style: `position:absolute;left:${(X(i) / VW) * 100}%;top:${((VH - P.b + 16) / VH) * 100}%;transform:translateX(-50%)` }, box);
    });

    const upTo = opts.upTo ?? pts.length - 1;
    const line = (a, b) => "M" + pts.slice(a, b + 1).map((p, k) => `${X(a + k).toFixed(1)} ${Y(p.close).toFixed(1)}`).join(" L");
    const ex = X(entryIdx);
    // Levels from the morning the setup published.
    const lvl = (v, stroke, dash, op) => svg("line", { x1: ex, x2: VW - P.r + 6, y1: Y(v), y2: Y(v), stroke, "stroke-width": 1.5, "stroke-dasharray": dash, "stroke-opacity": op }, s0);
    // The reward zone between entry and target.
    svg("rect", { x: ex, y: Math.min(Y(entry), Y(target)), width: VW - P.r + 6 - ex, height: Math.abs(Y(entry) - Y(target)), fill: "#1FBF86", "fill-opacity": 0.1 }, s0);
    if (trigger) lvl(trigger, "#AEB9B4", "3 6", 0.5);
    lvl(entry, "#DCE4E0", "6 6", 0.7);
    lvl(target, "#1FBF86", "0", 0.85);
    // The history in white, its area fading down; the trade's own path in green with the head lit.
    svg("path", { d: line(0, upTo) + ` L${X(upTo)} ${VH - P.b} L${X(0)} ${VH - P.b} Z`, fill: `url(#fade${opts.id})` }, s0);
    svg("path", { d: line(0, Math.min(entryIdx, upTo)), fill: "none", stroke: "#EAF1EE", "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-opacity": 0.86 }, s0);
    if (opts.trade === false) {
      svg("path", { d: line(entryIdx, upTo), fill: "none", stroke: "#EAF1EE", "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-opacity": 0.86 }, s0);
      svg("circle", { cx: X(upTo), cy: Y(pts[upTo].close), r: 5, fill: "#FFFFFF" }, s0);
    } else if (upTo > entryIdx) {
      const dTrade = line(entryIdx, upTo);
      const lastY = Y(pts[upTo].close);
      svg("path", { d: dTrade + ` L${X(upTo)} ${Y(entry)} L${ex} ${Y(entry)} Z`, fill: `url(#gain${opts.id})`, "fill-opacity": shortSide ? 0.9 : 0.9, transform: shortSide ? "" : "" }, s0);
      svg("path", { d: dTrade, fill: "none", stroke: "#1FBF86", "stroke-width": 3.2, "stroke-linejoin": "round", "stroke-linecap": "round", filter: `url(#glow${opts.id})` }, s0);
      // The head: lit, with a ring for the touch.
      svg("circle", { cx: X(upTo), cy: lastY, r: 15, fill: "#1FBF86", "fill-opacity": 0.16 }, s0);
      svg("circle", { cx: X(upTo), cy: lastY, r: 6, fill: "#6FF5C1", filter: `url(#glow${opts.id})` }, s0);
    } else {
      const lastY = Y(pts[upTo].close);
      svg("circle", { cx: X(upTo), cy: lastY, r: 5, fill: "#FFFFFF" }, s0);
    }
    // The morning it published: a hairline and its note.
    svg("line", { x1: ex, x2: ex, y1: P.t - 6, y2: VH - P.b, stroke: "#FFFFFF", "stroke-opacity": 0.22, "stroke-dasharray": "2 5" }, s0);
    if (opts.pubNote) el("span", { class: "fine", html: opts.pubNote, style: `position:absolute;right:${VW - ex + 10}px;bottom:${P.b + 8}px;text-align:right;color:#B4BFBA` }, box);

    // The crosshair snap: two hairlines locked on a point, with their axis readouts.
    let cross = null;
    if (opts.crosshair) {
      const ci = pts.findIndex((p) => p.date === opts.crosshair.date);
      cross = pts[ci].close;
      const cx = X(ci), cy = Y(cross);
      svg("line", { x1: P.l, x2: VW - P.r + 6, y1: cy, y2: cy, stroke: "#6FF5C1", "stroke-opacity": 0.75, "stroke-dasharray": "4 4" }, s0);
      svg("line", { x1: cx, x2: cx, y1: P.t, y2: VH - P.b, stroke: "#6FF5C1", "stroke-opacity": 0.75, "stroke-dasharray": "4 4" }, s0);
      svg("rect", { x: cx - 11, y: cy - 11, width: 22, height: 22, rx: 4, fill: "none", stroke: "#6FF5C1", "stroke-width": 1.6 }, s0);
      el("span", { class: "axchip ink", html: short(opts.crosshair.date).toUpperCase(), style: `left:${(cx / VW) * 100}%;top:${((VH - P.b + 18) / VH) * 100}%;transform:translate(-50%,-50%)` }, box);
    }

    // Axis chips, pushed apart so none overlaps.
    const chips = [];
    if (trigger) chips.push({ v: trigger, cls: "ghost", html: `<span class="k">${shortSide ? "BELOW" : "ABOVE"}</span>${fixed(trigger)}` });
    chips.push({ v: entry, cls: "ink", html: `<span class="k">ENTRY</span>${fixed(entry)}` });
    chips.push({ v: target, cls: "green", html: `<span class="k">TARGET</span>${fixed(target)}` });
    // The head's tag: the last price, green while the trade is winning (no arrow: on a short the price falls as it wins).
    if (opts.headChip && upTo > entryIdx) chips.push({ v: pts[upTo].close, cls: "green head", html: fixed(pts[upTo].close) });
    if (cross != null) chips.push({ v: cross, cls: "ink", html: fixed(cross) });
    chips.sort((a, b) => Y(a.v) - Y(b.v));
    const gap = opts.chipGap ?? (phone ? 27 : 32);
    let prev = -1e9;
    for (const c of chips) { c.y = Math.max(Y(c.v), prev + gap); prev = c.y; }
    const over = prev - (VH - P.b + 6);
    if (over > 0) for (const c of chips) c.y -= over;
    for (const c of chips) el("span", { class: `axchip ${c.cls}`, html: c.html, style: `left:${VW - P.r + 10}px;top:${c.y}px` }, box);
    return { X, Y, pts, entryIdx, upTo, VW, VH, P };
  }

  const VWphone = () => innerWidth < 760;

  // ── The hero: HOOD's short of Oct 29, graded at the Oct 30 close ─────────────────────────────────────────────
  function hero() {
    const box = $("#hero-chart");
    const r = setupChart(box, HOOD, setup, { id: "h", from: "2026-10-06", to: "2026-10-30", headChip: true, pad: VWphone() ? { t: 74 } : {}, pubNote: "Published Oct 29,<br>before the open" });
    // The result in its price tag, up where the price used to be (on a phone, in a band of its own above the line).
    el("div", { class: "callout", html: `<span class="tag flash" style="font-size:34px">${tri(true, "#fff")}<span>${pct(setup.result_pct)}</span></span><span class="fine" style="display:block;margin-top:10px;color:#B4BFBA">Target hit in 2 sessions</span>`,
      style: `position:absolute;right:${r.P.r + 18}px;top:${VWphone() ? 4 : r.P.t + 4}px;text-align:right` }, box);
    // This morning's report, behind.
    const rep = $("#report-body");
    const g = (label, v) => `<div class="mini"><b class="num">${v}</b><span>${label}</span><i><em style="width:${v}%"></em></i></div>`;
    rep.innerHTML = `<div class="minis">${g("Volatility", report.volatility)}${g("Opportunity", report.opportunity)}${g("Direction", report.direction)}</div>` +
      `<div class="slate">${W.today.map((t) => {
        const se = sessions(W.series[t.ticker] || []);
        const last = se[se.length - 1], prev = se[se.length - 2];
        const ch = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;
        return `<div class="srow"><b>${t.ticker}</b><span class="side ${t.direction}">${t.direction}</span><span class="flow"><i style="width:${t.flow_score}%"></i></span><span class="num">${t.flow_score}</span></div>`;
      }).join("")}</div>`;
    $("#report-date").textContent = `${weekday(report.report_date)}, ${short(report.report_date)}`;
    $("#bell-date").textContent = `${weekday(report.report_date)}, ${short(report.report_date)}`;
    $("#bell-count").textContent = `${W.today.length} setups`;
  }

  // ── How a setup happens: the same setup the morning its rules were met ───────────────────────────────────────
  function how() {
    const box = $("#how-chart");
    setupChart(box, HOOD, setup, { id: "w", from: "2026-10-08", to: "2026-10-30", upTo: HOOD.findIndex((p) => p.date === "2026-10-29") - HOOD.findIndex((p) => p.date === "2026-10-08"), trade: false, pad: { r: 136, t: 18, b: 34 }, crosshair: { date: "2026-10-29" } });
    $("#how-rules").innerHTML = setup.entry_criteria.map((c) => `<li><span class="ck">${check}</span>${c}</li>`).join("");
  }

  // ── Graded in public ─────────────────────────────────────────────────────────────────────────────────────────
  function graded() {
    $("#g-count").textContent = stats.closed_count;
    $("#g-rate").textContent = stats.win_rate.toFixed(1) + "%";
    $("#g-gain").innerHTML = `<span class="tag">${tri(true, "#fff")}<span>${pct(stats.avg_gain, 1)}</span></span>`;
    $("#g-loss").innerHTML = `<span class="tag loss">${tri(false, "#fff")}<span>${pct(stats.avg_loss, 1)}</span></span>`;
    // The ring: the share that hit its target.
    const ring = $("#g-ring");
    const C = 2 * Math.PI * 22;
    ring.innerHTML = `<circle cx="27" cy="27" r="22" fill="none" stroke="#E3E8E3" stroke-width="7"/><circle cx="27" cy="27" r="22" fill="none" stroke="#009F6F" stroke-width="7" stroke-linecap="round" stroke-dasharray="${((stats.win_rate / 100) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 27 27)"/>`;
    const STATUS = { target_hit: "Target hit", stopped: "Stopped", expired: "Expired" };
    const rows = [...W.closed].sort((a, b) => (a.report_date < b.report_date ? 1 : a.report_date > b.report_date ? -1 : a.ticker.localeCompare(b.ticker))).slice(0, 7);
    $("#g-rows").innerHTML = rows.map((c, i) => {
      const r = Number(c.result_pct), cls = r > 0 ? "g" : r < 0 ? "r" : "n";
      const first = i === 0 || rows[i - 1].report_date !== c.report_date;
      return `<tr><td class="date">${first ? short(c.report_date) : ""}</td><td><span class="tk">${c.ticker}</span><span class="${c.direction === "short" ? "dn" : "up"}">${c.direction === "short" ? "Short" : "Long"}</span></td>` +
        `<td class="num plan-col">$${fixed(c.entry_price)} → $${fixed(c.target_price)}</td>` +
        `<td class="res num"><span class="st">${STATUS[c.status] || c.status}</span><span class="chip ${cls}">${tri(r >= 0, "#fff")}${Math.abs(r).toFixed(2)}%</span></td></tr>`;
    }).join("");
    const max = Math.max(...W.weeks.map((w) => w.closed));
    $("#g-bars").innerHTML = W.weeks.map((w) => `<div class="bar" style="height:${((w.closed / max) * 100).toFixed(1)}%" title="Week of ${short(w.week)}: ${w.closed} closed, ${w.hits} hit"><i style="height:${w.closed ? ((w.hits / w.closed) * 100).toFixed(1) : 0}%"></i></div>`).join("");
    $("#g-x").innerHTML = W.weeks.map((w) => `<span>${short(w.week)}</span>`).join("");
  }

  // ── The desk: this morning's weather, the slate, insiders and the crowd ──────────────────────────────────────
  function desk() {
    const gauge = (label, v) => {
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, R = 46, cx = 60, cy = 58;
      const arc = (t) => { const a = a0 + (a1 - a0) * t; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
      const [x0, y0] = arc(0), [x1, y1] = arc(1), [xv, yv] = arc(v / 100);
      const big = (a1 - a0) * (v / 100) > Math.PI ? 1 : 0;
      return `<div class="gauge"><svg viewBox="0 0 120 104"><path d="M${x0} ${y0} A${R} ${R} 0 1 1 ${x1} ${y1}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9" stroke-linecap="round"/>` +
        `<path d="M${x0} ${y0} A${R} ${R} 0 ${big} 1 ${xv.toFixed(1)} ${yv.toFixed(1)}" fill="none" stroke="#1FBF86" stroke-width="9" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(31,191,134,.6))"/></svg><b class="num">${v}</b><span>${label}</span></div>`;
    };
    $("#d-gauges").innerHTML = gauge("Volatility", report.volatility) + gauge("Opportunity", report.opportunity) + gauge("Direction", report.direction);
    $("#d-note").textContent = report.summary;
    $("#d-date").textContent = `${weekday(report.report_date)}, ${short(report.report_date)}`;
    $("#d-slate").innerHTML = W.today.map((t) => {
      const se = sessions(W.series[t.ticker] || []);
      const last = se[se.length - 1];
      return `<div class="row"><span class="tk">${t.ticker}</span><span class="flow"><i style="width:${t.flow_score}%"></i></span><span class="side ${t.direction}">${t.direction}</span><span class="v">${last ? fixed(last.close) : "—"}</span></div>`;
    }).join("");
    const ins = Object.entries(W.reads).filter(([, r]) => r.insiders && r.insiders.sold > 0).map(([k, r]) => ({ k, ...r.insiders })).sort((a, b) => b.sold - a.sold).slice(0, 5);
    const maxSold = ins[0].sold;
    $("#d-insiders").innerHTML = ins.map((i) => `<div class="ins"><span class="tk">${i.k}</span><span class="meter"><i style="width:${Math.max(4, (i.sold / maxSold) * 100).toFixed(1)}%"></i></span><span class="v">${i.sells} sell${i.sells === 1 ? "" : "s"} · ${money(i.sold)}</span></div>`).join("");
    const crowd = ["NVDA", "AMZN", "MU", "HOOD", "MSTR"].map((k) => ({ k, ...W.reads[k].chatter }));
    $("#d-crowd").innerHTML = crowd.map((c) => {
      const t = c.bullish + c.bearish || 1;
      return `<div class="ins"><span class="tk">${c.k}</span><span class="meter" style="background:rgba(255,93,82,.55)"><i style="width:${((c.bullish / t) * 100).toFixed(1)}%;background:linear-gradient(90deg,#0E8F65,#1FBF86)"></i></span><span class="v">${Number(c.watchers).toLocaleString("en-US")} watching</span></div>`;
    }).join("");
  }

  // ── The close: the last session on one map ───────────────────────────────────────────────────────────────────
  function map() {
    const tiles = [...W.movers].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
    const shade = (v) => {
      const a = Math.min(1, Math.abs(v) / 9);
      return v >= 0 ? `rgb(${Math.round(12 + 8 * a)},${Math.round(62 + 98 * a)},${Math.round(46 + 70 * a)})` : `rgb(${Math.round(84 + 124 * a)},${Math.round(32 + 32 * a)},${Math.round(34 + 22 * a)})`;
    };
    $("#map").innerHTML = tiles.map((m, i) => {
      const size = i < 2 ? "xl" : i < 8 ? "l" : "";
      const span = size === "xl" ? "grid-column:span 2;grid-row:span 2" : size === "l" ? "grid-column:span 2" : "";
      return `<div class="mt ${size}" style="background:${shade(m.change_pct)};${span}"><b>${m.ticker}</b><span>${pct(m.change_pct)}</span></div>`;
    }).join("");
    $("#map-date").textContent = `${short(lastSession)} close`;
  }

  // ── Keyframe mode: ?kf=<section id> puts that section at the top for the renderer ─────────────────────────────
  async function boot() {
    tape();
    hero();
    how();
    graded();
    desk();
    map();
    await document.fonts.ready;
    document.querySelectorAll(".room").forEach((room, i) => priceField(room, 11 + i * 7));
    document.body.dataset.ready = "1";
  }
  boot();
})();
