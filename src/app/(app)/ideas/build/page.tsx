import type { Metadata } from "next";
import Link from "next/link";
import { requireMember } from "@/lib/membership";
import { PageHeader } from "@/components/ui";
import CheckSwitch from "../CheckSwitch";
import BuildForm from "./BuildForm";

export const metadata: Metadata = { title: "Build an idea — HighStrike" };

/** The idea builder (piece 4 of the trade-ideas plan, Ben 2026-11-02): say what you want, get the names that fit now. */
export default async function BuildIdeaPage() {
  await requireMember("/ideas/build");
  return (
    <div className="flex flex-col gap-6">
      <Link href="/ideas" className="text-[13px] text-ink-3 hover:text-ink">
        ← Ideas
      </Link>
      <PageHeader
        title="Build an idea"
        subtitle="Say what kind of trade you want. HighStrike scans the market right now and shows what fits, with the reasons."
        actions={<CheckSwitch on="build" />}
      />
      <BuildForm />
    </div>
  );
}
