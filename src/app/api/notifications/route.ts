import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The top bar's bell (src/components/NotificationBell.tsx), so the frame needs no Supabase library in the browser.
//   GET  /api/notifications?count  → { unread }
//   GET  /api/notifications        → { unread, items }: the latest 20, newest first
//   POST /api/notifications        { all: true } or { id }  → marks them read, answers { unread }
// The account comes from its sign-in cookie, checked with getClaims as the pages' viewer() does (locally, against the
// project's signing keys); the reads and the update run as the member, so RLS keeps each to their own rows.

const PRIVATE = { "Cache-Control": "private, no-store" };
const ID = /^[0-9a-f-]{36}$/i;

async function signedIn() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { supabase, id } : null;
}

type Me = NonNullable<Awaited<ReturnType<typeof signedIn>>>;

const unread = (me: Me) =>
  me.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).is("read_at", null);

export async function GET(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: PRIVATE });

  if (new URL(request.url).searchParams.has("count")) {
    const { count, error } = await unread(me);
    if (error) return NextResponse.json({ error: "Couldn't count notifications." }, { status: 500, headers: PRIVATE });
    return NextResponse.json({ unread: count ?? 0 }, { headers: PRIVATE });
  }

  const [counted, latest] = await Promise.all([
    unread(me),
    me.supabase
      .from("notifications")
      .select("id, kind, title, body, href, created_at, read_at")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (counted.error || latest.error) return NextResponse.json({ error: "Couldn't load notifications." }, { status: 500, headers: PRIVATE });
  return NextResponse.json({ unread: counted.count ?? 0, items: latest.data ?? [] }, { headers: PRIVATE });
}

export async function POST(request: Request) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: PRIVATE });

  const body = (await request.json().catch(() => ({}))) as { all?: unknown; id?: unknown };
  const all = body.all === true;
  const id = typeof body.id === "string" && ID.test(body.id) ? body.id : null;
  if (!all && !id) return NextResponse.json({ error: "Say which: { all: true } or { id }." }, { status: 400, headers: PRIVATE });

  let mark = me.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).is("read_at", null);
  if (id) mark = mark.eq("id", id);
  const { error } = await mark;
  if (error) return NextResponse.json({ error: "Couldn't mark them read." }, { status: 500, headers: PRIVATE });

  const { count } = await unread(me);
  return NextResponse.json({ unread: count ?? 0 }, { headers: PRIVATE });
}
