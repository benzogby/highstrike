# Offer overhaul — making the $99/month membership worth it

Interview with Ben, 2026-11-17. Starting point: 1 paying member, 67 free sign-ups, 0 trades logged in the journal,
house ideas 37.9% wins / avg +6.2% / avg −6.9% over 214 closed (loses on balance).

## What Ben decided

- **Member:** newer options trader, small account (under ~$25k), has lost money, wants a plan.
- **Main job:** make them a better options trader — ideas, scanner, grading, charting, analysis, backtesting,
  visibility and education. A tool for **scanning and planning**; no trade import / broker sync for now.
- **Aha in 10 minutes:** their first trade idea — 3 questions (account size, max risk per trade, style) → today's best
  idea, sized for them, on our chart with its grade, one tap for alerts.
- **Track record:** hide it from members now (keep the data and an admin view) until the idea engine is fixed.
- **Spend:** up to ~$100/month for data. Polygon/Massive: start free (2 years of daily candles), then Stocks + Options
  Starter (~$58/mo) when chains are built. Still no AI.
- **Pricing:** unchanged — $14 first week, then $99/month.
- **Compliance:** education and tools, never personalized advice; every grade and size says why, as a rule, not a
  recommendation.

## The plan, in order

1. **HighStrike Chart** (first build). Our own candle chart in our UI: daily + weekly candles, 9/21/50/200 MAs,
   volume, RSI. Markup: horizontal levels, trend lines, zones, text notes, arrows, measure (price/%), Fibonacci
   retracement, and a trade-plan overlay (drag entry/stop/target; reward:risk and the option's est. P&L update live).
   Drawings are private per member and saved per ticker; house ideas show their levels. Lives on `/symbol/[ticker]`
   and each idea page. Data: Polygon/Massive daily aggregates cached in Supabase (needs Ben's key); until then the
   chart runs on our own closes.
2. **Hide Track record** for members (tab, links, homepage/popup mentions); admins keep it.
3. **Onboarding to a first sized idea** (LIVE 2026-11-18) — 3 questions saved to the profile (/start → /start/idea); every idea, plan and size uses them.
4. **Trade Planner + A–F grade** — ticker → chart → direction/option → contracts for their account and stop → grade
   (trend, reward:risk, IV level, earnings risk, liquidity, size vs account) with reasons → save plan + alerts.
5. **Real option chains + IV** (Polygon Options Starter): real prices replace "est.", IV rank, expected move, P&L
   diagram per contract.
6. **Earnings calendar + IV crush** warnings for their watchlist and every idea.
7. **Setup backtester** — pick a setup + ticker → last 1–2 years: win rate, avg win/loss, every trade on the chart.
   Then use it on our own engine to fix the daily ideas' rules before the record comes back.
8. **Paper trading** with real option prices.
9. Scanner + Trading School tie-ins: lessons linked from grades ("why this got a D → watch lesson 4.2").

## Needs from Ben

- A Polygon/Massive account (free to start); the API key goes into a Mac dialog → Vercel env `POLYGON_API_KEY`.
