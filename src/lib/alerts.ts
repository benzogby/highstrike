import { fetchQuotes } from "@/lib/quotes";
import { supabaseService } from "@/lib/stripe";
import { SITE_URL, sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

// Price-alert sweep: evaluates active alerts against quotes, fires matches
// into the activity feed and the owner's bell (notify), and emails the owner
// when RESEND_API_KEY is set. Runs every minute while the market's open
// (api/cron/check-alerts), from the morning job, and piggybacks (throttled) on
// member traffic.

const SWEEP_THROTTLE_SECONDS = 120;

export async function recordActivity(
  kind: string,
  message: string,
  opts: { userId?: string; ticker?: string } = {}
) {
  try {
    const service = supabaseService();
    await service.from("activity_events").insert({
      kind,
      message,
      user_id: opts.userId ?? null,
      ticker: opts.ticker ?? null,
    });
  } catch (e) {
    console.error("recordActivity failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * The alert emails' sender (Ben, 2026-11-03: alerts must reliably arrive). mail.highstrike.com is verified on Resend, as
 * for the morning digest and sale alerts. They used RESEND_FROM, which could fall back to Resend's shared test sender
 * (onboarding@resend.dev), and that delivers only to the Resend account's owner.
 */
const ALERTS_FROM = process.env.ALERTS_FROM || "HighStrike Alerts <alerts@mail.highstrike.com>";

async function sendAlertEmail(userId: string, ticker: string, subject: string, body: string) {
  try {
    const service = supabaseService();
    const { data } = await service.auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) return;
    // Through sendMail, so it shows in Admin → Emails like every other email.
    const sent = await sendMail({
      to,
      subject,
      html: "",
      text: `${body}\n\nSee $${ticker}: ${SITE_URL}/symbol/${ticker}\nYour price alerts: ${SITE_URL}/settings\n\nMarket commentary, not investment advice.`,
      from: ALERTS_FROM,
      kind: "price_alert",
    });
    if (!sent.ok) console.error("alert email failed:", sent.error);
  } catch (e) {
    console.error("alert email failed:", e instanceof Error ? e.message : e);
  }
}

/** True when a sweep ran recently (stored in site_settings, service-written). */
async function recentlySwept(): Promise<boolean> {
  const service = supabaseService();
  const { data } = await service
    .from("site_settings")
    .select("value")
    .eq("key", "alerts_last_sweep")
    .maybeSingle();
  if (data?.value) {
    const last = Date.parse(data.value);
    if (Number.isFinite(last) && Date.now() - last < SWEEP_THROTTLE_SECONDS * 1000) {
      return true;
    }
  }
  await service.from("site_settings").upsert({
    key: "alerts_last_sweep",
    value: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return false;
}

export async function checkAlerts(opts: { throttled?: boolean } = {}): Promise<{
  checked: number;
  fired: number;
}> {
  if (opts.throttled && (await recentlySwept())) return { checked: 0, fired: 0 };

  const service = supabaseService();
  const { data: alerts } = await service
    .from("price_alerts")
    .select("id, user_id, ticker, condition, threshold")
    .eq("status", "active")
    .limit(500);
  if (!alerts || alerts.length === 0) return { checked: 0, fired: 0 };

  const quotes = await fetchQuotes([...new Set(alerts.map((a) => a.ticker))]);
  const priceOf = new Map(quotes.filter((q) => q.live).map((q) => [q.symbol, q.price]));
  let fired = 0;

  for (const a of alerts) {
    // Only fire on live prices — sample data must never trigger an alert.
    const price = priceOf.get(a.ticker);
    if (price == null) continue;
    const threshold = Number(a.threshold);
    const hit =
      (a.condition === "above" && price >= threshold) ||
      (a.condition === "below" && price <= threshold);
    if (!hit) continue;

    const { data: updated } = await service
      .from("price_alerts")
      .update({ status: "fired", fired_at: new Date().toISOString(), fired_price: price })
      .eq("id", a.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (!updated) continue; // raced with another sweep

    fired++;
    const message = `$${a.ticker} crossed ${a.condition} $${threshold} — now $${price.toFixed(2)}`;
    // None of the three throws; each failure is only logged.
    await Promise.all([
      recordActivity("alert_fired", message, { userId: a.user_id, ticker: a.ticker }),
      notify(a.user_id, {
        kind: "price_alert",
        title: `$${a.ticker} crossed ${a.condition} $${threshold}`,
        body: `It's at $${price.toFixed(2)} now.`,
        href: `/symbol/${a.ticker}`,
      }),
      sendAlertEmail(a.user_id, a.ticker, `⚡ Alert: ${message}`, message),
    ]);
  }

  return { checked: alerts.length, fired };
}
