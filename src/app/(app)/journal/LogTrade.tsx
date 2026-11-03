"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BUTTON_PRIMARY_SM, INPUT, LABEL } from "@/components/ui";
import { logTrade } from "./actions";

/** "Log a trade": a trade of your own (shares), not from an idea, in a small dialog. */
export default function LogTrade() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const d = dialog.current;
    const reset = () => {
      setError("");
      form.current?.reset();
      setDirection("long");
    };
    d?.addEventListener("close", reset);
    return () => d?.removeEventListener("close", reset);
  }, []);

  return (
    <>
      <button type="button" className={`inline-flex items-center gap-1.5 ${BUTTON_PRIMARY_SM}`} onClick={() => dialog.current?.showModal()}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Log a trade
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="hs-log-title"
        className="m-auto w-[min(100%-2rem,26rem)] rounded-2xl border border-line-strong bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialog.current && !pending) dialog.current?.close();
        }}
      >
        <form
          ref={form}
          className="grid gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError("");
            start(async () => {
              const r = await logTrade({
                ticker: f.get("ticker"),
                direction,
                price: f.get("price"),
                quantity: f.get("quantity"),
                target: f.get("target"),
                stop: f.get("stop"),
                notes: f.get("notes"),
              }).catch(() => ({ ok: false as const, error: "That didn't work. Try again." }));
              if (r.ok) dialog.current?.close();
              else setError(r.error);
            });
          }}
        >
          <div className="flex items-center justify-between">
            <h2 id="hs-log-title" className="font-display text-lg">
              Log a trade
            </h2>
            <button type="button" aria-label="Close" onClick={() => dialog.current?.close()} className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-panel-2 hover:text-ink">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={LABEL}>Ticker</span>
              <input name="ticker" required autoCapitalize="characters" spellCheck={false} placeholder="AAPL" className={`${INPUT} font-mono-nums uppercase`} />
            </label>
            <div>
              <span className={LABEL}>Side</span>
              <div className="grid h-9 grid-cols-2 rounded-lg bg-bg p-0.5 ring-1 ring-inset ring-line-strong">
                {(["long", "short"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={direction === s}
                    onClick={() => setDirection(s)}
                    className={`rounded-md text-sm font-medium transition ${direction === s ? (s === "long" ? "bg-up-soft text-up" : "bg-down-soft text-down") : "text-ink-3 hover:text-ink"}`}
                  >
                    {s === "long" ? "Long" : "Short"}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className={LABEL}>Price per share</span>
              <input name="price" required inputMode="decimal" placeholder="0.00" className={`${INPUT} font-mono-nums`} />
            </label>
            <label>
              <span className={LABEL}>Shares</span>
              <input name="quantity" required inputMode="decimal" placeholder="10" className={`${INPUT} font-mono-nums`} />
            </label>
            <label>
              <span className={LABEL}>Target (optional)</span>
              <input name="target" inputMode="decimal" placeholder="0.00" className={`${INPUT} font-mono-nums`} />
            </label>
            <label>
              <span className={LABEL}>Stop (optional)</span>
              <input name="stop" inputMode="decimal" placeholder="0.00" className={`${INPUT} font-mono-nums`} />
            </label>
          </div>
          <label>
            <span className={LABEL}>Notes (optional)</span>
            <textarea
              name="notes"
              rows={3}
              maxLength={4000}
              placeholder="Why you took it"
              className="w-full rounded-lg border border-line-strong bg-bg px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-down">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="h-10 rounded-lg bg-accent text-sm font-semibold text-on-accent transition hover:bg-accent-2 disabled:opacity-60">
            {pending ? "Saving…" : "Add to my trades"}
          </button>
        </form>
      </dialog>
    </>
  );
}
