import Link from "next/link";
import { Logo } from "@/components/Header";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative overflow-hidden">
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <div className="glow absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 py-20">
        <Link href="/" aria-label="HighStrike home">
          <Logo size={40} />
        </Link>
        <h1 className="mt-5 text-center font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-center text-sm text-ink-2">{subtitle}</p>
        <div className="mt-8 w-full rounded-2xl border border-line bg-panel p-7">
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </main>
  );
}

export const authInputClass =
  "h-12 w-full rounded-lg border border-line bg-panel-2 px-4 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

export const authButtonClass =
  "h-12 w-full rounded-lg bg-accent font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60";

export const authLabelClass = "mb-1.5 block text-xs uppercase tracking-wider text-ink-3";
