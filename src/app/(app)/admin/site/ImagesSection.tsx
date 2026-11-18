"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { invalidateBrandCache } from "@/components/BrandMark";
import { invalidateSiteContent } from "@/lib/siteContent";
import { SUPABASE_URL } from "@/lib/supabaseConfig";
import { SITE_IMAGES, SITE_IMAGE_KEYS, type SiteImage } from "@/lib/siteImages";

// Admin → Site → Images (Ben, 2026-11-18): the favicon, the app icon, the logo, the homepage's wordmark and mark, and
// the social share image. An upload goes to the public site-assets bucket under its key's folder and its URL into
// site_settings; Remove goes back to the built-in image. The site reads them through /api/site/asset/<key>.

const BUCKET = "site-assets";
const publicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
/** Where an upload goes: its key's folder, stamped so a replacement never hits an old cached copy. */
const uploadPath = (key: string, name: string) => `${key}/${Date.now()}-${cleanName(name)}`;

export default function ImagesSection() {
  const [current, setCurrent] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("site_settings")
      .select("key, value")
      .in("key", [...SITE_IMAGE_KEYS, "logo_dark"]);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r) => {
      if (r.value) map[r.key] = r.value;
    });
    // The app shows "logo_dark" over "logo" (BrandMark); one dark-only site has one logo, so show whichever is in use.
    if (map.logo_dark) map.logo = map.logo_dark;
    setCurrent(map);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the saved images once, from Supabase
    load();
  }, [load]);

  const afterChange = async (key: string) => {
    invalidateBrandCache();
    invalidateSiteContent();
    await load();
    setDone(key);
    setTimeout(() => setDone((d) => (d === key ? null : d)), 4000);
  };

  async function upload(image: SiteImage, file: File) {
    setBusy(image.key);
    setError("");
    try {
      if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".ico")) throw new Error("That file isn't an image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5 MB. Use a smaller one.");
      const supabase = supabaseBrowser();
      const path = uploadPath(image.key, file.name);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { error: setErr } = await supabase
        .from("site_settings")
        .upsert({ key: image.key, value: publicUrl(path), updated_at: new Date().toISOString() });
      if (setErr) throw setErr;
      // One logo: a new one replaces the old "dark theme" copy too, so the new one is what shows.
      if (image.key === "logo") await supabase.from("site_settings").delete().eq("key", "logo_dark");
      await afterChange(image.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(image: SiteImage) {
    setBusy(image.key);
    setError("");
    try {
      const keys = image.key === "logo" ? ["logo", "logo_dark"] : [image.key];
      const { error: delErr } = await supabaseBrowser().from("site_settings").delete().in("key", keys);
      if (delErr) throw delErr;
      await afterChange(image.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove it");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="max-w-2xl text-sm text-ink-2">
        Every image the site uses. Upload to replace one; Remove goes back to HighStrike&apos;s built-in image. Changes show within about 5
        minutes (browsers keep favicons longer: a hard refresh shows it at once).
      </p>
      {error && <p className="mt-4 rounded-lg border border-down/40 bg-down-soft px-4 py-3 text-sm text-down">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SITE_IMAGES.map((image) => {
          const uploaded = current[image.key];
          const shown = uploaded || image.fallback;
          return (
            <div key={image.key} className="flex flex-col rounded-xl border border-line bg-panel p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm text-ink">{image.title}</h3>
                <span className={`text-[11px] ${uploaded ? "text-accent-ink" : "text-ink-3"}`}>{uploaded ? "Uploaded" : "Built-in"}</span>
              </div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-2">{image.hint}</p>
              <div className="mt-4 flex h-28 items-center justify-center rounded-xl border border-dashed border-line-strong bg-bg">
                {shown ? (
                  image.maskNote ? (
                    <span
                      role="img"
                      aria-label={image.title}
                      className="block h-16 w-16 bg-accent"
                      style={{ mask: `url("${shown}") center / contain no-repeat`, WebkitMask: `url("${shown}") center / contain no-repeat` }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shown}
                      alt={image.title}
                      className={image.wide ? "max-h-16 max-w-[85%] object-contain" : "h-16 w-16 rounded-xl object-contain"}
                    />
                  )
                ) : (
                  <span className="text-xs text-ink-3">Built-in mark</span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <label
                  className={`flex-1 cursor-pointer rounded-lg bg-accent py-2 text-center text-xs font-medium text-on-accent transition hover:bg-accent-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
                >
                  {busy === image.key ? "Working…" : uploaded ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp,image/x-icon,.ico"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(image, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {uploaded && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => remove(image)}
                    className="rounded-lg border border-line-strong px-3 py-2 text-xs font-medium text-ink-2 transition hover:border-down/50 hover:text-down disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
              {done === image.key && <p className="mt-2 text-xs text-up">Saved ✓ — live within about 5 minutes</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
