"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BUTTON_PRIMARY, CARD, INPUT } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["What would make this idea wrong?", "Which strike and expiry fit this?", "What if it gaps against me at the open?"];

/** Ask the AI about this idea: the member's own thread, kept between visits. */
export default function AskAI({ id, ticker, initial }: { id: string; ticker: string; initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgs.length > initial.length) end.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length, initial.length]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setQ("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    try {
      const r = await fetch(`/api/ideas/${id}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      const j = (await r.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (j.answer) setMsgs((m) => [...m, { role: "assistant", content: j.answer! }]);
      else {
        setError(j.error ?? "No answer came back.");
        setMsgs((m) => m.slice(0, -1));
        setQ(text);
      }
    } catch {
      setError("Couldn't reach the AI. Check your connection.");
      setMsgs((m) => m.slice(0, -1));
      setQ(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ask-title" className={`${CARD} flex flex-col p-4`}>
      <h2 id="ask-title" className="text-[15px] font-medium text-ink">
        Ask the AI about {ticker}
      </h2>
      <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto text-sm">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} disabled={busy} className="rounded-full border border-line-strong bg-panel-2 px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, n) => (
          <div key={n} className={m.role === "user" ? "ml-8 rounded-lg bg-panel-2 px-3 py-2 text-ink" : "mr-4 whitespace-pre-wrap leading-relaxed text-ink-2"}>
            {m.content}
          </div>
        ))}
        {busy && <p className="text-ink-3">Thinking…</p>}
        <div ref={end} />
      </div>
      {error && <p className="mt-2 text-sm text-down">{error}</p>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask anything about this ${ticker} idea`} maxLength={1000} className={INPUT} aria-label="Your question" />
        <button type="submit" disabled={busy || !q.trim()} className={BUTTON_PRIMARY}>
          Ask
        </button>
      </form>
      <p className="mt-2 text-xs text-ink-3">Commentary, not advice. The AI can be wrong.</p>
    </section>
  );
}
