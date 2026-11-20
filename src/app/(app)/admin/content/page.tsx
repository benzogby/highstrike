import { requireAdmin } from "@/lib/adminGate";
import ContentManager from "./ContentManager";

export const metadata = {
  title: "Content — Admin — HighStrike",
};

export default async function AdminContentPage() {
  await requireAdmin();
  return <ContentManager />;
}
