"use client";

import { useState, useTransition } from "react";
import { CARD, HINT } from "@/components/ui";
import { setDigest } from "./digestActions";

/** The morning ideas email, on or off. */
export default function DigestSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const flip = () => {
    const next = !on;
    setOn(next);
    setError("");
    start(async () => {
      try {
        await setDigest(next);
      } catch (e) {
        setOn(!next);
        setError(e instanceof Error ? e.message : "That didn't save.");
      }
    });
  };
  return (
    <section className={`${CARD} flex items-start justify-between gap-4 p-4`}>
      <div>
        <h2 className="text-[15px] font-medium text-ink">Morning ideas email</h2>
        <p className={`${HINT} mt-0.5`}>Before the open on market days: the day&apos;s ideas, and the ones found on your watchlist.</p>
        {error && <p className="mt-1 text-sm text-down">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Morning ideas email"
        disabled={pending}
        onClick={flip}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-panel-3 ring-1 ring-inset ring-line-strong"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </section>
  );
}
