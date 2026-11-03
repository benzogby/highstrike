import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseService } from "@/lib/stripe";
import { SITE_URL, esc, sendMail } from "@/lib/mail";
import { enrichedScan, etToday, type EnrichedRow } from "@/lib/setupEngine";
import { buildIdeas } from "@/lib/buildIdeas";
import { saveOwnIdea } from "@/lib/ownIdeas";
import { MEMBER_PLANS } from "@/lib/offer";
import { STYLES, type Style } from "@/lib/ideas";
import { asOption, contractShort, usd as optionUsd } from "@/lib/optionIdea";

// The morning, after the engine has written the day's ideas (piece 5 of the trade-ideas plan, Ben 2026-11-02; no AI):
// each member's watchlist is scanned with the idea builder's rules and its best fits become their own private ideas,
// then every member who hasn't switched it off gets one email with the day's ideas and their watchlist's. Run once a day
// by /api/cron/morning-digest.

const money = (n: number) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Ideas from one member's watchlist a morning can add. */
const PER_MEMBER = 3;

type Member = { id: string; email: string | null; digest_email: boolean };

async function members(): Promise<Member[]> {
  const { data } = await supabaseService().from("profiles").select("id, email, digest_email, plan, is_admin").or(`plan.in.(${MEMBER_PLANS.join(",")}),is_admin.eq.true`);
  return (data ?? []) as Member[];
}

/** Each member's watchlist through the builder's rules (either side, swing): their best fits, saved as their own ideas. */
export async function scanWatchlists(rows?: EnrichedRow[]) {
  const db = supabaseService();
  const scan = (rows ?? (await enrichedScan())).filter((r) => r.live);
  const byTicker = new Map(scan.map((r) => [r.ticker, r]));
  const people = await members();
  const { data: lists } = await db.from("watchlists").select("user_id, watchlist_items(ticker)").in("user_id", people.map((p) => p.id));
  const tickersOf = new Map<string, Set<string>>();
  for (const l of (lists ?? []) as { user_id: string; watchlist_items: { ticker: string }[] }[]) {
    const set = tickersOf.get(l.user_id) ?? new Set<string>();
    for (const it of l.watchlist_items ?? []) set.add(it.ticker);
    tickersOf.set(l.user_id, set);
  }
  let saved = 0;
  for (const [userId, tickers] of tickersOf) {
    const mine = [...tickers].map((t) => byTicker.get(t)).filter((r): r is EnrichedRow => !!r);
    if (!mine.length) continue;
    const { data: open } = await db.from("setups").select("ticker").eq("owner_id", userId).eq("source", "watchlist").eq("status", "open");
    const already = new Set(((open ?? []) as { ticker: string }[]).map((o) => o.ticker));
    const fits = buildIdeas(mine, { side: "any", style: "swing", setup: "any", maxPrice: null, insiders: "any", crowd: "any" }, 10)
      .filter((b) => !already.has(b.ticker))
      .slice(0, PER_MEMBER);
    for (const b of fits) {
      const r = await saveOwnIdea({
        ownerId: userId,
        source: "watchlist",
        ticker: b.ticker,
        direction: b.direction,
        style: b.style,
        timeFrame: b.timeFrame,
        entry: b.price,
        target: b.target,
        stop: b.stop,
        headline: `${b.ticker} on your watchlist: ${b.direction} from ${money(b.price)} to ${money(b.target)}`,
        why: `From your watchlist this morning. It stood out because: ${b.reasons.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ")}.`,
      });
      if ("id" in r) saved++;
    }
  }
  return { members: tickersOf.size, saved };
}

/** A signature for a member's one-click unsubscribe link, from a server-only secret, so the link can't be forged. */
function sign(userId: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", `digest:${key}`).update(userId).digest("base64url").slice(0, 32);
}

