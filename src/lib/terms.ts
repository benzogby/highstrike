import type { User } from "@supabase/supabase-js";

// Agreeing to the Terms (no refunds included) and the Privacy Policy (Ben, 2026-11-02: "force agreement to terms, refund
// policy and privacy policy upon account creation"). The record is the account's own user metadata: written by signUp,
// by the auth callback after Google (?terms=1), or by the checkout for an account that has none yet, so nobody pays
// without one. TERMS_VERSION is the Terms' "Last updated" date; raise both together. The checkout asks again when the
// account agreed to an older version (2026-11-03: the membership became $14 for a week, then $99/month), so everyone
// who pays has agreed to the renewal in the Terms they pay under.

export const TERMS_VERSION = "2026-11-03";

/** What goes in the account's user metadata when they agree. */
export function termsAgreement() {
  return { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION };
}

/** The account has agreed to the Terms (any version). */
export function agreedToTerms(user: Pick<User, "user_metadata"> | null | undefined) {
  return typeof user?.user_metadata?.terms_accepted_at === "string";
}

/** The account has agreed to these Terms, the version in force now: the checkout's test. */
export function agreedToCurrentTerms(user: Pick<User, "user_metadata"> | null | undefined) {
  return agreedToTerms(user) && user?.user_metadata?.terms_version === TERMS_VERSION;
}
