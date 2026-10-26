import type { ClosedSetup, Close, Mover, Report, TickerRead, TodaySetup } from "@/app/(landing)/data";

// Real pieces of the HighStrike terminal, drawn in HTML at true size with this
// morning's data (Taste Skill: "The product performs"). Each root carries
// data-ui: inside it the product's own conventions hold (1px borders, small
// radii, tabular figures, a 1px accent line under the selected label).

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function signedPct(n: number, digits = 2) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}%`;
}

export function price(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function sideLabel(direction: string) {
  return direction.toLowerCase() === "short" ? "Short" : "Long";
}

export function statusLabel(status: string) {
  if (status === "target_hit") return "Target hit";
  if (status === "stopped") return "Stopped out";
  if (status === "expired") return "Expired";
  return status;
}

export function Lock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#009f6f" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function Mark() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#009f6f" />
      <path d="M8 22 L13 15 L17 18 L24 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// An ink line through the closes, with a price scale on the right and dates
// below (the app rule: a chart always carries its scale and its dates).
function SpyChart({ spy }: { spy: Close[] }) {
  const w = 640;
  const h = 150;
  const closes = spy.map((p) => p.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const span = hi - lo || 1;
  const y = (v: number) => 8 + (1 - (v - lo) / span) * (h - 16);
  const x = (i: number) => (i / (spy.length - 1)) * w;
  const d = spy.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.close).toFixed(1)}`).join(" ");
  const last = spy[spy.length - 1];
  return (
    <svg viewBox={`0 0 ${w + 56} ${h + 26}`} className="hs-chart" role="img" aria-label={`S&P 500 (SPY) closes from ${shortDate(spy[0].date)} to ${shortDate(last.date)}, between ${price(lo)} and ${price(hi)}`}>
      <line x1="0" y1={y(hi)} x2={w} y2={y(hi)} stroke="rgba(10,11,13,0.08)" />
      <line x1="0" y1={y(lo)} x2={w} y2={y(lo)} stroke="rgba(10,11,13,0.08)" />
      <path d={d} fill="none" stroke="#14161a" strokeWidth="1.6" strokeLinejoin="round" pathLength={100} data-draw="" />
      <circle cx={x(spy.length - 1)} cy={y(last.close)} r="3.5" fill="#009f6f" />
      <text x={w + 10} y={y(hi) + 4} fontSize="13" fill="#59606b" className="mono">{price(hi)}</text>
      <text x={w + 10} y={y(lo) + 4} fontSize="13" fill="#59606b" className="mono">{price(lo)}</text>
      <text x="0" y={h + 22} fontSize="13" fill="#59606b">{shortDate(spy[0].date)}</text>
      <text x={w} y={h + 22} fontSize="13" fill="#59606b" textAnchor="end">{shortDate(last.date)}</text>
    </svg>
  );
}

