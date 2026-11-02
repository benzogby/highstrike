"use client";

// The tick box every new account (and any account paying without one on record) must tick: the Terms, their no-refunds
// line and the Privacy Policy. Links open in a new tab, so a popup or a half-filled form stays where it is.

export default function AgreeTerms({
  checked,
  onChange,
  id = "hs-agree-terms",
  className = "",
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  id?: string;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={`flex cursor-pointer items-start gap-2.5 text-left text-xs leading-relaxed text-ink-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
      />
      <span>
        I agree to the{" "}
        <a href="/terms-of-service" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">
          Terms of Service
        </a>
        , including that <b className="font-semibold text-ink">all sales are final (no refunds)</b>, and the{" "}
        <a href="/privacy-policy" target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
