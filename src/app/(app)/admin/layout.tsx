import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AdminTabs from "./AdminTabs";

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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-3">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Control room
          </h1>
        </div>
      </div>
      <AdminTabs />
      <div className="mt-8">{children}</div>
    </AppShell>
  );
}
