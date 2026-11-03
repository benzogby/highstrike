import type { Metadata } from "next";
import Link from "next/link";
import FaqIndex from "@/components/landing/FaqIndex";
import Field from "@/components/landing/Field";
import ProofRow from "@/components/landing/Proof";
import { Tag, Tri, price, shortDate } from "@/components/landing/Pieces";
import { supabaseService } from "@/lib/stripe";
import { cardsFor, type Structure } from "@/lib/options/cards";
import type { DeckCard } from "@/lib/options/deck";
import SetupCard from "../(app)/swipe/SetupCard";
import { getLandingData } from "./data";

// The homepage, now the swipe app's (Ben, 2026-11-02: "Hide the rest for now, make this the only product", "Make it all
// free for now while we build"): what it is, the real cards from the deck (src/lib/options), how it works, what's on a
// card, the questions, and a free account. The earlier homepage that sold the $397 lifetime membership is in git
// history (1c34164). Styles in landing.css; refreshed every 30 minutes.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: "HighStrike — Swipe right on your next options trade",
  description:
    "Options setups on 350+ stocks, one card at a time: calls, puts, spreads and iron condors with the strikes, take profit and stop on the chart. Swipe right to save, left to pass. Free while we build.",
  openGraph: {
    title: "HighStrike — Swipe right on your next options trade",
    description: "Options setups on 350+ stocks, one card at a time. Swipe right to save, left to pass. Free.",
    type: "website",
  },
};

const FAQS = [
  { q: "Is it free?", a: "Yes. Swiping, saving, the scoreboard and the weekly contest are free while HighStrike is being built. You only need an account." },
  {
    q: "What's on a card?",
    a: "One options setup on one stock: the trade (a call, a put, a debit or credit spread, or an iron condor), its expiry, what it costs or pays, the most it can lose and make, the breakeven, the chance it pays, and the strikes, take profit and stop drawn on the stock's chart.",
  },
  {
    q: "Are the prices real?",
    a: "They're estimates. Each contract is priced with the Black-Scholes model from the stock's own recent moves, and every card says so. Real quotes, and real fills, will differ.",
  },
  { q: "What happens to setups I save?", a: "Each one is followed to its take profit, its stop or its expiry, with its estimated result, so you can see how your picks do. They count toward your streak and this week's contest." },
  { q: "Do I connect my broker?", a: "No. HighStrike never touches your account or your money. If you take a trade, you place it wherever you already trade." },
  { q: "Is this financial advice?", a: "No. The cards are market commentary and education, and you make every decision. Options can lose their whole value." },
];

const STEPS = [
  { name: "Swipe", text: "Each card is one options setup. Swipe right to save it, left to pass, up to see the legs. The deck learns what you like." },
  { name: "Follow", text: "Every setup you save is followed to its take profit, stop or expiry, with its estimated result as it goes." },
  { name: "Compete", text: "Keep a daily streak, climb this week's contest, and share your best calls as a card." },
];

const ON_A_CARD = [
  "The trade: a call, a put, a debit or credit spread, or an iron condor, with its expiry",
  "What it costs or pays, the most it can lose and the most it can make",
  "The breakeven, and how far the stock has to move to get there",
  "The chance it pays at expiry, on the same estimate",
  "The strikes, take profit and stop drawn on the stock's chart",
  "One plain line on why the setup exists, and how other traders swiped it",
];

const COLS = "id, ticker, structure, bias, expiry, dte, spot, vol, legs, net, max_profit, max_loss, reward_risk, breakevens, pop, take_profit, stop_loss, why, tier";

/** Two real cards from the deck for the hero (a spread and a different kind), or sample ones until the deck has any. */
async function heroCards(spy: number | null): Promise<DeckCard[]> {
  try {
    const db = supabaseService();
    const { data } = await db.from("swipe_cards").select(COLS).eq("active", true).eq("tier", 1).order("created_at", { ascending: false }).limit(60);
    const rows = (data ?? []) as DeckCard[];
    const first = rows.find((c) => c.structure === "bull_call_spread" || c.structure === "bear_put_spread") ?? rows[0];
    const second = rows.find((c) => c.ticker !== first?.ticker && (c.structure === "iron_condor" || c.structure === "bull_put_spread" || c.structure === "bear_call_spread"));
    const picked = [first, second].filter((c): c is DeckCard => !!c);
    if (picked.length) {
      const { data: closes } = await db.from("underlying_closes").select("ticker, close, day").in("ticker", picked.map((c) => c.ticker)).order("day", { ascending: false }).limit(80);
      return picked.map((c) => ({
        ...c,
        closes: ((closes ?? []) as { ticker: string; close: number }[]).filter((r) => r.ticker === c.ticker).map((r) => Number(r.close)).slice(0, 30).reverse(),
        crowd: null,
      }));
    }
  } catch {
    /* fall through to samples */
  }
  // Until the deck's first refresh: sample cards on SPY at its last close, priced by the same engine.
  const spot = spy ?? 690;
  const walk = Array.from({ length: 30 }, (_, i) => +(spot * (0.97 + 0.001 * i + 0.006 * Math.sin(i / 2.4))).toFixed(2));
  return (["bull_call_spread", "iron_condor"] as Structure[]).flatMap((s, i) => {
    const c = cardsFor({ ticker: "SPY", spot, vol: 0.17, changePct: 0.6, rangePos: 0.7, mom5: 1.2 }, 4).find((x) => x.structure === s);
    return c ? [{ ...c, id: `sample-${i}`, max_profit: c.maxProfit, max_loss: c.maxLoss, reward_risk: c.rewardRisk, take_profit: c.takeProfit, stop_loss: c.stopLoss, tier: 1, closes: walk, crowd: null }] : [];
  });
}

