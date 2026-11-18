import { NextResponse } from "next/server";
import { viewer } from "@/lib/membership";
import { chainView } from "@/lib/paperChain";

export const dynamic = "force-dynamic";

// /api/options/chain?u=AAPL&expiry=2026-12-18 — one expiry's option chain for the desk (src/lib/paperChain.ts), members only.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const u = (q.get("u") ?? "").trim().toUpperCase();
  const expiry = q.get("expiry");
  if (!/^[A-Z][A-Z.]{0,7}$/.test(u) || (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const v = await viewer();
  if (!v?.member) return NextResponse.json({ error: "Members only" }, { status: 401 });
  const chain = await chainView(u, expiry);
  return NextResponse.json(chain, { headers: { "Cache-Control": chain.rows.length ? "private, max-age=30" : "no-store" } });
}
