import { requireAdmin } from "@/lib/adminGate";
import TrafficTab from "./TrafficTab";

export const metadata = {
  title: "Traffic — Admin — HighStrike",
};

export default async function AdminTrafficPage() {
  await requireAdmin();
  return <TrafficTab />;
}
