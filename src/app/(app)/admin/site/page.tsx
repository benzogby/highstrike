import { requireAdmin } from "@/lib/adminGate";
import SiteTab from "./SiteTab";

export const metadata = {
  title: "Site — Admin — HighStrike",
};

export default async function AdminSitePage() {
  await requireAdmin();
  return <SiteTab />;
}
