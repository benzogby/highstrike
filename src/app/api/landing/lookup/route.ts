import { NextResponse } from "next/server";
import { getTickerRead } from "@/app/(landing)/data";

// The homepage's ticker lookup: what the desk has on one symbol, through the
// public get_landing_ticker RPC. Cached at the edge for a few minutes.
export async function GET(request: Request) {
  const sym = (new URL(request.url).searchParams.get("sym") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z.]{0,5}$/.test(sym)) {
    return NextResponse.json({ read: null }, { status: 400 });
  }
  const read = await getTickerRead(sym);
  return NextResponse.json(
    { read },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } }
  );
}
