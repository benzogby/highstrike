"use client";

import { useEffect } from "react";

// The homepage's motion layer (src/app/(landing)/landing.css → Motion): section
// parts that arrive once in a stagger, charts that draw themselves with the
// price tag landing on the head, the alert landing with depth, figures that
// roll to their value, and the tape that runs only while it's on screen.
// Everything is visible without this script; it only adds `is-in`.
export default function LandingMotion() {
  useEffect(() => {
    // Rolling figures: the real number stays in the text for screen readers.
    for (const el of document.querySelectorAll<HTMLElement>("[data-roll]")) {
      if (el.dataset.rolled) continue;
      const value = el.textContent?.trim() ?? "";
      const said = Object.assign(document.createElement("span"), { className: "hs-sr", textContent: value });
      const shown = Object.assign(document.createElement("span"), { className: "hs-roll__digits" });
      shown.setAttribute("aria-hidden", "true");
      let i = 0;
      for (const ch of value) {
        if (!/\d/.test(ch)) {
          shown.append(ch);
          continue;
        }
        const col = Object.assign(document.createElement("span"), { className: "hs-roll__col" });
        const strip = Object.assign(document.createElement("span"), { className: "hs-roll__strip" });
        strip.style.setProperty("--d", ch);
        strip.style.setProperty("--i", String(i++));
        for (let n = 0; n < 10; n++) strip.append(Object.assign(document.createElement("span"), { textContent: String(n) }));
        col.append(strip);
        shown.append(col);
      }
      el.classList.add("hs-roll");
      el.dataset.rolled = "1";
      el.replaceChildren(said, shown);
    }

    const targets = [...document.querySelectorAll<HTMLElement>("[data-reveal], [data-roll], [data-draw], [data-land]")];
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    targets.forEach((el) => io.observe(el));

    // The tape runs only while it is on screen.
    const loop = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-off", !e.isIntersecting);
    });
    document.querySelectorAll(".hs-tape").forEach((el) => loop.observe(el));
    return () => {
      io.disconnect();
      loop.disconnect();
    };
  }, []);

  return null;
}
