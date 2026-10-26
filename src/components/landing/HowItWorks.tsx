"use client";

import { useEffect, useRef, useState } from "react";

// How a setup happens: four times of day in one reading column, the matching
// product fragment pinned beside them and changing as each step reaches the
// middle of the screen. On phones, and without script, every paragraph
// carries its own fragment underneath instead.
export default function HowItWorks({
  title,
  steps,
  stages,
}: {
  title: string;
  steps: { lead: string; text: string }[];
  stages: React.ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="hs-story__grid">
      <div className="hs-story__text">
        <h2 className="hs-heading" data-reveal="">
          {title}
        </h2>
        {steps.map((s, i) => (
          <div
            key={s.lead}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            className={`hs-story__step${active === i ? " is-active" : ""}`}
          >
            <h3 className="hs-heading" data-reveal="">
              {s.lead}
            </h3>
            <p className="hs-body" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              {s.text}
            </p>
            <div className="hs-story__inline" data-reveal="" style={{ "--i": 1 } as React.CSSProperties}>
              {stages[i]}
            </div>
          </div>
        ))}
      </div>
      <div className="hs-story__pin">
        <div className="hs-stage">
          {stages.map((stage, i) => (
            <div key={i} aria-hidden={active !== i}>
              {stage}
            </div>
          ))}
        </div>
        <p className="hs-stage__count hs-small hs-muted" aria-live="polite">
          {active + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}
