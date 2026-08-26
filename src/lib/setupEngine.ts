import Anthropic from "@anthropic-ai/sdk";
import { fetchQuotes, type Quote } from "@/lib/quotes";
import { supabaseService } from "@/lib/stripe";

// Daily generation of the market weather report + setup cards. Uses Claude
// (claude-opus-5) when ANTHROPIC_API_KEY is configured; otherwise falls back
// to a deterministic heuristic derived from the same quote data, so the
// pipeline publishes real database-backed content in every environment.

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
  }

  return { graded: open.length, closed };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function heuristic(quotes: Quote[]): Generated {
  const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
  const gainers = quotes.filter((q) => q.changePct > 0).length;
  const avgAbs = quotes.reduce((s, q) => s + Math.abs(q.changePct), 0) / (quotes.length || 1);

  const direction = clamp((gainers / (quotes.length || 1)) * 100);
  const volatility = clamp(avgAbs * 28);
  const opportunity = clamp(avgAbs * 18 + Math.abs(direction - 50) * 0.6 + 25);

  const target = (q: Quote, up: boolean) =>
    `$${(q.price * (up ? 1.05 : 0.95)).toFixed(2)}`;

  const mk = (q: Quote, dir: "long" | "short", rank: number): GeneratedSetup => ({
    ticker: q.symbol,
    direction: dir,
    justification:
      dir === "long"
        ? `${q.symbol} is leading the scan universe at ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}% with breadth ${gainers}/${quotes.length} positive — momentum continuation setup while the day's leaders hold their gains.`
        : `${q.symbol} is the weakest name in the universe at ${q.changePct.toFixed(2)}% against ${gainers}/${quotes.length} positive breadth — relative-weakness fade while rallies keep getting sold.`,
    entry_criteria: [
      dir === "long"
        ? `Price holds above ${target(q, false)} on a 15-minute close`
        : `Price fails below ${target(q, true)} on a 15-minute close`,
      "Relative volume above 1.5× at trigger time",
      "Broad-market direction score unchanged or improving",
    ],
    price_target: target(q, dir === "long"),
    time_frame: "3-5 days",
    flow_score: clamp(78 - rank * 9 + Math.abs(q.changePct) * 3),
  });

  const setups: GeneratedSetup[] = [];
  if (sorted[0]) setups.push(mk(sorted[0], "long", 0));
  if (sorted[1]) setups.push(mk(sorted[1], "long", 1));
  const last = sorted[sorted.length - 1];
  if (last && last.changePct < 0) setups.push(mk(last, "short", 2));

  return {
    weather: {
      volatility,
      opportunity,
      direction,
      summary: `${gainers} of ${quotes.length} tracked names positive; average absolute move ${avgAbs.toFixed(2)}%. ${direction >= 50 ? "Constructive tape — favor momentum continuation." : "Defensive tape — be selective and size down."}`,
    },
    setups,
    model: "heuristic",
  };
}

async function claudeGenerate(quotes: Quote[]): Promise<Generated> {
  const client = new Anthropic();
  const quoteLines = quotes
    .map((q) => `${q.symbol}: $${q.price.toFixed(2)} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "You are HighStrike AI, generating the daily pre-market report for an options-trading terminal. " +
      "You produce market commentary and illustrative trade setups — never guarantees. " +
      "Respond with ONLY a JSON object, no markdown fences, matching exactly: " +
      '{"weather":{"volatility":0-100,"opportunity":0-100,"direction":0-100,"summary":"1-2 sentences"},' +
      '"setups":[{"ticker":"...","direction":"long"|"short","justification":"2 sentences of concrete reasoning tied to the data","entry_criteria":["3 specific trigger conditions"],"price_target":"$123.45","time_frame":"e.g. 3-5 days","flow_score":0-100}]} ' +
      "Produce exactly 3 setups chosen from the provided universe only. Price targets must be within ±12% of the current price.",
    messages: [
      {
        role: "user",
        content: `Today's scan universe with last price and day change:\n${quoteLines}\n\nGenerate today's weather report and 3 setups.`,
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
  const known = new Set(quotes.map((q) => q.symbol));
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

  const { data: universe } = await service
    .from("symbols")
    .select("ticker")
    .eq("is_active", true)
    .limit(40);
  const tickers = (universe ?? []).map((r) => r.ticker);
  const quotes = await fetchQuotes(tickers);

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
  const priceOf = new Map(quotes.map((q) => [q.symbol, q.price]));
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

  return { status: "generated", date, model: generated.model, setups: generated.setups.length };
}
