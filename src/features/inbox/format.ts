import { firstName, type Addr } from "@/lib/inbox-mail";
import type { Person, ThreadRow } from "./types";

/**
 * Admin → Inbox's dates and names, as Gmail writes them: a list's "10:42 AM" today, "Oct 26" this year, "10/26/25"
 * before; a message's "Oct 28, 2026, 10:42 AM (2 hours ago)"; a list's people "Jane, me (3)". In the viewer's own zone
 * (components/zone.tsx), the same on the server and in the browser.
 */

const formats = new Map<string, Intl.DateTimeFormat>();
const fmt = (zone: string, o: Intl.DateTimeFormatOptions) => {
  const key = `${zone}|${JSON.stringify(o)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, ...o });
    formats.set(key, f);
  }
  return f;
};

export function listDate(ms: number, zone: string, now: number): string {
  if (!ms) return "";
  const day = fmt(zone, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (day.format(ms) === day.format(now)) return fmt(zone, { hour: "numeric", minute: "2-digit" }).format(ms);
  const year = fmt(zone, { year: "numeric" });
  if (year.format(ms) === year.format(now)) return fmt(zone, { month: "short", day: "numeric" }).format(ms);
  return fmt(zone, { year: "2-digit", month: "numeric", day: "numeric" }).format(ms);
}

export const fullDate = (ms: number, zone: string) => (ms ? fmt(zone, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(ms) : "");

/** "(2 hours ago)" for a message from the last week; nothing for older ones. */
export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (!ms || s > 7 * 86400) return "";
  if (s < 60) return "(just now)";
  const [n, unit] = s < 3600 ? [Math.floor(s / 60), "minute"] : s < 86400 ? [Math.floor(s / 3600), "hour"] : [Math.floor(s / 86400), "day"];
  return `(${n} ${unit}${n === 1 ? "" : "s"} ago)`;
}

/** The people column: one name alone in full, several by first name, "me" for this mailbox, the count after. */
export function peopleLine(r: ThreadRow): { parts: { text: string; unread: boolean }[]; count: number } {
  const ppl: Person[] = r.people;
  const name = (p: Person, many: boolean) => (p.me ? "me" : many ? firstName(p) : p.name || p.email);
  const many = ppl.length > 1;
  let shown = ppl;
  if (ppl.length > 3) shown = [ppl[0], ...ppl.slice(-2)];
  const parts = shown.map((p) => ({ text: name(p, many), unread: p.unread }));
  if (ppl.length > 3) parts.splice(1, 0, { text: "…", unread: false });
  return { parts, count: r.count };
}

export const toLine = (to: Addr[]) => (to.length ? `To: ${to.map((a) => (to.length > 1 ? firstName(a) : a.name || a.email)).join(", ")}` : "(no recipients)");

/** A person's initial for their round mark, and one of the twelve glyph hues for it, the same every time. */
export function initialOf(a: Addr): string {
  const s = (a.name || a.email).replace(/^["'\s]+/, "");
  return (s.match(/\p{L}|\p{N}/u)?.[0] ?? "?").toUpperCase();
}
export function hueOf(email: string): number {
  let h = 0;
  for (const c of email.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 12;
}

/** Tailwind's classes for the twelve glyph hues (globals.css --glyph-N), written out so the build keeps them. */
export const GLYPH_BG = ["bg-glyph-0", "bg-glyph-1", "bg-glyph-2", "bg-glyph-3", "bg-glyph-4", "bg-glyph-5", "bg-glyph-6", "bg-glyph-7", "bg-glyph-8", "bg-glyph-9", "bg-glyph-10", "bg-glyph-11"];
export const GLYPH_TEXT = ["text-glyph-0", "text-glyph-1", "text-glyph-2", "text-glyph-3", "text-glyph-4", "text-glyph-5", "text-glyph-6", "text-glyph-7", "text-glyph-8", "text-glyph-9", "text-glyph-10", "text-glyph-11"];

export const plural = (n: number, one: string, many = `${one}s`) => `${n === 1 ? "" : `${n} `}${n === 1 ? one[0].toUpperCase() + one.slice(1) : many}`;
