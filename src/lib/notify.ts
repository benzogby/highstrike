import { supabaseService } from "@/lib/stripe";

// The in-app bell's side of telling a member something (Ben, 2026-11-03: alerts by email and an in-app bell). Any
// server feature calls notify(); the top bar's bell (src/components/NotificationBell.tsx) shows the latest with an
// unread count. Rows live in public.notifications (supabase/migrations/20261103160000_notifications.sql), which only
// the service key can write.

export type Notice = {
  /** What sent it, for telling kinds apart later: "price_alert", ... */
  kind: string;
  /** One short line, like "$NVDA crossed above $190". */
  title: string;
  /** A second line, if there's more to say. */
  body?: string | null;
  /** Where tapping it goes: a path inside HighStrike, like "/symbol/NVDA". Anything else is dropped. */
  href?: string | null;
};

/** A path on this site only (one leading slash), never another site's address. */
const insidePath = (href?: string | null) => (href && /^\/(?![/\\])/.test(href) ? href.slice(0, 300) : null);

/**
 * Puts a notification in a member's bell. Never throws and never holds up what sent it: a failure is logged and
 * answered with false.
 */
export async function notify(userId: string, n: Notice): Promise<boolean> {
  try {
    const { error } = await supabaseService()
      .from("notifications")
      .insert({
        user_id: userId,
        kind: n.kind.slice(0, 40),
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000) || null,
        href: insidePath(n.href),
      });
    if (error) {
      console.error("notify failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("notify failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
