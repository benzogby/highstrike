import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/membership";
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
  // The account the (app) layout already read for the frame (cached per request), not a second sign-in check.
  const me = await viewer();
  if (!me) redirect("/signin?next=/admin");
  if (!me.profile?.is_admin) redirect("/dashboard");

  return (
    <>
      <PageHeader title="Admin" subtitle="The control room: accounts, payments, growth, content and how the site is holding up." />
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-8">
        <AdminTabs />
        <div className="route-in min-w-0">{children}</div>
      </div>
    </>
  );
}
