import Link from "next/link";

// The pages' closing call: a free account and the swipe deck (Ben, 2026-11-02: swiping is the only product, free for now).
export default function CtaBlock() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Link href="/signup" className="press rounded-lg bg-accent px-8 py-3.5 font-display text-base text-on-accent transition hover:bg-accent-2">
        Start swiping free
      </Link>
      <p className="text-sm text-ink-2">Options setups on 350+ stocks, one card at a time. Free while HighStrike is being built.</p>
    </div>
  );
}
