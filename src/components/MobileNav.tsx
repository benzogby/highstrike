"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { activeKey, visibleNav } from "@/components/appNav";

export default function MobileNav({
  isAdmin,
  email,
  firstName,
  avatarUrl,
}: {
  isAdmin: boolean;
  email: string;
  firstName: string;
  avatarUrl?: string | null;
}) {
  // The frame stays mounted while pages change, so the current page comes from the URL.
  const active = activeKey(usePathname());
  const items = visibleNav(isAdmin);
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
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-panel-2 text-ink-2 transition hover:bg-panel-3 hover:text-ink"
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
            className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="anim-slide-in absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-sidebar shadow-2xl shadow-black/60">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-display text-base text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition hover:bg-panel-2 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2.5">
              {items.map((n) =>
                n.href ? (
                  <Link
                    key={n.label}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex h-10 items-center rounded-md px-3 text-sm transition ${
                      n.key === active
                        ? "bg-panel-2 font-medium text-ink"
                        : "text-ink-2 hover:bg-panel hover:text-ink"
                    }`}
                  >
                    {n.label}
                  </Link>
                ) : (
                  <span
                    key={n.label}
                    className="flex h-10 items-center justify-between rounded-md px-3 text-sm text-ink-3"
                  >
                    {n.label}
                    <span className="rounded px-1.5 text-[11px] font-medium leading-5 text-ink-3 ring-1 ring-inset ring-line-strong">
                      Soon
                    </span>
                  </span>
                )
              )}
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={`flex h-10 items-center rounded-md px-3 text-sm transition ${
                  active === "settings"
                    ? "bg-panel-2 font-medium text-ink"
                    : "text-ink-2 hover:bg-panel hover:text-ink"
                }`}
              >
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className={`flex h-10 items-center rounded-md px-3 text-sm transition ${
                    active === "admin" ? "bg-panel-2 font-medium text-ink" : "text-ink-2 hover:bg-panel hover:text-ink"
                  }`}
                >
                  Admin
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
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-medium uppercase text-accent-ink ring-1 ring-inset ring-accent/25">
                      {firstName.slice(0, 2)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{firstName}</p>
                    <p className="truncate text-xs text-ink-3">{email}</p>
                  </div>
                </div>
              </div>
              <form action="/auth/signout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="h-9 w-full rounded-lg border border-line-strong bg-panel-2 text-[13px] font-medium text-ink transition hover:bg-panel-3"
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
