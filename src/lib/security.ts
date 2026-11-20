import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/stripe";

/**
 * The app's security helpers (the security review, 2026-11-20; docs/security-checklist.md): rate limits, the cron
 * secret, and the caller's address. Everything here fails closed.
 */

/** The caller's address as Vercel saw it (its edge sets x-forwarded-for; the first entry is the client). */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") ?? "").split(",")[0] || "").trim() || "unknown";
}

/* ───────────── rate limits ───────────── */

type Limit = { max: number; windowSec: number };
const memory = new Map<string, { n: number; until: number }>();

/** A fixed window kept in this server instance's memory: cheap, per instance, a first line for busy member routes. */
function memoryHit(key: string, { max, windowSec }: Limit): boolean {
  const now = Date.now();
  const h = memory.get(key);
  if (!h || h.until < now) {
    memory.set(key, { n: 1, until: now + windowSec * 1000 });
    if (memory.size > 20_000) for (const [k, v] of memory) if (v.until < now) memory.delete(k);
    return true;
  }
  return ++h.n <= max;
}

/**
 * A fixed window counted in Postgres (public.rate_hit, supabase/migrations/20261120010000_security_hardening.sql), so
 * the limit holds across every server instance: for public endpoints that write or cost money. If the database can't
 * answer, the request goes through (the memory window above still applies), so an outage doesn't take the site down.
 */
async function durableHit(key: string, { max, windowSec }: Limit): Promise<boolean> {
  const hashed = createHash("sha256").update(key).digest("base64url").slice(0, 43);
  try {
    const { data, error } = await supabaseService().rpc("rate_hit", { p_key: hashed, p_max: max, p_window_seconds: windowSec });
    if (error) throw new Error(error.message);
    return data !== false;
  } catch (e) {
    console.error("rate_hit failed:", e instanceof Error ? e.message : e);
    return true;
  }
}

/**
 * True while `key` is under its limit. `durable` counts across all instances (public writes, paid APIs); otherwise
 * per instance. The key should name the route and the caller (an address or a user id).
 */
export async function allow(key: string, limit: Limit, durable = false): Promise<boolean> {
  if (!memoryHit(key, limit)) return false;
  return durable ? durableHit(key, limit) : true;
}

/** The 429 every throttled route answers. */
export function tooMany(windowSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Wait a moment and try again." },
    { status: 429, headers: { "retry-after": String(windowSec), "cache-control": "no-store" } }
  );
}

/**
 * A route's rate limit by the caller's address: null to go on, or the 429 to return.
 * `throttle(request, "waitlist", { max: 5, windowSec: 3600 }, true)`.
 */
export async function throttle(request: Request, name: string, limit: Limit, durable = false): Promise<NextResponse | null> {
  return (await allow(`${name}:${clientIp(request)}`, limit, durable)) ? null : tooMany(limit.windowSec);
}

/** A server action's limit by the signed-in user: throws the words the page shows when it's over. */
export async function throttleUser(userId: string, name: string, limit: Limit): Promise<void> {
  if (!(await allow(`${name}:u:${userId}`, limit))) throw new Error("You're doing that too fast. Wait a moment and try again.");
}

/* ───────────── cron ───────────── */

/**
 * Vercel Cron's call: the `Authorization: Bearer <CRON_SECRET>` header Vercel adds when the project has CRON_SECRET.
 * With no secret set, nothing counts as cron (a user-agent can be typed by anyone).
 */
export function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const want = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  return want.length === got.length && timingSafeEqual(want, got);
}
