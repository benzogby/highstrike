import { redirect } from "next/navigation";

// HighStrike sells one thing, the membership: $14 for the first week, then $99/month (src/lib/offer.ts, since
// 2026-11-03). The old three-plan page went with the old plans; its address now opens the
// homepage's pricing, where the same popup sells it.
export default function PricingPage() {
  redirect("/#pricing");
}
