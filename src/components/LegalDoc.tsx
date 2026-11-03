import Eyebrow from "@/components/Eyebrow";

// The frame shared by /terms-of-service and /privacy-policy: the about page's hero, then one readable column of
// numbered sections with a contents list at the top.

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export const UPDATED = "November 3, 2026";

export function LegalDoc({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-14 pt-16 text-center lg:pt-24">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-2">{intro}</p>
          <p className="mt-4 text-xs uppercase tracking-wider text-ink-3">Last updated {UPDATED}</p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <nav aria-label="Contents" className="rounded-2xl border border-line bg-panel p-6">
            <p className="text-xs uppercase tracking-wider text-ink-3">Contents</p>
            <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-2 transition hover:text-accent">
                    <span className="font-mono-nums text-ink-3">{i + 1}.</span> {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-12 space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-xl font-bold">
                  <span className="font-mono-nums text-accent">{i + 1}.</span> {s.title}
                </h2>
                <div className="legal-body mt-4 space-y-4 leading-relaxed text-ink-2 [&_a]:text-accent [&_a]:underline [&_li]:pl-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export const SUPPORT = "support@highstrike.com";

export function Mail() {
  return <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>;
}
