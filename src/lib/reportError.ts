// The browser's half of Admin → Errors: the error pages send what broke to /api/report-error, once each.
const sent = new Set<string>();

export function reportError(error: Error & { digest?: string }) {
  try {
    const key = `${error.message}|${error.digest ?? ""}`;
    if (sent.has(key)) return;
    sent.add(key);
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting never throws */
  }
}
