"use server";

import { revalidatePath } from "next/cache";
import { viewer } from "@/lib/membership";
import { supabaseService } from "@/lib/stripe";

/** Settings' switch for the morning ideas email (profiles.digest_email, written by the server only). */
export async function setDigest(on: boolean) {
  const v = await viewer();
  if (!v) throw new Error("Sign in first.");
  const { error } = await supabaseService().from("profiles").update({ digest_email: on }).eq("id", v.user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
