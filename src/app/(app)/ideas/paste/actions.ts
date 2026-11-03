"use server";

import { redirect } from "next/navigation";
import { viewer } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { ensureSymbol } from "@/lib/symbols";
import { saveOwnIdea } from "@/lib/ownIdeas";
import { STYLES, type Style } from "@/lib/ideas";

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

  const missing = await ensureSymbol(ticker, { active: false });
  if (missing) return { error: missing };

  const [q] = await fetchQuotes([ticker]).catch(() => []);
  const now = q?.live ? q.price : null;
  const long = d.direction === "long";
  const entry = price(d.entry) ?? now;
  if (entry == null) return { error: `There's no live price for ${ticker} right now. Add the entry price.` };
  const target = price(d.target) ?? +(entry * (long ? 1.1 : 0.9)).toFixed(2);
  const stop = price(d.stop) ?? +(entry * (long ? 0.92 : 1.08)).toFixed(2);
  const contract = d.contract.trim().slice(0, 60) || null;
  const text = d.text.trim().slice(0, 1500);

  const saved = await saveOwnIdea({
    ownerId: v.user.id,
    source: "pasted",
    ticker,
    direction: d.direction,
    style,
    timeFrame: d.timeFrame,
    entry,
    target,
    stop,
    contract,
    expires: /^\d{4}-\d{2}-\d{2}$/.test(d.expiry) ? d.expiry : null,
    headline: `${ticker} ${d.direction}${contract ? ` with the ${contract}` : ""}: ${money(entry)} to ${money(target)}, stop ${money(stop)}`,
    why: text ? `From the alert you pasted: "${text}"` : "Pasted by you.",
  });
  if ("error" in saved) return saved;
  redirect(`/ideas/${saved.id}`);
}
