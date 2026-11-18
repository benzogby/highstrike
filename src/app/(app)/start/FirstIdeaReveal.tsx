"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Badge, BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/components/ui";
import Confetti from "./Confetti";
import type { FirstIdeaCard } from "./actions";

const money = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);

/**
 * The end of the three questions (Ben, 2026-11-18: "show a confetti screen with the first trade idea as a card"): confetti,
 * then today's best idea for their answers as a card, sized for them, with the way into it. The app behind refreshes on
 * the way out, so the popup doesn't come back.
 */
export default function FirstIdeaReveal({ card }: { card: FirstIdeaCard | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) =>
    start(() => {
      router.push(href);
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-xl text-center">
      <Confetti />
      <span className="anim-reveal mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-7">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h1 className="anim-reveal mt-4 font-display text-[26px] leading-tight text-ink sm:text-[28px]" style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
        {card ? "Your first trade idea" : "You're all set"}
      </h1>
      <p className="anim-reveal mt-2 text-sm text-ink-2" style={{ "--reveal-delay": "140ms" } as React.CSSProperties}>
        {card ? "Today's best idea for your account and style, sized by your own risk rule." : "Today's ideas haven't landed yet. Yours will be sized for your account the moment they do."}
      </p>

      {card && (
        <div
          className="anim-reveal mt-6 rounded-xl border border-line-strong bg-panel-2 p-5 text-left shadow-[0_18px_50px_-20px_rgb(31_191_134/0.45)]"
          style={{ "--reveal-delay": "260ms" } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono-nums text-[22px] font-semibold leading-none text-ink">{card.ticker}</span>
            <Badge tone={card.direction === "long" ? "up" : "down"}>{card.direction === "long" ? "Long" : "Short"}</Badge>
            <span className="ml-auto text-xs text-ink-3">{card.timeFrame}</span>
          </div>
          <p className="mt-3 text-[15px] leading-snug text-ink">{card.headline}</p>
          <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-center">
            {(
              [
                ["Entry", money(card.entry), "text-ink"],
                ["Target", money(card.target), "text-up"],
                ["Stop", money(card.stop), "text-down"],
              ] as const
            ).map(([k, v, c]) => (
              <div key={k} className="bg-panel px-2 py-2.5">
                <dt className="text-[11px] text-ink-3">{k}</dt>
                <dd className={`mt-0.5 font-mono-nums text-[15px] ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-lg bg-accent-soft px-3.5 py-3">
            <p className="text-xs text-accent-ink">Sized for you</p>
            <p className="mt-0.5 font-mono-nums text-[17px] font-semibold text-ink">{card.size}</p>
            {card.detail && <p className="mt-0.5 font-mono-nums text-xs text-ink-2">{card.detail}</p>}
            {card.risk && <p className="mt-0.5 text-xs text-ink-2">Risks about {card.risk} if it goes wrong</p>}
          </div>
        </div>
      )}

      <div className="anim-reveal mt-6 flex flex-wrap justify-center gap-3" style={{ "--reveal-delay": "380ms" } as React.CSSProperties}>
        {card && (
          <button type="button" disabled={pending} onClick={() => go("/start/idea")} className={BUTTON_PRIMARY}>
            See it on the chart
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => go("/dashboard")} className={card ? BUTTON_SECONDARY : BUTTON_PRIMARY}>
          Go to the dashboard
        </button>
      </div>
      <p className="mt-6 text-xs text-ink-3">Market commentary and education, not investment advice. Option prices are estimates.</p>
    </div>
  );
}
