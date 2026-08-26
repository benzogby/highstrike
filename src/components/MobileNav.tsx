"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ThemeToggle from "@/components/ThemeToggle";

type Item = { label: string; href?: string; key?: string; soon?: boolean };

export default function MobileNav({
  items,
  active,
  isAdmin,
  email,
  firstName,
  avatarUrl,
}: {
  items: Item[];
  active: string;
  isAdmin: boolean;
  email: string;
  firstName: string;
  avatarUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-2 transition hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Portal to <body>: the topbar's backdrop-blur would otherwise become
          the containing block for this fixed overlay and collapse it. */}
      {open &&
        mounted &&
        createPortal(
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <span className="font-display text-base font-bold">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {items.map((n) =>
                n.href ? (
                  <Link
                    key={n.label}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-sm transition ${
                      n.key === active
                        ? "bg-panel-2 font-semibold text-ink"
                        : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                    }`}
                  >
                    {n.label}
                  </Link>
                ) : (
                  <span
                    key={n.label}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-ink-3"
                  >
                    {n.label}
                    <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider">
                      Soon
                    </span>
                  </span>
                )
              )}
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  active === "settings"
                    ? "bg-panel-2 font-semibold text-ink"
                    : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center rounded-lg border border-accent/40 px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-panel-2"
                >
                  Admin panel
                </Link>
              )}
            </nav>

            <div className="border-t border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-8 w-8 flex-none rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent font-display text-xs font-bold uppercase text-bg">
                      {firstName.slice(0, 2)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{firstName}</p>
                    <p className="truncate text-xs text-ink-3">{email}</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>
              <form action="/auth/signout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-line-strong py-2 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
