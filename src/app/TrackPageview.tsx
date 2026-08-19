"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Fire-and-forget pageview beacon, mounted once in the root layout. Sends one
// tiny POST to /api/track per route change — no external scripts, no cookies.
// Visitor id lives in localStorage; session id rotates after 30 idle minutes.
// Any failure is swallowed: tracking must never affect the visitor.
//
// HUMAN GATE: headless crawlers and uptime monitors execute JS with fresh
// storage per page, so they would register as bursts of one-page "sessions".
// Nothing sends until the visit looks human: navigator.webdriver is false AND
// the visitor either interacts (pointer/key/scroll) or keeps the page visible
// for 4s. Once confirmed, the whole browser session is trusted
// (sessionStorage flag) and every queued + subsequent pageview sends.

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export default function TrackPageview() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);
  const queue = useRef<{ path: string; ref: string; v: string; s: string }[]>([]);
  const human = useRef(false);
  const gateArmed = useRef(false);

  useEffect(() => {
    if (!pathname || pathname === prev.current) return;
    // External referrer on the landing hit; the previous internal path after that.
    const referrer = prev.current || document.referrer || "";
    prev.current = pathname;

    try {
      // Automation (Puppeteer, Playwright, most crawlers) declares itself.
      if (typeof navigator !== "undefined" && navigator.webdriver) return;

      let vid = localStorage.getItem("hs_vid");
      if (!vid) {
        vid = randomId();
        localStorage.setItem("hs_vid", vid);
      }

      const now = Date.now();
      let sid = sessionStorage.getItem("hs_sid");
      const lastSeen = Number(sessionStorage.getItem("hs_sid_t") || 0);
      if (!sid || now - lastSeen > 30 * 60 * 1000) {
        sid = randomId();
        sessionStorage.setItem("hs_sid", sid);
      }
      sessionStorage.setItem("hs_sid_t", String(now));

      const send = async (path: string, ref: string, v: string, s: string) => {
        let uid: string | null = null;
        try {
          const { data } = await supabaseBrowser().auth.getSession();
          uid = data.session?.user?.id || null;
        } catch {
          /* anonymous */
        }
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, referrer: ref, visitorId: v, sessionId: s, userId: uid }),
          keepalive: true,
        }).catch(() => {});
      };

      const flush = () => {
        const q = queue.current;
        queue.current = [];
        q.forEach((it) => send(it.path, it.ref, it.v, it.s));
      };

      if (human.current || sessionStorage.getItem("hs_h") === "1") {
        human.current = true;
        send(pathname, referrer, vid, sid);
        return;
      }

      // Not yet confirmed: queue this view and (once) arm the human gate.
      queue.current.push({ path: pathname, ref: referrer, v: vid, s: sid });
      if (gateArmed.current) return;
      gateArmed.current = true;

      const confirm = () => {
        if (human.current) return;
        human.current = true;
        try {
          sessionStorage.setItem("hs_h", "1");
        } catch {
          /* still confirmed in-memory */
        }
        cleanup();
        flush();
      };
      const onDwell = () => {
        // 4s elapsed: count it only if the tab is actually being looked at;
        // hidden renderers (prefetch, monitors) keep waiting until visible.
        if (document.visibilityState === "visible") confirm();
        else document.addEventListener("visibilitychange", onVisible);
      };
      const onVisible = () => {
        if (document.visibilityState === "visible") setTimeout(() => confirm(), 1500);
      };
      const timer = setTimeout(onDwell, 4000);
      const opts = { once: true, passive: true } as AddEventListenerOptions;
      const events: [string, () => void][] = [
        ["pointerdown", confirm],
        ["keydown", confirm],
        ["wheel", confirm],
        ["touchstart", confirm],
        ["scroll", confirm],
      ];
      events.forEach(([e, h]) => window.addEventListener(e, h, opts));
      const cleanup = () => {
        clearTimeout(timer);
        events.forEach(([e, h]) => window.removeEventListener(e, h));
        document.removeEventListener("visibilitychange", onVisible);
      };
    } catch {
      /* never let tracking throw */
    }
  }, [pathname]);

  return null;
}
