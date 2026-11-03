import { ImageResponse } from "next/og";
import { STRUCTURES, cardsFor } from "@/lib/options/cards";
import { sharedCard, type Shared } from "@/lib/options/share";

// The share image for a saved setup (step 5 of the swipe app): 1200×630, the card as it looks in the app (the ticker, the
// kind of trade, the chart with its levels, the numbers) and highstrike.com, for X, Instagram and messages.

const BG = "#0a0f12";
const PANEL = "#111a1e";
const INK = "#f2f6f4";
const INK2 = "#b4bfba";
const INK3 = "#7d8a85";
const UP = "#1fbf86";
const DOWN = "#ff5d52";
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 1000 ? 0 : 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const s = token === "preview" && process.env.NODE_ENV !== "production" ? previewCard() : await sharedCard(token);
  if (!s) return new Response("Not found", { status: 404 });
  const c = s.card;
  const W = 640;
  const H = 300;
  const series = [...(c.closes ?? []).slice(-29), Number(c.spot)];
  const levels = [
    ...c.legs.map((l) => ({ y: Number(l.strike), color: INK3, label: `${l.side === "sell" ? "−" : "+"}${l.strike}${l.type === "call" ? "C" : "P"}` })),
    ...c.take_profit.map((y) => ({ y: Number(y), color: UP, label: `TP ${usd(Number(y))}` })),
    ...c.stop_loss.map((y) => ({ y: Number(y), color: DOWN, label: `SL ${usd(Number(y))}` })),
  ];
  const all = [...series, ...levels.map((l) => l.y)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo || hi * 0.05) * 0.1;
  const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H;
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * (W - 10) + 5);
  const path = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const facts: [string, string][] = [
    [c.net < 0 ? "Credit" : "Cost", whole(Math.abs(Number(c.net)) * 100)],
    ["Max loss", whole(Number(c.max_loss))],
    ["Max profit", c.max_profit == null ? "Unlimited" : whole(Number(c.max_profit))],
    ["Chance of profit", `${Math.round(Number(c.pop) * 100)}%`],
  ];
  const result = s.status === "win" || s.status === "loss" ? `${s.status === "win" ? "Won" : "Lost"} ${s.pnl != null ? `${s.pnl >= 0 ? "+" : "−"}${whole(Math.abs(s.pnl))}` : ""}` : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: INK, padding: 44, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 700 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontSize: 64, fontWeight: 700 }}>{c.ticker}</span>
            <span style={{ fontSize: 28, color: c.bias === "bull" ? UP : c.bias === "bear" ? DOWN : INK2 }}>{STRUCTURES[c.structure]?.label ?? c.structure}</span>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: INK2, marginTop: 4 }}>
            {usd(Number(c.spot))} · expires {new Date(`${c.expiry}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
          </div>
          <div style={{ display: "flex", marginTop: 24, background: PANEL, borderRadius: 18, padding: 16, position: "relative" }}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              {levels.map((l, i) => (
                <line key={i} x1={0} x2={W} y1={y(l.y)} y2={y(l.y)} stroke={l.color} strokeWidth={2} strokeDasharray={l.color === INK3 ? "6 6" : undefined} />
              ))}
              <path d={path} fill="none" stroke={INK} strokeWidth={3} />
              <circle cx={x(series.length - 1)} cy={y(Number(c.spot))} r={7} fill={INK} />
            </svg>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 40, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
            {result && <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: s.status === "win" ? UP : DOWN }}>{result}</div>}
            {facts.map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, color: INK3 }}>{k}</span>
                <span style={{ fontSize: 34, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: UP }}>highstrike.com</span>
            <span style={{ fontSize: 18, color: INK3 }}>Swipe options setups. Estimated prices.</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=600" } }
  );
}

/** Development only: a sample saved card, to check the image without the database. */
function previewCard(): Shared {
  const c = cardsFor({ ticker: "NVDA", spot: 204.64, vol: 0.48, changePct: 3.1, rangePos: 0.85, mom5: 4.2 }, 1, new Date())[0];
  const closes = Array.from({ length: 30 }, (_, i) => +(185 * (1 + 0.0035 * i + 0.02 * Math.sin(i / 2))).toFixed(2));
  return {
    card: { ...c, id: "preview", max_profit: c.maxProfit, max_loss: c.maxLoss, reward_risk: c.rewardRisk, take_profit: c.takeProfit, stop_loss: c.stopLoss, tier: 1, closes, crowd: null },
    status: "win",
    pnl: 612,
    savedAt: new Date().toISOString(),
  };
}
