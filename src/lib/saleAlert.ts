import { LIFETIME } from "@/lib/offer";
import { esc, sendMail } from "@/lib/mail";

// The email Ben gets for every $397 purchase (Ben, 2026-11-02: "format an email to ben.zogby@gmail.com like the attached
// every time someone purchases for $397"; then "match this new design system and have the email come from
// payments@mail.highstrike.com"). In the app's design system (Cal.com's dashboard in HighStrike green): a white card with
// hairline borders on a soft grey page, the mark and a "New sale" badge, the buyer and the amount in Cal Sans, quiet
// label/value rows, and a green button to the payment in Stripe. Sent from mail.highstrike.com (verified on Resend,
// scripts/resend.mjs) through src/lib/mail.ts, once per payment (src/lib/lifetime.ts → settleLifetime), and from
// Admin → Overview as a test.

export const SALE_ALERT_TO = process.env.SALE_ALERT_TO || "ben.zogby@gmail.com";
const FROM = process.env.SALE_ALERT_FROM || "HighStrike Payments <payments@mail.highstrike.com>";

/** The app's colours and type (globals.css, light), as email clients take them: inline. */
const C = { page: "#F6F7F5", card: "#FFFFFF", line: "#E6E8E5", soft: "#EEF0ED", ink: "#0A0D0B", ink2: "#4F5652", ink3: "#7A817D", green: "#009F6F", greenSoft: "#E7F5EF", greenInk: "#065F46" };
const DISPLAY = "'Cal Sans','Inter',Helvetica,Arial,sans-serif";
const BODY = "'Inter',Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";

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

/** The subject, the HTML and a plain-text copy of the alert. */
export function saleAlertEmail(sale: Sale) {
  const price = `$${(sale.cents / 100).toLocaleString("en-US", { minimumFractionDigits: sale.cents % 100 ? 2 : 0 })}`;
  const exact = `${(sale.cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })} USD`;
  const when = `${sale.at.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;
  const stripe = `https://dashboard.stripe.com/${sale.live ? "" : "test/"}payments/${encodeURIComponent(sale.paymentIntent)}`;
  const account = sale.created ? "New account" : "Upgraded account";
  const subject = `${sale.test ? "[Test] " : ""}${sale.email} just purchased ${LIFETIME.name} for ${price}`;
  const badge = (text: string, bg: string, color: string) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${bg};color:${color};font-family:${BODY};font-size:12px;font-weight:500;line-height:18px">${text}</span>`;
  const row = (label: string, value: string, last = false) =>
    `<tr><td style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${C.soft};`}font-family:${BODY};font-size:13px;color:${C.ink3}">${label}</td><td align="right" style="padding:11px 0;${last ? "" : `border-bottom:1px solid ${C.soft};`}font-family:${BODY};font-size:13px;color:${C.ink}">${value}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=IBM+Plex+Mono:wght@500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse"><tr><td style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;border-collapse:separate;background:${C.card};border:1px solid ${C.line};border-radius:12px">
${sale.test ? `<tr><td style="padding:10px 24px;background:#FFF6DB;border-radius:12px 12px 0 0;border-bottom:1px solid ${C.line};font-family:${BODY};font-size:12px;color:#6B4E00">A test from Admin: nobody paid.</td></tr>` : ""}
<tr><td style="padding:18px 24px;border-bottom:1px solid ${C.line}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td style="font-family:${DISPLAY};font-size:16px;color:${C.ink}"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${C.green};vertical-align:-2px;margin-right:8px"></span>HighStrike</td>
<td align="right">${badge("New sale", C.greenSoft, C.greenInk)}</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 24px 6px">
<p style="margin:0;font-family:${BODY};font-size:13px;color:${C.ink3}">${LIFETIME.name}</p>
<p style="margin:6px 0 0;font-family:${DISPLAY};font-size:22px;line-height:1.3;color:${C.ink}">${esc(sale.email)} just bought lifetime access</p>
<p style="margin:18px 0 0;font-family:${DISPLAY};font-size:36px;line-height:1;color:${C.ink}">${esc(exact.replace(" USD", ""))} <span style="vertical-align:8px">${badge("Paid", C.greenSoft, C.greenInk)}</span></p>
</td></tr>
<tr><td style="padding:14px 24px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
${row("Buyer", esc(sale.email))}${row("Account", badge(sale.created ? "New account" : "Upgraded", sale.created ? C.greenSoft : C.soft, sale.created ? C.greenInk : C.ink2))}${row("Paid", esc(when))}${row("Payment", `<span style="font-family:${MONO};font-size:12px;color:${C.ink2}">${esc(sale.paymentIntent)}</span>`, true)}
</table>
</td></tr>
<tr><td style="padding:16px 24px 24px"><a href="${stripe}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:${C.green};color:#FFFFFF;font-family:${BODY};font-size:14px;font-weight:600;text-decoration:none">View in Stripe</a></td></tr>
</table>
<p style="max-width:520px;margin:14px auto 0;text-align:center;font-family:${BODY};font-size:12px;color:${C.ink3}">Sent for every ${price} purchase on highstrike.com.</p>
</td></tr></table>
</body></html>`;
  const text = `${sale.test ? "[A test from Admin: nobody paid.]\n\n" : ""}${sale.email} just joined ${LIFETIME.name}.\n\n${price}\n${LIFETIME.name}: ${exact}\n${account} · ${when}\n\nView the payment in Stripe: ${stripe}`;
  return { subject, html, text };
}

/** Sends the alert to SALE_ALERT_TO. Never throws: the reason it didn't go out comes back instead. */
export async function sendSaleAlert(sale: Sale) {
  return sendMail({ ...saleAlertEmail(sale), to: SALE_ALERT_TO, from: FROM, kind: "sale_alert" });
}
