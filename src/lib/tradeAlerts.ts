import { supabaseService } from "@/lib/stripe";
import { fetchQuotes } from "@/lib/quotes";
import { SITE_URL, esc, sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { TRADE_COLUMNS, levelHit, money, tradeName, type Trade } from "@/lib/trades";

// A tracked trade reached its target or its stop (Ben, 2026-11-03: alerts by email and the in-app bell; trades from
// "I took this" and My trades, src/lib/trades.ts). Each trade alerts once, on a live price only: the stock's price
// against the levels it watches (an option's too: its levels are the stock's). Swept on member traffic at most every
// two minutes (/api/quotes, as price alerts are) and by the morning job.

const FROM = "HighStrike Alerts <alerts@mail.highstrike.com>";
const SWEEP_KEY = "trades_last_sweep";
const SWEEP_SECONDS = 120;

/** True when a sweep ran in the last two minutes; otherwise it claims this one. */
async function sweptRecently() {
  const db = supabaseService();
  const { data } = await db.from("site_settings").select("value").eq("key", SWEEP_KEY).maybeSingle();
  const last = data?.value ? Date.parse(data.value) : NaN;
  if (Number.isFinite(last) && Date.now() - last < SWEEP_SECONDS * 1000) return true;
  const now = new Date().toISOString();
  await db.from("site_settings").upsert({ key: SWEEP_KEY, value: now, updated_at: now });
  return false;
}

type Hit = { trade: Trade & { user_id: string }; level: "target" | "stop"; price: number };

/** The alert's words: subject, plain text and HTML. */
function alertEmail({ trade, level, price }: Hit) {
  const name = tradeName(trade);
  const watched = level === "target" ? Number(trade.target) : Number(trade.stop);
  const subject = level === "target" ? `${trade.ticker} reached your target` : `${trade.ticker} hit your stop`;
  const lead =
    level === "target"
      ? `${trade.ticker} is at ${money(price)}, past the ${money(watched)} target you were watching for ${name}.`
      : `${trade.ticker} is at ${money(price)}, past the ${money(watched)} stop you set for ${name}.`;
  const next = level === "target" ? "Close it in My trades when you take profit, or let it run." : "Close it in My trades when you get out.";
  const open = `${SITE_URL}/journal`;
  const html = `<div style="margin:0;padding:28px 16px;background:#ffffff;font-family:Inter,Helvetica,Arial,sans-serif;color:#14161a">
<div style="max-width:480px;margin:0 auto">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#009f6f">HighStrike</p>
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">${esc(subject)}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${esc(lead)} ${esc(next)}</p>
<p style="margin:8px 0 24px"><a href="${open}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#009f6f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">Open My trades</a></p>
<p style="margin:0;font-size:13px;line-height:1.55;color:#4a5160">You get this because you're tracking this trade in My trades. Market commentary, not investment advice.</p>
</div>
</div>`;
  const text = `${subject}\n\n${lead} ${next}\n\nOpen My trades: ${open}\n\nYou get this because you're tracking this trade in My trades. Market commentary, not investment advice.`;
  return { subject, html, text, lead };
}

/**
 * Checks every open trade that watches a level and hasn't alerted yet, against live prices, and alerts each one that
 * got there, once (`alerted` is claimed before sending): an email and a notice in the member's bell (src/lib/notify.ts).
 */
export async function checkTrades(opts: { throttled?: boolean } = {}) {
  if (opts.throttled && (await sweptRecently())) return { checked: 0, alerted: 0 };
  const db = supabaseService();
  const { data } = await db
    .from("trades")
    .select(`${TRADE_COLUMNS}, user_id`)
    .eq("status", "open")
    .is("alerted", null)
    .or("target.not.is.null,stop.not.is.null")
    .limit(2000);
  const trades = (data ?? []) as (Trade & { user_id: string })[];
  if (!trades.length) return { checked: 0, alerted: 0 };
  const quotes = await fetchQuotes([...new Set(trades.map((t) => t.ticker))]);
  const spot = new Map(quotes.filter((q) => q.live).map((q) => [q.symbol, q.price]));
  const hits: Hit[] = [];
  for (const trade of trades) {
    const price = spot.get(trade.ticker);
    const level = price != null ? levelHit(trade, price) : null;
    if (price != null && level) hits.push({ trade, level, price });
  }
  if (!hits.length) return { checked: trades.length, alerted: 0 };

  const { data: people } = await db.from("profiles").select("id, email").in("id", [...new Set(hits.map((h) => h.trade.user_id))]);
  const emailOf = new Map(((people ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));
  let alerted = 0;
  for (const hit of hits) {
    const { data: claimed } = await db.from("trades").update({ alerted: hit.level }).eq("id", hit.trade.id).is("alerted", null).select("id");
    if (!claimed?.length) continue;
    alerted++;
    const words = alertEmail(hit);
    const to = emailOf.get(hit.trade.user_id);
    if (to) {
      const sent = await sendMail({ to, from: FROM, subject: words.subject, html: words.html, text: words.text, kind: "trade_alert" });
      if (!sent.ok) console.error(`trade alert ${hit.trade.id} didn't go out:`, sent.error);
    }
    await notify(hit.trade.user_id, { kind: "trade_alert", title: words.subject, body: words.lead, href: "/journal" });
  }
  return { checked: trades.length, alerted };
}
