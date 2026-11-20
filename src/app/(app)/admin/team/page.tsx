import { requireAdmin } from "@/lib/adminGate";
import TeamManager from "./TeamManager";

export const metadata = {
  title: "Team — Admin — HighStrike",
};

export default async function AdminTeamPage() {
  await requireAdmin();
  return <TeamManager />;
}
