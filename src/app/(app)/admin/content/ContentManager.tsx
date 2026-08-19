"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { invalidateBrandCache } from "@/components/BrandMark";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

const BUCKET = "site-assets";

type Slot = {
  key: string;
  title: string;
  hint: string;
};

const SLOTS: Slot[] = [
  {
    key: "logo",
    title: "Logo — light theme",
    hint: "Shown in the header and app sidebar on light backgrounds. SVG or PNG with transparency, ~4:1 wide.",
  },
  {
    key: "logo_dark",
    title: "Logo — dark theme",
    hint: "Optional. Used on dark backgrounds; falls back to the light logo if unset.",
  },
  {
    key: "og_image",
    title: "Social share image",
    hint: "Used when links are shared (Open Graph). 1200×630 recommended.",
  },
];

type LibraryItem = { name: string; url: string; createdAt: string };

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function cleanName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

export default function ContentManager() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const libInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const [{ data: rows }, { data: files }] = await Promise.all([
      supabase.from("site_settings").select("key, value"),
      supabase.storage.from(BUCKET).list("library", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      }),
    ]);
    setSettings(
      Object.fromEntries((rows ?? []).filter((r) => r.value).map((r) => [r.key, r.value]))
    );
    setLibrary(
      (files ?? [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: publicUrl(`library/${f.name}`),
          createdAt: f.created_at ?? "",
        }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadToSlot(slot: Slot, file: File) {
    setBusy(slot.key);
    setError("");
    try {
      const supabase = supabaseBrowser();
      const path = `${slot.key}/${Date.now()}-${cleanName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: setErr } = await supabase
        .from("site_settings")
        .upsert({ key: slot.key, value: publicUrl(path), updated_at: new Date().toISOString() });
      if (setErr) throw setErr;
      invalidateBrandCache();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function clearSlot(slot: Slot) {
    setBusy(slot.key);
    setError("");
    try {
      const supabase = supabaseBrowser();
      const { error: delErr } = await supabase
        .from("site_settings")
        .delete()
        .eq("key", slot.key);
      if (delErr) throw delErr;
      invalidateBrandCache();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear");
    } finally {
      setBusy(null);
    }
  }

  async function uploadToLibrary(file: File) {
    setBusy("library");
    setError("");
    try {
      const supabase = supabaseBrowser();
      const path = `library/${Date.now()}-${cleanName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
      });
      if (upErr) throw upErr;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteFromLibrary(item: LibraryItem) {
    setBusy(item.name);
    setError("");
    try {
      const supabase = supabaseBrowser();
      const { error: delErr } = await supabase.storage
        .from(BUCKET)
        .remove([`library/${item.name}`]);
      if (delErr) throw delErr;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
    } finally {
      setBusy(null);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-6 rounded-lg border border-down/40 bg-panel px-4 py-3 text-sm text-down">
          {error}
        </p>
      )}

      {/* Brand slots */}
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
        Brand assets
      </h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {SLOTS.map((slot) => {
          const current = settings[slot.key];
          return (
            <div key={slot.key} className="flex flex-col rounded-2xl border border-line bg-panel p-5">
              <h3 className="font-display text-sm font-semibold">{slot.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-2">{slot.hint}</p>
              <div
                className={`mt-4 flex h-24 items-center justify-center rounded-xl border border-dashed border-line-strong ${
                  slot.key === "logo_dark" ? "bg-[#0a0b0d]" : "bg-panel-2"
                }`}
              >
                {current ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current} alt={slot.title} className="max-h-16 max-w-[85%] object-contain" />
                ) : (
                  <span className="text-xs text-ink-3">Nothing uploaded</span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <label className="flex-1 cursor-pointer rounded-lg bg-accent py-2 text-center font-display text-xs font-semibold text-bg transition hover:bg-accent-2">
                  {busy === slot.key ? "Working…" : current ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadToSlot(slot, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {current && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => clearSlot(slot)}
                    className="rounded-lg border border-line-strong px-3 py-2 font-display text-xs font-semibold text-ink-2 transition hover:border-down/50 hover:text-down"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo library */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
          Photo library
        </h2>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => libInputRef.current?.click()}
          className="rounded-lg bg-accent px-4 py-2 font-display text-xs font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
        >
          {busy === "library" ? "Uploading…" : "+ Upload photo"}
        </button>
        <input
          ref={libInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadToLibrary(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-2">
        App-wide images with permanent public URLs — upload once, use anywhere on the site.
      </p>

      {library.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center text-sm text-ink-3">
          No photos yet — upload the first one.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {library.map((item) => (
            <div key={item.name} className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex h-36 items-center justify-center bg-panel-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="truncate text-xs text-ink-2" title={item.name}>
                  {item.name}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url)}
                    className="flex-1 rounded-lg border border-line-strong py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
                  >
                    {copied === item.url ? "Copied ✓" : "Copy URL"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => deleteFromLibrary(item)}
                    className="rounded-lg border border-line-strong px-2.5 py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-down/50 hover:text-down"
                    aria-label={`Delete ${item.name}`}
                  >
                    {busy === item.name ? "…" : "✕"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
