import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { stripeEnabled } from "@/lib/stripe";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "Settings — HighStrike",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, bio, avatar_url, plan, is_admin")
    .eq("id", user.id)
    .single();

  const providers: string[] = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : user.app_metadata?.provider
      ? [user.app_metadata.provider]
      : [];

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
      active="settings"
      displayName={profile?.name}
      avatarUrl={profile?.avatar_url}
    >
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-3">Account</p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Settings</h1>
      </div>
      <div className="mt-8 max-w-3xl">
        <SettingsForm
          userId={user.id}
          email={user.email ?? ""}
          hasPassword={providers.includes("email")}
          billing={stripeEnabled()}
          billingNotice={billing === "success" ? "success" : billing === "cancelled" ? "cancelled" : null}
          initial={{
            name: profile?.name ?? "",
            bio: profile?.bio ?? "",
            avatarUrl: profile?.avatar_url ?? null,
            plan: profile?.plan ?? "free",
          }}
        />
      </div>
    </AppShell>
  );
}
