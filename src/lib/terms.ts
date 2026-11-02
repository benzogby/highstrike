import type { User } from "@supabase/supabase-js";

// Agreeing to the Terms (no refunds included) and the Privacy Policy (Ben, 2026-11-02: "force agreement to terms, refund
// policy and privacy policy upon account creation"). The record is the account's own user metadata: written by signUp,
// by the auth callback after Google (?terms=1), or by the checkout for an account that has none yet, so nobody pays
// without one. TERMS_VERSION is the Terms' "Last updated" date; raise both together.

export const TERMS_VERSION = "2026-11-02";

/** What goes in the account's user metadata when they agree. */
export function termsAgreement() {
  return { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION };
}

/** The account has agreed to the Terms (any version). */
export function agreedToTerms(user: Pick<User, "user_metadata"> | null | undefined) {
  return typeof user?.user_metadata?.terms_accepted_at === "string";
}
