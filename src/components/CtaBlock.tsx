import { JOIN_LINK } from "@/components/join/events";
import { LIFETIME_PRICE } from "@/lib/offer";

// The pages' closing call: the homepage's popup, which sells the one membership (src/lib/offer.ts).
export default function CtaBlock() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <a
        href={JOIN_LINK}
        className="press rounded-lg bg-accent px-8 py-3.5 font-display text-base font-bold uppercase tracking-wide text-bg transition hover:bg-accent-2"
      >
        Get Lifetime Access
      </a>
      <p className="text-sm text-ink-2">
        {LIFETIME_PRICE} once for the daily trades, the tools and HighStrike Trading School
      </p>
    </div>
  );
}
