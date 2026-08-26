import { supabaseService } from "@/lib/stripe";
import { recordActivity } from "@/lib/alerts";

// SEC EDGAR Form 4 ingestion (free public data). Etiquette: identified
// User-Agent, sequential requests with a small stagger, daily cadence.
// Only open-market purchases (P) and sales (S) are stored, aggregated per
// filing. Real filings or nothing — no sample rows.

const UA = { "User-Agent": "HighStrike support@highstrike.com" };
const LOOKBACK_DAYS = 10;
const MAX_NEW_FILINGS_PER_RUN = 40;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`));
  return m ? m[1].trim() : null;
}

function tagValue(xml: string, name: string): string | null {
  const inner = tag(xml, name);
  if (inner == null) return null;
  const v = tag(inner, "value");
  return v ?? inner;
}

/** Resolve missing CIKs from SEC's ticker map (BRK.B ↔ BRK-B normalized). */
export async function resolveCiks(): Promise<number> {
  const service = supabaseService();
  const { data: missing } = await service
    .from("symbols")
    .select("ticker")
    .is("cik", null)
    .eq("is_active", true);
  if (!missing || missing.length === 0) return 0;

  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: UA,
    next: { revalidate: 604800 },
  });
  if (!res.ok) return 0;
  const map = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
  const byTicker = new Map(
    Object.values(map).map((e) => [e.ticker.toUpperCase(), String(e.cik_str)])
  );

  let resolved = 0;
  for (const row of missing) {
    const cik =
      byTicker.get(row.ticker) ?? byTicker.get(row.ticker.replace(".", "-"));
    if (cik) {
      await service.from("symbols").update({ cik }).eq("ticker", row.ticker);
      resolved++;
    }
  }
  return resolved;
}

type ParsedFiling = {
  ownerName: string;
  ownerTitle: string | null;
  transactionDate: string | null;
  totals: Map<string, { shares: number; value: number; priceSum: number; n: number }>;
};

function parseForm4(xml: string): ParsedFiling | null {
  const ownerName = tag(xml, "rptOwnerName");
  if (!ownerName) return null;
  const ownerTitle = tag(xml, "officerTitle");
  const transactionDate = tagValue(xml, "periodOfReport");

  const totals = new Map<string, { shares: number; value: number; priceSum: number; n: number }>();
  const txBlocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? [];
  for (const block of txBlocks) {
    const code = tag(block, "transactionCode");
    if (code !== "P" && code !== "S") continue;
    const shares = Number(tagValue(block, "transactionShares") ?? NaN);
    const price = Number(tagValue(block, "transactionPricePerShare") ?? NaN);
    if (!Number.isFinite(shares) || shares <= 0) continue;
    const entry = totals.get(code) ?? { shares: 0, value: 0, priceSum: 0, n: 0 };
    entry.shares += shares;
    if (Number.isFinite(price) && price > 0) {
      entry.value += shares * price;
      entry.priceSum += price;
      entry.n++;
    }
    totals.set(code, entry);
  }
  if (totals.size === 0) return null;
  return { ownerName, ownerTitle, transactionDate, totals };
}

export async function ingestInsiders(): Promise<{
  ciksResolved: number;
  filingsIngested: number;
  clusters: number;
}> {
  const service = supabaseService();
  const ciksResolved = await resolveCiks();

  const { data: universe } = await service
    .from("symbols")
    .select("ticker, cik")
    .eq("is_active", true)
    .not("cik", "is", null);
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  let filingsIngested = 0;

  for (const sym of universe ?? []) {
    if (filingsIngested >= MAX_NEW_FILINGS_PER_RUN) break;
    try {
      const padded = sym.cik!.padStart(10, "0");
      const res = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
        headers: UA,
        next: { revalidate: 21600 },
      });
      if (!res.ok) continue;
      const sub = (await res.json()) as {
        filings?: {
          recent?: {
            accessionNumber: string[];
            form: string[];
            filingDate: string[];
            primaryDocument: string[];
          };
        };
      };
      const r = sub.filings?.recent;
      if (!r) continue;

      for (let i = 0; i < r.form.length && filingsIngested < MAX_NEW_FILINGS_PER_RUN; i++) {
        if (r.form[i] !== "4") continue;
        if (r.filingDate[i] < cutoff) break; // recent[] is newest-first
        const accession = r.accessionNumber[i];
        // primaryDocument may carry an XSL-rendering prefix (xslF345X06/…);
        // the raw XML is the bare filename in the accession folder.
        const doc = r.primaryDocument[i]?.split("/").pop();
        if (!doc || !doc.endsWith(".xml")) continue;

        const { data: exists } = await service
          .from("insider_trades")
          .select("accession")
          .eq("accession", accession)
          .limit(1);
        if (exists && exists.length > 0) continue;

        await sleep(150); // SEC rate etiquette
        const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${Number(sym.cik)}/${accession.replace(/-/g, "")}/${doc}`;
        const xmlRes = await fetch(xmlUrl, { headers: UA });
        if (!xmlRes.ok) continue;
        const parsed = parseForm4(await xmlRes.text());
        if (!parsed) continue;

        for (const [code, t] of parsed.totals) {
          const avgPrice = t.n > 0 ? t.priceSum / t.n : null;
          await service.from("insider_trades").upsert(
            {
              accession,
              transaction_code: code,
              ticker: sym.ticker,
              filed_at: r.filingDate[i],
              transaction_date: parsed.transactionDate,
              owner_name: parsed.ownerName,
              owner_title: parsed.ownerTitle,
              shares: Math.round(t.shares),
              price: avgPrice != null ? Math.round(avgPrice * 100) / 100 : null,
              value: t.value > 0 ? Math.round(t.value) : null,
            },
            { onConflict: "accession,transaction_code", ignoreDuplicates: true }
          );
        }
        filingsIngested++;
      }
      await sleep(120);
    } catch (e) {
      console.error(`insider ingest failed for ${sym.ticker}:`, e instanceof Error ? e.message : e);
    }
  }

  // Cluster detection: ≥2 distinct open-market buyers in 14 days.
  let clusters = 0;
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: buys } = await service
    .from("insider_trades")
    .select("ticker, owner_name")
    .eq("transaction_code", "P")
    .gte("filed_at", since14);
  const buyers = new Map<string, Set<string>>();
  for (const b of buys ?? []) {
    (buyers.get(b.ticker) ?? buyers.set(b.ticker, new Set()).get(b.ticker)!).add(b.owner_name);
  }
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  for (const [ticker, owners] of buyers) {
    if (owners.size < 2) continue;
    const { data: recentEvent } = await service
      .from("activity_events")
      .select("id")
      .eq("kind", "insider_cluster")
      .eq("ticker", ticker)
      .gte("created_at", since7)
      .limit(1);
    if (recentEvent && recentEvent.length > 0) continue;
    await recordActivity(
      "insider_cluster",
      `Insider cluster on $${ticker} — ${owners.size} open-market buyers in 14 days`,
      { ticker }
    );
    clusters++;
  }

  return { ciksResolved, filingsIngested, clusters };
}