export default async function Home() {
  const { spy, qqq, movers, badges, proof } = await getLandingData();
  const session = spy[spy.length - 1]?.date;
  const tape = movers.some((m) => m.changePct !== 0) ? movers.slice(0, 24) : [];
  const cards = await heroCards(spy[spy.length - 1]?.close ?? null);

  return (
    <main className="hs-page">
      <section className="hs-room hs-hero" aria-labelledby="hs-title">
        <Field spy={spy} qqq={qqq} seed={11} />
        <div className="hs-wrap hs-hero__grid">
          <div className="hs-hero__copy">
            <h1 id="hs-title" className="hs-display hs-h1">
              <span className="hs-line" data-reveal="">
                Swipe right on
              </span>
              <span className="hs-line" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
                <Tag className="hs-tag--land">your next trade</Tag>
              </span>
            </h1>
            <p className="hs-lead" data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
              HighStrike deals you options setups on 350+ stocks: calls, puts, spreads and iron condors, each with its strikes, take profit and stop drawn on the chart. Swipe right to save, left to pass.
            </p>
            <div id="hero-cta" className="hs-hero__actions" data-reveal="" style={{ "--i": 3 } as React.CSSProperties}>
              <Link href="/signup" className="hs-btn">
                Start swiping free
              </Link>
              <Link href="/signin" className="hs-link">
                Sign in
              </Link>
            </div>
            <p className="hs-hero__price" data-reveal="" style={{ "--i": 3 } as React.CSSProperties}>
              <b>Free while we build.</b> No card needed.
            </p>
            <div data-reveal="" style={{ "--i": 4 } as React.CSSProperties}>
              <ProofRow proof={proof} traders={badges.traders} countries={badges.countries} />
            </div>
          </div>

          <figure className="hs-deckshow" aria-label="Setup cards as they look in the app">
            {cards[1] && (
              <div className="hs-deckshow__card hs-deckshow__card--back" aria-hidden="true">
                <SetupCard c={cards[1]} open={false} crowd={false} />
              </div>
            )}
            {cards[0] && (
              <div className="hs-deckshow__card">
                <span className="hs-deckshow__stamp">Save</span>
                <SetupCard c={cards[0]} open={false} crowd={false} />
              </div>
            )}
          </figure>
        </div>
      </section>

      {tape.length > 0 && (
        <section className="hs-tape" aria-label={`The biggest moves among the stocks HighStrike follows, ${session ? `${shortDate(session)} close` : "last session"}`}>
          <span className="hs-tape__label">
            <i aria-hidden="true" />
            Movers · {session ? `${shortDate(session)} close` : "last session"}
          </span>
          <div className="hs-tape__win">
            <div className="hs-tape__run">
              {[...tape, ...tape].map((m, i) => (
                <span key={`${m.ticker}-${i}`} className="hs-tape__it" aria-hidden={i >= tape.length ? true : undefined}>
                  <b>{m.ticker}</b>
                  <span className="hs-tape__p">{price(m.close)}</span>
                  <span className={`hs-tape__c ${m.changePct >= 0 ? "hs-up" : "hs-dn"}`}>
                    <Tri up={m.changePct >= 0} />
                    {Math.abs(m.changePct).toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="how" className="hs-room hs-section" aria-labelledby="hs-how-title">
        <Field spy={spy} qqq={qqq} seed={18} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-how-title" className="hs-display hs-h2" data-reveal="">
              How it works
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              A few minutes before the open, a few cards on the train. That&apos;s it.
            </p>
          </div>
          <ul className="hs-tools hs-steps">
            {STEPS.map((s, i) => (
              <li key={s.name} className="is-on" data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                <span className="hs-steps__n">{i + 1}</span>
                <h3 className="hs-tools__name">{s.name}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="cards" className="hs-room hs-section" aria-labelledby="hs-card-title">
        <Field spy={spy} qqq={qqq} seed={25} />
        <div className="hs-wrap">
          <div className="hs-section-head">
            <h2 id="hs-card-title" className="hs-display hs-h2" data-reveal="">
              Everything you need, on one card
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              No option chains to dig through. Each setup is worked out for you, with the risk up front.
            </p>
          </div>
          <ul className="hs-included hs-oncard">
            {ON_A_CARD.map((t, i) => (
              <li key={t} data-reveal="" style={{ "--i": i } as React.CSSProperties}>
                {t}
              </li>
            ))}
          </ul>
          <p className="hs-fine hs-oncard__note">Prices are estimates from the Black-Scholes model, not live quotes, and every card says so.</p>
        </div>
      </section>

      <section id="faq" className="hs-room hs-section hs-faq" aria-label="Questions">
        <Field spy={spy} qqq={qqq} seed={39} />
        <div className="hs-wrap">
          <FaqIndex title="Questions" faqs={FAQS} />
        </div>
      </section>

      <section id="closing" className="hs-room hs-close" aria-labelledby="hs-close-title">
        <Field spy={spy} qqq={qqq} seed={46} />
        <div className="hs-wrap">
          <div className="hs-end">
            <span className="hs-end__pool" aria-hidden="true" />
            <h2 id="hs-close-title" className="hs-display hs-h2" data-reveal="">
              Your next trade is one swipe away.
            </h2>
            <p className="hs-lead" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              Free while we build. Make an account and start swiping in a minute.
            </p>
            <div data-reveal="" style={{ "--i": 2 } as React.CSSProperties}>
              <Link href="/signup" className="hs-btn">
                Start swiping free
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
