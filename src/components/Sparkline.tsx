/** A small trend line from the last closes, green if it ended higher, red if lower; a dash until there are two. */
export default function Sparkline({ values, width = 64, height = 22 }: { values?: number[]; width?: number; height?: number }) {
  if (!values || values.length < 2) {
    return <span className="text-xs text-ink-3">—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
      role="img"
      aria-label={`Trend ${up ? "up" : "down"} over ${values.length} sessions`}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
