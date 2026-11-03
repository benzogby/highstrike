"use client";

import { useState } from "react";
import { CARD, HINT, INPUT, LABEL } from "@/components/ui";

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 })}`;
const num = (s: string) => {
  const n = Number(s.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * How big to go (Ben's plan, 2026-11-02: "Enter your account size and risk per trade; it says how many contracts or
 * shares"). Shares: the risk divided by the distance to the stop. Options: the risk divided by what one contract costs,
 * since a bought option can lose its whole premium. The option's price starts at the idea's option's estimate, when it
 * has one. Kept in this browser only; nothing is saved.
 */
export default function PositionSizer({ entry, side, optionPrice = null }: { entry: number | null; side: "long" | "short"; optionPrice?: number | null }) {
  const defaultStop = entry ? +(side === "long" ? entry * 0.92 : entry * 1.08).toFixed(2) : 0;
  const [account, setAccount] = useState("10000");
  const [risk, setRisk] = useState("1");
  const [price, setPrice] = useState(entry ? String(entry) : "");
  const [stop, setStop] = useState(defaultStop ? String(defaultStop) : "");
  const [premium, setPremium] = useState(optionPrice ? optionPrice.toFixed(2) : "");

  const acct = num(account);
  const pct = num(risk);
  const at = num(price);
  const out = num(stop);
  const prem = num(premium);
  const budget = acct > 0 && pct > 0 ? (acct * pct) / 100 : NaN;
  const perShare = Math.abs(at - out);
  const shares = budget > 0 && perShare > 0 ? Math.floor(budget / perShare) : NaN;
  const contracts = budget > 0 && prem > 0 ? Math.floor(budget / (prem * 100)) : NaN;
  const wrongSide = at > 0 && out > 0 && (side === "long" ? out >= at : out <= at);

  const field = (label: string, value: string, set: (v: string) => void, hint?: string) => (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className={`${INPUT} font-mono-nums`} />
      {hint && <span className={`${HINT} mt-1 block text-xs`}>{hint}</span>}
    </label>
  );

  return (
    <section aria-labelledby="size-title" className={`${CARD} p-4`}>
      <h2 id="size-title" className="text-[15px] font-medium text-ink">
        Position size
      </h2>
      <p className={`${HINT} mt-0.5`}>How much to put on so a loss costs only what you choose.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {field("Account size ($)", account, setAccount)}
        {field("Risk per trade (%)", risk, setRisk, "1% is a common rule")}
        {field("Entry price ($)", price, setPrice)}
        {field("Stop price ($)", stop, setStop, "Defaults to 8% against you")}
      </div>
      <div className="mt-4 rounded-lg bg-bg/60 p-3 text-sm">
        <p className="flex justify-between text-ink-2">
          <span>You&apos;re risking</span>
          <span className="font-mono-nums text-ink">{budget > 0 ? money(budget) : "—"}</span>
        </p>
        {wrongSide ? (
          <p className="mt-2 text-down">The stop should be {side === "long" ? "below" : "above"} the entry for a {side}.</p>
        ) : (
          <>
            <p className="mt-2 flex justify-between text-ink-2">
              <span>Shares</span>
              <span className="font-mono-nums text-ink">{shares >= 0 ? shares.toLocaleString("en-US") : "—"}</span>
            </p>
            <p className="mt-1 flex justify-between text-xs text-ink-3">
              <span>Position value</span>
              <span className="font-mono-nums">{shares >= 0 && at > 0 ? money(shares * at) : "—"}</span>
            </p>
          </>
        )}
      </div>
      <div className="mt-4">
        {field("Or, an option's price ($ per share)", premium, setPremium, optionPrice ? "Starts at the option's est. price; use the ask in your broker" : "The ask on the contract you're looking at")}
        <p className="mt-2 flex justify-between text-sm text-ink-2">
          <span>Contracts</span>
          <span className="font-mono-nums text-ink">{contracts >= 0 ? contracts.toLocaleString("en-US") : "—"}</span>
        </p>
        <p className={`${HINT} mt-1 text-xs`}>A bought option can go to zero, so this sizes on its whole cost ({prem > 0 ? money(prem * 100) : "price × 100"} a contract).</p>
      </div>
    </section>
  );
}
