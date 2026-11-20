"use server";

import { allow } from "@/lib/security";
import { viewer } from "@/lib/membership";
import { refreshScan } from "@/lib/scan/build";

/** Admin's Refresh now on the Scanner (src/lib/scan/build.ts). */
export async function refreshScanNow(): Promise<{ error?: string; stocks?: number; contracts?: number }> {
  const v = await viewer();
  if (!v?.profile?.is_admin) return { error: "Admins only." };
  if (!(await allow(`refresh-scan:${v.user.id}`, { max: 3, windowSec: 300 }))) return { error: "You're doing that too fast. Wait a moment and try again." };
  try {
    const r = await refreshScan();
    return { stocks: r.stocks, contracts: r.contracts };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The refresh failed." };
  }
}
