"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "@/components/NavIcon";
import { ADMIN_LINK, NAV, SETTINGS_LINK, activeKey, type NavLink } from "@/components/appNav";
import { BUTTON_PRIMARY_SM } from "@/components/ui";

// The sidebar's pages. The frame stays mounted while pages change (the (app) layout), so the current page comes from
// the URL and moves the moment a click lands; a click still on its way pulses at its row's end.

export default function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const active = activeKey(usePathname());
  return (
    <>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV.map((link) => (
          <NavItem key={link.label} link={link} active={link.href !== undefined && link.key === active} />
        ))}
      </nav>
      <div className="space-y-0.5 px-3 pb-3">
        {isAdmin && <NavItem link={ADMIN_LINK} active={active === "admin"} />}
        <NavItem link={SETTINGS_LINK} active={active === "settings"} />
      </div>
    </>
  );
}

/** One row: the current page lifted onto the next step with its icon in green, others quiet until hovered, "Soon" for
 * what isn't built. */
function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  const row = "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-100";
  if (!link.href) {
    return (
      <span className={`${row} justify-between text-ink-3`}>
        <span className="flex items-center gap-2.5">
          <NavIcon d={link.icon} />
          {link.label}
        </span>
        <span className="rounded px-1.5 text-[11px] font-medium leading-5 text-ink-3 ring-1 ring-inset ring-line-strong">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`${row} ${active ? "bg-panel-2 font-medium text-ink" : "text-ink-2 hover:bg-panel hover:text-ink"}`}
    >
      <NavIcon d={link.icon} className={active ? "text-accent" : "text-ink-3 transition-colors group-hover:text-ink-2"} />
      {link.label}
      <Pending />
    </Link>
  );
}

/** A small green pulse at the end of a row whose page is still on its way (fixed size, so nothing shifts). */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`ml-auto h-1.5 w-1.5 flex-none rounded-full bg-accent transition-opacity duration-150 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}

/**
 * The top bar's one action: "Check a trade idea" (Ben, 2026-11-03), which opens Paste an idea, one tap from Build; just
 * its icon on a phone. An "Admin" tag instead while in Admin.
 */
export function TopAction() {
  if (activeKey(usePathname()) === "admin") {
    return <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line-strong">Admin</span>;
  }
  return (
    <Link href="/ideas/paste" className={`inline-flex max-sm:h-9 max-sm:w-9 max-sm:rounded-lg max-sm:px-0 ${BUTTON_PRIMARY_SM}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <span className="max-sm:sr-only">Check a trade idea</span>
    </Link>
  );
}
