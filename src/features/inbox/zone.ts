/** HighStrike's audience is American; a reply's "On … wrote:" line falls back to New York time. */
export const DEFAULT_ZONE = "America/New_York";

/** An IANA zone this runtime knows ("Europe/Paris"), as it names it; null for anything else. */
export function cleanZone(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(v)) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: v }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
