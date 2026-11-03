import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { computeScan } from "@/lib/scanner";

export const dynamic = "force-dynamic";

// Member-only scanner data.
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // The membership, as the tables check it (public.is_member()).
  const { data: member } = await supabase.rpc("is_member");
  if (!member) return NextResponse.json({ error: "Members only" }, { status: 403 });

  const scan = await computeScan();
  return NextResponse.json(scan);
}
