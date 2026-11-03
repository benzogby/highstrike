import Link from "next/link";
import Avatar from "@/components/Avatar";
import InstallBanner from "@/components/InstallBanner";
import BrandMark from "@/components/BrandMark";
import CommandBar from "@/components/CommandBar";
import MobileNav from "@/components/MobileNav";
import NavIcon from "@/components/NavIcon";
import NotificationBell from "@/components/NotificationBell";
import SideNav, { TopAction } from "@/components/SideNav";
import Toaster from "@/components/Toaster";
import { MarketClock } from "@/components/Now";
import { SIGN_OUT_ICON } from "@/components/appNav";
import type { Logos } from "@/lib/brand";

// The app's frame (Ben, 2026-11-02: "more premium, try going toward a replit theme but with our colors... only dark
// mode"): one dark ground for the sidebar, the top bar and the page, split by hairlines, with cards raised a step above
// it. The sidebar names the product, lists the pages (SideNav: the current one lifted onto the next step, its icon in
// green), keeps Admin and Settings at its foot, then the account. The top bar holds search, whether the market is open
// with the time in New York, the notifications bell, and one green action. Below lg the sidebar hides and a bar along the bottom takes its place
// (MobileNav, Ben 2026-11-03), so the page leaves room for it; the frame keeps clear of a phone's notch and home
// indicator (the (app) layout sets viewport-fit=cover).
//
// It's drawn once by the (app) layout and stays mounted while pages change ("tab change clicks to work much quicker"):
// only the page beside it is swapped, behind each route's loading skeleton, and each page fades in (`route-in`).

export default function AppShell({
  email,
  isAdmin,
  displayName,
  avatarUrl,
  logos,
  children,
}: {
  email: string;
  isAdmin: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  logos: Logos;
  children: React.ReactNode;
}) {
  const firstName = displayName || email.split("@")[0];

  return (
    <div data-app-shell="" className="min-h-screen bg-bg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex h-14 flex-none items-center border-b border-line px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="HighStrike, home">
            <BrandMark size={22} withName logos={logos} />
          </Link>
        </div>
        <SideNav isAdmin={isAdmin} />
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={firstName} url={avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{firstName}</p>
              <p className="truncate text-xs text-ink-3">{email}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition hover:bg-panel-2 hover:text-ink"
              >
                <NavIcon d={SIGN_OUT_ICON} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label="HighStrike, home">
              <BrandMark size={20} withName logos={logos} />
            </Link>
            <div className="flex flex-1 items-center justify-end lg:justify-start">
              <CommandBar isAdmin={isAdmin} />
            </div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <MarketClock />
              <NotificationBell />
              <TopAction />
            </div>
          </div>
        </header>

        <main className="route-in mx-auto w-full max-w-[1280px] px-4 pb-[calc(5rem_+_env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Phones only, once: add HighStrike to the home screen (Ben, 2026-11-03). */}
          <InstallBanner />
          {children}
        </main>
      </div>
      <MobileNav isAdmin={isAdmin} email={email} firstName={firstName} avatarUrl={avatarUrl} />
      <Toaster />
    </div>
  );
}
