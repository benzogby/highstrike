import type { CSSProperties, ReactNode } from "react";
import { price, sideLabel } from "@/components/landing/Pieces";

// The homepage's phones (Ben, 2026-11-03: "add a section for mobile app like getripping.com has"): HighStrike as it
// opens from the home screen, drawn in the app's own dark system (#0a0f12, the panel ladder, HighStrike green) with
// the page's real data where it has some. Styles under "Phones" in landing.css.

export type PhoneIdea = { ticker: string; direction: string; score: number | null; last: number | null; closes: number[] };
export type PhoneModule = { name: string; eyebrow: string; lessons: number; art: string | null };

function Phone({ children, className = "", style, label }: { children: ReactNode; className?: string; style?: CSSProperties; label?: string }) {
  return (
    <div className={`hs-phone ${className}`} style={style} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <div className="hs-phone__screen">
        <div className="hs-phone__status">
          <b>9:41</b>
          <span className="hs-phone__island" />
          <span className="hs-phone__icons">
            <i />
            <i />
            <i />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Spark({ closes, up }: { closes: number[]; up: boolean }) {
  if (closes.length < 2) return null;
  const lo = Math.min(...closes), hi = Math.max(...closes), span = hi - lo || 1;
  const d = closes.map((c, i) => `${i ? "L" : "M"}${((i / (closes.length - 1)) * 100).toFixed(1)} ${(36 - ((c - lo) / span) * 32).toFixed(1)}`).join(" ");
  return (
    <svg className={`hs-ph-spark ${up ? "is-up" : "is-dn"}`} viewBox="0 0 100 40" preserveAspectRatio="none">
      <path d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TabBar({ on }: { on: "ideas" | "scanner" | "school" | "alerts" }) {
  return (
    <nav className="hs-ph-tabs">
      {(["ideas", "scanner", "school", "alerts"] as const).map((t) => (
        <span key={t} className={t === on ? "is-on" : undefined}>
          <i />
          {t[0].toUpperCase() + t.slice(1)}
        </span>
      ))}
    </nav>
  );
}

const isShort = (d: string) => d.toLowerCase() === "short";

/** The idea feed: this morning's ideas, each with its side, its score and its last close. */
export function IdeasPhone({ ideas, day, className, style }: { ideas: PhoneIdea[]; day: string; className?: string; style?: CSSProperties }) {
  return (
    <Phone className={className} style={style}>
      <div className="hs-ph-body">
        <p className="hs-ph-eyebrow">{day}</p>
        <h4 className="hs-ph-title">Ideas</h4>
        <div className="hs-ph-chips">
          <span className="is-on">All</span>
          <span>Long</span>
          <span>Short</span>
          <span>Swing</span>
        </div>
        <div className="hs-ph-list">
          {ideas.slice(0, 5).map((i) => (
            <div key={i.ticker} className="hs-ph-idea">
              <div className="hs-ph-idea__top">
                <b>{i.ticker}</b>
                <span className={`hs-ph-side ${isShort(i.direction) ? "is-short" : ""}`}>{sideLabel(i.direction)}</span>
                <span className="hs-ph-idea__px">{i.last != null ? price(i.last) : ""}</span>
              </div>
              <div className="hs-ph-idea__row">
                <span className="hs-ph-meter">
                  <i style={{ width: `${i.score ?? 50}%` }} />
                </span>
                <Spark closes={i.closes} up={!isShort(i.direction)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar on="ideas" />
    </Phone>
  );
}

/** One idea opened: its chart, the bull and bear case, and the sizer. */
export function IdeaPhone({ idea, className, style }: { idea: PhoneIdea; className?: string; style?: CSSProperties }) {
  const short = isShort(idea.direction);
  return (
    <Phone className={className} style={style}>
      <div className="hs-ph-body">
        <p className="hs-ph-back">‹ Ideas</p>
        <div className="hs-ph-head">
          <h4 className="hs-ph-title">{idea.ticker}</h4>
          <span className={`hs-ph-side ${short ? "is-short" : ""}`}>{sideLabel(idea.direction)}</span>
        </div>
        <p className="hs-ph-px">{idea.last != null ? `$${price(idea.last)}` : ""}</p>
        <div className="hs-ph-chart">
          <Spark closes={idea.closes} up={!short} />
        </div>
        <div className="hs-ph-case">
          <div>
            <h5 className="is-bull">Bull case</h5>
            <p>Trend and volume agree</p>
          </div>
          <div>
            <h5 className="is-bear">Bear case</h5>
            <p>Stretched from its average</p>
          </div>
        </div>
        <div className="hs-ph-size">
          <span>Size it</span>
          <b>2 contracts · 1% risk</b>
        </div>
      </div>
      <TabBar on="ideas" />
    </Phone>
  );
}

/** HighStrike Trading School: the module in progress and what's next. */
export function SchoolPhone({ modules, className, style }: { modules: PhoneModule[]; className?: string; style?: CSSProperties }) {
  const [now, ...next] = modules;
  return (
    <Phone className={className} style={style}>
      <div className="hs-ph-body">
        <p className="hs-ph-eyebrow">Trading School</p>
        <h4 className="hs-ph-title">Keep going</h4>
        {now && (
          <div className="hs-ph-module">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {now.art && <img src={now.art} alt="" loading="lazy" width={480} height={270} />}
            <div className="hs-ph-module__tx">
              <span>{now.eyebrow}</span>
              <b>{now.name}</b>
              <span className="hs-ph-meter">
                <i style={{ width: "62%" }} />
              </span>
            </div>
          </div>
        )}
        <div className="hs-ph-lessons">
          {next.slice(0, 3).map((m) => (
            <div key={m.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.art ? <img src={m.art} alt="" loading="lazy" width={96} height={54} /> : <i />}
              <span>
                <b>{m.name}</b>
                {m.lessons} lessons
              </span>
            </div>
          ))}
        </div>
      </div>
      <TabBar on="school" />
    </Phone>
  );
}

/** The scanner: each name with its five-day move, its score and its lean, as the Scanner page lists them. */
export function ScannerPhone({ ideas, className, style }: { ideas: PhoneIdea[]; className?: string; style?: CSSProperties }) {
  return (
    <Phone className={className} style={style}>
      <div className="hs-ph-body">
        <p className="hs-ph-eyebrow">Smart scanner</p>
        <h4 className="hs-ph-title">Scanner</h4>
        <div className="hs-ph-scan">
          <div className="hs-ph-scan__head">
            <span>Ticker</span>
            <span>5d</span>
            <span>Score</span>
            <span>Bias</span>
          </div>
          {ideas.slice(0, 7).map((i) => {
            const c = i.closes;
            const five = c.length > 5 ? ((c[c.length - 1] - c[c.length - 6]) / c[c.length - 6]) * 100 : null;
            return (
              <div key={i.ticker} className="hs-ph-scan__row">
                <b>{i.ticker}</b>
                <span className={five == null ? undefined : five >= 0 ? "hs-up" : "hs-dn"}>{five == null ? "–" : `${five >= 0 ? "+" : ""}${five.toFixed(1)}%`}</span>
                <span>{i.score ?? "–"}</span>
                <span className={isShort(i.direction) ? "hs-dn" : "hs-up"}>{sideLabel(i.direction)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <TabBar on="scanner" />
    </Phone>
  );
}

/** The home screen, with HighStrike in the middle of it. */
export function HomePhone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Phone className={`hs-phone--home ${className ?? ""}`} style={style}>
      <div className="hs-ph-home">
        {Array.from({ length: 16 }, (_, i) =>
          i === 9 ? (
            <span key={i} className="hs-ph-app is-hs">
              <i>
                <span className="hs-bull" />
              </i>
              HighStrike
            </span>
          ) : (
            <span key={i} className="hs-ph-app">
              <i />
            </span>
          ),
        )}
      </div>
      <div className="hs-ph-dockbar">
        <i />
        <i />
        <i />
        <i />
      </div>
    </Phone>
  );
}
