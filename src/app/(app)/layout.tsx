import AppShell from "@/components/AppShell";
import { brandLogos } from "@/lib/brand";
import { viewer } from "@/lib/membership";

// The app's frame, drawn once and kept while pages change (Ben, 2026-11-02: "tab change clicks to work much quicker"):
// a click swaps only the page beside the sidebar, showing that route's loading skeleton at once. Each page still checks
// membership itself (requireMember) before it reads anything, since a layout can't stop a page from rendering; the
// account read here is shared with the page's (viewer is cached per request). Nobody signed in gets no frame: their
// page sends them to Sign in, or (/welcome after paying) shows its own card.

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [me, logos] = await Promise.all([viewer(), brandLogos()]);
  if (!me) return children;
  return (
    <AppShell
      email={me.user.email ?? ""}
      isAdmin={Boolean(me.profile?.is_admin)}
      displayName={me.profile?.name}
      avatarUrl={me.profile?.avatar_url}
      logos={logos}
    >
      {children}
    </AppShell>
  );
}
