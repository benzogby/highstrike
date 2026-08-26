"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/traffic", label: "Traffic" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/site", label: "Site" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active =
          t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 font-display text-sm font-semibold transition ${
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