/** The token the engine's run hands the morning job for the day, so the job runs right after the ideas are written. */
export function morningToken(day: string) {
  return createHmac("sha256", `morning:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).update(day).digest("base64url");
}

export function validMorningToken(day: string, token: string | null) {
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const want = Buffer.from(morningToken(day));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function unsubscribeUrl(userId: string) {
  return `${SITE_URL}/api/digest/unsubscribe?u=${userId}&t=${sign(userId)}`;
}

export function validUnsubscribe(userId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const want = Buffer.from(sign(userId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

type Row = { id: string; ticker: string; direction: string; style: Style; headline: string | null; justification: string; entry_price: number | null; target_price: number | null; time_frame: string; option?: unknown };

/** The idea's option in one short line: "Option: Nov 20 $340 call · est. $8.40 a share". */
const optionText = (r: Row) => {
  const o = asOption(r.option);
  return o ? `Option: ${contractShort(o)} · est. ${optionUsd(o.premium)} a share` : null;
};

const C = { page: "#F6F7F5", card: "#FFFFFF", line: "#E6E8E5", soft: "#EEF0ED", ink: "#0A0D0B", ink2: "#4F5652", ink3: "#7A817D", green: "#009F6F", up: "#0F7B4F", down: "#C2362B" };
const DISPLAY = "'Cal Sans','Inter',Helvetica,Arial,sans-serif";
const BODY = "'Inter',Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";

/** The morning email, in the sale alert's design (src/lib/saleAlert.ts): the day's ideas, then the member's watchlist's. */
export function digestEmail(day: string, house: Row[], mine: Row[], unsubscribe: string) {
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const line = (r: Row) => {
    const head = r.headline?.trim() || r.justification.split(/(?<=\.)\s/)[0];
    const side = r.direction === "long" ? `<span style="color:${C.up}">Long</span>` : `<span style="color:${C.down}">Short</span>`;
    const option = optionText(r);
    return `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.soft}">
<a href="${SITE_URL}/ideas/${r.id}" style="text-decoration:none;color:${C.ink}"><span style="font-family:${MONO};font-size:14px;font-weight:600">${esc(r.ticker)}</span> <span style="font-family:${BODY};font-size:12px;font-weight:500">${side} · ${esc(STYLES[r.style] ?? r.style)}</span><br>
<span style="font-family:${BODY};font-size:14px;line-height:1.45;color:${C.ink2}">${esc(head)}</span><br>
<span style="font-family:${MONO};font-size:12px;color:${C.ink3}">${r.entry_price != null ? money(r.entry_price) : "—"} → ${r.target_price != null ? money(r.target_price) : "—"} · ${esc(r.time_frame)}</span>${
      option ? `<br>\n<span style="font-family:${MONO};font-size:12px;color:${C.ink2}">${esc(option)}</span>` : ""
    }</a></td></tr>`;
  };
  const anyOption = [...house, ...mine].some((r) => optionText(r));
  const block = (title: string, rows: Row[]) =>
    rows.length
      ? `<tr><td style="padding:20px 24px 0"><p style="margin:0;font-family:${DISPLAY};font-size:17px;color:${C.ink}">${title}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.map(line).join("")}</table></td></tr>`
      : "";
  const subject = `${house.length} trade idea${house.length === 1 ? "" : "s"} for ${date.split(",")[0]}${mine.length ? `, ${mine.length} from your watchlist` : ""}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse"><tr><td style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:separate;background:${C.card};border:1px solid ${C.line};border-radius:12px">
<tr><td style="padding:18px 24px;border-bottom:1px solid ${C.line};font-family:${DISPLAY};font-size:16px;color:${C.ink}"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${C.green};vertical-align:-2px;margin-right:8px"></span>HighStrike</td></tr>
<tr><td style="padding:22px 24px 0"><p style="margin:0;font-family:${BODY};font-size:13px;color:${C.ink3}">${esc(date)}</p>
<p style="margin:6px 0 0;font-family:${DISPLAY};font-size:22px;line-height:1.3;color:${C.ink}">This morning&#39;s trade ideas</p></td></tr>
${block("Your watchlist", mine)}${block("Today&#39;s ideas", house)}
<tr><td style="padding:20px 24px 24px"><a href="${SITE_URL}/ideas" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${C.green};color:#FFFFFF;font-family:${BODY};font-size:14px;font-weight:600;text-decoration:none">Open all ideas</a></td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;text-align:center;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.ink3}">Market commentary and education, not investment advice.${anyOption ? " Option prices are estimates (est.) from each stock's own past moves, not live quotes." : ""}<br>
<a href="${unsubscribe}" style="color:${C.ink3}">Stop these emails</a> · you can switch them back on in Settings.</p>
</td></tr></table></body></html>`;
  const withOption = (r: Row, text: string) => (optionText(r) ? `${text}\n  ${optionText(r)}` : text);
  const text = [
    `HighStrike: this morning's trade ideas (${date})`,
    ...(mine.length ? ["", "Your watchlist:", ...mine.map((r) => withOption(r, `- ${r.ticker} ${r.direction}: ${r.headline ?? ""} ${SITE_URL}/ideas/${r.id}`))] : []),
    "",
    "Today's ideas:",
    ...house.map((r) => withOption(r, `- ${r.ticker} ${r.direction}: ${r.headline ?? r.justification.split(". ")[0]} ${SITE_URL}/ideas/${r.id}`)),
    "",
    ...(anyOption ? ["Option prices are estimates (est.) from each stock's own past moves, not live quotes."] : []),
    `All ideas: ${SITE_URL}/ideas`,
    `Stop these emails: ${unsubscribe}`,
  ].join("\n");
  return { subject, html, text };
}

const FROM = process.env.DIGEST_FROM || "HighStrike Ideas <ideas@mail.highstrike.com>";
const COLUMNS = "id, ticker, direction, style, headline, justification, entry_price, target_price, time_frame, option";

/** One email per member who wants it: today's house ideas (the best ten) and their own watchlist ideas from today. */
export async function sendDigests() {
  const db = supabaseService();
  const day = etToday();
  const { data: house } = await db.from("setups").select(COLUMNS).eq("report_date", day).is("owner_id", null).order("flow_score", { ascending: false }).limit(10);
  if (!house?.length) return { day, sent: 0, failed: 0, skipped: "no ideas today" };
  let sent = 0;
  let failed = 0;
  for (const m of await members()) {
    if (!m.digest_email || !m.email) continue;
    const { data: mine } = await db.from("setups").select(COLUMNS).eq("report_date", day).eq("owner_id", m.id).eq("source", "watchlist").limit(PER_MEMBER);
    const unsub = unsubscribeUrl(m.id);
    const r = await sendMail({
      ...digestEmail(day, house as Row[], (mine ?? []) as Row[], unsub),
      to: m.email,
      from: FROM,
      kind: "digest",
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });
    if (r.ok) sent++;
    else failed++;
    // Resend takes a couple of emails a second.
    await new Promise((res) => setTimeout(res, 550));
  }
  return { day, sent, failed };
}
