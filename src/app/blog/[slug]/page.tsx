import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CtaBlock from "@/components/CtaBlock";
import { posts, getPost, formatDate, type PostBlock } from "@/lib/posts";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — HighStrike Blog`,
    description: post.excerpt,
  };
}

function Block({ block }: { block: PostBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-10 font-display text-xl font-bold sm:text-2xl">
          {block.text}
        </h2>
      );
    case "ul":
      return (
        <ul className="mt-5 space-y-3">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-ink-2">
              <span className="mt-1 text-accent" aria-hidden="true">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <p className="mt-6 rounded-xl border border-accent/30 bg-panel px-6 py-5 font-display text-base font-medium">
          {block.text}
        </p>
      );
    default:
      return <p className="mt-5 leading-relaxed text-ink-2">{block.text}</p>;
  }
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <main>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-16">
        <p className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
          <Link href="/blog" className="transition hover:text-ink">
            ← Blog
          </Link>
          <span className="rounded-full border border-line px-2.5 py-0.5 uppercase tracking-wider">
            {post.category}
          </span>
          {formatDate(post.date)} · {post.readMinutes} min read
        </p>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-ink-2">{post.excerpt}</p>

        <div className="mt-4 border-t border-line pt-4">
          {post.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>

        <p className="mt-10 rounded-xl border border-line bg-panel-2 px-6 py-4 text-xs leading-relaxed text-ink-3">
          Educational content only — nothing on this page is financial, investment,
          or trading advice. Trading involves substantial risk, including possible
          loss of principal. Past performance is not indicative of future results.
        </p>
      </article>

      <section className="border-t border-line bg-panel/30">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            Keep reading
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group rounded-2xl border border-line bg-panel p-6 transition hover:border-accent/40"
              >
                <p className="text-xs text-ink-3">
                  {formatDate(p.date)} · {p.readMinutes} min read
                </p>
                <h3 className="mt-2 font-display text-base font-bold transition group-hover:text-accent">
                  {p.title}
                </h3>
              </Link>
            ))}
          </div>
          <div className="mt-14">
            <CtaBlock />
          </div>
        </div>
      </section>
    </main>
  );
}
