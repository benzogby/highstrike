import Link from "next/link";
import BrandMark from "@/components/BrandMark";

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
    <main className="bg-bg">
      <div className="mx-auto flex min-h-[70vh] max-w-[420px] flex-col items-center justify-center px-4 py-16 sm:py-20">
        <Link href="/" aria-label="HighStrike home" className="flex items-center gap-2">
          <BrandMark size={32} />
        </Link>
        <h1 className="mt-5 text-center font-display text-2xl leading-tight text-ink">
          {title}
        </h1>
        <p className="mt-2 text-center text-sm text-ink-2">{subtitle}</p>
        <div className="card-shadow mt-7 w-full rounded-xl border border-line bg-panel p-6 sm:p-7">
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </main>
  );
}

export const authInputClass =
  "h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export const authButtonClass =
  "h-10 w-full rounded-lg bg-accent text-sm font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60";

export const authLabelClass = "mb-1.5 block text-[13px] font-medium text-ink";
