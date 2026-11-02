import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import CommandBar from "@/components/CommandBar";
import MobileNav from "@/components/MobileNav";
import Toaster from "@/components/Toaster";
import { MarketClock } from "@/components/Now";
import { BUTTON_PRIMARY_SM } from "@/components/ui";

// The app's frame (Ben, 2026-11-02: "more premium, try going toward a replit theme but with our colors... only dark
// mode"): one dark ground for the sidebar, the top bar and the page, split by hairlines, with cards raised a step above
// it. The sidebar names the product, lists the pages with the current one lifted onto the next step and its icon in
// green, keeps Admin and Settings at its foot, then the account. The top bar holds search, whether the market is open
// with the time in New York, and one green action. Colours are globals.css's tokens.

const nav = [
  {
    label: "Home",
    key: "home",
    href: "/dashboard",
    icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-6h4v6a1 1 0 001 1h3a1 1 0 001-1V10",
  },
  {
    label: "Setups",
    key: "setups",
    href: "/setups",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    label: "Scanner",
    key: "scanner",
    href: "/scanner",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  },
  {
    label: "Watchlists",
    icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
  },
  {
    label: "Insider feed",
    key: "insiders",
    href: "/insiders",
    icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    label: "Chatter",
    key: "chatter",
    href: "/chatter",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    label: "Trading School",
    key: "education",
    href: "/education",
    icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 12c0 2.21-.895 4.21-2.343 5.657L12 21l-6.657-3.343A7.962 7.962 0 013 12c0-1.192.26-2.323.727-3.339L12 14z",
  },
];

type Active = "home" | "setups" | "scanner" | "insiders" | "chatter" | "education" | "admin" | "settings" | "none";

export default function AppShell({
  email,
  isAdmin,
  active,
  displayName,
  avatarUrl,
  children,
}: {
  email: string;
  isAdmin: boolean;
  active: Active;
  displayName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const firstName = displayName || email.split("@")[0];

  return (
    <div data-app-shell="" className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex h-14 flex-none items-center border-b border-line px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="HighStrike, home">
            <BrandMark size={22} withName />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {nav.map((n) => (
            <NavItem key={n.label} label={n.label} href={"href" in n ? n.href : undefined} icon={n.icon} active={"key" in n && active === n.key} />
          ))}
        </nav>
        <div className="space-y-0.5 px-3 pb-3">
          {isAdmin && <NavItem label="Admin" href="/admin" icon={ADMIN_ICON} active={active === "admin"} />}
          <NavItem label="Settings" href="/settings" icon={SETTINGS_ICON} active={active === "settings"} />
        </div>
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
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 lg:hidden">
              <MobileNav
                items={nav.map((n) => ({
                  label: n.label,
                  href: "href" in n ? n.href : undefined,
                  key: "key" in n ? n.key : undefined,
                }))}
                active={active}
                isAdmin={isAdmin}
                email={email}
                firstName={firstName}
                avatarUrl={avatarUrl}
              />
              <Link href="/dashboard" className="flex items-center" aria-label="HighStrike, home">
                <BrandMark size={20} />
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-end lg:justify-start">
              <CommandBar isAdmin={isAdmin} />
            </div>
            <div className="flex items-center gap-2.5">
              <MarketClock />
              {active === "admin" ? (
                <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line-strong">Admin</span>
              ) : (
                <Link href="/dashboard#watchlist" className={`hidden sm:inline-flex ${BUTTON_PRIMARY_SM}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New watchlist
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

/** One sidebar row: the current page lifted onto the next step with its icon in green, others quiet until hovered, and
 * "Soon" for what isn't built. */
function NavItem({ label, href, icon, active }: { label: string; href?: string; icon: string; active: boolean }) {
  const row = "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition";
  if (active) {
    return (
      <span aria-current="page" className={`${row} bg-panel-2 font-medium text-ink`}>
        <NavIcon d={icon} className="text-accent" />
        {label}
      </span>
    );
  }
  if (!href) {
    return (
      <span className={`${row} justify-between text-ink-3`}>
        <span className="flex items-center gap-2.5">
          <NavIcon d={icon} />
          {label}
        </span>
        <span className="rounded px-1.5 text-[11px] font-medium leading-5 text-ink-3 ring-1 ring-inset ring-line-strong">Soon</span>
      </span>
    );
  }
  return (
    <Link href={href} className={`${row} text-ink-2 hover:bg-panel hover:text-ink`}>
      <NavIcon d={icon} className="text-ink-3 transition group-hover:text-ink-2" />
      {label}
    </Link>
  );
}

/** The account's picture, or its initials on the green tint. */
export function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ width: size, height: size }} className="flex-none rounded-full border border-line object-cover" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-medium uppercase text-accent-ink ring-1 ring-inset ring-accent/25"
    >
      {name.slice(0, 2)}
    </span>
  );
}

const SETTINGS_ICON =
  "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z";
const ADMIN_ICON =
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z";
const SIGN_OUT_ICON = "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

function NavIcon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      <path d={d} />
    </svg>
  );
}
