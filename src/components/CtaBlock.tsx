import { BonusLine } from "@/components/SiteContentBits";

export default function CtaBlock() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <a
        href="/signup"
        className="rounded-lg bg-accent px-8 py-3.5 font-display text-base font-bold uppercase tracking-wide text-bg transition hover:bg-accent-2"
      >
        Get Access Now
      </a>
      <p className="text-sm text-ink-2">Start Trading with HighStrike AI Terminal</p>
      <BonusLine />
    </div>
  );
}
