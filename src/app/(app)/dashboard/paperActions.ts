"use server";

import { requireMember } from "@/lib/membership";
import { allow } from "@/lib/security";
import { cancelOrder, placeOrder, resetAccount, type OrderInput } from "@/lib/paper";

// The desk's buttons (src/lib/paper.ts does the work, as the server, so fills can't be faked).

export async function sendOrder(input: OrderInput) {
  const { user } = await requireMember("/dashboard");
  if (!(await allow(`paper-order:${user.id}`, { max: 60, windowSec: 60 }))) return { error: "You're doing that too fast. Wait a moment and try again." };
  return placeOrder(user.id, input);
}

export async function cancelPaperOrder(id: string) {
  const { user } = await requireMember("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "That order isn't yours." };
  return cancelOrder(user.id, id);
}

export async function resetPaper() {
  const { user } = await requireMember("/dashboard");
  if (!(await allow(`paper-reset:${user.id}`, { max: 5, windowSec: 600 }))) return { error: "You're doing that too fast. Wait a moment and try again." };
  return resetAccount(user.id);
}
