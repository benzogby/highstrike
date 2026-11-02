"use client";

// Renders the brand logo + wordmark. If an admin has uploaded a custom logo
// (site_settings key "logo", optional "logo_dark" for dark mode), it renders
// that image; otherwise it falls back to the built-in SVG mark.

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import type { Logos } from "@/lib/brand";

let cached: Logos | null = null;
let inflight: Promise<Logos> | null = null;

async function fetchLogos(): Promise<Logos> {
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
      // Loaded only when a page didn't hand the logos down (the app's frame does), so Supabase's library stays out of
      // the pages that need nothing else from it.
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const { data } = await supabaseBrowser()
        .from("site_settings")
        .select("key, value")
        .in("key", ["logo", "logo_dark"]);
      const result = Object.fromEntries(
        (data ?? []).filter((r) => r.value).map((r) => [r.key, r.value])
      ) as Logos;
      cached = result;
      return result;
    })();
  }
  return inflight;
}

/** Call after an admin changes logos so the next mount refetches. */
export function invalidateBrandCache() {
  cached = null;
  inflight = null;
}

/**
 * The logo, and with `withName` the name "HighStrike" beside it. The site is dark only, so an uploaded logo shows its
 * dark version (or the one logo there is). `logos` from the server (the app's frame) draws it at once; without them it
 * looks them up and keeps the logo's space empty meanwhile instead of flashing the built-in mark.
 */
export default function BrandMark({ size = 28, withName = false, logos: given }: { size?: number; withName?: boolean; logos?: Logos }) {
  const [fetched, setLogos] = useState<Logos | null>(cached);
  const logos = given ?? fetched;

  useEffect(() => {
    if (given) return;
    let cancelled = false;
    fetchLogos().then((l) => {
      if (!cancelled) setLogos(l);
    });
    return () => {
      cancelled = true;
    };
  }, [given]);

  const name = withName ? <span className="font-display text-[15px] leading-none text-ink">HighStrike</span> : null;
  if (!logos) {
    return (
      <>
        <span aria-hidden="true" style={{ width: size, height: size }} className="inline-block flex-none" />
        {name}
      </>
    );
  }
  const src = logos.logo_dark ?? logos.logo;
  if (src) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="HighStrike" style={{ height: size + 4 }} className="w-auto max-w-[160px] flex-none object-contain" />
        {name}
      </>
    );
  }

  return (
    <>
      <Logo size={size} />
      {name ?? (
        <span className="font-display tracking-tight" style={{ fontSize: size >= 28 ? "1.125rem" : "1rem" }}>
          highstrike
        </span>
      )}
    </>
  );
}
