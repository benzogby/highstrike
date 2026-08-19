import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

export const dynamic = "force-dynamic";

// Stable favicon URL that follows the admin-set icon (Admin ▸ Content).
// Redirects to the uploaded asset, or the built-in mark when unset.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  let target = `${origin}/icon-default.svg`;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "favicon")
      .maybeSingle();
    if (data?.value) target = data.value;
  } catch {
    // fall through to default
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
