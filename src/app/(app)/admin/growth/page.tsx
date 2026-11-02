import { Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/adminGate";
import { growth } from "@/lib/adminGrowth";
import GrowthChart from "./GrowthChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Growth — Admin — HighStrike" };

/** Admin → Growth (from getripping.com's): the members, then revenue, sales and new accounts a day at a time. */
export default async function AdminGrowthPage() {
  await requireAdmin();
  const g = await growth(30);
  const conversion = g.accounts ? Math.round((g.members / g.accounts) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Lifetime members" value={g.members.toLocaleString("en-US")} />
        <Stat label="Accounts" value={g.accounts.toLocaleString("en-US")} />
        <Stat label="Accounts that paid" value={`${conversion}%`} />
      </div>
      {!g.stripe && <p className="text-sm text-ink-3">Stripe isn&apos;t set up here, so revenue and sales show as zero.</p>}
      <GrowthChart days={g.days} />
    </div>
  );
}
