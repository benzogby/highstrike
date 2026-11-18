"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The frame's few colours. HighStrike is dark only, but mail is written for a white page (a newsletter's black text, a
 * receipt's grey table), so a message sits on a white sheet with dark ink, as Gmail shows rich mail in its dark theme.
 */
const PAPER = { ink: "#1f1f1f", link: "#0b57d0", chip: "#e8eaed", chipInk: "#5f6368", rule: "#dadce0" };

/**
 * The frame's document. Its Content-Security-Policy comes first, before anything of the sender's: pictures from this
 * mailbox's files only, and from this server's picture fetcher once Show images is on; inline styles; nothing else at
 * all. Links open in a new tab with no referrer.
 */
function frameDoc(html: string, images: boolean, origin: string): string {
  const img = [`data:`, `${origin}/api/admin/inbox/attachment`, ...(images ? [`${origin}/api/admin/inbox/img`] : [])].join(" ");
  const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'; frame-src 'none'`;
  const css = [
    "html{overflow-y:hidden}",
    `body{margin:0;padding:14px 16px;background:#fff;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:${PAPER.ink};overflow-wrap:anywhere;overflow-x:auto}`,
    "img{max-width:100%;height:auto}pre{white-space:pre-wrap}",
    `a{color:${PAPER.link}}`,
    `details.rq>summary{list-style:none;display:inline-block;margin:8px 0;padding:0 7px;border-radius:7px;background:${PAPER.chip};color:${PAPER.chipInk};font-size:12px;line-height:15px;letter-spacing:1px;cursor:pointer;user-select:none}`,
    "details.rq>summary::-webkit-details-marker{display:none}",
    `blockquote{margin:0 0 0 .8ex;border-left:1px solid ${PAPER.rule};padding-left:1ex}`,
  ].join("");
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="x-dns-prefetch-control" content="off"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>${css}</style></head><body>${html}</body></html>`;
}

/**
 * One message's HTML (already through sanitize.ts → sanitizeMail) in a sandboxed frame: no scripts, no forms, no top
 * navigation; its own CSS can't touch the page. The frame shares the page's origin only so the page can size it to its
 * content and hear its clicks and keys: a mailto: link opens a new message here, and Gmail's shortcuts keep working
 * while the message has focus.
 */
export function MessageFrame({ html, images, onMailto, className = "" }: { html: string; images: boolean; onMailto?: (href: string) => void; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(60);
  const mailto = useRef(onMailto);
  useEffect(() => {
    mailto.current = onMailto;
  });
  const srcDoc = useMemo(() => frameDoc(html, images, typeof window === "undefined" ? "" : window.location.origin), [html, images]);
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let ro: ResizeObserver | null = null;
    const hook = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const fit = () => setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight) + 2, 40_000));
      fit();
      ro?.disconnect();
      ro = new ResizeObserver(fit);
      ro.observe(doc.body);
      doc.querySelectorAll("img").forEach((i) => i.addEventListener("load", fit));
      doc.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", fit));
      doc.addEventListener("click", (e) => {
        const a = (e.target as Element | null)?.closest?.("a[href]");
        const href = a?.getAttribute("href") ?? "";
        if (/^mailto:/i.test(href) && mailto.current) {
          e.preventDefault();
          mailto.current(href);
        }
      });
      // The page's shortcuts listen on its window: a key pressed in the message goes on to there.
      doc.addEventListener("keydown", (e) => {
        const copy = new KeyboardEvent("keydown", { key: e.key, code: e.code, shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, bubbles: true, cancelable: true });
        if (!window.dispatchEvent(copy)) e.preventDefault();
      });
    };
    frame.addEventListener("load", hook);
    if (frame.contentDocument?.readyState === "complete") hook();
    return () => {
      frame.removeEventListener("load", hook);
      ro?.disconnect();
    };
  }, [srcDoc]);
  return (
    <iframe
      ref={ref}
      title="Message"
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className={`block w-full overflow-hidden rounded-lg border-0 bg-white ${className}`}
      style={{ height }}
    />
  );
}
