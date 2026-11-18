"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/membership";
import { saveOwnIdea } from "@/lib/ownIdeas";
import { STYLES, type Style } from "@/lib/ideas";
import { etToday } from "@/lib/setupEngine";
import { planEndOf } from "@/lib/planner";

// Save a Trade Planner plan (src/app/(app)/plan/Planner.tsx) as one of the member's own ideas (source "planner"), so it's
// followed to its target, stop or end like every idea, and set its alerts. The grade comes from the member's own screen
// and is only shown back to them.

type Input = {
  ticker: string;
  side: "long" | "short";
  style: Style;
  entry: number;
  stop: number;
  target: number;
  holdDays: number;
  option: { type: "call" | "put"; strike: number; expiry: string } | null;
  quantity: number;
  letter: string;
  score: number;
  reasons: string[];
  alerts: boolean;
};

const money = (n: number) => `$${n.toFixed(2)}`;
const pos = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1e7;

export async function savePlan(p: Input): Promise<{ error: string } | void> {
  const { supabase, user } = await requireMember("/plan");
  if (!/^[A-Z][A-Z0-9.]{0,7}$/.test(p.ticker) || (p.side !== "long" && p.side !== "short") || !(p.style in STYLES)) return { error: "That plan didn't come through. Try again." };
  if (!pos(p.entry) || !pos(p.stop) || !pos(p.target)) return { error: "Enter an entry, a stop and a target." };
  if (!["A", "B", "C", "D", "F"].includes(p.letter)) return { error: "That plan has no grade yet." };
  const hold = Math.max(1, Math.min(250, Math.round(p.holdDays)));
  const today = etToday();
  const end = planEndOf(today, hold);
  const o =
    p.option && (p.option.type === "call" || p.option.type === "put") && pos(p.option.strike) && /^\d{4}-\d{2}-\d{2}$/.test(p.option.expiry) && p.option.expiry >= today ? p.option : null;
  const qty = Math.max(0, Math.min(100_000, Math.floor(p.quantity || 0)));
  const size = qty ? (o ? `${qty} contract${qty === 1 ? "" : "s"}` : `${qty} share${qty === 1 ? "" : "s"}`) : null;
  const contract = o ? `${o.strike}${o.type === "call" ? "C" : "P"} ${o.expiry.slice(5, 7)}/${o.expiry.slice(8, 10)}` : null;
  const reasons = (Array.isArray(p.reasons) ? p.reasons : []).filter((r) => typeof r === "string").slice(0, 10).map((r) => r.slice(0, 300));
  const score = Math.max(0, Math.min(100, Math.round(p.score)));

  const saved = await saveOwnIdea({
    ownerId: user.id,
    source: "planner",
    ticker: p.ticker,
    direction: p.side,
    style: p.style,
    timeFrame: hold === 1 ? "Today" : `${hold} days`,
    entry: p.entry,
    target: p.target,
    stop: p.stop,
    contract,
    expires: o ? o.expiry : end,
    headline: `${p.ticker} ${p.side} plan, grade ${p.letter}: ${money(p.entry)} to ${money(p.target)}, stop ${money(p.stop)}`,
    why: `Planned by you in the Trade Planner. Grade ${p.letter} (${score}/100)${size ? `, sized at ${size}` : ""}.\n\n${reasons.join("\n")}`,
    rules: [
      `Entry around ${money(p.entry)}`,
      `Stop at ${money(p.stop)}`,
      `Target ${money(p.target)}`,
      ...(contract ? [`Contract: ${contract}${size ? `, ${size}` : ""}`] : size ? [`Size: ${size}`] : []),
    ],
  });
  if ("error" in saved) return saved;

  if (p.alerts) {
    const long = p.side === "long";
    await supabase.from("price_alerts").insert([
      { user_id: user.id, ticker: p.ticker, condition: long ? "above" : "below", threshold: p.target },
      { user_id: user.id, ticker: p.ticker, condition: long ? "below" : "above", threshold: p.stop },
    ]);
  }
  redirect(`/ideas/${saved.id}`);
}
