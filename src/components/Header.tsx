import Link from "next/link";

const nav = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">
            highstrike
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm text-ink-2 transition hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href="#waitlist"
          className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2"
        >
          Get early access
        </a>
      </div>
    </header>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
      <path
        d="M8 22 L13 15 L17 18 L24 8"
        stroke="#0a0b0d"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M24 8 L24 13 M24 8 L19 8" stroke="#0a0b0d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
