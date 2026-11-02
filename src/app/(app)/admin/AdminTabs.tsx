"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The admin pages, grouped as getripping.com's admin groups them (Ben, 2026-11-02: "Copy all applicable aspects of
 * ripping's admin panel"): the business first, then what members see, then how the product is holding up. A column
 * beside the page on a wide screen; a row that scrolls sideways on a phone.
 */
const GROUPS = [
  {
    title: "Business",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/accounts", label: "Accounts" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/growth", label: "Growth" },
      { href: "/admin/traffic", label: "Traffic" },
      { href: "/admin/waitlist", label: "Waitlist" },
      { href: "/admin/emails", label: "Emails" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/education", label: "Trading School" },
      { href: "/admin/site", label: "Site" },
      { href: "/admin/team", label: "Team" },
    ],
  },
  {
    title: "Product",
    items: [{ href: "/admin/errors", label: "Errors" }],
  },
];

export default function AdminTabs() {
  const pathname = usePathname();
  const isOn = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:gap-5 lg:self-start lg:overflow-visible lg:px-0">
      {GROUPS.map((g) => (
        <div key={g.title} className="flex shrink-0 gap-1 lg:flex-col lg:gap-0.5">
          <p className="hidden px-2.5 pb-1 text-xs font-medium text-ink-3 lg:block">{g.title}</p>
          {g.items.map((t) => {
            const on = isOn(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
                  on ? "bg-panel-2 text-ink" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
