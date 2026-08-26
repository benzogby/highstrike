import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import CommandBar from "@/components/CommandBar";
import MobileNav from "@/components/MobileNav";
import ThemeToggle from "@/components/ThemeToggle";
import { NowTimeET } from "@/components/Now";

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
    label: "Insider Feed",
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
    icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 12c0 2.21-.895 4.21-2.343 5.657L12 21l-6.657-3.343A7.962 7.962 0 013 12c0-1.192.26-2.323.727-3.339L12 14z",
  },
];

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
  active: "home" | "setups" | "scanner" | "insiders" | "chatter" | "admin" | "settings" | "none";
  displayName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const firstName = displayName || email.split("@")[0];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-panel lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark />
        </Link>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {nav.map((n) => {
            const isActive = "key" in n && active === n.key;
            return isActive ? (
              <span
                key={n.label}
                className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm font-semibold text-ink"
              >
                <NavIcon d={n.icon} active />
                {n.label}
              </span>
            ) : "href" in n && n.href ? (
              <Link
                key={n.label}
                href={n.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-panel-2 hover:text-ink"
              >
                <NavIcon d={n.icon} />
                {n.label}
              </Link>
            ) : (
              <span
                key={n.label}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-2"
              >
                <span className="flex items-center gap-3">
                  <NavIcon d={n.icon} />
                  {n.label}
                </span>
                <span className="rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ink-3">
                  Soon
                </span>
              </span>
            );
          })}
          {active === "settings" ? (
            <span className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm font-semibold text-ink">
              <NavIcon d={SETTINGS_ICON} active />
              Settings
            </span>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-panel-2 hover:text-ink"
            >
              <NavIcon d={SETTINGS_ICON} />
              Settings
            </Link>
          )}
        </nav>
        {isAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                active === "admin"
                  ? "border-accent bg-panel-2 text-accent"
                  : "border-accent/40 text-accent hover:bg-panel-2"
              }`}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin panel
            </Link>
          </div>
        )}
        <div className="border-t border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-8 w-8 flex-none rounded-full border border-line object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent font-display text-xs font-bold uppercase text-bg">
                  {firstName.slice(0, 2)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{firstName}</p>
                <p className="truncate text-xs text-ink-3">{email}</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-line-strong py-2 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-5 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
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
              <Link href="/" className="flex items-center gap-2">
                <BrandMark size={24} />
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-end lg:justify-start">
              <CommandBar isAdmin={isAdmin} />
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden font-mono-nums text-xs text-ink-3 sm:block">
                <NowTimeET />
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-ink-2 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                Markets open
              </span>
              {active === "admin" ? (
                <span className="rounded-full bg-accent px-2.5 py-0.5 font-display text-xs font-bold text-bg">
                  ADMIN
                </span>
              ) : (
                <Link
                  href="/dashboard#watchlist"
                  className="hidden rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 sm:block"
                >
                  + New watchlist
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

const SETTINGS_ICON =
  "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z";

function NavIcon({ d, active = false }: { d: string; active?: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--color-accent)" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
