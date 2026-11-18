import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { rateGuard } from "@/features/inbox/platform";
import { decrypt } from "@/features/inbox/platform";
import { site } from "@/features/inbox/platform";
import { captureError } from "@/features/inbox/platform";
import { ConnectProblem, INBOX_STATE_COOKIE, connectWithCode, noteConnectProblem, type ConnectCode } from "@/features/inbox/google";
import { founderOnly } from "@/features/inbox/route-kit";

export const dynamic = "force-dynamic";

/**
 * Google sends Connect back here (the Authorized redirect URI Ben gave the Google app): the state must be one this
 * browser started in the last 15 minutes, then the code becomes the mailbox's kept key (features/inbox/google.ts →
 * connectWithCode). Back to Admin → Inbox with ?connected=1, or ?connect=<why> in a word the page explains. A refusal is
 * also written down in words, Google's own where it gave any: on the setup card (inbox_gmail.error) and in Admin → Errors.
 */
export async function GET(request: Request) {
  const tooMany = await rateGuard(request, "/api/admin/inbox/callback");
  if (tooMany) return tooMany;
  const refused = await founderOnly();
  if (refused) return refused;
  const url = new URL(request.url);
  const back = (q: string) => {
    const res = NextResponse.redirect(`${site.url.replace(/\/$/, "")}/admin/inbox?${q}`);
    res.cookies.set(INBOX_STATE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/admin/inbox", maxAge: 0 });
    return res;
  };
  const refuse = async (code: ConnectCode, why: string) => {
    await noteConnectProblem(why).catch(() => null);
    await captureError(new Error(`Inbox Connect refused (${code}): ${why}`), { source: "route", path: "/api/admin/inbox/callback" });
    return back(`connect=${code}`);
  };
  const googleError = url.searchParams.get("error");
  if (googleError) return refuse("denied", `Google's screen came back with "${googleError.replace(/[^\w.-]/g, "").slice(0, 60)}" instead of a permission.`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${INBOX_STATE_COOKIE}=([^;]+)`))?.[1] ?? "";
  let guard = "";
  let at = 0;
  try {
    const s = JSON.parse(decrypt(state ?? "")) as { guard?: string; t?: number };
    guard = s.guard ?? "";
    at = s.t ?? 0;
  } catch { /* not a state we made */ }
  if (!code) return refuse("expired", "Google came back without a sign-in code.");
  if (!guard) return refuse("expired", "Google came back with a state this site didn't make.");
  if (!cookie) return refuse("expired", "The browser came back without Connect's cookie (cookies blocked for highstrike.com, or Connect started in another browser).");
  const same = cookie.length === guard.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(guard));
  if (!same) return refuse("expired", "Connect was pressed again, in this tab or another, before Google came back from the first one.");
  if (Date.now() - at > 15 * 60_000) return refuse("expired", "Google's screen was open for more than 15 minutes.");
  try {
    await connectWithCode(code);
    return back("connected=1");
  } catch (e) {
    if (e instanceof ConnectProblem) return refuse(e.code, e.message);
    await noteConnectProblem("This site hit an error finishing the connection (Admin → Errors has it). Connect again.").catch(() => null);
    await captureError(e, { source: "route", path: "/api/admin/inbox/callback" });
    return back("connect=failed");
  }
}
