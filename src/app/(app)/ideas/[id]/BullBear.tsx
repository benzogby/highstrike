"use client";

import { useEffect, useState } from "react";
import { BUTTON_SECONDARY, CARD } from "@/components/ui";
import type { Cases } from "@/lib/ideas";

/**
 * The bull case and the bear case, side by side. Written by the AI the first time anyone opens the idea (a few seconds),
 * then kept on it, so everyone after sees it at once.
 */
export default function BullBear({ id, initial }: { id: string; initial: Cases | null }) {
  const [cases, setCases] = useState<Cases | null>(initial);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (cases) return;
    let alive = true;
    fetch(`/api/ideas/${id}/cases`, { method: "POST" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { cases?: Cases; error?: string };
        if (!alive) return;
        if (j.cases) setCases(j.cases);
        else setError(j.error ?? "The case couldn't load.");
      })
      .catch(() => alive && setError("The case couldn't load. Check your connection."));
    return () => {
      alive = false;
    };
  }, [id, cases, tries]);

  const side = (title: string, points: string[] | null, tone: "up" | "down") => (
    <div className={`${CARD} p-4`}>
      <h3 className={`text-sm font-medium ${tone === "up" ? "text-up" : "text-down"}`}>{title}</h3>
      {points ? (
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className={tone === "up" ? "text-up" : "text-down"}>
                {tone === "up" ? "+" : "−"}
              </span>
              {p}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 space-y-2" aria-hidden>
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-3.5 animate-pulse rounded bg-panel-2" style={{ width: `${88 - n * 14}%` }} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section aria-labelledby="bb-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="bb-title" className="text-[15px] font-medium text-ink">
          Bull case vs bear case
        </h2>
        {!cases && !error && <span className="text-xs text-ink-3">The AI is writing it…</span>}
      </div>
      {error ? (
        <div className={`${CARD} mt-3 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-ink-2`}>
          {error}
          <button
            type="button"
            className={BUTTON_SECONDARY}
            onClick={() => {
              setError("");
              setTries((t) => t + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {side("Why it could work", cases?.bull ?? null, "up")}
            {side("Why it could fail", cases?.bear ?? null, "down")}
          </div>
          {cases?.verdict && <p className="mt-3 text-sm text-ink-2">{cases.verdict}</p>}
        </>
      )}
    </section>
  );
}
