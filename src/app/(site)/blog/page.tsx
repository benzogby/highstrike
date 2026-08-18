import type { Metadata } from "next";
import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import { posts, formatDate } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog — HighStrike",
  description:
    "Trading education and product notes from the HighStrike team: expectancy, position sizing, options flow, and how the AI terminal works.",
};

export default function BlogIndex() {
  const [featured, ...rest] = posts;

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 lg:pt-20">
          <Eyebrow>Blog</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
            Trade smarter, not more.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            Education and product notes from the HighStrike team — the math, the
            data, and the process behind the terminal.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-16">
          {/* Featured post */}
          <Link
            href={`/blog/${featured.slug}`}
            className="group block overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-accent/40"
          >
            <div className="grid gap-0 lg:grid-cols-5">
              <div className="flex items-center justify-center border-b border-line bg-panel-2 p-10 lg:col-span-2 lg:border-b-0 lg:border-r">
                <span className="font-display text-6xl font-bold text-accent">
                  64%
                </span>
              </div>
              <div className="p-8 lg:col-span-3">
                <p className="flex items-center gap-3 text-xs text-ink-3">
                  <span className="rounded-full border border-line px-2.5 py-0.5 uppercase tracking-wider">
                    {featured.category}
                  </span>
                  {formatDate(featured.date)} · {featured.readMinutes} min read
                </p>
                <h2 className="mt-4 font-display text-2xl font-bold transition group-hover:text-accent">
                  {featured.title}
                </h2>
                <p className="mt-3 text-ink-2">{featured.excerpt}</p>
                <p className="mt-6 text-sm font-semibold text-accent">
                  Read the post →
                </p>
              </div>
            </div>
          </Link>

          {/* Rest of the posts */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {rest.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col rounded-2xl border border-line bg-panel p-7 transition hover:border-accent/40"
              >
                <p className="flex items-center gap-3 text-xs text-ink-3">
                  <span className="rounded-full border border-line px-2.5 py-0.5 uppercase tracking-wider">
                    {p.category}
                  </span>
                  {formatDate(p.date)} · {p.readMinutes} min read
                </p>
                <h2 className="mt-4 font-display text-lg font-bold transition group-hover:text-accent">
                  {p.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">
                  {p.excerpt}
                </p>
                <p className="mt-5 text-sm font-semibold text-accent">
                  Read the post →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
