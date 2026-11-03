"use client";

import Link from "next/link";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import Sparkline from "@/components/Sparkline";
import { useQuotes, type LiveQuote } from "@/components/useQuotes";
import { BELL_ICON } from "@/components/appNav";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_PRIMARY_SM, CARD, INPUT, PageHeader } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastBus";
import { NAME_MAX, STARTERS, type Watchlist } from "@/lib/watchlists";
import { addStarters, addSymbol, createList, deleteList, removeSymbol, renameList, type Done } from "./actions";

type Props = { lists: Watchlist[]; names: Record<string, string>; trends: Record<string, number[]>; alerted: string[] };

type Change =
  | { kind: "add"; list: string; ticker: string }
  | { kind: "remove"; list: string; ticker: string }
  | { kind: "starters"; list: string }
  | { kind: "rename"; list: string; name: string }
  | { kind: "delete"; list: string };

/** A change shown at once, before the server confirms it (and undone if it doesn't). */
function apply(lists: Watchlist[], c: Change): Watchlist[] {
  const edit = (fn: (l: Watchlist) => Watchlist) => lists.map((l) => (l.id === c.list ? fn(l) : l));
  switch (c.kind) {
    case "add":
      return edit((l) => (l.tickers.includes(c.ticker) ? l : { ...l, tickers: [...l.tickers, c.ticker] }));
    case "remove":
      return edit((l) => ({ ...l, tickers: l.tickers.filter((t) => t !== c.ticker) }));
    case "starters":
      return edit((l) => ({ ...l, tickers: [...new Set([...l.tickers, ...STARTERS])] }));
    case "rename":
      return edit((l) => ({ ...l, name: c.name }));
    case "delete":
      return lists.filter((l) => l.id !== c.list);
  }
}

const TICKER = /^[A-Z][A-Z.-]{0,9}$/;
const pctText = (q: LiveQuote) => `${q.changePct >= 0 ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%`;

/**
 * The Watchlists page (Ben, 2026-11-03: "Watchlists gets its own page"): every list the member keeps, full width, each
 * with its own add box (a ticker or a company), live prices, today's move, the trend and a bell per symbol that opens
 * its price alert. Lists are made, renamed and deleted here; a change shows at once and the server confirms it.
 */
export default function WatchlistsBoard({ lists, names, trends, alerted }: Props) {
  const [shown, change] = useOptimistic(lists, apply);
  const [, startTransition] = useTransition();
  const { quotes, flash, live } = useQuotes(shown.flatMap((l) => l.tickers));
  const alertedSet = new Set(alerted);
  const symbols = new Set(shown.flatMap((l) => l.tickers)).size;
  const goTo = useRef<string | null>(null);

  // A list just made lands at the bottom: bring it into view and put the cursor in its add box.
  useEffect(() => {
    const id = goTo.current;
    const el = id ? document.getElementById(`list-${id}`) : null;
    if (!el) return;
    goTo.current = null;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.querySelector<HTMLInputElement>("input[role=combobox]")?.focus({ preventScroll: true });
  }, [shown]);

  /** Shows the change, asks the server, and answers with its error in words (or null). */
  const run = (c: Change, act: () => Promise<Done>) =>
    new Promise<string | null>((resolve) => {
      startTransition(async () => {
        change(c);
        const r = await act();
        resolve("error" in r ? r.error : null);
      });
    });

  const say = (error: string | null, ok?: string) => (error ? toastError(error) : ok ? toastSuccess(ok) : undefined);

  return (
    <>
      <PageHeader
        className="anim-rise"
        title="Watchlists"
        subtitle="Every list you keep, with live prices. Tap a bell to set a price alert on that stock."
        actions={<NewList onMade={(id) => (goTo.current = id)} />}
      />

      {symbols > 0 && (
        <p className="mt-6 flex items-center gap-2 text-xs font-medium text-ink-3" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-accent" : "bg-ink-3"}`} aria-hidden="true" />
          {shown.length} {shown.length === 1 ? "list" : "lists"} · {symbols} {symbols === 1 ? "symbol" : "symbols"} ·{" "}
          {live === null ? "Getting prices…" : live ? "Live prices, updated every 45 seconds" : "Sample prices for now"}
        </p>
      )}

      <div className={`${symbols > 0 ? "mt-3" : "mt-6"} flex flex-col gap-6`}>
        {shown.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            names={names}
            trends={trends}
            quotes={quotes}
            flash={flash}
            alerted={alertedSet}
            canDelete={shown.length > 1}
            onAdd={(ticker) => run({ kind: "add", list: list.id, ticker }, () => addSymbol(list.id, ticker))}
            onRemove={async (ticker) => say(await run({ kind: "remove", list: list.id, ticker }, () => removeSymbol(list.id, ticker)))}
            onStarters={async () => say(await run({ kind: "starters", list: list.id }, () => addStarters(list.id)), "Added SPY, QQQ, NVDA, AAPL and TSLA")}
            onRename={async (name) => say(await run({ kind: "rename", list: list.id, name }, () => renameList(list.id, name)))}
            onDelete={async () => say(await run({ kind: "delete", list: list.id }, () => deleteList(list.id)), `Deleted “${list.name}”`)}
          />
        ))}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-ink-3">
        Prices can run a little behind the market. Each list holds up to 50 symbols. Market data for information, not investment advice.
      </p>
    </>
  );
}

