"use client";

import { useEffect, useState } from "react";
import JoinButton from "@/components/join/JoinButton";
import { Bull } from "@/components/landing/Pieces";
import { LIFETIME_WAS } from "@/lib/offer";

/**
 * The homepage's floating bar at the foot (Ben, 2026-11-02: "Give page a floating footer like getripping.com/staging
 * when the page is scrolled beyond the hero"): "Get HighStrike", $1,997 struck through over the price, and Get Instant Access (Ben's words, 2026-11-02), from when the hero's button (#hero-cta) has
 * scrolled away until the close (#closing) comes into sight, and not over the pricing section (#pricing), which has its own, so the button is always at hand but never doubled.
 */
export default function LandingDock({ price }: { price: string }) {
  const [heroGone, setHeroGone] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [atPrice, setAtPrice] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const hero = document.getElementById("hero-cta");
    const end = document.getElementById("closing");
    const pricing = document.getElementById("pricing");
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === end) setAtEnd(e.isIntersecting || e.boundingClientRect.top < 0);
        if (e.target === pricing) setAtPrice(e.isIntersecting);
      }
    });
    if (hero) watch.observe(hero);
    if (end) watch.observe(end);
    if (pricing) watch.observe(pricing);
    return () => watch.disconnect();
  }, []);
  const on = heroGone && !atEnd && !atPrice;
  return (
    <div className="hs-dock" data-on={on} aria-hidden={!on} inert={!on}>
      <Bull />
      <p className="hs-dock__text">
        <b>Get HighStrike</b>
        <s>{LIFETIME_WAS}</s> {price}
      </p>
      <JoinButton className="hs-btn hs-btn--sm">Get Instant Access</JoinButton>
    </div>
  );
}
