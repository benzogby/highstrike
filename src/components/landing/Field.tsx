import type { Close } from "@/app/(landing)/data";
import { seeded } from "./Pieces";

// The dark room's depth (the reels' price field): SPY and QQQ's real closes,
// huge and out of focus at two depths, each session's move hanging off the line
// as a green or red bar, and a little dust lit by the key light. Decorative.

function layer(series: Close[], cls: string, color: string, width: number) {
  if (series.length < 2) return null;
  const lo = Math.min(...series.map((p) => p.close));
  const hi = Math.max(...series.map((p) => p.close));
  const pts = series.map((p, i) => [(i / (series.length - 1)) * 1000, 340 - ((p.close - lo) / (hi - lo || 1)) * 240] as const);
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  return (
    <svg className={cls} viewBox="0 0 1000 400" preserveAspectRatio="none">
      <path d={`${d} L1000 400 L0 400 Z`} fill={color} opacity="0.06" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => {
        if (i === 0 || i % 2) return null;
        const move = (series[i].close - series[i - 1].close) / series[i - 1].close;
        const h = 14 + Math.min(70, Math.abs(move) * 1900);
        return <rect key={i} x={x - 5} y={y - h / 2} width="10" height={h} rx="3" fill={move >= 0 ? "#1FBF86" : "#FF5D52"} opacity="0.5" />;
      })}
    </svg>
  );
}

export default function Field({ spy, qqq, seed }: { spy: Close[]; qqq: Close[]; seed: number }) {
  const r = seeded(seed);
  const dust = Array.from({ length: 18 }, () => {
    const x = r() * 100, y = r() * 100, size = 2 + r() * 4, depth = r();
    const lit = Math.max(0, 1 - Math.hypot((x - 18) / 70, (y - 4) / 90));
    return { x, y, size, depth, lit };
  });
  return (
    <>
      <div className="hs-light" aria-hidden="true" />
      <div className="hs-field" aria-hidden="true">
        {layer(spy, "hs-field__far", "#1FBF86", 10)}
        {layer(qqq.slice(-36), "hs-field__near", "#7FE9C3", 6)}
        {dust.map((m, i) => (
          <i
            key={i}
            className="hs-dust"
            style={{
              left: `${m.x.toFixed(2)}%`,
              top: `${m.y.toFixed(2)}%`,
              width: `${m.size.toFixed(1)}px`,
              height: `${m.size.toFixed(1)}px`,
              opacity: Number((0.06 + m.lit * 0.42).toFixed(2)),
              filter: `blur(${(m.depth * 2).toFixed(1)}px)`,
              animationDelay: `${(-m.depth * 12).toFixed(1)}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
