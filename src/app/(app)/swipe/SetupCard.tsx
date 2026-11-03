import { Badge } from "@/components/ui";
import { STRUCTURES } from "@/lib/options/cards";
import type { DeckCard } from "@/lib/options/deck";

// One setup on the swipe screen (step 2 of the swipe app; Ben 2026-11-02: "Strike prices and stop/take are visualized on
// the screen", "Mini chart + levels"): the stock's recent closes with the strikes, take profit, stop and breakevens drawn
// across them and the profit zone shaded, then the numbers every card shows, and more when opened.

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 1000 ? 0 : 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Level = { y: number; label: string; tone: "strike" | "tp" | "sl" | "be" };

/** Where the setup makes money at expiry, as a price band. */
function profitZone(c: DeckCard): [number, number] | null {
  const [a, b] = c.breakevens;
  if (STRUCTURES[c.structure].kind === "condor" && b != null) return [a, b];
  if (a == null) return null;
  return c.bias === "bull" ? [a, Infinity] : [-Infinity, a];
}

export function MiniChart({ c }: { c: DeckCard }) {
  const W = 340;
  const H = 180;
  const padR = 78;
  const series = [...c.closes.slice(-29), c.spot];
  const levels: Level[] = [
    ...c.legs.map((l) => ({ y: l.strike, label: `${l.side === "sell" ? "−" : "+"}${l.strike}${l.type === "call" ? "C" : "P"}`, tone: "strike" as const })),
    ...c.take_profit.map((y) => ({ y, label: `TP ${usd(y)}`, tone: "tp" as const })),
    ...c.stop_loss.map((y) => ({ y, label: `SL ${usd(y)}`, tone: "sl" as const })),
    ...c.breakevens.map((y) => ({ y, label: `BE ${usd(y)}`, tone: "be" as const })),
  ];
  const all = [...series, ...levels.map((l) => l.y)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo || hi * 0.05) * 0.08;
  const min = lo - pad;
  const max = hi + pad;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const x = (i: number) => (series.length === 1 ? (W - padR) / 2 : (i / (series.length - 1)) * (W - padR - 8) + 4);
  const path = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const zone = profitZone(c);
  const zTop = zone ? y(Math.min(max, zone[1])) : 0;
  const zBot = zone ? y(Math.max(min, zone[0])) : 0;

  // Labels on the right, nudged apart so they never overlap.
  const placed = [...levels].sort((a, b) => y(a.y) - y(b.y)).map((l) => ({ ...l, ly: y(l.y) }));
  for (let i = 1; i < placed.length; i++) if (placed[i].ly - placed[i - 1].ly < 12) placed[i].ly = placed[i - 1].ly + 12;
  // Then from the bottom up, so the lowest label stays inside the chart.
  if (placed.length && placed[placed.length - 1].ly > H - 4) {
    placed[placed.length - 1].ly = H - 4;
    for (let i = placed.length - 2; i >= 0; i--) if (placed[i + 1].ly - placed[i].ly < 12) placed[i].ly = placed[i + 1].ly - 12;
  }
  const tone = { strike: "var(--color-ink-3)", tp: "var(--color-up)", sl: "var(--color-down)", be: "var(--color-accent)" };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${c.ticker} over recent sessions with the setup's levels`}>
      {zone && <rect x={0} y={Math.min(zTop, zBot)} width={W - padR} height={Math.abs(zBot - zTop)} fill="var(--color-up)" opacity={0.08} />}
      {placed.map((l, i) => (
        <g key={`${l.label}-${i}`}>
          <line x1={0} x2={W - padR + 4} y1={y(l.y)} y2={y(l.y)} stroke={tone[l.tone]} strokeWidth={l.tone === "strike" ? 1 : 1.5} strokeDasharray={l.tone === "strike" ? "3 3" : l.tone === "be" ? "1 3" : undefined} opacity={0.9} />
          <text x={W - padR + 8} y={l.ly + 3.5} fontSize={10} fill={tone[l.tone]} className="font-mono-nums">
            {l.label}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={1.75} strokeLinejoin="round" />
      <circle cx={x(series.length - 1)} cy={y(c.spot)} r={3.5} fill="var(--color-ink)" />
    </svg>
  );
}

export default function SetupCard({ c, open }: { c: DeckCard; open: boolean }) {
  const s = STRUCTURES[c.structure];
  const credit = c.net < 0;
  const be = c.breakevens.map((b) => `${usd(b)} (${b >= c.spot ? "+" : ""}${(((b - c.spot) / c.spot) * 100).toFixed(1)}%)`);
  const facts: [string, string][] = [
    [credit ? "Credit" : "Cost", `${whole(Math.abs(c.net) * 100)}`],
    ["Max loss", whole(c.max_loss)],
    ["Max profit", c.max_profit == null ? "Unlimited" : whole(c.max_profit)],
    ["Reward : risk", c.reward_risk != null ? `${c.reward_risk.toFixed(2)} : 1` : "—"],
    [c.breakevens.length > 1 ? "Breakevens" : "Breakeven", be.join(" / ")],
    ["Chance of profit", `${Math.round(c.pop * 100)}%`],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono-nums text-[26px] font-semibold leading-none text-ink">{c.ticker}</p>
          <p className="mt-1 font-mono-nums text-[13px] text-ink-2">{usd(c.spot)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            <Badge tone={c.bias === "bull" ? "up" : c.bias === "bear" ? "down" : "neutral"}>{c.bias === "bull" ? "Bullish" : c.bias === "bear" ? "Bearish" : "Neutral"}</Badge>
            <Badge tone="accent">{s.label}</Badge>
          </div>
          <p className="text-xs text-ink-3">
            Expires {DATE.format(new Date(`${c.expiry}T12:00:00Z`))} · {c.dte}d
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-bg/50 p-2">
        <MiniChart c={c} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {facts.map(([k, v]) => (
          <div key={k} className={k.startsWith("Breakeven") ? "col-span-2" : undefined}>
            <dt className="text-[11px] text-ink-3">{k}</dt>
            <dd className="font-mono-nums text-[15px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{c.why}</p>

      {open && (
        <div className="mt-3 border-t border-line pt-3 text-[13px]">
          <p className="font-medium text-ink">The legs</p>
          <ul className="mt-1 space-y-1 font-mono-nums text-ink-2">
            {c.legs.map((l, i) => (
              <li key={i}>
                {l.side === "buy" ? "Buy" : "Sell"} 1 {c.ticker} {DATE.format(new Date(`${c.expiry}T12:00:00Z`))} {l.strike} {l.type === "call" ? "call" : "put"} @ {usd(l.price)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-ink-2">
            Take profit {c.take_profit.length ? c.take_profit.map(usd).join(" / ") : "while it stays between the short strikes"} · stop {c.stop_loss.map(usd).join(" / ")}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Prices are estimates from the Black-Scholes model at {Math.round(c.vol * 100)}% volatility (from {c.ticker}&apos;s own recent moves), not live quotes. Real fills will differ. Not investment advice.
          </p>
        </div>
      )}
      <p className="mt-auto pt-3 text-center text-[11px] text-ink-3">Estimated prices</p>
    </div>
  );
}
