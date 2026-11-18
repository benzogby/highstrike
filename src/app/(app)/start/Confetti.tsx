"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#1fbf86", "#3dd49c", "#55dfaa", "#f2b84b", "#eef3f1", "#2cc7b6"];

/**
 * A burst of confetti over the whole screen for about three seconds (the first idea's reveal), drawn on one canvas that
 * ignores clicks. Nothing for anyone who's asked their system for less motion.
 */
export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    size();
    window.addEventListener("resize", size);
    const W = () => canvas.width;
    const H = () => canvas.height;
    // Two cannons from the lower corners, angled in and up, plus a light fall from the top.
    const bits = Array.from({ length: 190 }, (_, i) => {
      const fromTop = i % 4 === 0;
      const left = i % 2 === 0;
      const angle = fromTop ? Math.PI / 2 + (Math.random() - 0.5) * 0.6 : left ? -Math.PI / 3 - Math.random() * 0.5 : -Math.PI * (2 / 3) + Math.random() * 0.5;
      const speed = fromTop ? 2 + Math.random() * 3 : 14 + Math.random() * 10;
      return {
        x: fromTop ? Math.random() * W() : left ? 0 : W(),
        y: fromTop ? -20 * dpr : H(),
        vx: Math.cos(angle) * speed * dpr,
        vy: Math.sin(angle) * speed * dpr,
        w: (6 + Math.random() * 6) * dpr,
        h: (3 + Math.random() * 4) * dpr,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length],
        delay: fromTop ? Math.random() * 40 : Math.random() * 8,
      };
    });
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W(), H());
      const fade = t > 2400 ? Math.max(0, 1 - (t - 2400) / 900) : 1;
      for (const b of bits) {
        if (b.delay > 0) {
          b.delay--;
          continue;
        }
        b.vy += 0.32 * dpr;
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + dpr);
        ctx.restore();
      }
      if (t < 3300) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W(), H());
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] h-full w-full" />;
}
