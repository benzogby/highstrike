import type { Proof } from "@/app/(landing)/data";

/** "10,000+" as Ben writes it on the page, "10k+". */
const short = (n: string) => n.replace(/^(\d{1,3}),000(\+?)$/, "$1k$2");

/**
 * The proof line (Ben, 2026-11-02: "a 4.9 star rating with example profile circles with the below line: 10k+ traders |
 * 142 countries"): five stars and the rating from HighStrike's own member reviews, the member photos uploaded in
 * Admin → Site → Proof, and the reach from Admin → Site → Hero.
 */
export default function ProofRow({ proof, traders, countries, className = "" }: { proof: Proof; traders: string; countries: string; className?: string }) {
  const faces = proof.avatars.filter((u) => /^https:\/\//.test(u)).slice(0, 5);
  return (
    <div className={`hs-proofrow ${className}`}>
      {faces.length > 0 && (
        <span className="hs-proofrow__faces" aria-hidden="true">
          {faces.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" width={36} height={36} loading="lazy" />
          ))}
        </span>
      )}
      <span className="hs-proofrow__text">
        <span className="hs-proofrow__stars" role="img" aria-label={`Rated ${proof.rating} out of 5 by members`}>
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
            </svg>
          ))}
          <b>{proof.rating}</b>
          <span>from member reviews</span>
        </span>
        <span className="hs-proofrow__reach">
          {short(traders)} traders <i aria-hidden="true">|</i> {countries} countries
        </span>
      </span>
    </div>
  );
}
