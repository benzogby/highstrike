import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Daily price history: /api/history?symbol=AAPL — daily closes from Yahoo
// Finance's public chart endpoint (no key required; Stooq was tried first but
// now sits behind a JS challenge), cached for 6 hours, with a deterministic
// sample series as fallback so the chart always renders.

type Point = { date: string; close: number };

function sampleSeries(symbol: string, days = 260): Point[] {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 100000;
  let price = 40 + (h % 700);
  const out: Point[] = [];
  const today = new Date();
  let s = h || 7;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let i = days; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    price = Math.max(2, price * (1 + (rand() - 0.485) * 0.025));
    out.push({ date: d.toISOString().slice(0, 10), close: Math.round(price * 100) / 100 });
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z.-]{1,10}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      {
        next: { revalidate: 21600 },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      }
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points: Point[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null && Number.isFinite(c) && c > 0) {
        points.push({
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
          close: Math.round(c * 100) / 100,
        });
      }
    }
    if (points.length < 30) throw new Error("too few points");
    return NextResponse.json({ live: true, symbol, points: points.slice(-260) });
  } catch {
    // Yahoo unavailable — fall back to first-party accrued closes (real data,
    // grows daily via the cron snapshot), then to a labeled sample series.
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase
        .from("price_history")
        .select("price_date, close")
        .eq("ticker", symbol)
        .order("price_date", { ascending: true })
        .limit(260);
      if (data && data.length >= 10) {
        return NextResponse.json({
          live: true,
          symbol,
          points: data.map((r) => ({ date: r.price_date, close: Number(r.close) })),
        });
      }
    } catch {
      // ignore and fall through
    }
    return NextResponse.json({ live: false, symbol, points: sampleSeries(symbol) });
  }
}
