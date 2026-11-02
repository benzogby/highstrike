// The pure parts of the Education library (src/lib/education.ts), with nothing server-only in them, so the admin's
// editor in the browser can use them too.

/** The private storage bucket every lesson video, poster and file sits in. */
export const LESSONS_BUCKET = "lessons";

/** A module's chapter title split for its card: "BONUS: Module 12: Mobile Trading Playbook" → "Bonus · Module 12" over the rest. */
export function moduleLabel(title: string): { eyebrow: string; name: string } {
  const m = /^(BONUS:\s*)?Module\s+(\d+)\s*:\s*(.+)$/i.exec(title.trim());
  if (m) return { eyebrow: `${m[1] ? "Bonus · " : ""}Module ${m[2]}`, name: m[3] };
  if (/recordings/i.test(title)) return { eyebrow: "Recordings", name: title };
  if (/welcome/i.test(title)) return { eyebrow: "Start here", name: title };
  return { eyebrow: "Module", name: title };
}

/** 252 → "4:12", 3725 → "1:02:05". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

export const lessonHref = (id: string) => `/education/${encodeURIComponent(id)}`;
