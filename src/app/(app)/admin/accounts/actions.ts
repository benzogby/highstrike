"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGate";
import { supabaseService } from "@/lib/stripe";
import { LIFETIME } from "@/lib/offer";

// Admin → Accounts' buttons: turn the membership on or off by hand (a comp, or a refund done in Stripe), and make an
// account an admin or not. Each asks requireAdmin itself, as a server action can be called without its page.

const ID = /^[0-9a-f-]{36}$/i;

export async function setMembership(id: string, on: boolean) {
  await requireAdmin();
  if (!ID.test(id)) throw new Error("No such account.");
  const { error } = await supabaseService().from("profiles").update({ plan: on ? LIFETIME.plan : "free" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${id}`);
}

export async function setAdmin(id: string, on: boolean) {
  const me = await requireAdmin();
  if (!ID.test(id)) throw new Error("No such account.");
  if (id === me.id && !on) throw new Error("You can't take admin away from yourself.");
  const { error } = await supabaseService().from("profiles").update({ is_admin: on }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${id}`);
}
