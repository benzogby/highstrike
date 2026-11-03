import type { Metadata } from "next";
import { requireMember } from "@/lib/membership";
import SettingsForm from "./SettingsForm";
import AlertsManager from "./AlertsManager";
import DigestSwitch from "./DigestSwitch";
import { supabaseService } from "@/lib/stripe";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Settings — HighStrike",
};

export default async function SettingsPage() {
  const { user, profile } = await requireMember("/settings");

  const { data: prefs } = await supabaseService().from("profiles").select("digest_email").eq("id", user.id).maybeSingle();

  const providers: string[] = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : user.app_metadata?.provider
      ? [user.app_metadata.provider]
      : [];

  return (
    <>
      <PageHeader title="Settings" subtitle="Your morning email, price alerts, profile, sign-in and membership." />
      <div className="mt-8 max-w-3xl space-y-10">
        <DigestSwitch initial={prefs?.digest_email ?? true} />
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
