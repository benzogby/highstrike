/**
 * Where to send someone after signing in or paying: only a path on this site. Refuses "//evil.com", "/\evil.com"
 * (browsers read the backslash as a slash), control characters and anything with a scheme, so a link can't bounce a
 * signed-in member to another site. Used on the server and in the browser.
 */
export function safeNext(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length > 500) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, "https://www.highstrike.com");
    if (u.origin !== "https://www.highstrike.com") return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
