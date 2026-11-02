"use client";

import { JOIN_EVENT, JOIN_LINK, type JoinIntent } from "./events";

/**
 * A button that opens the homepage's popup (JoinDialog, mounted once on the page). It's a link to /?join=1 underneath,
 * so it still gets there before the page's script has loaded, or with none.
 */
export default function JoinButton({ className, intent = "start", children }: { className?: string; intent?: JoinIntent; children: React.ReactNode }) {
  return (
    <a
      href={JOIN_LINK}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent<JoinIntent>(JOIN_EVENT, { detail: intent }));
      }}
    >
      {children}
    </a>
  );
}
