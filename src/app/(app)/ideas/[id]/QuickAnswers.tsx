import { CARD } from "@/components/ui";

/** The questions traders ask about an idea, answered from its own numbers (src/lib/ideaCase.ts → quickAnswers). */
export default function QuickAnswers({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section aria-labelledby="qa-title" className={CARD}>
      <h2 id="qa-title" className="border-b border-line px-4 py-3 text-[15px] font-medium text-ink">
        Quick answers
      </h2>
      <div className="divide-y divide-line">
        {items.map((it, n) => (
          <details key={it.q} open={n === 0} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
              {it.q}
              <span aria-hidden className="text-ink-3 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
