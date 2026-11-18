import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { isOwnHost } from "@/lib/inbox-mail";
import { FILE_HEADERS, NO_STORE, founderOnly, streamOf } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const PICTURE = /^image\/(png|jpe?g|pjpeg|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/;

/** An address on a private network, the machine itself, or a multicast one: never fetched from here. */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19));
  }
  const v = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return privateAddress(mapped[1]);
  return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
}

/** The address when it's a public web address on the usual ports whose name points only at public machines; else null. */
async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (isOwnHost(u.hostname)) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return privateAddress(host) ? null : u;
  try {
    const found = await lookup(host, { all: true });
    return found.length && !found.some((f) => privateAddress(f.address)) ? u : null;
  } catch {
    return null;
  }
}

const nothing = (status: number) => NextResponse.json({ error: "No picture" }, { status, headers: NO_STORE });

/**
 * GET ?u=<address>: a sender's picture, fetched by this server rather than by the browser (Gmail's image proxy), once Ben
 * has pressed "Show images" on a message (features/inbox/sanitize.ts rewrites its pictures to here; the message's frame
 * lets pictures load from nowhere else). The sender learns that the message was opened, never from where; nothing on a
 * private network or on this site is fetched; only real pictures up to 8 MB come back.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/img");
  if (tooMany) return tooMany;
  const refused = await founderOnly();
  if (refused) return refused;
  const raw = new URL(request.url).searchParams.get("u") ?? "";
  if (!raw || raw.length > 4096) return nothing(400);
  let url = await publicUrl(raw);
  try {
    for (let hop = 0; url && hop < 4; hop++) {
      const res = await fetch(url, {
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; HighStrikeInbox/1.0; +https://www.highstrike.com)", accept: "image/avif,image/webp,image/png,image/*;q=0.8" },
      });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = await publicUrl(new URL(next, url).toString());
        continue;
      }
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!res.ok || !res.body) return nothing(404);
      if (!PICTURE.test(type)) return nothing(415);
      if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return nothing(413);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) {
          await reader.cancel().catch(() => null);
          return nothing(413);
        }
        chunks.push(value);
      }
      const buf = Buffer.concat(chunks);
      return new Response(streamOf(buf), { headers: { ...FILE_HEADERS, "content-type": type, "content-length": String(buf.length), "cache-control": "private, max-age=86400" } });
    }
  } catch {
    return nothing(404);
  }
  return nothing(404);
}
