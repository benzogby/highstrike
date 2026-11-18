"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

const BUCKET = "site-assets";

type LibraryItem = { name: string; url: string; createdAt: string };

function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function cleanName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

export default function ContentManager() {
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const libInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: files } = await supabase.storage.from(BUCKET).list("library", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
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

      <p className="mb-6 rounded-lg border border-line bg-panel px-4 py-3 text-sm text-ink-2">
        The favicon, logo, app icon and share image are in <a href="/admin/site" className="font-medium text-accent hover:text-accent-2">Site → Images</a> now.
      </p>

      {/* Photo library */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[15px] text-ink">
          Photo library
        </h2>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => libInputRef.current?.click()}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
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
        <div className="mt-4 rounded-xl border border-dashed border-line-strong bg-panel px-6 py-12 text-center text-sm text-ink-3">
          No photos yet — upload the first one.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {library.map((item) => (
            <div key={item.name} className="overflow-hidden rounded-xl border border-line bg-panel">
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
                    className="flex-1 rounded-lg border border-line-strong bg-panel-2 py-1.5 text-xs font-medium text-ink transition hover:bg-panel-3"
                  >
                    {copied === item.url ? "Copied ✓" : "Copy URL"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => deleteFromLibrary(item)}
                    className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-medium text-ink-2 transition hover:border-down/50 hover:text-down"
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