export function Briefing({ report, today, spy }: { report: Report | null; today: TodaySetup[]; spy: Close[] }) {
  const metrics = report
    ? [
        { label: "Volatility", value: report.volatility },
        { label: "Opportunity", value: report.opportunity },
        { label: "Direction", value: report.direction },
      ]
    : [];
  const spyLast = spy.length > 1 ? spy[spy.length - 1] : null;
  const spyPrev = spy.length > 1 ? spy[spy.length - 2] : null;
  const spyMove = spyLast && spyPrev ? ((spyLast.close - spyPrev.close) / spyPrev.close) * 100 : null;
  return (
    <div className="hs-ui" data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">
          <Mark /> HighStrike terminal
        </span>
        <span className="hs-muted">{report ? `${report.dateLabel} · pre-market report` : "Pre-market report"}</span>
      </div>
      <div className="hs-ui__tabs" aria-hidden="true">
        <span aria-current="page">Briefing</span>
        <span>Scanner</span>
        <span>Setups</span>
        <span>Record</span>
      </div>

      {report && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid var(--hs-ui-line)" }}>
          {metrics.map((m, i) => (
            <div key={m.label} style={{ padding: "16px 18px", borderLeft: i ? "1px solid var(--hs-ui-line)" : undefined }}>
              <div className="hs-ui__label">{m.label}</div>
              <div className="hs-ui__fig" style={{ marginTop: 6 }}>
                {m.value}
                <span className="hs-muted" style={{ fontSize: 13, fontWeight: 400, letterSpacing: 0 }}> /100</span>
              </div>
              <span className="hs-meter" aria-hidden="true">
                <span style={{ width: `${Math.max(2, Math.min(100, m.value))}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {report && (
        <p style={{ margin: 0, padding: "14px 18px", borderBottom: "1px solid var(--hs-ui-line)", color: "#2b2f36" }}>
          {report.summary}
        </p>
      )}

      <table>
        <caption className="sr-only-hs">Today&apos;s setups (entry and target for members)</caption>
        <thead>
          <tr>
            <th scope="col">Setup</th>
            <th scope="col">Side</th>
            <th scope="col" className="right">Flow</th>
            <th scope="col" className="right">Entry · target</th>
          </tr>
        </thead>
        <tbody>
          {today.slice(0, 4).map((s, i) => (
            <tr key={s.ticker} className={i === 0 ? "is-hover" : undefined}>
              <td>
                <span className={i === 0 ? "hs-sel" : undefined} style={{ fontWeight: 600 }}>
                  {s.ticker}
                </span>
              </td>
              <td className={s.direction.toLowerCase() === "short" ? "hs-down" : "hs-up"}>{sideLabel(s.direction)}</td>
              <td className="right mono">{s.flowScore ?? "–"}</td>
              <td className="right">
                <span className="hs-lock">
                  <Lock /> Members
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {spyLast && spyMove != null && (
        <div style={{ padding: "14px 18px 16px", borderTop: "1px solid var(--hs-ui-line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <span className="hs-ui__label">S&amp;P 500 · SPY · {spy.length} sessions</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {price(spyLast.close)} <span className="hs-muted">{signedPct(spyMove)}</span>
            </span>
          </div>
          <SpyChart spy={spy} />
          <div className="hs-ui__label" style={{ marginTop: 6 }}>
            Updated daily
          </div>
        </div>
      )}
    </div>
  );
}

export function WeatherRow({ report }: { report: Report }) {
  const metrics = [
    { label: "Volatility", value: report.volatility },
    { label: "Opportunity", value: report.opportunity },
    { label: "Direction", value: report.direction },
  ];
  return (
    <div className="hs-ui hs-cell__frag" data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Market weather</span>
        <span className="hs-muted">{report.dateLabel}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid var(--hs-ui-line)" }}>
        {metrics.map((m, i) => (
          <div key={m.label} style={{ padding: "16px 18px 20px", borderLeft: i ? "1px solid var(--hs-ui-line)" : undefined }}>
            <div className="hs-ui__label">{m.label}</div>
            <div className="hs-ui__fig" style={{ marginTop: 4 }}>
              {m.value}
            </div>
            <span className="hs-meter" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.min(100, m.value))}%` }} />
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, padding: "14px 18px", color: "#2b2f36" }}>{report.summary}</p>
    </div>
  );
}

export function ScannerSlice({ today, movers, className = "" }: { today: TodaySetup[]; movers: Mover[]; className?: string }) {
  const flow = new Map(today.map((t) => [t.ticker, t]));
  const moves = new Map(movers.map((m) => [m.ticker, m]));
  const names = [...today.map((t) => t.ticker), ...movers.map((m) => m.ticker).filter((t) => !flow.has(t))].slice(0, 6);
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Flow scanner</span>
        <span className="hs-muted">5,400+ symbols</span>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col" className="right">Last</th>
            <th scope="col" className="right">Move</th>
            <th scope="col" className="right">Flow</th>
          </tr>
        </thead>
        <tbody>
          {names.map((t, i) => {
            const m = moves.get(t);
            const s = flow.get(t);
            return (
              <tr key={t} className={i === 0 ? "is-hover" : undefined}>
                <td>
                  <span className={i === 0 ? "hs-sel" : undefined} style={{ fontWeight: 600 }}>
                    {t}
                  </span>
                </td>
                <td className="right mono">{m ? price(m.close) : "–"}</td>
                <td className={`right mono ${m ? (m.changePct >= 0 ? "hs-up" : "hs-down") : ""}`}>{m ? signedPct(m.changePct) : "–"}</td>
                <td className="right mono">{s?.flowScore ?? "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SetupCard({ setup, className = "" }: { setup: ClosedSetup; className?: string }) {
  const move = ((setup.target - setup.entry) / setup.entry) * 100;
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">
          {setup.ticker} <span className={setup.direction.toLowerCase() === "short" ? "hs-down" : "hs-up"}>{sideLabel(setup.direction)}</span>
        </span>
        <span className="hs-muted">Published {shortDate(setup.reportDate)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderBottom: "1px solid var(--hs-ui-line)" }}>
        {[
          { label: "Entry", value: `$${price(setup.entry)}` },
          { label: "Target", value: `$${price(setup.target)}` },
          { label: "Window", value: setup.timeFrame ?? "–" },
        ].map((c, i) => (
          <div key={c.label} style={{ padding: "12px 18px", borderLeft: i ? "1px solid var(--hs-ui-line)" : undefined }}>
            <div className="hs-ui__label">{c.label}</div>
            <div className="mono" style={{ fontSize: "var(--hs-s4)", marginTop: 2 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 18px 16px" }}>
        <div className="hs-ui__label" style={{ marginBottom: 8 }}>
          Entry rules · target {signedPct(move, 1)}
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {setup.criteria.slice(0, 3).map((c) => (
            <li key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ marginTop: 2 }}>
                <Check />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AlertToast({ setup, className = "", style }: { setup: ClosedSetup; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`hs-ui ${className}`} data-ui="" style={style}>
      <div style={{ display: "flex", gap: 12, padding: "14px 16px" }}>
        <span style={{ marginTop: 2 }}>
          <Mark />
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>
            {setup.ticker} {sideLabel(setup.direction).toLowerCase()} · entry rules met
          </div>
          <div className="hs-muted" style={{ marginTop: 2 }}>
            {setup.criteria[0] ?? "Entry rules met"}
          </div>
        </div>
      </div>
    </div>
  );
}

// The alerts tray: entry alerts for the latest setups that went on to hit
// their target, newest first.
export function AlertFeed({ setups, className = "" }: { setups: ClosedSetup[]; className?: string }) {
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Alerts</span>
        <span className="hs-muted">{setups.length} recent</span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {setups.map((s, i) => (
          <li
            key={`${s.ticker}-${s.reportDate}`}
            className={i === 0 ? "is-hover" : undefined}
            style={{
              display: "flex",
              gap: 12,
              padding: "12px 16px",
              borderTop: i ? "1px solid var(--hs-ui-line)" : undefined,
              background: i === 0 ? "#f3f5f1" : undefined,
            }}
          >
            <span style={{ marginTop: 2 }}>
              <Mark />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>
                {s.ticker} {sideLabel(s.direction).toLowerCase()} · entry rules met
              </span>
              <span className="hs-muted" style={{ display: "block", marginTop: 2 }}>
                {s.criteria[0] ?? "Entry rules met"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GradedStamp({ setup, className = "" }: { setup: ClosedSetup; className?: string }) {
  const result = setup.resultPct ?? 0;
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Graded</span>
        <span className="hs-muted">against real prices</span>
      </div>
      <div style={{ padding: "18px 18px 20px", display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontWeight: 600 }}>
            {setup.ticker} {sideLabel(setup.direction).toLowerCase()} · {statusLabel(setup.status)}
          </span>
          <span className={`hs-ui__fig ${result >= 0 ? "hs-up" : "hs-down"}`}>
            {signedPct(result)}
          </span>
        </div>
        <div className="hs-muted">
          Entry ${price(setup.entry)} · target ${price(setup.target)} · published {shortDate(setup.reportDate)}
        </div>
      </div>
    </div>
  );
}

function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function InsiderChatter({ reads, className = "" }: { reads: TickerRead[]; className?: string }) {
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Insiders and chatter</span>
        <span className="hs-muted">30 days · last session</span>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col" className="right">Insider filings</th>
            <th scope="col" className="right">Bullish</th>
          </tr>
        </thead>
        <tbody>
          {reads.map((r, i) => {
            const ins = r.insiders;
            const c = r.chatter;
            const total = c ? c.bullish + c.bearish : 0;
            return (
              <tr key={r.ticker} className={i === 0 ? "is-hover" : undefined}>
                <td>
                  <span className={i === 0 ? "hs-sel" : undefined} style={{ fontWeight: 600 }}>
                    {r.ticker}
                  </span>
                </td>
                <td className="right mono">
                  {ins && ins.sells + ins.buys > 0
                    ? `${ins.sells} sell${ins.sells === 1 ? "" : "s"} · ${ins.buys} buy${ins.buys === 1 ? "" : "s"}`
                    : "None"}
                </td>
                <td className="right mono">{c && total > 0 ? `${Math.round((c.bullish / total) * 100)}% of ${total}` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {reads[0]?.chatter && (
        <div className="hs-muted" style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--hs-ui-line)", fontSize: 13 }}>
          {reads[0].ticker}: {reads[0].chatter.perHour.toFixed(1)} messages an hour, {compact(reads[0].chatter.watchers)} watching
        </div>
      )}
    </div>
  );
}

export function SchoolModules({ className = "" }: { className?: string }) {
  const modules = [
    { title: "Options mechanics", note: "Calls, puts, strikes and expiries", state: "Done" },
    { title: "Trade management", note: "Entries, exits and adjustments", state: "Done" },
    { title: "The risk framework", note: "Sizing behind every setup", state: "In progress" },
    { title: "Trade review", note: "Grade your own execution", state: "Next" },
  ];
  return (
    <div className={`hs-ui ${className}`} data-ui="">
      <div className="hs-ui__bar">
        <span className="hs-ui__title">Trading School</span>
        <span className="hs-muted">4 modules</span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {modules.map((m, i) => (
          <li
            key={m.title}
            className={i === 2 ? "is-hover" : undefined}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "11px 18px",
              borderTop: i ? "1px solid var(--hs-ui-line)" : undefined,
              background: i === 2 ? "#f3f5f1" : undefined,
            }}
          >
            <span>
              <span className={i === 2 ? "hs-sel" : undefined} style={{ fontWeight: 600 }}>
                {m.title}
              </span>
              <span className="hs-muted" style={{ display: "block", fontSize: 13 }}>
                {m.note}
              </span>
            </span>
            <span className={m.state === "Done" ? "hs-up" : "hs-muted"} style={{ fontSize: 13, whiteSpace: "nowrap" }}>
              {m.state}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
