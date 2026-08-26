import Anthropic from "@anthropic-ai/sdk";
import { fetchQuotes } from "@/lib/quotes";
import { computeScan, type ScanRow } from "@/lib/scanner";
import { supabaseService } from "@/lib/stripe";
import { recordActivity } from "@/lib/alerts";

// Daily generation of the market weather report + setup cards. Cross-system
// by design: generation consumes the terminal's own signals — scanner flow
// scores (day momentum, range position, gaps, 5d trend) and recent SEC
// insider activity — via Claude (claude-opus-5) when ANTHROPIC_API_KEY is
// configured, else a deterministic heuristic over the same signals.

/** Scanner row enriched with 14-day insider aggregates for the ticker. */
export type EnrichedRow = ScanRow & {
  insBuyers: number;
  insBuyValue: number;
  insSellers: number;
  insSellValue: number;
};

function insiderNote(r: EnrichedRow): string | null {
  if (r.insBuyers === 0 && r.insSellers === 0) return null;
  const parts: string[] = [];
  if (r.insBuyers > 0) {
    parts.push(
      `${r.insBuyers} insider buy${r.insBuyers > 1 ? "s" : ""}${
        r.insBuyValue > 0 ? ` ($${Math.round(r.insBuyValue).toLocaleString()})` : ""
      }`
    );
  }
  if (r.insSellers > 0) {
    parts.push(
      `${r.insSellers} insider sell${r.insSellers > 1 ? "s" : ""}${
        r.insSellValue > 0 ? ` ($${Math.round(r.insSellValue).toLocaleString()})` : ""
      }`
    );
  }
  return `${parts.join(", ")} filed in the last 14 days`;
}

export type GeneratedSetup = {
  ticker: string;
  direction: "long" | "short";
  justification: string;
  entry_criteria: string[];
  price_target: string;
  time_frame: string;
  flow_score: number;
};

export type Generated = {
  weather: { volatility: number; opportunity: number; direction: number; summary: string };
  setups: GeneratedSetup[];
  model: string;
};

export function etToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

const STOP_PCT = 8; // adverse move that closes a setup as "stopped"
const HORIZON_DAYS = 10; // calendar days before an open setup expires

