// Email from highstrike.com, through Resend (resend.com). HighStrike's sending domain was verified on Resend on
// 2026-11-02 (scripts/resend.mjs): before that the account (newhighstrike@gmail.com) could only write to itself. The key is
// RESEND_API_KEY on Vercel. Never throws: the reason a message didn't go out comes back instead.

import { after } from "next/server";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.highstrike.com").replace(/\/$/, "");

/** The everyday sender, for buyers. */
export const MAIL_FROM = process.env.MAIL_FROM || "HighStrike <hello@highstrike.com>";

/** `kind`: what sent it, for Admin → Emails ("sale_alert", "payment", "price_alert"). */
export type Mail = { to: string; subject: string; html: string; text: string; from?: string; kind?: string };

/** A sign-in link or a code in it: Admin → Emails keeps the subject but not the words (as getripping.com's does). */
const SECRET_LINK = /token_hash=|[?&]token=|access_token|[?&]code=|one-time code/i;

/**
 * Every email to Admin → Emails' log (email_log, supabase/migrations/20261102233000_admin_logs.sql), sent or not.
 * Never in the way of the email: a failure to log is only logged.
 */
async function logMail(mail: Mail, from: string, status: "sent" | "failed", error: string | null, resendId: string | null) {
  try {
    const { supabaseService } = await import("@/lib/stripe");
    const html = mail.html || `<pre>${esc(mail.text)}</pre>`;
    const { error: failed } = await supabaseService()
      .from("email_log")
      .insert({
        to_address: mail.to,
        from_address: from,
        subject: mail.subject.slice(0, 300),
        kind: mail.kind ?? null,
        html: SECRET_LINK.test(html) ? null : html.slice(0, 200_000),
        status,
        error: error?.slice(0, 500) ?? null,
        resend_id: resendId,
      });
    if (failed) console.error("email log:", failed.message);
  } catch (e) {
    console.error("email log:", e instanceof Error ? e.message : e);
  }
}

export async function sendMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const from = mail.from ?? MAIL_FROM;
  const result = await deliver(mail, from);
  // Logged after the answer goes back (next/server's after), so the log never delays or fails a send; outside a
  // request, where after() can't run, it's written in the background.
  const log = () => logMail(mail, from, result.ok ? "sent" : "failed", result.ok ? null : result.error, result.ok ? result.id : null);
  try {
    after(log);
  } catch {
    void log();
  }
  return result.ok ? { ok: true } : result;
}

async function deliver(mail: Mail, from: string): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY isn't set on Vercel, so the server can't send email." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, ...(mail.html ? { html: mail.html } : {}), text: mail.text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
    if (res.ok) return { ok: true, id: body.id ?? null };
    return { ok: false, error: `Resend said ${res.status}: ${String(body.message ?? body.error ?? "no reason given").slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Resend: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
