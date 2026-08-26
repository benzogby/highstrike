"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type PageCmd = { kind: "page"; label: string; hint: string; href: string };
type SymbolCmd = { kind: "symbol"; ticker: string; name: string };
type Cmd = PageCmd | SymbolCmd;

const PAGES: Omit<PageCmd, "kind">[] = [
  { label: "Dashboard", hint: "Home — weather, setups, watchlist", href: "/dashboard" },
  { label: "Setups", hint: "Setup history & scoreboard", href: "/setups" },
  { label: "Scanner", hint: "Universe ranked by flow score", href: "/scanner" },
  { label: "Insider Feed", hint: "Form 4 buys, sells, clusters", href: "/insiders" },
  { label: "Watchlist", hint: "Jump to your watchlist", href: "/dashboard#watchlist" },
  { label: "Settings", hint: "Profile, security, plan", href: "/settings" },
];

export default function CommandBar({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [symbols, setSymbols] = useState<SymbolCmd[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const pages: PageCmd[] = [
    ...PAGES.map((p) => ({ ...p, kind: "page" as const })),
    ...(isAdmin
      ? [{ kind: "page" as const, label: "Admin panel", hint: "Members, traffic, content, site", href: "/admin" }]
      : []),
  ];

  const q = query.trim().toLowerCase();
  const pageMatches = q
    ? pages.filter((p) => p.label.toLowerCase().includes(q))
    : pages;
  const results: Cmd[] = [...(q ? symbols : []), ...pageMatches];

  // Open on "/" or Cmd/Ctrl+K anywhere (outside editable fields).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const editing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((e.key === "/" && !editing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus + reset when opening; lock scroll.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSymbols([]);
    setSel(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Debounced ticker search.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!open || q.length < 1) {
      setSymbols([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: { ticker: string; name: string }[] };
        setSymbols(data.results.map((r) => ({ kind: "symbol", ...r })));
        setSel(0);
      } catch {
        setSymbols([]);
      }
    }, 180);
  }, [q, open]);

  const run = useCallback(
    (cmd: Cmd | undefined) => {
      if (!cmd) return;
      setOpen(false);
      router.push(cmd.kind === "symbol" ? `/symbol/${cmd.ticker}` : cmd.href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      run(results[sel]);
    }
  }

  return (
    <>
      {/* Topbar trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-line bg-panel px-3.5 text-sm text-ink-3 transition hover:border-accent/50 lg:flex"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search tickers, pages…
        <kbd className="ml-auto rounded border border-line px-1.5 font-mono-nums text-[10px]">/</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-2 transition hover:text-ink lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-bg/60 backdrop-blur-sm"
            />
            <div className="absolute left-1/2 top-24 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Type a ticker or page…"
                aria-label="Command bar"
                className="h-14 w-full border-b border-line bg-transparent px-5 text-base text-ink placeholder:text-ink-3 outline-none"
              />
              <ul className="max-h-80 overflow-y-auto py-2">
                {results.map((r, i) => (
                  <li key={r.kind === "symbol" ? `s-${r.ticker}` : `p-${r.href}`}>
                    <button
                      type="button"
                      onClick={() => run(r)}
                      onMouseEnter={() => setSel(i)}
                      className={`flex w-full items-center justify-between px-5 py-2.5 text-left text-sm transition ${
                        i === sel ? "bg-panel-2" : ""
                      }`}
                    >
                      {r.kind === "symbol" ? (
                        <>
                          <span className="font-display font-semibold">${r.ticker}</span>
                          <span className="ml-3 truncate text-xs text-ink-3">{r.name}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-display font-semibold">{r.label}</span>
                          <span className="ml-3 truncate text-xs text-ink-3">{r.hint}</span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-ink-3">
                    No matches — try a ticker like NVDA.
                  </li>
                )}
              </ul>
              <p className="border-t border-line px-5 py-2 text-[10px] uppercase tracking-wider text-ink-3">
                ↑↓ navigate · Enter go · Esc close
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