function parsePrice(text: string): number | null {
  const m = text.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Records today's real closes into price_history (first-party chart data).
 * Sample quotes are never recorded — the table only ever holds live prices.
 */
export async function snapshotPrices(): Promise<{ recorded: number }> {
  const service = supabaseService();
  const { data: universe } = await service
    .from("symbols")
    .select("ticker")
    .eq("is_active", true)
    .limit(200);
  const tickers = (universe ?? []).map((r) => r.ticker);
  if (tickers.length === 0) return { recorded: 0 };

  const quotes = await fetchQuotes(tickers);
  const live = quotes.filter((q) => q.live);
  if (live.length === 0) return { recorded: 0 };

  const date = etToday();
  const { error } = await service.from("price_history").upsert(
    live.map((q) => ({ ticker: q.symbol, price_date: date, close: q.price })),
    { onConflict: "ticker,price_date" }
  );
  if (error) {
    console.error("price snapshot failed:", error.message);
    return { recorded: 0 };
  }
  return { recorded: live.length };
}

/**
 * Grades every open setup against current prices: target hit, stopped out
 * (±8% adverse), or expired past the horizon. Backfills entry/target prices
 * for rows published before grading existed.
 */
export async function gradeSetups(): Promise<{ graded: number; closed: number }> {
  const service = supabaseService();
  const { data: open } = await service
    .from("setups")
    .select("id, ticker, direction, report_date, price_target, entry_price, target_price, expires_on")
    .eq("status", "open");
  if (!open || open.length === 0) return { graded: 0, closed: 0 };

  const quotes = await fetchQuotes([...new Set(open.map((s) => s.ticker))]);
  const priceOf = new Map(quotes.map((q) => [q.symbol, q.price]));
  const today = etToday();
  let closed = 0;

  for (const s of open) {
    const price = priceOf.get(s.ticker);
    if (!price) continue;

    const entry = s.entry_price ?? price;
    const target = s.target_price ?? parsePrice(s.price_target);
    const expires =
      s.expires_on ??
      new Date(new Date(`${s.report_date}T12:00:00Z`).getTime() + HORIZON_DAYS * 86400000)
        .toISOString()
        .slice(0, 10);

    const sign = s.direction === "long" ? 1 : -1;
    const movePct = ((price - entry) / entry) * 100 * sign;

    let status: "open" | "target_hit" | "stopped" | "expired" = "open";
    if (target !== null) {
      if (s.direction === "long" && price >= target) status = "target_hit";
      if (s.direction === "short" && price <= target) status = "target_hit";
    }
    if (status === "open" && movePct <= -STOP_PCT) status = "stopped";
    if (status === "open" && today > expires) status = "expired";

    const update: Record<string, unknown> = {
      entry_price: entry,
      target_price: target,
      expires_on: expires,
      current_pct: Math.round(movePct * 100) / 100,
    };
    if (status !== "open") {
      update.status = status;
      update.result_pct = Math.round(movePct * 100) / 100;
      update.closed_at = new Date().toISOString();
      closed++;
    }
    await service.from("setups").update(update).eq("id", s.id);
    if (status !== "open") {
      const label =
        status === "target_hit" ? "hit its target" : status === "stopped" ? "stopped out" : "expired";
      await recordActivity(
        "setup_closed",
        `$${s.ticker} setup ${label} at ${movePct >= 0 ? "+" : ""}${movePct.toFixed(2)}%`,
        { ticker: s.ticker }
      );
    }
  }

  return { graded: open.length, closed };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function heuristic(quotes: EnrichedRow[]): Generated {
  const byScore = [...quotes].sort((a, b) => b.score - a.score);
  const gainers = quotes.filter((q) => q.changePct > 0).length;
  const avgAbs = quotes.reduce((s, q) => s + Math.abs(q.changePct), 0) / (quotes.length || 1);

  const direction = clamp((gainers / (quotes.length || 1)) * 100);
  const volatility = clamp(avgAbs * 28);
  const opportunity = clamp(avgAbs * 18 + Math.abs(direction - 50) * 0.6 + 25);

  const target = (q: EnrichedRow, up: boolean) =>
    `$${(q.price * (up ? 1.05 : 0.95)).toFixed(2)}`;

  const mk = (q: EnrichedRow, dir: "long" | "short"): GeneratedSetup => {
    const ins = insiderNote(q);
    const signalBits = [
      `flow score ${q.score}`,
      q.rangePos != null
        ? `closing at ${q.rangePos.toFixed(2)} of the day's range`
        : null,
      q.mom5d != null
        ? `${q.mom5d >= 0 ? "+" : ""}${q.mom5d.toFixed(1)}% over 5 sessions`
        : null,
    ].filter(Boolean);
    const insiderBoost = dir === "long" ? Math.min(q.insBuyers * 6, 12) : 0;
    return {
      ticker: q.ticker,
      direction: dir,
      justification:
        dir === "long"
          ? `${q.ticker} tops the scanner (${signalBits.join(", ")}) at ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% with breadth ${gainers}/${quotes.length} positive${ins ? `, and ${ins}` : ""} — momentum continuation while the leaders hold.`
          : `${q.ticker} sits at the bottom of the scanner (${signalBits.join(", ")}) at ${q.changePct.toFixed(2)}% against ${gainers}/${quotes.length} positive breadth${ins ? `, with ${ins}` : ""} — relative-weakness fade while rallies keep getting sold.`,
      entry_criteria: [
        dir === "long"
          ? `Price holds above ${target(q, false)} on a 15-minute close`
          : `Price fails below ${target(q, true)} on a 15-minute close`,
        "Relative volume above 1.5× at trigger time",
        "Broad-market direction score unchanged or improving",
      ],
      price_target: target(q, dir === "long"),
      time_frame: "3-5 days",
      flow_score: clamp(q.score + insiderBoost),
    };
  };

  const setups: GeneratedSetup[] = [];
  if (byScore[0]) setups.push(mk(byScore[0], "long"));
  if (byScore[1]) setups.push(mk(byScore[1], "long"));
  const weakest = byScore[byScore.length - 1];
  if (weakest && weakest.score <= 45 && weakest.changePct < 0) {
    setups.push(mk(weakest, "short"));
  }

  const clusterTickers = quotes
    .filter((q) => q.insBuyers >= 2)
    .map((q) => `$${q.ticker}`);

  return {
    weather: {
      volatility,
      opportunity,
      direction,
      summary: `${gainers} of ${quotes.length} tracked names positive; average absolute move ${avgAbs.toFixed(2)}%. ${direction >= 50 ? "Constructive tape — favor momentum continuation." : "Defensive tape — be selective and size down."}${clusterTickers.length ? ` Insider buying clusters active on ${clusterTickers.join(", ")}.` : ""}`,
    },
    setups,
    model: "heuristic",
  };
}

async function claudeGenerate(quotes: EnrichedRow[]): Promise<Generated> {
  const client = new Anthropic();
  const quoteLines = quotes
    .map((q) => {
      const bits = [
        `$${q.price.toFixed(2)}`,
        `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% today`,
        `flow ${q.score} (${q.bias})`,
        q.rangePos != null ? `range-pos ${q.rangePos.toFixed(2)}` : null,
        q.gapPct != null ? `gap ${q.gapPct >= 0 ? "+" : ""}${q.gapPct.toFixed(2)}%` : null,
        q.mom5d != null ? `5d ${q.mom5d >= 0 ? "+" : ""}${q.mom5d.toFixed(2)}%` : null,
        insiderNote(q),
      ].filter(Boolean);
      return `${q.ticker}: ${bits.join(" | ")}`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "You are HighStrike AI, generating the daily pre-market report for an options-trading terminal. " +
      "You produce market commentary and illustrative trade setups — never guarantees. " +
      "Each universe line carries the terminal's own signals: flow score 0-100 with a long/short/neutral bias " +
      "(computed from day momentum, position in the day's range, gap follow-through, and 5-session trend), " +
      "plus SEC Form 4 insider activity from the last 14 days where any exists. " +
      "Weigh these signals and CITE the specific ones that drive each pick in its justification " +
      "(e.g. the flow score, range position, or insider buying). Insider buying clusters are meaningful; " +
      "lone routine sells usually are not. Keep your flow_score within about ±10 of the scanner's, " +
      "adjusting for signal quality. " +
      "Respond with ONLY a JSON object, no markdown fences, matching exactly: " +
      '{"weather":{"volatility":0-100,"opportunity":0-100,"direction":0-100,"summary":"1-2 sentences"},' +
      '"setups":[{"ticker":"...","direction":"long"|"short","justification":"2 sentences of concrete reasoning tied to the data","entry_criteria":["3 specific trigger conditions"],"price_target":"$123.45","time_frame":"e.g. 3-5 days","flow_score":0-100}]} ' +
      "Produce exactly 3 setups chosen from the provided universe only. Price targets must be within ±12% of the current price.",
    messages: [
      {
        role: "user",
        content: `Today's scan universe with the terminal's signals:\n${quoteLines}\n\nGenerate today's weather report and 3 setups.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(text) as Generated;
  const known = new Set(quotes.map((q) => q.ticker));
  const setups = (parsed.setups ?? [])
    .filter(
      (s) =>
        known.has(s.ticker) &&
        (s.direction === "long" || s.direction === "short") &&
        Array.isArray(s.entry_criteria) &&
        s.justification
    )
    .slice(0, 3)
    .map((s) => ({ ...s, flow_score: clamp(s.flow_score) }));
  if (setups.length === 0) throw new Error("no valid setups in model output");

  return {
    weather: {
      volatility: clamp(parsed.weather.volatility),
      opportunity: clamp(parsed.weather.opportunity),
      direction: clamp(parsed.weather.direction),
      summary: String(parsed.weather.summary ?? "").slice(0, 500),
    },
    setups,
    model: "claude-opus-5",
  };
}

export async function generateDaily(force = false): Promise<{
  status: "generated" | "exists" | "skipped_weekend";
  date: string;
  model?: string;
  setups?: number;
}> {
  const date = etToday();
  const service = supabaseService();

  const { data: existing } = await service
    .from("weather_reports")
    .select("report_date")
    .eq("report_date", date)
    .maybeSingle();
  if (existing && !force) return { status: "exists", date };

  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if ((dow === 0 || dow === 6) && !force) return { status: "skipped_weekend", date };

  // Cross-system inputs: the scanner's ranked universe + 14-day insider flow.
  const { rows: scan } = await computeScan();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: insiderRows } = await service
    .from("insider_trades")
    .select("ticker, transaction_code, owner_name, value")
    .gte("filed_at", since14);

  const insAgg = new Map<
    string,
    { buyers: Set<string>; buyValue: number; sellers: Set<string>; sellValue: number }
  >();
  for (const t of insiderRows ?? []) {
    const e =
      insAgg.get(t.ticker) ??
      insAgg
        .set(t.ticker, { buyers: new Set(), buyValue: 0, sellers: new Set(), sellValue: 0 })
        .get(t.ticker)!;
    if (t.transaction_code === "P") {
      e.buyers.add(t.owner_name);
      e.buyValue += Number(t.value ?? 0);
    } else {
      e.sellers.add(t.owner_name);
      e.sellValue += Number(t.value ?? 0);
    }
  }

  const quotes: EnrichedRow[] = scan.map((r) => {
    const ins = insAgg.get(r.ticker);
    return {
      ...r,
      insBuyers: ins?.buyers.size ?? 0,
      insBuyValue: ins?.buyValue ?? 0,
      insSellers: ins?.sellers.size ?? 0,
      insSellValue: ins?.sellValue ?? 0,
    };
  });

  let generated: Generated;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      generated = await claudeGenerate(quotes);
    } catch (e) {
      console.error("setup engine: Claude generation failed, using heuristic:", e);
      generated = heuristic(quotes);
    }
  } else {
    generated = heuristic(quotes);
  }

  const { error: wErr } = await service.from("weather_reports").upsert({
    report_date: date,
    ...generated.weather,
    model: generated.model,
  });
  if (wErr) throw new Error(`weather upsert failed: ${wErr.message}`);

  await service.from("setups").delete().eq("report_date", date);
  const priceOf = new Map(quotes.map((q) => [q.ticker, q.price]));
  const expiresOn = new Date(Date.now() + HORIZON_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  const { error: sErr } = await service.from("setups").insert(
    generated.setups.map((s) => ({
      report_date: date,
      ...s,
      model: generated.model,
      entry_price: priceOf.get(s.ticker) ?? null,
      target_price: parsePrice(s.price_target),
      expires_on: expiresOn,
    }))
  );
  if (sErr) throw new Error(`setups insert failed: ${sErr.message}`);

  await recordActivity(
    "report_published",
    `Weather report published — ${generated.setups.length} setups (${generated.setups
      .map((s) => `$${s.ticker}`)
      .join(", ")})`
  );

  return { status: "generated", date, model: generated.model, setups: generated.setups.length };
}
