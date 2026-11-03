"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/ideas", label: "Ideas" },
  { href: "/ideas/record", label: "Track record" },
];

/** Ideas' tabs, underlined in green, as links: each tab is its own URL, so it can be shared, bookmarked and cached. */
export default function IdeasTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Ideas" className="mt-5 flex gap-5 border-b border-line">
      {TABS.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`relative -mb-px flex h-10 items-center border-b-2 text-sm font-medium transition-colors ${
              on ? "border-accent text-ink" : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink"
            }`}
          >
            {t.label}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}

/** A small green pulse just past the label while the tab's page is still on its way (out of the flow, so nothing shifts). */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent transition-opacity duration-150 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}
