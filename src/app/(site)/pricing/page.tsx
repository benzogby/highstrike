import { redirect } from "next/navigation";

// HighStrike sells one thing since 2026-11-02: $397 once for lifetime access to the daily trades, the tools and the
// HighStrike Trading School (src/lib/offer.ts). The old three-plan page went with the old plans; its address now opens the
// homepage's pricing, where the same popup sells it.
export default function PricingPage() {
  redirect("/#pricing");
}
