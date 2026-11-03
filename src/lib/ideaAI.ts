import Anthropic from "@anthropic-ai/sdk";
import type { Cases, Idea } from "@/lib/ideas";

export type { Cases };

// The idea page's AI (piece 2 of the trade-ideas plan, Ben 2026-11-02): the bull and bear case written for an idea, and
// "Ask the AI" answers about it. Claude Opus 5.5, with the server-side refusal fallback on, so a declined request is
// re-run on a fallback model instead of failing. Server only (ANTHROPIC_API_KEY).

export const IDEA_MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
const ai = () => (client ??= new Anthropic());

const RULES =
  "You are HighStrike AI, helping an active options trader judge a trade idea. Talk like a friend who trades: short, plain, " +
  "concrete, no hype, no jargon a busy trader would have to look up. Use only the facts given here plus general market " +
  "knowledge; never invent prices, news, earnings dates or options data you weren't given, and say so when you don't know. " +
  "This is market commentary and education, not investment advice; the trader makes every decision.";

/** The idea as the model reads it, with the latest price when there is one. */
function brief(i: Idea, price: number | null) {
  return [
    `Ticker: ${i.ticker}`,
    `Side: ${i.direction}`,
    `Style: ${i.style}`,
    `Published: ${i.report_date}`,
    `Idea: ${i.headline ?? ""}`,
    `Reasoning: ${i.justification}`,
    `Entry rules: ${i.entry_criteria.join("; ")}`,
    `Entry price when published: ${i.entry_price ?? "unknown"}`,
    `Target: ${i.price_target} (${i.time_frame})`,
    `Stop used for grading: an 8% move against the idea`,
    `Status: ${i.status}${i.current_pct != null ? `, ${i.current_pct}% so far` : ""}`,
    `Latest price: ${price ?? "unknown"}`,
  ].join("\n");
}

async function complete(system: string, messages: Anthropic.Beta.BetaMessageParam[], effort: "low" | "medium" | "high") {
  const res = await ai().beta.messages.create({
    model: IDEA_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort },
    system,
    messages,
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined to answer that one.");
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** The bull case and the bear case, three short points each, and one line on how to weigh them. */
export async function writeCases(i: Idea, price: number | null): Promise<Cases> {
  const text = await complete(
    `${RULES} Respond with ONLY a JSON object, no markdown fences: {"bull":["3 short points for the idea working"],"bear":["3 short points for it failing, including what would prove it wrong"],"verdict":"one sentence on how to weigh the two"}`,
    [{ role: "user", content: `${brief(i, price)}\n\nWrite the bull case and the bear case for this idea.` }],
    "medium"
  );
  const parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as Partial<Cases>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.slice(0, 300)).filter(Boolean).slice(0, 4) : []);
  const cases = { bull: list(parsed.bull), bear: list(parsed.bear), verdict: String(parsed.verdict ?? "").slice(0, 300), at: new Date().toISOString() };
  if (!cases.bull.length || !cases.bear.length) throw new Error("The AI's answer came back empty.");
  return cases;
}

/** An answer to the member's question about the idea, with their earlier questions on it as context. */
export async function answer(i: Idea, price: number | null, history: { role: "user" | "assistant"; content: string }[], question: string) {
  return complete(
    `${RULES} Keep answers under 150 words unless the question needs more. The idea:\n${brief(i, price)}`,
    [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: question }],
    "medium"
  );
}
