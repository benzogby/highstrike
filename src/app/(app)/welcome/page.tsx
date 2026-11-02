import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { billingReady, completeLifetime, type Completion } from "@/lib/lifetime";
import { PAYWALL, memberContext } from "@/lib/membership";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome — HighStrike" };

type Props = { searchParams: Promise<{ payment_intent?: string; session_id?: string }> };

const BUTTON = "inline-flex h-11 items-center justify-center rounded-lg px-5 font-display text-sm font-semibold transition";

/**
 * Where a paid checkout lands: the popup's card form, a bank's 3-D Secure page, or Stripe's own checkout page. It checks
 * the payment with Stripe and turns the membership on before anything draws (src/lib/lifetime.ts → completeLifetime),
 * so access is there the moment the page is. A payment still clearing says so; one that didn't go through goes back to
 * the paywall.
 */
export default async function WelcomePage({ searchParams }: Props) {
  const { payment_intent, session_id } = await searchParams;
  const { user, profile, member } = await memberContext("/welcome");
  let state: Completion | "error" = member ? "member" : "unpaid";
  if (!member && billingReady()) {
    state = await completeLifetime(
      { id: user.id, email: user.email ?? null },
      { paymentIntent: payment_intent ?? null, session: session_id ?? null }
    ).catch((e) => {
      console.error("welcome:", e instanceof Error ? e.message : e);
      return "error" as const;
    });
  }
  if (state === "unpaid") redirect(PAYWALL);

  const again = `/welcome?${new URLSearchParams({ ...(payment_intent ? { payment_intent } : {}), ...(session_id ? { session_id } : {}) })}`;
  return (
    <AppShell email={user.email ?? ""} isAdmin={Boolean(profile?.is_admin)} active="none" displayName={profile?.name} avatarUrl={profile?.avatar_url}>
      <div className="anim-rise mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-16">
        {state === "member" ? (
          <>
            <span className="grid size-16 place-items-center rounded-full bg-accent text-bg">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-8">
                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">You&apos;re in</h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">
              Lifetime access is on. Today&apos;s trades, every tool and the whole Alpha Mastermind are open to you now, with nothing more to pay.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className={`${BUTTON} bg-accent text-bg hover:bg-accent-2`}>
                Open today&apos;s trades
              </Link>
              <Link href="/education" className={`${BUTTON} border border-line-strong text-ink hover:border-accent/50 hover:text-accent`}>
                Start the Alpha Mastermind
              </Link>
            </div>
            {!profile?.is_admin && <p className="mt-6 text-sm text-ink-3">Stripe emails your receipt to {user.email}.</p>}
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {state === "pending" ? "Your payment is clearing" : "We couldn't check your payment just now"}
            </h1>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink-2">
              {state === "pending"
                ? "Stripe is still confirming it with your bank. Access turns on the moment it does, so give it a minute and refresh."
                : "If you paid, nothing is lost: refresh in a moment and access turns on. Still stuck? Write to support@highstrike.com."}
            </p>
            <Link href={again} className={`mt-8 ${BUTTON} bg-accent text-bg hover:bg-accent-2`}>
              Refresh
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
