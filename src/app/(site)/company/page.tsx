import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";
import Eyebrow from "@/components/Eyebrow";

// Team edits in the admin panel show up within 30 minutes.
export const revalidate = 1800;

type TeamMember = {
  id: string;
  name: string;
  title: string;
  bio: string;
  photo_url: string | null;
};

async function fetchTeam(): Promise<TeamMember[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data } = await supabase
      .from("team_members")
      .select("id, name, title, bio, photo_url")
      .eq("is_active", true)
      .order("position")
      .order("created_at");
    return (data ?? []) as TeamMember[];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: "Company — HighStrike",
  description:
    "The company behind HighStrike AI: who we are, how we operate, careers, and how to reach us.",
};

const values = [
  {
    title: "Skin in the game",
    body: "We trade the same setups the terminal publishes. Nothing sharpens a product like using it with your own money on the line.",
  },
  {
    title: "Transparency by default",
    body: "Wins and losses on the same scoreboard, methodology in the open, reasoning written out on every setup. Trust is earned in public.",
  },
  {
    title: "Members over metrics",
    body: "We'd rather have a smaller group of traders who genuinely improve than a large one that churns. Education is the product as much as the software.",
  },
  {
    title: "Ship carefully",
    body: "Trading tools carry real consequences. New features earn their way into the terminal through testing against history before they ever touch a live morning.",
  },
];

const facts = [
  { label: "Legal entity", value: "ZERO DTE HOLDINGS LLC" },
  { label: "Incorporated", value: "Wyoming, United States" },
  { label: "Founded", value: "2018" },
  { label: "Products", value: "HighStrike AI Terminal · HighStrike Trading School" },
  { label: "Support", value: "support@highstrike.com" },
];

export default async function CompanyPage() {
  const team = await fetchTeam();
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-16 pt-16 text-center lg:pt-24">
          <Eyebrow>Company</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            The company behind the terminal.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-2">
            HighStrike is a trading education and analytics company. Since 2018
            we&apos;ve taught traders a disciplined, data-first process — and built
            the software that runs it every market day.
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-8">
              <h2 className="font-display text-xl font-bold">HighStrike AI Terminal</h2>
              <p className="mt-3 leading-relaxed text-ink-2">
                Our flagship product: a daily analytics terminal that scores market
                conditions each morning and delivers curated options setups —
                entries, targets, time frames, and plain-English justifications —
                built on 8 years of theory and data from 150k trades.
              </p>
              <Link
                href="/pricing"
                className="mt-5 inline-block text-sm font-semibold text-accent transition hover:text-accent-2"
              >
                See plans →
              </Link>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-8">
              <h2 className="font-display text-xl font-bold">HighStrike Trading School</h2>
              <p className="mt-3 leading-relaxed text-ink-2">
                Where it all started. A structured options-trading curriculum
                covering process, risk management, and trade selection — the same
                playbook the AI was trained on, taught to humans. Included free with
                qualifying Terminal registrations.
              </p>
              <Link
                href="/about"
                className="mt-5 inline-block text-sm font-semibold text-accent transition hover:text-accent-2"
              >
                Our story →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            How we operate
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="bg-panel p-7">
                <h3 className="font-display text-base font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      {team.length > 0 && (
        <section className="border-t border-line bg-panel/30">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <div className="flex flex-col items-center text-center">
              <Eyebrow>The team</Eyebrow>
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
                The people behind the terminal
              </h2>
            </div>
            <div
              className={`mt-12 grid gap-6 ${
                team.length === 1
                  ? "mx-auto max-w-md"
                  : team.length === 2
                    ? "mx-auto max-w-2xl sm:grid-cols-2"
                    : "sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {team.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center rounded-2xl border border-line bg-panel p-7 text-center"
                >
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_url}
                      alt={m.name}
                      className="h-24 w-24 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent font-display text-2xl font-bold uppercase text-bg">
                      {m.name.slice(0, 2)}
                    </span>
                  )}
                  <h3 className="mt-4 font-display text-lg font-semibold">{m.name}</h3>
                  {m.title && <p className="mt-0.5 text-sm text-accent">{m.title}</p>}
                  {m.bio && (
                    <p className="mt-3 text-sm leading-relaxed text-ink-2">{m.bio}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Careers */}
      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Careers
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-2">
            We&apos;re a small team of traders, engineers, and educators — and we
            hire slowly, on purpose. If you trade seriously, build carefully, or
            teach clearly and think you&apos;d make the terminal better, we want to
            hear from you even when no role is posted.
          </p>
          <a
            href="mailto:support@highstrike.com?subject=Careers%20at%20HighStrike"
            className="mt-7 inline-block rounded-lg border border-line-strong px-6 py-3 font-display text-sm font-semibold transition hover:border-accent/50 hover:text-accent"
          >
            Introduce yourself
          </a>
        </div>
      </section>

      {/* Company facts / contact */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Company facts
          </h2>
          <dl className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <dt className="text-sm text-ink-3">{f.label}</dt>
                <dd className="text-sm text-ink">
                  {f.label === "Support" ? (
                    <a
                      href={`mailto:${f.value}`}
                      className="text-accent transition hover:text-accent-2"
                    >
                      {f.value}
                    </a>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
            For legal terms, see our{" "}
            <a
              href="https://www.highstrike.com/terms-of-service"
              className="underline transition hover:text-ink"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://www.highstrike.com/privacy-policy"
              className="underline transition hover:text-ink"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
