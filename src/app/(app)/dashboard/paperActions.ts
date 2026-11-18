"use server";

import { requireMember } from "@/lib/membership";
import { cancelOrder, placeOrder, resetAccount, type OrderInput } from "@/lib/paper";

// The desk's buttons (src/lib/paper.ts does the work, as the server, so fills can't be faked).

export async function sendOrder(input: OrderInput) {
  const { user } = await requireMember("/dashboard");
  return placeOrder(user.id, input);
}

export async function cancelPaperOrder(id: string) {
  const { user } = await requireMember("/dashboard");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "That order isn't yours." };
  return cancelOrder(user.id, id);
}

export async function resetPaper() {
  const { user } = await requireMember("/dashboard");
  return resetAccount(user.id);
}
