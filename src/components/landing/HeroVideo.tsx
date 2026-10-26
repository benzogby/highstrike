"use client";

import { useEffect, useRef, useState } from "react";

// The homepage's full-bleed background film (docs/design-system.md → Hero).
// Muted, looping and decorative, with a white scrim on the left so the copy
// stays readable. Visitors can pause it, and reduced-motion visitors get the
// still poster. Without a film yet, the hero's ivory ground shows through and
// previews say where the film goes.
export default function HeroVideo({
  src,
  poster,
  note,
}: {
  src: string | null;
  poster?: string;
  note?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (video && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      setPaused(true);
    }
  }, []);

  if (!src) {
    return note ? (
      <p className="absolute bottom-5 right-5 z-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-lx-ink-3 sm:right-8">
        {note}
      </p>
    ) : null;
  }

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  };

  return (
    <>
      <video
        ref={ref}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.6)_42%,rgba(255,255,255,0)_72%)]"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute bottom-5 right-5 z-10 inline-flex h-11 items-center rounded-[4px] border border-lx-line bg-white px-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-lx-ink transition-colors hover:border-lx-ink sm:right-8"
      >
        {paused ? "Play film" : "Pause film"}
      </button>
    </>
  );
}
