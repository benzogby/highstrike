// The desk's small helpers, safe in the browser (src/lib/optionQuotes.ts has the server's own copy of parseContract).

export const usd = (n: number | null, digits = 2) =>
  n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const signed = (n: number | null, digits = 2) => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);
export const pct = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);
export const tone = (n: number | null) => (n == null || n === 0 ? "text-ink-2" : n > 0 ? "text-up" : "text-down");

export type Contract = { underlying: string; type: "call" | "put"; strike: number; expiry: string };

export function parseContract(c: string): Contract | null {
  const m = /^O:([A-Z.]{1,8})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(c);
  if (!m) return null;
  return { underlying: m[1], expiry: `20${m[2]}-${m[3]}-${m[4]}`, type: m[5] === "C" ? "call" : "put", strike: Number(m[6]) / 1000 };
}

export const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "AAPL Dec 19 $350 call", or the ticker for a stock. */
export function symbolLabel(symbol: string) {
  const c = parseContract(symbol);
  return c ? `${c.underlying} ${shortDay(c.expiry)} $${Number.isInteger(c.strike) ? c.strike : c.strike.toFixed(2)} ${c.type}` : symbol;
}

export const daysTo = (iso: string) => Math.max(0, Math.round((Date.parse(`${iso}T21:00:00Z`) - Date.now()) / 86_400_000));
