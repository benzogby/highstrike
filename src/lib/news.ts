// Company and market headlines via Finnhub's free news endpoints. Honest by
// construction: with no FINNHUB_API_KEY (or on any failure) we return an
// empty list — headlines are never fabricated or sampled.

export type NewsItem = {
  headline: string;
  source: string;
  url: string;
  datetime: number; // unix seconds
  summary: string;
};

type FinnhubNews = {
  headline?: string;
  source?: string;
  url?: string;
  datetime?: number;
  summary?: string;
};

function clean(items: FinnhubNews[], limit: number): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const n of items) {
    if (!n.headline || !n.url || !n.datetime) continue;
    const key = n.headline.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      headline: n.headline.trim(),
      source: n.source?.trim() || "News",
      url: n.url,
      datetime: n.datetime,
      summary: (n.summary ?? "").trim().slice(0, 240),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchCompanyNews(
  symbol: string,
  days = 7,
  limit = 8
): Promise<{ live: boolean; items: NewsItem[] }> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { live: false, items: [] };
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${token}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as FinnhubNews[];
    return { live: true, items: clean(data, limit) };
  } catch {
    return { live: false, items: [] };
  }
}

export async function fetchMarketNews(
  limit = 6
): Promise<{ live: boolean; items: NewsItem[] }> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { live: false, items: [] };
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${token}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as FinnhubNews[];
    return { live: true, items: clean(data, limit) };
  } catch {
    return { live: false, items: [] };
  }
}

export function newsTime(unixSeconds: number): string {
  const s = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
