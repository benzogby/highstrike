import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { requireMember } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import AlertsManager from "./AlertsManager";

export const metadata: Metadata = {
  title: "Settings — HighStrike",
};

export default async function SettingsPage() {
  const { user, profile } = await requireMember("/settings");

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
      <div className="mt-8 max-w-3xl space-y-10">
        <AlertsManager />
        <SettingsForm
          userId={user.id}
          email={user.email ?? ""}
          hasPassword={providers.includes("email")}
          membership={profile?.plan === "lifetime" ? "lifetime" : "admin"}
          initial={{
            name: profile?.name ?? "",
            bio: profile?.bio ?? "",
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
      </div>
    </AppShell>
  );
}
