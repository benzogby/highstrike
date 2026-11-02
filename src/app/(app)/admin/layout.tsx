import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AdminTabs from "./AdminTabs";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "Admin — HighStrike",
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
      <PageHeader title="Admin" subtitle="The control room: the setup engine, members, traffic, content and Trading School." />
      <AdminTabs />
      <div className="mt-8">{children}</div>
    </AppShell>
  );
}
