// The cookie banner's answer (Ben, 2026-11-02: "Add cookie consent banner"), kept in this browser. "all": the page-view
// counter may keep its random visitor and session IDs. "essential": no page-view counting at all. No answer yet: views
// are counted with no IDs and nothing stored. Signing in and the theme are essential and work either way.

export type Consent = "all" | "essential";

const KEY = "hs_consent";
export const CONSENT_EVENT = "hs:consent";

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(c: Consent) {
  try {
    localStorage.setItem(KEY, c);
    if (c === "essential") {
      localStorage.removeItem("hs_vid");
      sessionStorage.removeItem("hs_sid");
      sessionStorage.removeItem("hs_sid_t");
      sessionStorage.removeItem("hs_h");
    }
  } catch {
    /* the banner still closes for this page */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: c }));
}