/** "New list": a name field in place of the button, then the list is made and brought into view. */
function NewList({ onMade }: { onMade: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setError("");
    requestAnimationFrame(() => button.current?.focus());
  };

  if (!open) {
    return (
      <button ref={button} type="button" onClick={() => setOpen(true)} className={BUTTON_PRIMARY}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New list
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
        if (!name) return setError("Give the list a name.");
        start(async () => {
          const r = await createList(name);
          if ("error" in r) return setError(r.error);
          if (r.id) onMade(r.id);
          setOpen(false);
          setError("");
        });
      }}
    >
      <input
        name="name"
        autoFocus
        maxLength={NAME_MAX}
        placeholder="Name the list, like Earnings week"
        aria-label="New list's name"
        onKeyDown={(e) => e.key === "Escape" && close()}
        className={`${INPUT} w-64 max-w-full`}
      />
      <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
        {pending ? "Making…" : "Make list"}
      </button>
      <button type="button" onClick={close} className={BUTTON_GHOST}>
        Cancel
      </button>
      {error && (
        <p role="alert" className="basis-full text-xs text-down">
          {error}
        </p>
      )}
    </form>
  );
}

type CardProps = {
  list: Watchlist;
  names: Record<string, string>;
  trends: Record<string, number[]>;
  quotes: Record<string, LiveQuote>;
  flash: Record<string, "up" | "down">;
  alerted: Set<string>;
  canDelete: boolean;
  onAdd: (ticker: string) => Promise<string | null>;
  onRemove: (ticker: string) => void;
  onStarters: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/** One list: its name (rename, delete), the add box, then a row per symbol. */
function ListCard({ list, names, trends, quotes, flash, alerted, canDelete, onAdd, onRemove, onStarters, onRename, onDelete }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const n = list.tickers.length;

  const stopEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => renameButton.current?.focus());
  };

  return (
    <section id={`list-${list.id}`} aria-labelledby={titleId} className={`${CARD} scroll-mt-20`}>
      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
        {editing ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
              if (name && name !== list.name) onRename(name);
              stopEditing();
            }}
          >
            <h2 id={titleId} className="sr-only">
              {list.name}
            </h2>
            <input
              name="name"
              defaultValue={list.name}
              autoFocus
              maxLength={NAME_MAX}
              aria-label="List name"
              onKeyDown={(e) => e.key === "Escape" && stopEditing()}
              className={`${INPUT} w-64 max-w-full`}
            />
            <button type="submit" className={`inline-flex ${BUTTON_PRIMARY_SM}`}>
              Save
            </button>
            <button type="button" onClick={stopEditing} className={BUTTON_GHOST}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2 id={titleId} className="min-w-0 truncate font-display text-[15px] text-ink">
              {list.name}
            </h2>
            <span className="text-xs text-ink-3">
              {n} {n === 1 ? "symbol" : "symbols"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {confirming ? (
                <>
                  <span className="text-[13px] text-ink-2">Delete this list{n ? ` and its ${n} ${n === 1 ? "symbol" : "symbols"}` : ""}?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      onDelete();
                    }}
                    className="inline-flex h-8 items-center rounded-md bg-down-soft px-2.5 text-[13px] font-medium text-down ring-1 ring-inset ring-down/25 transition hover:bg-down/20"
                  >
                    Delete
                  </button>
                  <button type="button" autoFocus onClick={() => setConfirming(false)} className={BUTTON_GHOST}>
                    Keep it
                  </button>
                </>
              ) : (
                <>
                  <button ref={renameButton} type="button" onClick={() => setEditing(true)} className={BUTTON_GHOST}>
                    Rename
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition hover:bg-down-soft hover:text-down"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-4 pt-3">
        <AddSymbol list={list} onAdd={onAdd} />
      </div>

      {n === 0 ? (
        <div className="px-4 pb-8 pt-6 text-center">
          <p className="text-sm text-ink-3">No symbols yet. Add a ticker above, or start with the classics.</p>
          <button type="button" onClick={onStarters} className={`${BUTTON_PRIMARY} press mt-3`}>
            Add {STARTERS.join(", ")}
          </button>
        </div>
      ) : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">{list.name}: last price, today&apos;s move and trend for each symbol</caption>
          <thead>
            <tr className="border-y border-line text-left text-xs text-ink-3">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Symbol
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Last
              </th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">
                Today
              </th>
              <th scope="col" className="hidden px-3 py-2.5 text-right font-medium md:table-cell">
                Trend
              </th>
              <th scope="col" className="px-3 py-2.5 sm:px-4">
                <span className="sr-only">Price alert and remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.tickers.map((t) => {
              const q = quotes[t];
              const up = (q?.changePct ?? 0) >= 0;
              const on = alerted.has(t);
              const moved = flash[t] === "up" ? "flash-up" : flash[t] === "down" ? "flash-down" : "";
              return (
                <tr key={t} className="transition-colors hover:bg-panel-2/50">
                  <td className="w-full max-w-0 px-4 py-2.5">
                    <Link href={`/symbol/${t}`} className="font-mono-nums font-semibold text-ink transition hover:text-accent">
                      {t}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">{names[t] ?? " "}</span>
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono-nums text-ink ${moved}`}>
                    {q ? q.price.toFixed(2) : "—"}
                    <span className={`block text-xs sm:hidden ${q ? (up ? "text-up" : "text-down") : "text-ink-3"}`}>{q ? pctText(q) : " "}</span>
                  </td>
                  <td className={`hidden whitespace-nowrap px-3 py-2.5 text-right font-mono-nums sm:table-cell ${q ? (up ? "text-up" : "text-down") : "text-ink-3"}`}>
                    {q ? pctText(q) : "—"}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right md:table-cell">
                    <Sparkline values={trends[t]} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                    <span className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/symbol/${t}#alerts`}
                        aria-label={on ? `${t} has a price alert. Change it` : `Set a price alert on ${t}`}
                        title={on ? "Price alert set" : "Set a price alert"}
                        className={`grid h-9 w-9 place-items-center rounded-md transition hover:bg-panel-3 ${on ? "text-accent" : "text-ink-3 hover:text-ink"}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={BELL_ICON} />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => onRemove(t)}
                        aria-label={`Remove ${t} from ${list.name}`}
                        title="Remove"
                        className="grid h-9 w-9 place-items-center rounded-md text-ink-3 transition hover:bg-down-soft hover:text-down"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

type Hit = { ticker: string; name: string };

/**
 * The add box: a ticker, or part of a company's name, with matches to pick from (arrow keys and Enter, or a tap).
 * Enter adds the highlighted match, else the ticker typed, else a name's first match.
 */
function AddSymbol({ list, onAdd }: { list: Watchlist; onAdd: (ticker: string) => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const asked = useRef(0);
  const box = useId();

  const search = (value: string) => {
    setText(value);
    setError("");
    setActive(-1);
    clearTimeout(timer.current);
    const term = value.trim();
    if (!term) {
      asked.current++;
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const mine = ++asked.current;
      try {
        const r = await fetch(`/api/symbols/search?q=${encodeURIComponent(term)}`);
        const d = (await r.json()) as { results?: Hit[] };
        if (mine === asked.current) setHits((d.results ?? []).filter((h) => !list.tickers.includes(h.ticker)).slice(0, 6));
      } catch {
        if (mine === asked.current) setHits([]);
      }
    }, 200);
  };

  const add = async (raw: string) => {
    const ticker = raw.trim().toUpperCase().replace(/^\$/, "");
    if (!TICKER.test(ticker)) return setError("Type a ticker like NVDA, or pick a company from the list.");
    if (list.tickers.includes(ticker)) return setError(`${ticker} is already on this list.`);
    asked.current++;
    clearTimeout(timer.current);
    setText("");
    setHits([]);
    setActive(-1);
    setError("");
    setAdding(true);
    const problem = await onAdd(ticker);
    setAdding(false);
    if (problem) setError(problem);
  };

  const enter = () => {
    if (active >= 0 && hits[active]) return add(hits[active].ticker);
    const typed = text.trim().toUpperCase().replace(/^\$/, "");
    if (!typed) return;
    // What was typed, when it can be a ticker (five letters at most, or a class like BRK.B); a name ("nvidia") takes
    // its first match.
    if (TICKER.test(typed) && (typed.length <= 5 || /[.-]/.test(typed))) return add(typed);
    return add(hits[0]?.ticker ?? typed);
  };

  return (
    <div className="relative">
      <input
        value={text}
        onChange={(e) => search(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && hits.length) {
            e.preventDefault();
            setActive((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp" && hits.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            void enter();
          } else if (e.key === "Escape") {
            setHits([]);
            setActive(-1);
          }
        }}
        onBlur={() => {
          setHits([]);
          setActive(-1);
        }}
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={box}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${box}-${active}` : undefined}
        aria-label={`Add a symbol to ${list.name}`}
        aria-describedby={error ? `${box}-error` : undefined}
        placeholder={adding ? "Adding…" : "Add a ticker or company, like NVDA or Apple"}
        autoComplete="off"
        spellCheck={false}
        className={`${INPUT} h-10`}
      />
      {hits.length > 0 && (
        <ul id={box} role="listbox" aria-label="Matches" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line-strong bg-panel-2 py-1 shadow-2xl shadow-black/50">
          {hits.map((h, i) => (
            <li
              key={h.ticker}
              id={`${box}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void add(h.ticker)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 text-sm ${i === active ? "bg-panel-3" : ""}`}
            >
              <span className="w-16 flex-none font-mono-nums font-semibold text-ink">{h.ticker}</span>
              <span className="truncate text-[13px] text-ink-3">{h.name}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${box}-error`} role="alert" className="mt-1.5 text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
