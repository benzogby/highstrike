import { within } from "@/lib/within";

// A stock's next earnings date, from Finnhub's earnings calendar (the same key as the quotes), for the Trade Planner's
// grade (src/lib/planGrade.ts). Three answers: a date (YYYY-MM-DD), null when none is listed in the next 100 days, and
// undefined when it couldn't be found out (no key, a slow or failed answer), which the grade says rather than guesses.

type Row = { date?: string; symbol?: string };

export async function nextEarnings(ticker: string): Promise<string | null | undefined> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return undefined;
  return within(lookup(token, ticker.toUpperCase()), 2500, undefined);
}

async function lookup(token: string, ticker: string): Promise<string | null | undefined> {
  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 100 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(ticker)}&token=${token}`, {
      next: { revalidate: 21_600 },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { earningsCalendar?: Row[] };
    if (!Array.isArray(body.earningsCalendar)) return undefined;
    const dates = body.earningsCalendar
      .filter((r) => (r.symbol ?? ticker).toUpperCase() === ticker && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date >= from)
      .map((r) => r.date as string)
      .sort();
    return dates[0] ?? null;
  } catch {
    return undefined;
  }
}
