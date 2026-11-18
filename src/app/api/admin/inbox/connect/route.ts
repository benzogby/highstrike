import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { ensureMigrated } from "@/features/inbox/platform";
import { encrypt } from "@/features/inbox/platform";
import { site } from "@/features/inbox/platform";
import { INBOX_STATE_COOKIE, authUrl } from "@/features/inbox/google";
import { founderOnly } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/**
 * Admin → Inbox's Connect Gmail: to Google's permission screen for ben@highstrike.com (features/inbox/google.ts). The
 * state carries a random guard that's also in a cookie, so the callback refuses a return this browser didn't start.
 * Founders only.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/connect");
  if (tooMany) return tooMany;
  const refused = await founderOnly();
  if (refused) return refused;
  await ensureMigrated().catch(() => null);
  const guard = randomBytes(16).toString("base64url");
  try {
    const res = NextResponse.redirect(await authUrl(encrypt(JSON.stringify({ guard, t: Date.now() }))));
    res.cookies.set(INBOX_STATE_COOKIE, guard, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/admin/inbox", maxAge: 900 });
    return res;
  } catch {
    return NextResponse.redirect(`${site.url.replace(/\/$/, "")}/admin/inbox?connect=setup`);
  }
}
