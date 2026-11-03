import { Badge, CARD } from "@/components/ui";
import { contractName, costOf, dayLabel, dollars, gainAtTarget, optionWhy, usd, type OptionIdea } from "@/lib/optionIdea";

/**
 * The idea's option (Ben, 2026-11-03: "each idea gets a suggested option contract, estimated from the stock's own
 * volatility, marked est."), from the rules in src/lib/optionIdea.ts: the contract, what it costs, where it breaks even,
 * the most it can lose, and what it would be worth if the stock reaches the target in time. Every price is an estimate.
 */
export default function SuggestedOption({ ticker, option: o }: { ticker: string; option: OptionIdea }) {
  const call = o.kind === "call" || o.kind === "call_spread";
  const gain = gainAtTarget(o);
  const stats: { label: string; value: string; note: React.ReactNode }[] = [
    { label: "Cost", value: usd(o.premium), note: `${dollars(costOf(o))} a contract (100 shares)` },
    { label: "Breakeven at expiry", value: usd(o.breakeven), note: `${ticker} ${call ? "above" : "below"} this on ${dayLabel(o.expiry, o.asOf)}` },
    { label: "Max loss", value: dollars(costOf(o)), note: "The whole cost, if it ends worthless" },
  ];
  if (o.target != null && o.atTarget != null) {
    stats.push({
      label: `If ${ticker} hits ${usd(o.target)} by ${dayLabel(o.windowEnd, o.asOf)}`,
      value: usd(o.atTarget),
      note: (
        <>
          {dollars(o.atTarget * 100)} a contract
          {gain != null && <span className={gain >= 0 ? "text-up" : "text-down"}>{` · ${gain >= 0 ? "+" : ""}${gain}%`}</span>}
        </>
      ),
    });
  }

  return (
    <section aria-labelledby="option-title" className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="option-title" className="text-[15px] font-medium text-ink">
          {o.pick === "yours" ? "Your option" : "Suggested option"}
        </h2>
        <Badge>est.</Badge>
      </div>
      <p className="mt-2 font-mono-nums text-lg font-semibold leading-snug text-ink">{contractName(ticker, o)}</p>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">{optionWhy(ticker, o)}</p>
      <dl className={`mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${stats.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {stats.map((s, n) => (
          <div key={s.label} className={`bg-panel px-3 py-2.5 ${stats.length % 2 && n === stats.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}>
            <dt className="text-xs text-ink-3">{s.label}</dt>
            <dd className="mt-0.5 font-mono-nums text-[15px] text-ink">
              <span className="text-xs text-ink-3">est. </span>
              {s.value}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3">{s.note}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        est. means estimated from {ticker}&apos;s own moves over its last {o.closes - 1} trading days (a volatility of {Math.round(o.vol * 100)}% a year), at the{" "}
        {usd(o.spot)} entry on {dayLabel(o.asOf)}. It&apos;s not a live quote: check the price in your broker before you trade.
      </p>
    </section>
  );
}
