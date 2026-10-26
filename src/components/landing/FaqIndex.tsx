"use client";

import { useState } from "react";

// Questions on the left, one answer on the right that follows hover, click and
// keyboard focus. On phones the answer opens under its question instead.
export default function FaqIndex({ title, faqs }: { title: string; faqs: { q: string; a: string }[] }) {
  const [sel, setSel] = useState(0);
  return (
    <div className="hs-faq__grid">
      <div>
        <h2 className="hs-faq__title hs-muted">{title}</h2>
        <ul className="hs-faq__list">
          {faqs.map((f, i) => (
            <li key={f.q}>
              <button
                type="button"
                className="hs-faq__q"
                aria-expanded={sel === i}
                aria-controls={`hs-faq-a-${i}`}
                onClick={() => setSel(i)}
                onFocus={() => setSel(i)}
                onMouseEnter={() => setSel(i)}
              >
                {f.q}
              </button>
              {sel === i && (
                <p id={`hs-faq-a-${i}`} className="hs-faq__inline">
                  {f.a}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="hs-faq__pane" aria-live="polite">
        <p key={sel} className="hs-faq__answer hs-fade">
          {faqs[sel].a}
        </p>
      </div>
    </div>
  );
}
