"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toastSuccess, toastError } from "@/lib/toastBus";

type Alert = {
  id: string;
  condition: "above" | "below";
  threshold: number;
  status: string;
  fired_price: number | null;
};

export default function AlertPanel({
  ticker,
  userId,
  currentPrice,
}: {
  ticker: string;
  userId: string;
  currentPrice: number | null;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("price_alerts")
      .select("id, condition, threshold, status, fired_price")
      .eq("ticker", ticker)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(10);
    setAlerts((data ?? []) as Alert[]);
  }, [ticker]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await supabaseBrowser().from("price_alerts").insert({
      user_id: userId,
      ticker,
      condition,
      threshold: value,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setThreshold("");
    load();
    toastSuccess(`Alert set — $${ticker} ${condition} $${value.toFixed(2)}`);
  }

  async function cancel(id: string) {
    const { error: err } = await supabaseBrowser()
      .from("price_alerts")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (err) toastError("Couldn't cancel the alert");
    else toastSuccess("Alert cancelled");
    load();
  }

  return (
    <section id="alerts" className="mt-10 scroll-mt-24 rounded-xl border border-line bg-panel p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[15px] text-ink">
          Price alerts — ${ticker}
        </h2>
        {currentPrice != null && (
          <span className="font-mono-nums text-xs text-ink-3">
            now {currentPrice.toFixed(2)}
          </span>
        )}
      </div>

      <form onSubmit={create} className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">Alert me when price goes</span>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(["above", "below"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={`px-3 py-1.5 text-xs font-medium capitalize transition ${
                condition === c ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-panel-2"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          inputMode="decimal"
          placeholder={currentPrice != null ? currentPrice.toFixed(2) : "Price"}
          aria-label="Alert price"
          className="h-9 w-28 rounded-lg border border-line-strong bg-bg px-3 font-mono-nums text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="press rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Set alert"}
        </button>
        {error && <span className="text-sm text-down">{error}</span>}
      </form>

      {alerts.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink-2">
                {a.status === "fired" ? (
                  <>
                    <span className="mr-2 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink ring-1 ring-inset ring-accent/25">
                      FIRED
                    </span>
                    crossed {a.condition} ${Number(a.threshold).toFixed(2)}
                    {a.fired_price != null && (
                      <span className="font-mono-nums"> at ${Number(a.fired_price).toFixed(2)}</span>
                    )}
                  </>
                ) : (
                  <>
                    fires {a.condition}{" "}
                    <span className="font-mono-nums text-ink">
                      ${Number(a.threshold).toFixed(2)}
                    </span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => cancel(a.id)}
                className="text-xs text-ink-3 transition hover:text-down"
              >
                {a.status === "fired" ? "Dismiss" : "Cancel"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-3">
        Alerts fire on live prices only and land in your activity feed
        {process.env.NEXT_PUBLIC_EMAIL_ALERTS === "off" ? "." : " — and your inbox when email alerts are enabled."}
      </p>
    </section>
  );
}
