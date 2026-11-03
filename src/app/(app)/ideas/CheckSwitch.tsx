import Link from "next/link";

/**
 * The two ways to check a trade idea, one tap apart (Ben, 2026-11-03: the top bar's "Check a trade idea" opens Paste):
 * paste one you got somewhere, or build one from what you want.
 */
export default function CheckSwitch({ on }: { on: "paste" | "build" }) {
  const item = (key: "paste" | "build", href: string, label: string) => (
    <Link
      href={href}
      aria-current={on === key ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
        on === key ? "bg-panel-2 text-ink ring-1 ring-inset ring-line-strong" : "text-ink-3 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Check a trade idea" className="inline-flex gap-1 rounded-lg border border-line bg-panel p-1">
      {item("paste", "/ideas/paste", "Paste an idea")}
      {item("build", "/ideas/build", "Build an idea")}
    </nav>
  );
}
