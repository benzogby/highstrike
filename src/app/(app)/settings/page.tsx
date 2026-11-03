import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import AlertsManager from "./AlertsManager";
import DigestSwitch from "./DigestSwitch";
import BillingSection from "./BillingSection";
import { supabaseService } from "@/lib/stripe";
import { billingState, type BillingState } from "@/lib/billing";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Settings — HighStrike",
};

type Props = { searchParams: Promise<{ billing?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { user, profile } = await requireMember("/settings");

  const [{ data: prefs }, billing, q] = await Promise.all([
    supabaseService().from("profiles").select("digest_email").eq("id", user.id).maybeSingle(),
    billingState(user, profile).catch((): BillingState => (profile?.is_admin ? { kind: "admin" } : { kind: "none", ended: false })),
    searchParams,
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
