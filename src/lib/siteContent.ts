"use client";

// Site-content settings: admin-editable knobs (Admin ▸ Site) that the public
// pages read client-side, falling back to built-in defaults so the site never
// depends on the table being populated.

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export const SITE_DEFAULTS = {
  hero_badges: { traders: "10,000+", countries: "142" },
  hero_bonus: "", // empty = dynamic "*BONUS: {month} registrants…" line
  scoreboard: {
    stats: [
      { value: "39%", label: "Average gain" },
      { value: "64%", label: "Win rate" },
      { value: "-19%", label: "Average loss" },
    ],
    trades: [
      { ticker: "DELL", status: "Target Hit", result: "+956%", daysAgo: 2 },
      { ticker: "SMCI", status: "Closed", result: "+121%", daysAgo: 5 },
    ],
  },
  legal_disclaimer: [] as string[], // empty = built-in footer paragraphs
};

export type SiteKey = keyof typeof SITE_DEFAULTS;

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

async function fetchAll(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      const { data } = await supabaseBrowser().from("site_settings").select("key, value");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r) => {
        if (r.value) map[r.key] = r.value;
      });
      cache = map;
      return map;
    })();
  }
  return inflight;
}

export function invalidateSiteContent() {
  cache = null;
  inflight = null;
}

/** Returns the parsed override for `key`, or `fallback` until loaded / when unset. */
export function useSiteSetting<T>(key: SiteKey, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    fetchAll().then((map) => {
      if (!alive || !map[key]) return;
      try {
        setValue(JSON.parse(map[key]) as T);
      } catch {
        // Plain-string settings are stored unquoted.
        setValue(map[key] as unknown as T);
      }
    });
    return () => {
      alive = false;
    };
  }, [key, fallback]);
  return value;
}
