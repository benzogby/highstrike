"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";
// The site pages' bar. Swiping is the only product for now (Ben, 2026-11-02), free: no pricing, and the buttons lead to
// the swipe deck or a free account.
const nav = [
  { href: "/#how", label: "How it works" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/company", label: "Company" },
];

export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-ink-2 transition hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {signedIn ? (
            <Link
              href="/swipe"
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
            >
              Swipe
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden text-sm text-ink-2 transition hover:text-ink sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
