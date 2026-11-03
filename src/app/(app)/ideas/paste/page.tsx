import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import PasteForm from "./PasteForm";

export const metadata: Metadata = { title: "Paste an idea — HighStrike" };

/** Paste any idea (piece 3 of the trade-ideas plan, Ben 2026-11-02): an alert from anywhere, turned into an idea to evaluate. */
export default async function PasteIdeaPage() {
  await requireMember("/ideas/paste");
  return (
    <div className="flex flex-col gap-6">
      <Link href="/ideas" className="text-[13px] text-ink-3 hover:text-ink">
        ← Ideas
      </Link>
      <PageHeader title="Paste an idea" subtitle="Got a trade idea from somewhere else? Paste it, and HighStrike turns it into an idea you can evaluate and follow." />
      <PasteForm />
    </div>
  );
}
