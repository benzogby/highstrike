import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

/** The uploaded logos (site_settings "logo", and "logo_dark" for the dark ground). */
export type Logos = { logo?: string; logo_dark?: string };

/**
 * The logos, read on the server once per request, so the app's frame draws them in its first paint and the browser
 * never loads Supabase's library just to look them up (2026-11-02, "compress the app": 65 KB on pages that need nothing
 * else from it). A logo changed in Admin shows on the next full load.
 */
export const brandLogos = cache(async (): Promise<Logos> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("site_settings").select("key, value").in("key", ["logo", "logo_dark"]);
  return Object.fromEntries((data ?? []).filter((r) => typeof r.value === "string" && r.value).map((r) => [r.key, r.value]));
});
