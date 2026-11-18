/**
 * Errors that are safe to show in the Inbox. Next hides a server action's thrown message in production but forwards
 * `digest`, so the message rides along in the digest (as getripping.com's lib/errors does). Client-safe.
 */
export class UserError extends Error {
  digest: string;
  constructor(message: string) {
    super(message);
    this.name = "UserError";
    this.digest = `user:${message}`;
  }
}

/** The words to show for any caught error. */
export function errMsg(err: unknown, fallback = "Something went wrong"): string {
  const digest = (err as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith("user:")) return digest.slice(5);
  if (err instanceof Error && err.message && !/Minified React error|omitted in production|unexpected response/i.test(err.message)) return err.message;
  return fallback;
}
