import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { paperState } from "@/lib/paper";

export const dynamic = "force-dynamic";

// /api/paper — the member's paper account for the desk (src/lib/paper.ts): cash, positions marked to the market,
// recent orders. Asked every 15 seconds while the desk is open.
export async function GET() {
  const v = await viewer();
  if (!v?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  return NextResponse.json(await paperState(v.user.id), { headers: { "Cache-Control": "no-store" } });
}
