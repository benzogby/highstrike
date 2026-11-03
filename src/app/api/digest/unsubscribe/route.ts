import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/stripe";
import { validUnsubscribe } from "@/lib/morning";

export const dynamic = "force-dynamic";

// The morning email's "Stop these emails" link (src/lib/morning.ts): signed per member, so it works without signing in.
// POST is the mail app's one-click unsubscribe (List-Unsubscribe-Post); GET is the link, answered with a short page.
async function stop(request: Request) {
  const url = new URL(request.url);
  const u = url.searchParams.get("u") ?? "";
  const t = url.searchParams.get("t") ?? "";
  if (!validUnsubscribe(u, t)) return false;
  const { error } = await supabaseService().from("profiles").update({ digest_email: false }).eq("id", u);
  return !error;
}

const page = (ok: boolean) =>
  new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HighStrike emails</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f0e;color:#f2f6f4;font-family:system-ui,sans-serif">
<div style="max-width:420px;padding:24px;text-align:center"><h1 style="font-size:22px;margin:0 0 8px">${ok ? "You're unsubscribed" : "That link didn't work"}</h1>
<p style="color:#b4bfba;font-size:15px;line-height:1.5">${ok ? "You won't get the morning ideas email any more. You can switch it back on in Settings." : "Switch the morning email off in Settings instead."}</p>
<p><a href="/settings" style="color:#1fbf86">Go to Settings</a></p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );

export async function GET(request: Request) {
  return page(await stop(request));
}

export async function POST(request: Request) {
  const ok = await stop(request);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
