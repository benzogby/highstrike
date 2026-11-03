"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "@/components/NavIcon";
import { ADMIN_LINK, SETTINGS_LINK, activeKey, visibleNav, type NavLink } from "@/components/appNav";
import { BUTTON_PRIMARY_SM } from "@/components/ui";

// The sidebar's pages. The frame stays mounted while pages change (the (app) layout), so the current page comes from
// the URL and moves the moment a click lands; a click still on its way pulses at its row's end.

export default function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const active = activeKey(usePathname());
  return (
    <>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {visibleNav(isAdmin).map((link) => (
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

/** The top bar's one action: "New watchlist", or an "Admin" tag while in Admin. */
export function TopAction() {
  if (activeKey(usePathname()) === "admin") {
    return <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line-strong">Admin</span>;
  }
  return (
    <Link href="/swipe" className={`hidden sm:inline-flex ${BUTTON_PRIMARY_SM}`}>
      Swipe setups
    </Link>
  );
}
