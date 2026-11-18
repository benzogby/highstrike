"use server";

import { viewer } from "@/lib/membership";
import { refreshScan } from "@/lib/scan/build";

/** Admin's Refresh now on the Scanner (src/lib/scan/build.ts). */
export async function refreshScanNow(): Promise<{ error?: string; stocks?: number; contracts?: number }> {
  const v = await viewer();
  if (!v?.profile?.is_admin) return { error: "Admins only." };
  try {
    const r = await refreshScan();
    return { stocks: r.stocks, contracts: r.contracts };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The refresh failed." };
  }
}
