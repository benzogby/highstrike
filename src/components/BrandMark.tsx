"use client";

// Renders the brand logo + wordmark. If an admin has uploaded a custom logo
// (site_settings key "logo", optional "logo_dark" for dark mode), it renders
// that image; otherwise it falls back to the built-in SVG mark.

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/Header";

type Logos = { logo?: string; logo_dark?: string };

let cached: Logos | null = null;
let inflight: Promise<Logos> | null = null;

async function fetchLogos(): Promise<Logos> {
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
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

export default function BrandMark({ size = 28 }: { size?: number }) {
  const [logos, setLogos] = useState<Logos | null>(cached);

  useEffect(() => {
    let cancelled = false;
    fetchLogos().then((l) => {
      if (!cancelled) setLogos(l);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (logos?.logo) {
    const dark = logos.logo_dark ?? logos.logo;
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logos.logo}
          alt="HighStrike"
          style={{ height: size + 4 }}
          className="w-auto max-w-[160px] object-contain brand-logo-light"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dark}
          alt="HighStrike"
          style={{ height: size + 4 }}
          className="w-auto max-w-[160px] object-contain brand-logo-dark"
        />
      </>
    );
  }

  return (
    <>
      <Logo size={size} />
      <span
        className="font-display font-bold tracking-tight"
        style={{ fontSize: size >= 28 ? "1.125rem" : "1rem" }}
      >
        highstrike
      </span>
    </>
  );
}
