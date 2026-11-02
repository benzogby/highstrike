import Link from "next/link";

/** What an account without a paid plan sees on Education: what the library is, and where to get it. */
export default function Paywall({ summary }: { summary: { modules: number; lessons: number; videoHours: number } | null }) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="anim-rise rounded-2xl border border-line bg-panel p-8 text-center">
        <p className="text-xs uppercase tracking-wider text-ink-3">Education</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Highstrike Alpha Mastermind comes with every paid plan</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
          {summary
            ? `${summary.modules} modules and ${summary.lessons} lessons, from setting up your trading station to options, smart money concepts and selling options, plus every live trading and education recording.`
            : "The full Alpha Mastermind library, from setting up your trading station to options, smart money concepts and selling options, plus every live recording."}
        </p>
        <Link href="/pricing" className="mt-6 inline-flex rounded-lg bg-accent px-5 py-2.5 font-display text-sm font-semibold text-bg transition hover:bg-accent-2">
          See plans
        </Link>
      </div>
    </div>
  );
}
