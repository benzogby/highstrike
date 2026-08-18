import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseConfig";

export const dynamic = "force-dynamic";

// Handles Supabase auth redirects: OAuth (PKCE `code`), email confirmation,
// and password-recovery links (`token_hash`). Session cookies are written
// directly onto the redirect response — never rely on ambient cookie
// propagation from a route handler.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  // Only allow same-site relative redirects.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
    console.error("auth callback: code exchange failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return response;
    console.error("auth callback: verifyOtp failed:", error.message);
  } else {
    console.error("auth callback: no code or token_hash in", url.search);
  }

  return NextResponse.redirect(new URL("/signin?error=auth_callback", url.origin));
}
