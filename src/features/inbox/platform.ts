import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";
import { UserError } from "./errors";

/**
 * What Admin → Inbox needs from the app around it (ported from getripping.com's Inbox, 2026-11-17: "the exact same UI
 * as the app but as if I was using gmail in the app"). getripping.com's Inbox reached into a dozen of its own modules
 * (lib/workspace, lib/admin, lib/crypto, lib/storage, lib/migrate, lib/guard, lib/site…); HighStrike's versions of just
 * those pieces live here, so the Inbox's own files stay as close to getripping.com's as they can.
 */

export { captureError } from "@/lib/capture";

/** The site's address, for OAuth's redirect URI and the links back into the app. */
export const site = { url: (process.env.NEXT_PUBLIC_SITE_URL || "https://www.highstrike.com").replace(/\/$/, "") };

/** The service-role client: the inbox_gmail row is readable by nobody else (its RLS has no policies). */
export const supabaseAdmin = supabaseService;

/** An admin of HighStrike (profiles.is_admin), as Admin's layout checks it. */
async function adminOrNull() {
  const me = await viewer();
  return me && me.profile?.is_admin ? me : null;
}

/** The Inbox's server actions start here: an admin, or a refusal the page can show. */
export async function requireFounder() {
  const me = await adminOrNull();
  if (!me) throw new UserError("Only HighStrike's admins can use the Inbox.");
  return { user: me.user };
}

/** The Inbox's routes and page: an admin, or a 404 for anybody else (nothing here admits the Inbox exists). */
export async function adminRefusal(): Promise<Response | null> {
  const me = await adminOrNull();
  return me ? null : NextResponse.json({ error: "not found" }, { status: 404, headers: { "cache-control": "private, no-store" } });
}

export async function isAdminViewer(): Promise<boolean> {
  return Boolean(await adminOrNull());
}

/** The Inbox's table is made by its migration (supabase/migrations/20261117230000_inbox_gmail.sql), applied ahead of time. */
export async function ensureMigrated() {}

/**
 * The routes' rate limit: in memory, per address and route, generous enough for the Inbox's own polling and parallel
 * reads (getripping.com's lib/guard). Admins only reach it, so it's a seatbelt, not a gate.
 */
const hits = new Map<string, { n: number; until: number }>();
export async function rateGuard(request: Request, path: string): Promise<NextResponse | null> {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const key = `${path}:${ip}`;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.until < now) {
    hits.set(key, { n: 1, until: now + 60_000 });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.until < now) hits.delete(k);
    return null;
  }
  if (++h.n <= 600) return null;
  return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "retry-after": String(Math.ceil((h.until - now) / 1000)) } });
}

/** A count of what the Inbox does, for the server's log only (HighStrike has no event table). */
export async function track(name: string, opts: { userId?: string } = {}) {
  console.info(`[inbox] ${name}${opts.userId ? ` by ${opts.userId}` : ""}`);
}

/**
 * AES-256-GCM, as getripping.com keeps the mailbox's secret and refresh token. The key is TOKEN_ENCRYPTION_KEY (32 bytes,
 * hex) when Vercel has one; otherwise it's derived from the service-role key the server already holds, which reads the
 * table anyway, so the stored tokens are never plain text in a backup or an export of it.
 */
function key() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY ?? "";
  if (/^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, "hex");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) throw new UserError("The server has no SUPABASE_SERVICE_ROLE_KEY to keep the Inbox's tokens with.");
  return crypto.createHash("sha256").update(`highstrike admin inbox v1\n${service}`).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new UserError("Bad ciphertext");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** A private storage bucket, made the first time it's needed. */
const made = new Set<string>();
async function ensurePrivateBucket(bucket: string) {
  if (made.has(bucket)) return;
  const storage = supabaseAdmin().storage;
  const { data } = await storage.getBucket(bucket);
  if (!data) {
    const { error } = await storage.createBucket(bucket, { public: false, fileSizeLimit: 25 * 1024 * 1024 });
    if (error && !/already exists/i.test(error.message)) throw new Error(`storage bucket ${bucket}: ${error.message}`);
  }
  made.add(bucket);
}

/** A one-time link the browser uploads a compose attachment through, straight to storage. */
export async function signedUploadUrl(bucket: string, path: string, o: { upsert?: boolean } = {}): Promise<{ signedUrl: string; token: string; path: string }> {
  await ensurePrivateBucket(bucket);
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path, { upsert: o.upsert ?? true });
  if (error || !data) throw new Error(`storage upload link for ${path}: ${error?.message ?? "storage didn't answer"}`);
  return { signedUrl: data.signedUrl, token: data.token, path };
}

/** What the bytes actually are, whatever a file claims: the four raster types a browser draws, never SVG. */
export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export function sniff(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(0, 6).toString("latin1") === "GIF87a" || buf.subarray(0, 6).toString("latin1") === "GIF89a") return "image/gif";
  return null;
}

export { DEFAULT_ZONE, cleanZone } from "./zone";
