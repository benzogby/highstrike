"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SITE_DEFAULTS, invalidateSiteContent } from "@/lib/siteContent";

// Admin ▸ Site: everything that shapes the public site in one place — the hero
// badges, the scoreboard numbers, and the legal disclaimer. Same hub-of-
// sections pattern as zogby.io's Site tab, with pill sub-navigation.

const SECTIONS = [
  { key: "hero", label: "Hero" },
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
            className={`rounded-full border px-4 py-1.5 font-display text-xs font-semibold transition ${
              section === s.key
                ? "border-accent bg-accent text-bg"
                : "border-line-strong text-ink-2 hover:border-accent/50 hover:text-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "hero" ? <HeroSection /> : section === "scoreboard" ? <ScoreboardSection /> : <LegalSection />}
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
        className="rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="rounded-lg border border-line-strong px-4 py-2 font-display text-sm font-semibold text-ink-2 transition hover:border-down/50 hover:text-down"
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
  "h-11 w-full rounded-lg border border-line bg-panel-2 px-3.5 text-sm text-ink outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-1 block text-[10px] uppercase tracking-wider text-ink-3";

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
          placeholder="*BONUS: August registrants get FREE access to HighStrike Trading School ($2,995 value)"
          className={inputClass}
        />
      </div>

      {/* Live preview */}
      <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <p className="mb-3 text-[10px] uppercase tracking-wider text-ink-3">Preview</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3.5 py-1.5 text-sm text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-display font-semibold text-ink">{traders}</span>
            traders
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3.5 py-1.5 text-sm text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-display font-semibold text-ink">{countries}</span>
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

      <p className="mt-5 font-display text-xs font-semibold uppercase tracking-wide text-ink-2">
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

      <p className="mt-6 font-display text-xs font-semibold uppercase tracking-wide text-ink-2">
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
        className="mt-4 w-full rounded-xl border border-line bg-panel-2 p-4 text-sm leading-relaxed text-ink outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
      <SaveRow onSave={save} onReset={reset} saving={saving} saved={saved} error={error} />
    </div>
  );
}
