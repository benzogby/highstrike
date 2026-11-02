"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/traffic", label: "Traffic" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/education", label: "Trading School" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/site", label: "Site" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="mt-6 flex gap-5 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active =
          t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium transition ${
              active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
