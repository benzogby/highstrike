"use server";

import { redirect } from "next/navigation";
import { viewer } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { supabaseService } from "@/lib/stripe";
import { ensureSymbol } from "@/lib/symbols";
import { etToday } from "@/lib/setupEngine";
import { STYLES, type Style } from "@/lib/ideas";

/** Pasted ideas a member can save in a day. */
const PER_DAY = 20;

export type Draft = {
  text: string;
  ticker: string;
  direction: "long" | "short";
  style: Style;
  timeFrame: string;
  entry: string;
  target: string;
  stop: string;
  contract: string;
  expiry: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;
const price = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Saves a pasted idea as the member's own (owner_id; nobody else sees it), filling what the alert left out from the live
 * price: the entry is the price now, the target 10% and the stop 8% away. Then opens it on its idea page.
 */
export async function savePasted(d: Draft): Promise<{ error: string } | void> {
  const v = await viewer();
  if (!v?.member) return { error: "Ideas are for members." };
  const ticker = d.ticker.trim().toUpperCase().replace(/^\$/, "");
  if (!/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)) return { error: "Add the ticker, like AAPL." };
  if (d.direction !== "long" && d.direction !== "short") return { error: "Pick long or short." };
  const style: Style = d.style in STYLES ? d.style : "swing";

  const db = supabaseService();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("setups").select("id", { count: "exact", head: true }).eq("owner_id", v.user.id).gte("created_at", since);
  if ((count ?? 0) >= PER_DAY) return { error: `That's ${PER_DAY} pasted ideas in a day. Paste more tomorrow.` };

  const missing = await ensureSymbol(ticker, { active: false });
  if (missing) return { error: missing };

  const [q] = await fetchQuotes([ticker]).catch(() => []);
  const now = q?.live ? q.price : null;
  const long = d.direction === "long";
  const entry = price(d.entry) ?? now;
  if (entry == null) return { error: `There's no live price for ${ticker} right now. Add the entry price.` };
  const target = price(d.target) ?? +(entry * (long ? 1.1 : 0.9)).toFixed(2);
  const stop = price(d.stop) ?? +(entry * (long ? 0.92 : 1.08)).toFixed(2);
  if (long ? target <= entry : target >= entry) return { error: `For a ${d.direction}, the target should be ${long ? "above" : "below"} the entry.` };
  if (long ? stop >= entry : stop <= entry) return { error: `For a ${d.direction}, the stop should be ${long ? "below" : "above"} the entry.` };

  const today = etToday();
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(d.expiry) ? d.expiry : null;
  const add = (days: number) => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const expires = expiry ?? (style === "day" ? today : style === "long" ? add(60) : add(14));
  const contract = d.contract.trim().slice(0, 60) || null;
  const text = d.text.trim().slice(0, 1500);

  const { data, error } = await db
    .from("setups")
    .insert({
      report_date: today,
      ticker,
      direction: d.direction,
      source: "pasted",
      style,
      owner_id: v.user.id,
      headline: `${ticker} ${d.direction}${contract ? ` with the ${contract}` : ""}: ${money(entry)} to ${money(target)}, stop ${money(stop)}`,
      justification: text ? `From the alert you pasted: "${text}"` : "Pasted by you.",
      entry_criteria: [`Entry around ${money(entry)}`, `Stop at ${money(stop)}`, ...(contract ? [`Contract: ${contract}`] : [])],
      price_target: money(target),
      time_frame: d.timeFrame.trim().slice(0, 40) || "1-2 weeks",
      flow_score: 50,
      model: "pasted",
      entry_price: entry,
      target_price: target,
      stop_price: stop,
      contract,
      expires_on: expires,
    })
    .select("id")
    .single();
  if (error || !data) return { error: `The idea couldn't be saved: ${error?.message ?? "unknown error"}` };
  redirect(`/ideas/${data.id}`);
}
