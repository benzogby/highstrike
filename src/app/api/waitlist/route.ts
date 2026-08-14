import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ email: email.trim().toLowerCase(), source: "landing" });

  if (error) {
    // 23505 = unique violation → already signed up; treat as success.
    if (error.code === "23505") {
      return NextResponse.json({ message: "You're already on the list — see you at launch." });
    }
    console.error("waitlist insert failed:", error.code, error.message);
    return NextResponse.json(
      { error: "Couldn't save your signup — try again in a minute." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "You're on the list — we'll be in touch soon." });
}
