// Blog content. Each post is structured as typed blocks so pages render
// consistently without an MDX pipeline. Add new posts to the top of the array.

export type PostBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; text: string };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readMinutes: number;
  blocks: PostBlock[];
};

export const posts: Post[] = [
  {
    slug: "what-a-64-percent-win-rate-actually-means",
    title: "What a 64% Win Rate Actually Means",
    excerpt:
      "Win rate is the most quoted — and most misunderstood — number in trading. Here's how to read it next to average gain and average loss.",
    category: "Education",
    date: "2026-08-10",
    readMinutes: 6,
    blocks: [
      {
        type: "p",
        text: "Ask a room full of traders which they'd rather have — a 64% win rate or a 40% win rate — and almost everyone picks the first. It's the wrong question. A win rate means nothing by itself. It only becomes information when you put it next to two other numbers: how much you make when you're right, and how much you lose when you're wrong.",
      },
      {
        type: "h2",
        text: "Expectancy is the number that pays you",
      },
      {
        type: "p",
        text: "The math is short. Multiply your win rate by your average gain, subtract your loss rate times your average loss, and you have your expectancy — the amount you earn, on average, every time you put a trade on. A 64% win rate with a 39% average gain and a 19% average loss produces a strongly positive expectancy. A 90% win rate with small wins and occasional catastrophic losses can produce a negative one. Plenty of traders have gone broke winning most of the time.",
      },
      {
        type: "p",
        text: "This is why we publish average loss right next to average gain on our scoreboard. A performance claim that only shows winners is not a track record — it's an advertisement.",
      },
      {
        type: "h2",
        text: "Why capped losses matter more than big wins",
      },
      {
        type: "p",
        text: "Options give you something stock traders don't get: a structurally capped downside on long premium trades. You can never lose more than you paid. That changes the shape of the distribution — the left tail is truncated, while the right tail stays open. The occasional +900% outlier isn't the strategy; it's what an open right tail occasionally produces when you let winners run.",
      },
      {
        type: "callout",
        text: "The goal is not to win every trade. The goal is to make your average win meaningfully larger than your average loss, and to take enough trades for the math to assert itself.",
      },
      {
        type: "h2",
        text: "Sample size is the silent variable",
      },
      {
        type: "p",
        text: "Ten trades tell you almost nothing. A 64% win rate measured over ten trades is statistically indistinguishable from a coin flip. Over hundreds of trades, the confidence interval tightens and the number starts to mean something. This is one reason we train and evaluate on a large historical trade base rather than cherry-picking a hot quarter.",
      },
      {
        type: "p",
        text: "When you evaluate any signal service — ours included — ask for the three numbers together, ask over what sample they were measured, and ask what the worst stretch looked like. If the answer to any of those is missing, you're looking at marketing, not measurement.",
      },
    ],
  },
  {
    slug: "how-the-ai-reads-the-market-every-morning",
    title: "How HighStrike AI Reads the Market Every Morning",
    excerpt:
      "Volatility, opportunity, direction — a look inside the daily market weather report and why we lead with conditions, not predictions.",
    category: "Product",
    date: "2026-07-28",
    readMinutes: 7,
    blocks: [
      {
        type: "p",
        text: "Every trading day starts the same way inside the terminal: with a weather report, not a forecast. Before the AI proposes a single trade, it scores the day's conditions on three axes — volatility, opportunity, and direction. The distinction matters. A forecast tells you what should happen. A weather report tells you what you're walking into.",
      },
      {
        type: "h2",
        text: "Volatility: how fast is the tape moving?",
      },
      {
        type: "p",
        text: "The volatility score blends realized movement over recent sessions with what the options market is pricing for the days ahead. High readings don't mean 'stay out' — they mean position smaller, expect wider stops, and favor setups that are paid for movement. Low readings favor patience and defined-risk structures that don't bleed while you wait.",
      },
      {
        type: "h2",
        text: "Opportunity: is there anything worth doing?",
      },
      {
        type: "p",
        text: "Opportunity measures the density of qualifying setups across the scan universe — how many names are near actionable levels with confirming flow. Some of the most expensive days in a trader's year are the ones where nothing is happening and they trade anyway. A low opportunity score is the system's way of saying that cash is a position.",
      },
      {
        type: "h2",
        text: "Direction: which way is the wind blowing?",
      },
      {
        type: "p",
        text: "Direction aggregates trend and breadth into a single lean — how strongly conditions favor longs or shorts. It is deliberately the last of the three, because direction without volatility and opportunity context is how traders end up fighting the tape or overtrading a drifting market.",
      },
      {
        type: "callout",
        text: "Conditions first, setups second. Every trade idea the AI generates inherits the day's weather — sizing guidance, time frame, and structure all flow from it.",
      },
      {
        type: "p",
        text: "After the weather report, the pipeline narrows: the scan universe is filtered to names with confirming signals across price action, unusual options activity, insider filings, and social chatter, and each survivor is written up as a full setup — entry criteria, target, time frame, and the reasoning, in plain English. You see the finished card; the weather report is why the card says what it says.",
      },
    ],
  },
  {
    slug: "position-sizing-the-only-edge-you-fully-control",
    title: "Position Sizing: The Only Edge You Fully Control",
    excerpt:
      "You can't control what the market does next. You have total control over how much of your account finds out. That asymmetry should shape everything.",
    category: "Education",
    date: "2026-07-14",
    readMinutes: 6,
    blocks: [
      {
        type: "p",
        text: "Every part of trading involves uncertainty except one. Entries can be early, targets can be missed, theses can be wrong — but the amount you risk on a trade is decided by you, in full, before any of that happens. Sizing is the only lever with no variance on it. It deserves more attention than it gets.",
      },
      {
        type: "h2",
        text: "The arithmetic of drawdowns is not symmetric",
      },
      {
        type: "p",
        text: "Lose 20% and you need 25% to get back to even. Lose 50% and you need 100%. This asymmetry is the whole argument for small, consistent position sizes: the penalty for oversizing compounds faster than the reward for being right. A strategy with positive expectancy can still ruin an account if individual positions are large enough for a normal losing streak to dig a hole the math can't climb out of.",
      },
      {
        type: "h2",
        text: "Fixed-fraction sizing, in one paragraph",
      },
      {
        type: "p",
        text: "Risk a fixed, small percentage of your account on every trade — for defined-risk options positions, that's simply the premium as a percentage of equity. When the account grows, position size grows with it; when you're in a drawdown, size shrinks automatically. It is self-correcting in exactly the direction you want: pressing when things work, easing off when they don't, with no willpower required.",
      },
      {
        type: "ul",
        items: [
          "Decide the risk percentage before the market opens, not during a trade.",
          "Count correlated positions as one position — five bullish tech trades is one bet on tech.",
          "A losing streak at your normal size is information; a losing streak at double size is damage.",
          "If a single loss would change how you trade tomorrow, the position was too big.",
        ],
      },
      {
        type: "callout",
        text: "Signals tell you where the odds are favorable. Sizing decides whether you're still around when the odds pay off.",
      },
      {
        type: "p",
        text: "This is why every setup in the terminal ships with a time frame and defined-risk structures rather than a dollar amount: the right size is a function of your account, not our conviction. The system can find the trade. Only you can size it.",
      },
    ],
  },
  {
    slug: "unusual-options-activity-explained",
    title: "Unusual Options Activity, Explained",
    excerpt:
      "What it means when option volume detaches from its baseline, why it sometimes signals informed positioning, and how to avoid reading noise as signal.",
    category: "Education",
    date: "2026-06-30",
    readMinutes: 7,
    blocks: [
      {
        type: "p",
        text: "Most days, an option contract trades in a predictable range of volume. Then one day, a strike that normally trades a few hundred contracts prints twenty thousand, most of it hitting the ask in blocks, at a strike and expiry that only pays if something happens soon. That detachment from baseline is what traders call unusual options activity — and it's one of the highest-signal, highest-noise data sources in the market.",
      },
      {
        type: "h2",
        text: "Why it can be informative",
      },
      {
        type: "p",
        text: "Options are levered and time-boxed. Someone paying up for short-dated out-of-the-money contracts in size is expressing a view with a deadline, and paying a premium for the privilege. When that positioning clusters ahead of catalysts, it is occasionally the footprint of someone who knows — or strongly believes — something the tape hasn't priced yet.",
      },
      {
        type: "h2",
        text: "Why it's mostly noise",
      },
      {
        type: "p",
        text: "The overwhelming majority of large option prints are not directional bets at all. They're hedges against stock positions, one leg of multi-leg structures, closing trades that look like opening ones, or dealer flow rebalancing. Raw volume screens surface all of it indiscriminately. Treating every big print as smart money is how retail traders end up tailing someone else's hedge.",
      },
      {
        type: "ul",
        items: [
          "Volume vs. open interest: volume exceeding existing open interest suggests genuinely new positioning.",
          "Aggressor side: prints at the ask lean bullish, at the bid lean bearish — midpoint prints are ambiguous.",
          "Context: activity ahead of a known catalyst reads differently than activity in a news vacuum.",
          "Clustering: one print is a data point; the same expiry hit across multiple days is a pattern.",
        ],
      },
      {
        type: "callout",
        text: "In our pipeline, unusual options activity is a confirming input, never a standalone trigger — it's one of the flags you see on a setup card, weighed alongside price action, insider filings, and chatter.",
      },
      {
        type: "p",
        text: "Used that way — as one witness among several rather than the whole case — unusual activity earns its place in a process. Used alone, it's a slot machine with extra steps.",
      },
    ],
  },
  {
    slug: "why-we-track-insider-buying",
    title: "Why We Track Insider Buying",
    excerpt:
      "Executives sell stock for a hundred reasons. They buy it in the open market for approximately one. That asymmetry is worth monitoring systematically.",
    category: "Education",
    date: "2026-06-12",
    readMinutes: 5,
    blocks: [
      {
        type: "p",
        text: "Corporate insiders file their transactions publicly, on a deadline, under penalty of law. That makes insider activity one of the few genuinely privileged datasets that everyone is allowed to read. The trick is knowing which filings carry information and which are administrative exhaust.",
      },
      {
        type: "h2",
        text: "Selling is ambiguous; buying is not",
      },
      {
        type: "p",
        text: "Insiders sell to diversify, to exercise expiring options, to pay taxes, to fund a divorce, or because a pre-scheduled plan said so. Sales are usually uninformative. Open-market purchases are different: an executive spending their own after-tax cash to increase exposure to a company they already depend on for a salary is expressing one opinion — that the stock is worth more than it costs.",
      },
      {
        type: "h2",
        text: "What makes a purchase worth flagging",
      },
      {
        type: "ul",
        items: [
          "Open-market buys, not option exercises or plan-scheduled acquisitions.",
          "Size that's meaningful relative to the insider's existing stake and compensation.",
          "Cluster buying — several insiders in the same window is far stronger than one.",
          "Buys that break a long personal pattern of not buying.",
        ],
      },
      {
        type: "p",
        text: "When a setup card in the terminal shows insider flags, this is what's behind them: recent filings scored on those criteria, not a raw count of transactions. Two meaningful flags on a name with confirming price action and options flow is a very different situation than two routine filings on a quiet chart.",
      },
      {
        type: "callout",
        text: "No single dataset makes a trade. Insider buying is a slow, sturdy signal — it tells you where conviction lives, and the rest of the stack tells you when the market starts to agree.",
      },
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
