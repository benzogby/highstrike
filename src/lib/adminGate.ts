import { notFound } from "next/navigation";
import { viewer } from "@/lib/membership";

// The admin pages' own check (Next can render a page without the layouts above it, so each page and each server action
// asks here, not only admin/layout.tsx). An account that isn't an admin gets a 404, as on getripping.com. Through
// viewer(), cached per request and checked against the project's keys locally, so it costs nothing after the layout's.
export async function requireAdmin() {
  const v = await viewer();
  if (!v?.profile?.is_admin) notFound();
  return v.user;
}

/** "Nov 2, 2026" and "3:41 PM" in New York, as the admin tables show times. */
export const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
export const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

/** A New York calendar day ("2026-11-02") for a time. */
export const nyDay = (t: number | string | Date) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/New_York" }).format(new Date(t));

/** The last `n` New York days, oldest first. */
export function lastDays(n: number, now = Date.now()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(nyDay(now - i * 86_400_000));
  return [...new Set(out)];
}

/** The time `n` days ago, as the tables' timestamps are written. */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
