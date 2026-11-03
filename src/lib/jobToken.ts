import { createHmac, timingSafeEqual } from "node:crypto";

// A signed token for a background job to start the next run of itself (or another job) without a cron secret: a hash of
// the job's name and the day under a server-only secret, so outsiders can't start it.
export function jobToken(job: string, day: string) {
  return createHmac("sha256", `job:${job}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).update(day).digest("base64url");
}

export function validJobToken(job: string, day: string, token: string | null) {
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const want = Buffer.from(jobToken(job, day));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}
