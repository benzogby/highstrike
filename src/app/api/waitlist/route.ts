import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/stripe";
import { throttle } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Where a signup came from: the homepage's popup, or the paywall over the app (a signed-in account). */
const SOURCES = ["landing", "app"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const limited = await throttle(req, "waitlist", { max: 8, windowSec: 3600 }, true);
  if (limited) return limited;
  let email: unknown;
  let source: unknown;
  try {
    ({ email, source } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const supabase = supabaseService();
  const { error } = await supabase
    .from("waitlist_signups")
    .insert({ email: email.trim().toLowerCase(), source: SOURCES.includes(source as string) ? (source as string) : "landing" });

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
