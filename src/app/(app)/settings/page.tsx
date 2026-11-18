import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import AlertsManager from "./AlertsManager";
import DigestSwitch from "./DigestSwitch";
import BillingSection from "./BillingSection";
import { supabaseService } from "@/lib/stripe";
import { billingReady, billingState, recheckMember, type BillingState } from "@/lib/billing";
import { CARD, PageHeader } from "@/components/ui";
import Link from "next/link";
import { STYLES } from "@/lib/ideas";
import { profileOf, usd } from "@/lib/tradingProfile";

export const metadata: Metadata = {
  title: "Settings — HighStrike",
};

type Props = { searchParams: Promise<{ billing?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { user, profile } = await requireMember("/settings");
  const q = await searchParams;
  // Back from Stripe's billing page: what changed there (a cancellation, a new card) shows now, not at the next webhook.
  if (q.billing === "back" && billingReady()) await recheckMember(user.id).catch(() => null);

  const [{ data: prefs }, billing] = await Promise.all([
    supabaseService().from("profiles").select("digest_email").eq("id", user.id).maybeSingle(),
    billingState(user, profile).catch((): BillingState => (profile?.is_admin ? { kind: "admin" } : { kind: "none", ended: false })),
  ]);

  const providers: string[] = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : user.app_metadata?.provider
      ? [user.app_metadata.provider]
      : [];

  return (
    <>
      <PageHeader title="Settings" subtitle="Your morning email, price alerts, profile, sign-in and billing." />
      <div className="mt-8 max-w-3xl space-y-10">
        <TradingAnswers profile={profile} />
        <DigestSwitch initial={prefs?.digest_email ?? true} />
        <AlertsManager />
        <SettingsForm
          userId={user.id}
          email={user.email ?? ""}
          hasPassword={providers.includes("email")}
          initial={{
            name: profile?.name ?? "",
            bio: profile?.bio ?? "",
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
        <BillingSection state={billing} unavailable={q.billing === "unavailable"} />
      </div>
    </>
  );
}

/** The three first questions' answers, which every size in the app starts from, and the way back to change them. */
function TradingAnswers({ profile }: { profile: Parameters<typeof profileOf>[0] }) {
  const p = profileOf(profile);
  return (
    <section>
      <h2 className="font-display text-[15px] text-ink">Your trading</h2>
      <div className={`${CARD} mt-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5`}>
        <p className="text-sm text-ink-2">
          {p ? (
            <>
              <span className="font-mono-nums text-ink">{usd(p.account)}</span> account · risk <span className="font-mono-nums text-ink">{p.riskPct}%</span> ({usd((p.account * p.riskPct) / 100)}) a trade ·{" "}
              {STYLES[p.style]}
            </>
          ) : (
            "Tell HighStrike your account size, risk per trade and style, and every size is worked out for you."
          )}
        </p>
        <Link href="/start" className="text-sm font-medium text-accent hover:underline">
          {p ? "Change" : "Answer 3 questions"}
        </Link>
      </div>
    </section>
  );
}
