"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import NavIcon from "@/components/NavIcon";
import Sheet from "@/components/Sheet";
import { ADMIN_LINK, MORE_ICON, MORE_LINKS, SIGN_OUT_ICON, TAB_BAR, activeKey, type NavLink } from "@/components/appNav";
import { BUTTON_SECONDARY } from "@/components/ui";

// The phone's navigation (Ben, 2026-11-03: most visits are Instagram on phones, and members keep HighStrike on their
// home screen as an app): a bar along the bottom, below lg where the sidebar hides, with Home, Ideas, Scanner, School
// and More. More opens a sheet with the rest of the sidebar, Admin for admins, and the account with Sign out. The bar
// pads itself clear of the iPhone's home indicator (the (app) layout sets viewport-fit=cover); the page leaves room for
// it (AppShell's <main>). The current tab comes from the URL, as the sidebar's does.

const TAB = "group relative flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none [-webkit-tap-highlight-color:transparent]";

export default function MobileNav({ isAdmin, email, firstName, avatarUrl }: { isAdmin: boolean; email: string; firstName: string; avatarUrl?: string | null }) {
  const path = usePathname();
  const active = activeKey(path);
  // The sheet belongs to the page it was opened on: going anywhere else (a link in it, or Back) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const more = isAdmin ? [...MORE_LINKS, ADMIN_LINK] : MORE_LINKS;
  const inMore = open || more.some((l) => l.key === active);

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto flex h-14 max-w-xl px-1">
          {TAB_BAR.map((link) => (
            <li key={link.key} className="flex-1">
              <Tab link={link} on={link.key === active} />
            </li>
          ))}
          <li className="flex-1">
            <button type="button" onClick={() => setOpenOn(path)} aria-haspopup="dialog" aria-expanded={open} className={TAB}>
              <TabIcon d={MORE_ICON} on={inMore} />
              <span className={inMore ? "text-ink" : "text-ink-3"}>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onClose={() => setOpenOn(null)} label="More">
        <div className="overflow-y-auto px-3 pb-4 pt-1">
          <p className="px-2 pb-2 pt-1 font-display text-base text-ink">More</p>
          <ul className="space-y-0.5">
            {more.map((link) => {
              const on = link.key === active;
              return (
                <li key={link.key}>
                  <Link
                    href={link.href ?? "#"}
                    onClick={() => setOpenOn(null)}
                    aria-current={on ? "page" : undefined}
                    className={`flex h-12 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors ${
                      on ? "bg-panel-2 font-medium text-ink" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                    }`}
                  >
                    <NavIcon d={link.icon} size={18} className={on ? "text-accent" : "text-ink-3"} />
                    {link.label}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto text-ink-3">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-3 border-t border-line px-2 pt-4">
            <Avatar name={firstName} url={avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{firstName}</p>
              <p className="truncate text-xs text-ink-3">{email}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className={BUTTON_SECONDARY}>
                <NavIcon d={SIGN_OUT_ICON} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** One tab: the current one's icon lifted onto the next step in green (as the sidebar's row is), the rest quiet. */
function Tab({ link, on }: { link: NavLink; on: boolean }) {
  return (
    <Link href={link.href ?? "/dashboard"} aria-current={on ? "page" : undefined} className={TAB}>
      <TabIcon d={link.icon} on={on} />
      <span className={on ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}>{link.label}</span>
      <Pending />
    </Link>
  );
}

function TabIcon({ d, on }: { d: string; on: boolean }) {
  return (
    <span
      className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
        on ? "bg-panel-2 text-accent ring-1 ring-inset ring-line-strong" : "text-ink-3 group-hover:text-ink-2"
      }`}
    >
      <NavIcon d={d} size={20} />
    </span>
  );
}

/** A small green pulse by the icon while the tab's page is still on its way (out of the flow, so nothing shifts). */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`absolute right-[calc(50%_-_1.875rem)] top-1.5 h-1.5 w-1.5 rounded-full bg-accent transition-opacity duration-150 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}
