// The app's pages as the sidebar and the phone menu list them, and which one a URL belongs to. The frame lives in the
// (app) layout and stays mounted while pages change, so the current page is read from the URL rather than passed in.

export type NavKey = "home" | "ideas" | "journal" | "setups" | "scanner" | "insiders" | "chatter" | "education" | "admin" | "settings" | "none";
export type NavLink = { label: string; key: NavKey; href?: string; icon: string };

export const NAV: NavLink[] = [
  {
    label: "Home",
    key: "home",
    href: "/dashboard",
    icon: "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-6h4v6a1 1 0 001 1h3a1 1 0 001-1V10",
  },
  // Ideas, the product's hero (Ben, 2026-11-02: "make this all about TRADE IDEAS"), right under Home. Setups keeps its
  // page for the scoreboard and history, one step down.
  {
    label: "Ideas",
    key: "ideas",
    href: "/ideas",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  // The member's own trades and journal (Ben, 2026-11-03: "track + journal"), right under the ideas they come from.
  {
    label: "My trades",
    key: "journal",
    href: "/journal",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
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
    key: "none",
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

export const ADMIN_LINK: NavLink = {
  label: "Admin",
  key: "admin",
  href: "/admin",
  icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
};

export const SETTINGS_LINK: NavLink = {
  label: "Settings",
  key: "settings",
  href: "/settings",
  icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

export const SIGN_OUT_ICON = "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

/** The section a URL belongs to: a lesson is Trading School, every Admin tab is Admin, a symbol's page is none. */
export function activeKey(path: string): NavKey {
  for (const link of [...NAV, ADMIN_LINK, SETTINGS_LINK]) {
    if (link.href && (path === link.href || path.startsWith(`${link.href}/`))) return link.key;
  }
  return "none";
}
