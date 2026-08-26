"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toastSuccess } from "@/lib/toastBus";

type Alert = {
  id: string;
  ticker: string;
  condition: "above" | "below";
  threshold: number;
  status: "active" | "fired";
  fired_price: number | null;
  fired_at: string | null;
  created_at: string;
};

export default function AlertsManager() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("price_alerts")
      .select("id, ticker, condition, threshold, status, fired_price, fired_at, created_at")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(50);
    setAlerts((data ?? []) as Alert[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    await supabaseBrowser()
      .from("price_alerts")
      .update({ status: "cancelled" })
      .eq("id", id);
    load();
    toastSuccess("Alert removed");
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
          Price alerts
        </h2>
        <span className="text-xs text-ink-3">
          {alerts ? `${alerts.filter((a) => a.status === "active").length} active` : "…"}
        </span>
      </div>

      {alerts != null && alerts.length === 0 && (
        <p className="mt-4 text-sm text-ink-2">
          No alerts yet — open any symbol page (or hover a watchlist row and hit
          the bell) to set your first one.
        </p>
      )}

      {alerts != null && alerts.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <Link
                  href={`/symbol/${a.ticker}#alerts`}
                  className="font-display font-semibold transition hover:text-accent"
                >
                  ${a.ticker}
                </Link>
                {a.status === "fired" ? (
                  <span className="text-ink-2">
                    <span className="mr-1.5 rounded-full bg-accent px-2 py-0.5 font-display text-[10px] font-bold text-bg">
                      FIRED
                    </span>
                    crossed {a.condition} ${Number(a.threshold).toFixed(2)}
                    {a.fired_price != null && (
                      <span className="font-mono-nums"> at ${Number(a.fired_price).toFixed(2)}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-ink-2">
                    fires {a.condition}{" "}
                    <span className="font-mono-nums text-ink">
                      ${Number(a.threshold).toFixed(2)}
                    </span>
                  </span>
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
    </section>
  );
}
