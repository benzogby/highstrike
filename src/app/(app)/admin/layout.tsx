import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AdminTabs from "./AdminTabs";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Admin — HighStrike",
  // Saved to a phone's home screen, Admin opens as its own app, straight to Overview (as getripping.com's does).
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Admin", statusBarStyle: "black-translucent" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/admin");

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin, name, avatar_url")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) redirect("/dashboard");

  return (
    <AppShell
      email={user.email ?? ""}
      isAdmin
      active="admin"
      displayName={me?.name}
      avatarUrl={me?.avatar_url}
    >
      <PageHeader title="Admin" subtitle="The control room: accounts, payments, growth, content and how the site is holding up." />
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-8">
        <AdminTabs />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
