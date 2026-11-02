// Email from highstrike.com, through Resend (resend.com). HighStrike's sending domain was verified on Resend on
// 2026-11-02 (scripts/resend.mjs): before that the account (newhighstrike@gmail.com) could only write to itself. The key is
// RESEND_API_KEY on Vercel. Never throws: the reason a message didn't go out comes back instead.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.highstrike.com").replace(/\/$/, "");

/** The everyday sender, for buyers. */
export const MAIL_FROM = process.env.MAIL_FROM || "HighStrike <hello@highstrike.com>";

export type Mail = { to: string; subject: string; html: string; text: string; from?: string };

export async function sendMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY isn't set on Vercel, so the server can't send email." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mail.from ?? MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return { ok: false, error: `Resend said ${res.status}: ${String(body.message ?? body.error ?? "no reason given").slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Resend: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
