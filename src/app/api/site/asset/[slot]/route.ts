import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";
import { SITE_IMAGES } from "@/lib/siteImages";

export const dynamic = "force-dynamic";

// /api/site/asset/favicon (app_icon, logo, wordmark, mark, og_image): a redirect to the image set in Admin → Site →
// Images, or to the built-in one (src/lib/siteImages.ts). Cached 5 minutes at the edge.
export async function GET(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params;
  const image = SITE_IMAGES.find((i) => i.key === slot);
  if (!image) return NextResponse.json({ error: "Unknown image" }, { status: 404 });

  const origin = new URL(request.url).origin;
  let target = image.fallback ? `${origin}${image.fallback}` : "";
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const keys = slot === "logo" ? ["logo_dark", "logo"] : [slot];
    const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
    const found = keys.map((k) => data?.find((r) => r.key === k)?.value).find((v) => typeof v === "string" && v);
    if (found) target = found;
  } catch {
    // the built-in one
  }
  if (!target) return new NextResponse(null, { status: 404 });

  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600" },
  });
}
