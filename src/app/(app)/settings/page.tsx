import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import AlertsManager from "./AlertsManager";
import { PageHeader } from "@/components/ui";

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
    <>
      <PageHeader title="Settings" subtitle="Your profile, sign-in, price alerts and membership." />
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
    </>
  );
}
