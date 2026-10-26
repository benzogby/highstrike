"use client";

import { useEffect, useRef, useState } from "react";
import type { TickerRead } from "@/app/(landing)/data";
import { Lock, price, shortDate, sideLabel, signedPct, statusLabel } from "./Fragments";

// The page's one live thing (Taste Skill step 4): the section's headline is a
// ticker field, and the desk answers at true interface size from
// /api/landing/lookup, the public get_landing_ticker RPC.

const VALID = /^[A-Z][A-Z.]{0,5}$/;

function compact(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function money(n: number) {
  return `$${compact(n)}`;
}

export default function TickerLookup({
  start,
  initial,
  examples,
  tracked,
}: {
  start: string;
  initial: TickerRead | null;
  examples: string[];
  tracked: number;
}) {
  const [value, setValue] = useState(start);
  const [shown, setShown] = useState<{ sym: string; read: TickerRead | null }>({ sym: start, read: initial });
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, TickerRead | null>([[start, initial]]));
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(start);
  const section = useRef<HTMLDivElement>(null);

  // Pause the caret while the section is off screen.
  useEffect(() => {
    const el = section.current?.closest("section");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("is-off", !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lookup = async (sym: string) => {
    latest.current = sym;
    if (cache.current.has(sym)) {
      setShown({ sym, read: cache.current.get(sym) ?? null });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/landing/lookup?sym=${encodeURIComponent(sym)}`);
      const data = (await res.json()) as { read: TickerRead | null };
      cache.current.set(sym, data.read);
      if (latest.current === sym) setShown({ sym, read: data.read });
    } catch {
      if (latest.current === sym) setShown({ sym, read: null });
    } finally {
      if (latest.current === sym) setLoading(false);
    }
  };

  const onChange = (raw: string) => {
    const next = raw.toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
    setValue(next);
    window.clearTimeout(timer.current);
    if (VALID.test(next)) timer.current = window.setTimeout(() => lookup(next), 320);
  };

  const pick = (sym: string) => {
    window.clearTimeout(timer.current);
    setValue(sym);
    lookup(sym);
  };

  const read = shown.read;
  const closes = read?.closes ?? [];
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const move = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;
  const chat = read?.chatter;
  const chatTotal = chat ? chat.bullish + chat.bearish : 0;
  const ins = read?.insiders;

  return (
    <div ref={section}>
      <label htmlFor="hs-ticker" className="sr-only-hs">
        Ticker symbol
      </label>
      <div className="hs-lookup__line" data-ui="">
        <input
          id="hs-ticker"
          className="hs-lookup__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && VALID.test(value)) pick(value);
          }}
          size={Math.max(value.length, 1)}
          maxLength={6}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TSLA"
          aria-describedby="hs-ticker-hint"
          aria-controls="hs-ticker-answer"
        />
        <span className="hs-lookup__caret" aria-hidden="true" />
      </div>
      <p id="hs-ticker-hint" className="hs-lookup__hint hs-body hs-muted">
        Type a ticker to see what the desk has on it today.
      </p>

      <div id="hs-ticker-answer" className="hs-lookup__answer hs-ui" data-ui="" aria-live="polite" aria-busy={loading}>
        <div className="hs-ui__bar">
          <span className="hs-ui__title">{shown.sym}</span>
          <span className="hs-muted">{loading ? "Looking up…" : last ? `Last session ${shortDate(last.date)}` : "Not tracked"}</span>
        </div>
        {read && last ? (
          <dl>
            <div className="hs-lookup__row">
              <dt>Last close</dt>
              <dd className="mono">
                {price(last.close)}{" "}
                {move != null && <span className={move >= 0 ? "hs-up" : "hs-down"}>{signedPct(move)}</span>}
              </dd>
            </div>
            <div className="hs-lookup__row">
              <dt>Today&apos;s slate</dt>
              <dd>
                {read.today ? (
                  <>
                    <span className={read.today.direction.toLowerCase() === "short" ? "hs-down" : "hs-up"}>{sideLabel(read.today.direction)}</span>
                    <span className="mono"> · flow {read.today.flow ?? "–"}</span>
                    <span className="hs-lock" style={{ marginLeft: 10 }}>
                      <Lock /> entry and target for members
                    </span>
                  </>
                ) : (
                  <span className="hs-muted">Not on today&apos;s slate</span>
                )}
              </dd>
            </div>
            <div className="hs-lookup__row">
              <dt>Last graded setup</dt>
              <dd>
                {read.graded ? (
                  <>
                    {sideLabel(read.graded.direction)} · {shortDate(read.graded.date)} · {statusLabel(read.graded.status)}{" "}
                    {read.graded.result != null && (
                      <span className={`mono ${read.graded.result >= 0 ? "hs-up" : "hs-down"}`}>{signedPct(read.graded.result)}</span>
                    )}
                  </>
                ) : (
                  <span className="hs-muted">None yet</span>
                )}
              </dd>
            </div>
            <div className="hs-lookup__row">
              <dt>Insiders, 30 days</dt>
              <dd className="mono">
                {ins && ins.sells + ins.buys > 0 ? (
                  <>
                    {ins.sells} sell{ins.sells === 1 ? "" : "s"}
                    {ins.sells > 0 && ` (${money(ins.sold)})`} · {ins.buys} buy{ins.buys === 1 ? "" : "s"}
                    {ins.buys > 0 && ` (${money(ins.bought)})`}
                  </>
                ) : (
                  <span className="hs-muted">No filings</span>
                )}
              </dd>
            </div>
            <div className="hs-lookup__row">
              <dt>Chatter</dt>
              <dd>
                {chat && chatTotal > 0 ? (
                  <>
                    <span className="mono">{Math.round((chat.bullish / chatTotal) * 100)}%</span> bullish ·{" "}
                    <span className="mono">{chat.perHour.toFixed(1)}</span> messages an hour ·{" "}
                    <span className="mono">{compact(chat.watchers)}</span> watching
                  </>
                ) : (
                  <span className="hs-muted">Quiet</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <div style={{ padding: "16px 18px" }}>
            {loading ? (
              <span className="hs-muted">Looking up {shown.sym}…</span>
            ) : (
              <span className="hs-muted">
                {shown.sym} isn&apos;t on the public desk. It follows {tracked} large names here; members get the full scanner.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="hs-lookup__examples" role="group" aria-label="Try another ticker">
        {examples.map((sym) => (
          <button key={sym} type="button" className="hs-chip" aria-pressed={shown.sym === sym} onClick={() => pick(sym)}>
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
