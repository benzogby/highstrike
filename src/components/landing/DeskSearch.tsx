"use client";

import { useEffect, useRef, useState } from "react";
import type { TickerRead } from "@/app/(landing)/data";
import { Tag, compact, price, shortDate, sideLabel, signedPct, statusLabel } from "./Pieces";

// The page's one live thing: the desk terminal's search. Type a ticker and the
// desk answers in a panel that lands under the bar, from /api/landing/lookup
// (the public get_landing_ticker RPC). Without script it's the terminal's bar.

const VALID = /^[A-Z][A-Z.]{0,5}$/;

export default function DeskSearch({ start, initial, examples, tracked }: { start: string; initial: TickerRead | null; examples: string[]; tracked: number }) {
  const [value, setValue] = useState(start);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<{ sym: string; read: TickerRead | null }>({ sym: start, read: initial });
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, TickerRead | null>([[start, initial]]));
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(start);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // The hero's "Look up a ticker" lands here with the field ready to type in.
  useEffect(() => {
    const focus = () => {
      if (window.location.hash === "#lookup") {
        input.current?.focus({ preventScroll: true });
        input.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("hashchange", focus);
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      window.removeEventListener("hashchange", focus);
      document.removeEventListener("pointerdown", away);
    };
  }, []);

  const lookup = async (sym: string) => {
    latest.current = sym;
    setOpen(true);
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
    input.current?.focus();
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
    <div className="hs-search" ref={box} id="lookup">
      <label htmlFor="hs-ticker" className="hs-sr">
        Look up a ticker
      </label>
      <div className="hs-search__field">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 11 L14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={input}
          id="hs-ticker"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && VALID.test(value)) pick(value);
            if (e.key === "Escape") setOpen(false);
          }}
          maxLength={6}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TSLA"
          role="combobox"
          aria-autocomplete="none"
          aria-controls="hs-ticker-answer"
          aria-expanded={open}
        />
        <span className="hs-search__hint" aria-hidden="true">
          Look up a ticker
        </span>
      </div>

      <div id="hs-ticker-answer" className={`hs-search__panel${open ? " is-open" : ""}`} aria-live="polite" aria-busy={loading} hidden={!open}>
        <div className="hs-search__head">
          <b>{shown.sym}</b>
          {read && last ? (
            <>
              <span className="hs-num">{price(last.close)}</span>
              {move != null && <Tag tone={move >= 0 ? "gain" : "loss"} className="hs-tag--sm">{signedPct(move)}</Tag>}
              <span className="hs-search__when">{shortDate(last.date)} close</span>
            </>
          ) : (
            <span className="hs-search__when">{loading ? "Looking up…" : "Not on the public desk"}</span>
          )}
        </div>
        {read && last ? (
          <dl className="hs-search__rows">
            <div>
              <dt>Today&apos;s slate</dt>
              <dd>
                {read.today ? (
                  <>
                    <span className={read.today.direction.toLowerCase() === "short" ? "hs-dn" : "hs-up"}>{sideLabel(read.today.direction)}</span> · flow {read.today.flow ?? "–"} · entry and target for members
                  </>
                ) : (
                  <span className="hs-quiet">Not on today&apos;s slate</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Last graded</dt>
              <dd>
                {read.graded ? (
                  <>
                    {sideLabel(read.graded.direction)} · {shortDate(read.graded.date)} · {statusLabel(read.graded.status)}{" "}
                    {read.graded.result != null && <span className={read.graded.result >= 0 ? "hs-up" : "hs-dn"}>{signedPct(read.graded.result)}</span>}
                  </>
                ) : (
                  <span className="hs-quiet">None yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Insiders, 30 days</dt>
              <dd>
                {ins && ins.sells + ins.buys > 0 ? (
                  <>
                    {ins.sells} sell{ins.sells === 1 ? "" : "s"}
                    {ins.sells > 0 && ` ($${compact(ins.sold)})`} · {ins.buys} buy{ins.buys === 1 ? "" : "s"}
                    {ins.buys > 0 && ` ($${compact(ins.bought)})`}
                  </>
                ) : (
                  <span className="hs-quiet">No filings</span>
                )}
              </dd>
            </div>
            <div>
              <dt>The crowd</dt>
              <dd>
                {chat && chatTotal > 0 ? (
                  <>
                    {Math.round((chat.bullish / chatTotal) * 100)}% bullish · {compact(chat.watchers)} watching
                  </>
                ) : (
                  <span className="hs-quiet">Quiet</span>
                )}
              </dd>
            </div>
          </dl>
        ) : (
          !loading && <p className="hs-search__none">{shown.sym} isn&apos;t on the public desk. It follows {tracked} large names here; members get the full scanner.</p>
        )}
        <div className="hs-search__try" role="group" aria-label="Try another ticker">
          {examples.map((sym) => (
            <button key={sym} type="button" aria-pressed={shown.sym === sym} onClick={() => pick(sym)}>
              {sym}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
