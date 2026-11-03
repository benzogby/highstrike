"use server";

import { redirect } from "next/navigation";
import { viewer } from "@/lib/membership";
import { fetchQuotes } from "@/lib/quotes";
import { enrichedScan } from "@/lib/setupEngine";
import { PLAN, SETUPS, buildIdeas, type Built, type Want } from "@/lib/buildIdeas";
import { saveOwnIdea } from "@/lib/ownIdeas";
import { STYLES } from "@/lib/ideas";

const money = (n: number) => `$${n.toFixed(2)}`;

/** The checked version of what the form sent: anything unexpected falls back to "any". */
function wantOf(w: Partial<Want>): Want {
  return {
    side: w.side === "long" || w.side === "short" ? w.side : "any",
    style: w.style && w.style in STYLES ? w.style : "swing",
    setup: w.setup && w.setup in SETUPS ? w.setup : "any",
    maxPrice: typeof w.maxPrice === "number" && w.maxPrice > 0 ? w.maxPrice : null,
    insiders: w.insiders === "buying" ? "buying" : "any",
    crowd: w.crowd === "with" || w.crowd === "against" ? w.crowd : "any",
  };
}

/** The ideas that fit, from a fresh scan of the universe. */
export async function findIdeas(w: Partial<Want>): Promise<{ ideas: Built[]; scanned: number } | { error: string }> {
  const v = await viewer();
  if (!v?.member) return { error: "The idea builder is for members." };
  const rows = await enrichedScan().catch(() => null);
  if (!rows) return { error: "The scan couldn't run just now. Try again in a minute." };
  const live = rows.filter((r) => r.live);
  if (!live.length) return { error: "There are no live prices right now, so nothing can be built." };
  return { ideas: buildIdeas(live, wantOf(w)), scanned: live.length };
}

/** Saves one built idea as the member's own, re-pricing it if the stock has moved since, and opens it. */
export async function saveBuilt(b: Built): Promise<{ error: string } | void> {
  const v = await viewer();
  if (!v?.member) return { error: "The idea builder is for members." };
  if (!/^[A-Z.]{1,8}$/.test(b.ticker) || (b.direction !== "long" && b.direction !== "short") || !(b.style in STYLES)) return { error: "That idea didn't come through. Build again." };
  const [q] = await fetchQuotes([b.ticker]).catch(() => []);
  const entry = q?.live ? q.price : b.price;
  const plan = PLAN[b.style];
  const k = b.direction === "long" ? 1 : -1;
  const target = +(entry * (1 + (k * plan.target) / 100)).toFixed(2);
  const stop = +(entry * (1 - (k * plan.stop) / 100)).toFixed(2);
  const saved = await saveOwnIdea({
    ownerId: v.user.id,
    source: "builder",
    ticker: b.ticker,
    direction: b.direction,
    style: b.style,
    timeFrame: plan.timeFrame,
    entry,
    target,
    stop,
    headline: `${b.ticker} ${b.direction}: ${money(entry)} to ${money(target)}, stop ${money(stop)}`,
    why: `Built by you. It matched because: ${b.reasons.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join("; ")}.`,
  });
  if ("error" in saved) return saved;
  redirect(`/ideas/${saved.id}`);
}
