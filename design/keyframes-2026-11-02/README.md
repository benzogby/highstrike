# highstrike.com in the HighStrike reels system: keyframes (2026-11-02)

Ben, 2026-11-02: "Let's re-render the homepage to follow the new highstrike design system that we just made for the
highstrike reels style. Render me a few website keyframes, and then we will build. Make it look awesome."

**Not approved yet, nothing built.** These are eight stills of one real page (`index.html`), for his eye. The live
homepage is unchanged (src/app/(landing), commit cc7b86c).

## The system, from the reels to the web

The reels system is the one Ben answered for on 2026-11-02 (daily-reels `benchmarks/highstrike-keyframes-2026-11-02`,
`hs2.css`, and the DNA in `benchmarks/highstrike-reference-2026-11-02/DNA.md`). Its pieces, as the site uses them:

- **The dark room** is every dark section: graphite, one green key light from the top left, and the market out of focus
  behind it (SPY's and QQQ's real closes, blurred, with each session's move as a green or red bar).
- **The white card** is the light punch: highstrike.com's own light ground, its 48 px grid fading down, with the green
  glow from the top. It's used once, for the record.
- **Type:** Cal Sans for headlines and big figures, Inter for everything else, with tabular figures. Both fonts are in
  `fonts/` (OFL).
- **Colour:** HighStrike green is the one accent and means a gain; red is used only for a loss.
- **The price tag** is the key word: "before the bell" in the hero and "$99" in pricing carry the plain green tag (the
  accent, no arrow). Results carry ▲ in green or ▼ in red.
- **The live chart:** a setup's real closes, its levels drawn from the morning it published (trigger, entry and target
  as axis chips), the reward zone, the trade's own path lit green, and the tag on the head.
- **Glass:** every dark card is smoked glass with the key light on its rim. The alert lands with depth.
- **Furniture:** the ticker tape (the last session's movers) at the hero's foot, the bull and wordmark in the bar, and
  the full lockup at the close.
- **The crosshair snap** (k3's lock) marks the moment a setup's rules are met.

## The frames (desktop 1440 × 900 at 2×, phone 390 × 844 at 3×)

| frame | section | what it shows |
| --- | --- | --- |
| kf1-hero | Hero | "Finished trades [before the bell]". HOOD's short of Oct 29, drawn from Oct 6 to its target hit at the Oct 30 close (+7.04% in two sessions). This morning's pre-market report (87/94/29) sits behind it, and the "Target hit" alert lands on top. The tape shows the Oct 30 movers. |
| kf2-hero-phone | Hero, phone | The same, phone-first: the headline, one button, then the setup card. |
| kf3-how | How a setup happens | The four moments; "When the price agrees" is lit. The same HOOD setup is shown as its ticket: the plan, its real entry rules all met, and the crosshair locked on Oct 29 as the alert lands. |
| kf4-graded | Graded in public (light) | 134 setups graded since August, 31.3% hit their target, an average gain of +5.3% and an average loss of −6.1%. The newest seven results include the wins and the stops, plus the setups closed each week. |
| kf5-desk | Everything on the desk | The terminal, with the ticker lookup as its search. It shows this morning's weather (87/94/29 and its note), today's slate (PFE, XOM, VICR), insider selling over 30 days and the crowd. |
| kf6-pricing | Pricing | "Everything for [$99] a month", sold as an order ticket: $99.00 a month, a 7-day trial, $0.00 due today. |
| kf7-close | The close | The desk's 48 names on one map at the Oct 30 close, fading into the dark where the full lockup stands, then "Start before tomorrow's open". |
| kf8-graded-phone | Graded, phone | The light punch at phone width. |

`sheet.jpg` puts all eight on one sheet.

## The data (all real, all public)

`make-world.mjs` reads what the live homepage reads, with the publishable key and the public RPCs, into `world.json` and
`world.js`. That covers the Nov 2 weather report and slate, the 20 newest graded setups, the setup stats, the weekly
record, the 48 movers, each name's lookup, and longer daily closes from `get_landing_closes`. A `price_history` row
dated D holds the close of the session before D, and the page labels each close with its own session, the same way
src/lib/marketCalendar.ts does. Nothing is invented: every ticker, price, date, score, insider sale and watcher count
comes from that fetch at 10:40 ET.

## Calls made for Ben's eye

- **The hero trade is a short.** The public record's five newest target hits are four shorts (IREN, HOOD ×2, MSTR) and
  VICR's long. VICR has only six closes on file, too few to draw. HOOD's Oct 29 short has 19 sessions of history and a
  clean two-session hit. On a short the price falls as the trade wins, so the head's tag shows the price with no arrow,
  and the result carries ▲ +7.04%. The build can pick the newest hit with enough history automatically.
- **The record is shown as it stands:** a 31.3% hit rate, with an average gain (+5.3%) smaller than the average loss
  (−6.1%). It matches the live page.
- **The plain green tag** (no arrow) holds non-figures ("before the bell", "$99"). The reels proposed a graphite tag
  for these. Green reads better on a page.
- **Taste Skill's house rules ban** glass, glows, gradients, a coloured word in a headline and small uppercase labels.
  All of them are this system's own, so the build keeps them and passes the inspector's `--allow` for those rules only.
  Everything else in the gate still applies.
- **Pricing sells the one $99 plan with a 7-day trial,** like the live homepage, but billing still runs the old three
  tiers (src/lib/stripe.ts) and /pricing still lists them. The build should ship with the $99 plan wired in Stripe.

## Re-rendering

```
node design/keyframes-2026-11-02/make-world.mjs      # refresh the data (public, no keys)
node design/keyframes-2026-11-02/render.mjs           # every frame, then the sheet (Chrome for Testing via CHROME_PATH)
node design/keyframes-2026-11-02/render.mjs kf1-hero  # one frame
```
