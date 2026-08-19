import Link from "next/link";
import { LegalParagraphs } from "@/components/SiteContentBits";

const siteLinks = [
  { href: "/results", label: "Results" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About Us" },
  { href: "/company", label: "Company" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-lg font-bold">HighStrike</p>
            <p className="text-xs text-ink-3">Est. 2018</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {siteLinks.map((l) => (
              <Link key={l.href} href={l.href} className="transition hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            <a
              href="https://www.highstrike.com/terms-of-service"
              className="transition hover:text-ink"
            >
              Terms of Service
            </a>
            <a
              href="https://www.highstrike.com/privacy-policy"
              className="transition hover:text-ink"
            >
              Privacy Policy
            </a>
            <a href="mailto:support@highstrike.com" className="transition hover:text-ink">
              support@highstrike.com
            </a>
          </nav>
        </div>

        <div className="mt-10 space-y-3 border-t border-line pt-8 text-xs leading-relaxed text-ink-3">
          <LegalParagraphs />
          <p>
            By using this website, you acknowledge and agree to our{" "}
            <a
              href="https://www.highstrike.com/terms-of-service"
              className="underline transition hover:text-ink"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://www.highstrike.com/privacy-policy"
              className="underline transition hover:text-ink"
            >
              Privacy Policy
            </a>
            .
          </p>
          <p>
            HighStrike is owned and operated by ZERO DTE HOLDINGS LLC, a Wyoming
            Limited Liability Company.
          </p>
          <p>ZERO DTE HOLDINGS, {new Date().getFullYear()} — All Rights Reserved</p>
        </div>
      </div>
    </footer>
  );
}
