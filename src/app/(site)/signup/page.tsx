import { redirect } from "next/navigation";
import { JOIN_LINK } from "@/components/join/events";

// Accounts are made by paying since 2026-11-02 (Ben: "Lifetime access should just open to the payment popup. Account is
// created upon payment"), so the old sign-up form's address opens the homepage's payment popup instead.
export default function SignUpPage() {
  redirect(JOIN_LINK);
}
