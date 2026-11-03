import { CARD } from "@/components/ui";

/** The bull case and the bear case side by side, from src/lib/ideaCase.ts's rules, with the one-line verdict under them. */
export default function BullBear({ bull, bear, verdict }: { bull: string[]; bear: string[]; verdict: string }) {
  const side = (title: string, points: string[], tone: "up" | "down") => (
    <div className={`${CARD} p-4`}>
      <h3 className={`text-sm font-medium ${tone === "up" ? "text-up" : "text-down"}`}>{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden className={tone === "up" ? "text-up" : "text-down"}>
              {tone === "up" ? "+" : "−"}
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <section aria-labelledby="bb-title">
      <h2 id="bb-title" className="text-[15px] font-medium text-ink">
        Bull case vs bear case
      </h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {side("Why it could work", bull, "up")}
        {side("Why it could fail", bear, "down")}
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{verdict}</p>
    </section>
  );
}
