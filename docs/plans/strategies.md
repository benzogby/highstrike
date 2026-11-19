# Strategies: builder, backtester, live signals

Ben's answers, 2026-11-19 (question loop on narrowing the app). The charts and the paper trading desk stay as they are.

## Direction

- **Who it's for:** active retail options traders (this replaces the 11-17 "newer trader" answer).
- **The promise:** find better options trades.
- **Free hooks:** paper trading desk, strategy builder, trade grader, a daily idea are all meant to be free eventually.
  For now the paywall stays exactly as it is ($14 first week, then $99/mo). What's paid gets decided later.
- **Education:** Trading School stays, in the background: in the menu and in context ("what is this?" links on the
  builder and the chain), not the headline.

## What a strategy is

A strategy is **entry and exit rules**: indicators, price action and news. Not a set of option legs.

- **Editor:** blocks, IF / AND / THEN, picked from menus (e.g. `RSI(14) crosses below 30` AND `price above 50-day
  average` AND `news in the last hour`). Exits the same way, plus target, stop and time limits. No code, no AI.
- **What it trades:** an option picked by rule, set once per strategy (e.g. a call about 30 days out near 0.40 delta;
  a put when bearish). Backtests price that contract; live, it fills on the paper desk.
- **News rules:** Alpaca's free news feed (already on our keys): "news in the last N hours", "earnings in the next N
  days", keyword-based tone (no AI).

## Backtester

- Real stock history (Alpaca daily and intraday bars, 2016 on) with the option **priced by a volatility model** from
  the stock's own price history, clearly labelled "estimated". Real option history can be bought and added later.
- Results: trades list, win rate, average win and loss, expectancy, drawdown, equity curve, and the entries and exits
  as arrows on the chart.

## Live

All four, per saved strategy:
1. **Alerts** when the entry fires on its watched tickers (bell and email, through sendMail).
2. **Auto paper-trade** when it fires, using the member's Auto-Send setting.
3. **On the chart:** arrows where it would have entered and exited.
4. **Scanner tab** listing every stock where the entry is true right now.

## Ideas

The daily ideas come from **HighStrike's own published strategies** firing, each shown with its backtest record.
Members can copy a strategy and tweak it.

## Templates

Ship 6–10 classics, each one click to backtest and copy: RSI oversold bounce, 20-day breakout, moving-average cross,
gap and go, earnings run-up, VWAP reclaim (and a few more).

## Where it lives

A new **Strategies** page in the menu (list, block editor, backtest results), plus a Strategies toggle-over on the
desk that shows a strategy's signals on the chart.

## Open

- What members pay for (nothing decided; paywall unchanged meanwhile).
- Real option history for backtests (later, paid data).
