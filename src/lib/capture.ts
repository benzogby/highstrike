import { supabaseService } from "@/lib/stripe";

// Admin → Errors' record (ported from getripping.com's lib/capture.ts, 2026-11-02): an error a page, a route or a
// browser reported, written to error_reports. Fire-and-forget: never throws, never blocks. Anything key-shaped is cut out
// before it's written, since a provider's own error text can carry one.

const SECRET = /\b(sk_live|sk_test|rk_live|rk_test|pk_live|whsec|sk-ant-api\d\d|sk-proj|sk-|re_|github_pat_|ghp_|xox[baprs])[-_A-Za-z0-9]{6,}/g;
const JWTISH = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
export const scrub = (s: string) => s.replace(SECRET, (m) => `${m.slice(0, 7)}…[redacted]`).replace(JWTISH, "[redacted jwt]");

type Capture = { source?: "server" | "route" | "client"; path?: string | null; digest?: string | null; userId?: string | null };

export async function captureError(err: unknown, opts: Capture = {}) {
  const message = scrub(err instanceof Error ? err.message : String(err));
  const stack = err instanceof Error && err.stack ? scrub(err.stack) : null;
  try {
    const { error } = await supabaseService()
      .from("error_reports")
      .insert({
        source: opts.source ?? "server",
        message: message.slice(0, 2000) || "(no message)",
        stack: stack?.slice(0, 8000) ?? null,
        path: opts.path?.slice(0, 300) ?? null,
        digest: opts.digest ? scrub(opts.digest).slice(0, 100) : null,
        user_id: opts.userId ?? null,
      });
    if (error) console.error("[capture] insert:", error.message);
  } catch (e) {
    console.error("[capture]", e instanceof Error ? e.message : e);
  }
}
