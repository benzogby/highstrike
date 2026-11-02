import { LIFETIME } from "@/lib/offer";

// The email Ben gets for every $397 purchase (Ben, 2026-11-02: "format an email to ben.zogby@gmail.com like the attached
// every time someone purchases for $397"). He picked the classic layout, after HighStrike's 2021 Trading School sale
// email: a grey-blue band with "<buyer> just joined", the price large, then the line item over a dashed rule. Sent through
// Resend like the price alerts (RESEND_API_KEY), once per payment (src/lib/lifetime.ts → settleLifetime), and from
// Admin → Overview as a test.

export const SALE_ALERT_TO = process.env.SALE_ALERT_TO || "ben.zogby@gmail.com";
const FROM = process.env.SALE_ALERT_FROM || process.env.RESEND_FROM || "Ben from HighStrike <onboarding@resend.dev>";

export type Sale = {
  /** The buyer: the email the account is under (the checkout asks for no name). */
  email: string;
  /** The payment made the account (rather than upgrading one). */
  created: boolean;
  cents: number;
  at: Date;
  paymentIntent: string;
  /** A live-mode payment (the Stripe link goes to test mode otherwise). */
  live: boolean;
  /** Admin → Overview's test: nobody paid. */
  test?: boolean;
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** The subject, the HTML and a plain-text copy of the alert. */
export function saleAlertEmail(sale: Sale) {
  const price = `$${(sale.cents / 100).toLocaleString("en-US", { minimumFractionDigits: sale.cents % 100 ? 2 : 0 })}`;
  const exact = `${(sale.cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} USD`;
  const when = `${sale.at.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;
  const stripe = `https://dashboard.stripe.com/${sale.live ? "" : "test/"}payments/${encodeURIComponent(sale.paymentIntent)}`;
  const account = sale.created ? "New account" : "Upgraded account";
  const subject = `${sale.test ? "[Test] " : ""}${sale.email} just purchased ${LIFETIME.name} for ${price}`;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#757c88">${label}</td><td align="right" style="padding:6px 0;font-size:14px;color:#14161a">${value}</td></tr>`;
  const html = `<div style="margin:0;padding:24px 12px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#14161a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse">
${sale.test ? `<tr><td style="padding:10px 16px;background:#fff4d6;color:#6b4e00;font-size:13px;text-align:center">A test from Admin: nobody paid.</td></tr>` : ""}
<tr><td style="background:#c7d1d3;padding:44px 28px;text-align:center">
<div style="font-size:15px;font-weight:700;color:#1f2a2c;letter-spacing:.01em">HighStrike</div>
<div style="margin-top:28px;font-size:30px;line-height:1.35;color:#14161a">${esc(sale.email)} just joined ${LIFETIME.name}</div>
</td></tr>
<tr><td style="padding:40px 28px 4px;text-align:center;font-size:54px;font-weight:300;line-height:1;color:#14161a">${price}</td></tr>
<tr><td style="padding:32px 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="font-size:15px;color:#4a5160">${LIFETIME.name}</td><td align="right" style="font-size:15px;color:#4a5160">${exact}</td></tr>
</table>
<div style="margin:18px 0 10px;border-top:1px dashed #c3c8cf;line-height:0;font-size:0">&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${row("Account", account)}${row("Paid", esc(when))}
</table>
</td></tr>
<tr><td style="padding:28px 28px 8px;text-align:center"><a href="${stripe}" style="color:#009f6f;font-size:14px;font-weight:600;text-decoration:none">View the payment in Stripe</a></td></tr>
</table>
</div>`;
  const text = `${sale.test ? "[A test from Admin: nobody paid.]\n\n" : ""}${sale.email} just joined ${LIFETIME.name}.\n\n${price}\n${LIFETIME.name}: ${exact}\n${account} · ${when}\n\nView the payment in Stripe: ${stripe}`;
  return { subject, html, text };
}

/** Sends the alert to SALE_ALERT_TO. Never throws: the reason it didn't go out comes back instead. */
export async function sendSaleAlert(sale: Sale): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY isn't set on Vercel, so the server can't send email." };
  const { subject, html, text } = saleAlertEmail(sale);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [SALE_ALERT_TO], subject, html, text }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return { ok: false, error: `Resend said ${res.status}: ${String(body.message ?? body.error ?? "no reason given").slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Resend: ${e instanceof Error ? e.message : String(e)}` };
  }
}
