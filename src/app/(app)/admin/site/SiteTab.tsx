"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SITE_DEFAULTS, invalidateSiteContent } from "@/lib/siteContent";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

// Admin ▸ Site: everything that shapes the public site in one place — the hero
// badges, the scoreboard numbers, and the legal disclaimer. Same hub-of-
// sections pattern as zogby.io's Site tab, with pill sub-navigation.

const SECTIONS = [
  { key: "hero", label: "Hero" },
  { key: "proof", label: "Proof" },
  { key: "scoreboard", label: "Scoreboard" },
  { key: "legal", label: "Legal" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

async function saveSetting(key: string, value: string) {
  const { error } = await supabaseBrowser()
    .from("site_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  invalidateSiteContent();
}

async function clearSetting(key: string) {
  const { error } = await supabaseBrowser().from("site_settings").delete().eq("key", key);
  if (error) throw new Error(error.message);
  invalidateSiteContent();
}

async function loadRaw(keys: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser()
    .from("site_settings")
    .select("key, value")
    .in("key", keys);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    if (r.value) map[r.key] = r.value;
  });
  return map;
}

export default function SiteTab() {
  const [section, setSection] = useState<SectionKey>("hero");
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={`rounded-md border px-3 py-1 text-[13px] font-medium transition ${
              section === s.key
                ? "border-line-strong bg-panel-2 text-ink"
                : "border-transparent text-ink-2 hover:bg-panel-2 hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "hero" ? <HeroSection /> : section === "proof" ? <ProofSection /> : section === "scoreboard" ? <ScoreboardSection /> : <LegalSection />}
    </div>
  );
}

function SaveRow({
  onSave,
  onReset,
  saving,
  saved,
  error,
}: {
  onSave: () => void;
  onReset?: () => void;
  saving: boolean;
  saved: boolean;
  error: string;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 transition hover:border-down/50 hover:text-down"
        >
          Reset to default
        </button>
      )}
      {saved && <span className="text-sm text-up">Saved ✓ — live on next page load</span>}
      {error && <span className="text-sm text-down">{error}</span>}
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-1.5 block text-[13px] font-medium text-ink";

/**
 * The homepage's proof line (Ben, 2026-11-02: "a 4.9 star rating with example profile circles", the circles "photos I
 * upload in admin from our database"): the rating from HighStrike's own member reviews, and up to five member photos,
 * stored in the public site-assets bucket under proof/. Live on the homepage within its 30-minute refresh.
 */
function ProofSection() {
  const [rating, setRating] = useState(SITE_DEFAULTS.proof.rating);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaw(["proof"]).then((map) => {
      if (!map.proof) return;
      try {
        const p = JSON.parse(map.proof);
        if (typeof p.rating === "string") setRating(p.rating);
        if (Array.isArray(p.avatars)) setAvatars(p.avatars.filter((u: unknown) => typeof u === "string"));
      } catch {
        /* keep defaults */
      }
    });
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    setSaved(false);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 5 - avatars.length)) {
        if (!file.type.startsWith("image/")) continue;
        const name = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-60);
        const path = `proof/${Date.now()}-${name}`;
        const { error: upErr } = await supabaseBrowser().storage.from("site-assets").upload(path, file, { cacheControl: "31536000", upsert: false });
        if (upErr) throw new Error(upErr.message);
        urls.push(`${SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`);
      }
      setAvatars((a) => [...a, ...urls].slice(0, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await saveSetting("proof", JSON.stringify({ rating: rating.trim() || "4.9", avatars }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-ink-2">
        The stars and member photos on the homepage, next to &ldquo;10k+ traders | 142 countries&rdquo; (those two numbers are on the Hero tab). Use photos of members who&apos;ve agreed to be shown.
      </p>
      <div className="mt-5 max-w-[200px]">
        <label className={labelClass}>Star rating</label>
        <input value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.9" className={inputClass} />
      </div>
      <div className="mt-5">
        <p className={labelClass}>Member photos ({avatars.length} of 5)</p>
        <div className="flex flex-wrap items-center gap-3">
          {avatars.map((u) => (
            <div key={u} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-14 rounded-full object-cover ring-1 ring-line-strong" />
              <button
                type="button"
                onClick={() => {
                  setAvatars((a) => a.filter((x) => x !== u));
                  setSaved(false);
                }}
                aria-label="Remove this photo"
                className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-panel-3 text-xs text-ink ring-1 ring-line-strong hover:bg-down hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
          {avatars.length < 5 && (
            <label className="grid size-14 cursor-pointer place-items-center rounded-full border border-dashed border-line-strong text-xl text-ink-3 transition hover:border-accent hover:text-accent">
              {uploading ? "…" : "+"}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => void upload(e.target.files)} />
            </label>
          )}
        </div>
        <p className="mt-2 text-[13px] text-ink-3">Square photos look best. Remember to press Save after uploading or removing.</p>
      </div>
      <SaveRow onSave={save} saving={saving} saved={saved} error={error} />
    </div>
  );
}

function HeroSection() {
  const [traders, setTraders] = useState(SITE_DEFAULTS.hero_badges.traders);
  const [countries, setCountries] = useState(SITE_DEFAULTS.hero_badges.countries);
  const [bonus, setBonus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaw(["hero_badges", "hero_bonus"]).then((map) => {
      if (map.hero_badges) {
        try {
          const b = JSON.parse(map.hero_badges);
          if (b.traders) setTraders(b.traders);
          if (b.countries) setCountries(b.countries);
        } catch {
          /* keep defaults */
        }
      }
      if (map.hero_bonus) setBonus(map.hero_bonus);
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await saveSetting("hero_badges", JSON.stringify({ traders, countries }));
      if (bonus.trim()) await saveSetting("hero_bonus", bonus.trim());
      else await clearSetting("hero_bonus");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-ink-2">
        The stat badges under the homepage hero CTA, and the bonus line shown beneath every
        Get&nbsp;Access button.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Traders badge</label>
          <input value={traders} onChange={(e) => setTraders(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Countries badge</label>
          <input value={countries} onChange={(e) => setCountries(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="mt-4">
        <label className={labelClass}>
          Bonus line (leave empty for the automatic &quot;*BONUS: current-month registrants…&quot; line)
        </label>
        <input
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          placeholder="*BONUS: August registrants get FREE access to HighStrike Trading School ($397 value)"
          className={inputClass}
        />
      </div>

      {/* Live preview */}
      <div className="mt-6 rounded-xl border border-line bg-panel p-5">
        <p className="mb-3 text-xs text-ink-3 font-medium">Preview</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 py-1 text-[13px] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-medium text-ink">{traders}</span>
            traders
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 py-1 text-[13px] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-medium text-ink">{countries}</span>
            countries
          </span>
        </div>
      </div>

      <SaveRow onSave={save} saving={saving} saved={saved} error={error} />
    </div>
  );
}

function ScoreboardSection() {
  const [stats, setStats] = useState(SITE_DEFAULTS.scoreboard.stats);
  const [trades, setTrades] = useState(SITE_DEFAULTS.scoreboard.trades);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaw(["scoreboard"]).then((map) => {
      if (map.scoreboard) {
        try {
          const s = JSON.parse(map.scoreboard);
          if (Array.isArray(s.stats) && s.stats.length === 3) setStats(s.stats);
          if (Array.isArray(s.trades)) setTrades(s.trades);
        } catch {
          /* keep defaults */
        }
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await saveSetting("scoreboard", JSON.stringify({ stats, trades }));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError("");
    try {
      await clearSetting("scoreboard");
      setStats(SITE_DEFAULTS.scoreboard.stats);
      setTrades(SITE_DEFAULTS.scoreboard.trades);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-ink-2">
        The homepage scoreboard: three headline stats and the two highlighted trades. Trade dates
        render as &quot;N days ago&quot; relative to the visitor&apos;s today.
      </p>

      <p className="mt-5 font-display text-sm text-ink">
        Headline stats
      </p>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl border border-line bg-panel p-4">
            <label className={labelClass}>Value</label>
            <input
              value={s.value}
              onChange={(e) =>
                setStats(stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
              className={inputClass}
            />
            <label className={`${labelClass} mt-3`}>Label</label>
            <input
              value={s.label}
              onChange={(e) =>
                setStats(stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <p className="mt-6 font-display text-sm text-ink">
        Highlighted trades
      </p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {trades.map((t, i) => (
          <div key={i} className="rounded-xl border border-line bg-panel p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ticker</label>
                <input
                  value={t.ticker}
                  onChange={(e) =>
                    setTrades(trades.map((x, j) => (j === i ? { ...x, ticker: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Result</label>
                <input
                  value={t.result}
                  onChange={(e) =>
                    setTrades(trades.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <input
                  value={t.status}
                  onChange={(e) =>
                    setTrades(trades.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Days ago</label>
                <input
                  type="number"
                  min={0}
                  value={t.daysAgo}
                  onChange={(e) =>
                    setTrades(
                      trades.map((x, j) =>
                        j === i ? { ...x, daysAgo: Math.max(0, Number(e.target.value) || 0) } : x
                      )
                    )
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <SaveRow onSave={save} onReset={reset} saving={saving} saved={saved} error={error} />
    </div>
  );
}

function LegalSection() {
  const [text, setText] = useState("");
  const [loadedDefault, setLoadedDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRaw(["legal_disclaimer"]).then((map) => {
      if (map.legal_disclaimer) {
        try {
          const arr = JSON.parse(map.legal_disclaimer);
          if (Array.isArray(arr) && arr.length) {
            setText(arr.join("\n\n"));
            setLoadedDefault(false);
          }
        } catch {
          /* keep default */
        }
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const paragraphs = text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (paragraphs.length) {
        await saveSetting("legal_disclaimer", JSON.stringify(paragraphs));
        setLoadedDefault(false);
      } else {
        await clearSetting("legal_disclaimer");
        setLoadedDefault(true);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setError("");
    try {
      await clearSetting("legal_disclaimer");
      setText("");
      setLoadedDefault(true);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-ink-2">
        The disclaimer paragraphs in the site footer. Separate paragraphs with a blank line.
        {loadedDefault && " Currently using the built-in text — saving replaces it site-wide."}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Leave empty to use the built-in disclaimer…"
        className="mt-4 w-full rounded-xl border border-line-strong bg-bg p-4 text-sm leading-relaxed text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <SaveRow onSave={save} onReset={reset} saving={saving} saved={saved} error={error} />
    </div>
  );
}
