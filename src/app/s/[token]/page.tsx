import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sharedCard } from "@/lib/options/share";
import { STRUCTURES } from "@/lib/options/cards";
import SetupCard from "../../(app)/swipe/SetupCard";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const s = await sharedCard(token);
  if (!s) return { title: "HighStrike" };
  const title = `${s.card.ticker} ${STRUCTURES[s.card.structure]?.label ?? "setup"} on HighStrike`;
  const image = `/api/share/${token}/image`;
  return {
    title,
    description: s.card.why,
    openGraph: { title, description: s.card.why, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description: s.card.why, images: [image] },
  };
}

/**
 * A shared setup (step 5 of the swipe app): the card as it was saved, open to anyone with the link, and the way into the
 * deck. Nothing about who shared it.
 */
export default async function SharedSetup({ params }: Props) {
  const { token } = await params;
  const s = await sharedCard(token);
  if (!s) notFound();
  return (
    <main className="mx-auto flex min-h-svh max-w-[440px] flex-col gap-5 bg-bg px-4 py-8">
      <Link href="/" className="font-display text-lg text-ink">
        HighStrike
      </Link>
      <article className="rounded-2xl border border-line-strong bg-panel p-4">
        <SetupCard c={{ ...s.card, closes: s.card.closes ?? [], crowd: null }} open crowd={false} />
      </article>
      {(s.status === "win" || s.status === "loss") && (
        <p className={`text-center text-sm font-medium ${s.status === "win" ? "text-up" : "text-down"}`}>
          This setup {s.status === "win" ? "won" : "lost"} {s.pnl != null ? `${s.pnl >= 0 ? "+" : "−"}$${Math.abs(Math.round(s.pnl)).toLocaleString("en-US")}` : ""} per contract (estimated).
        </p>
      )}
      <Link href="/swipe" className="inline-flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent hover:bg-accent-2">
        Swipe setups like this
      </Link>
      <p className="text-center text-xs text-ink-3">Estimated prices, not live quotes. Not investment advice.</p>
    </main>
  );
}
