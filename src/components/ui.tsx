// The app's design system in pieces (Ben, 2026-11-02: dark only, "toward a replit theme but with our colors"; tokens
// in globals.css). Pages take their header, badges, buttons, cards and fields from here, so the whole app reads as one
// product: Cal Sans titles, Inter at 13-14px, sentence-case labels (never small caps), surfaces a step above the ground
// with a hairline a step lighter, fields sunk into their card, 8-12px corners, green for actions and gains.

/** Green, for the one main action on a screen, with a lit top edge. */
export const BUTTON_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] transition hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60";
export const BUTTON_PRIMARY_SM =
  "items-center justify-center gap-1.5 rounded-md bg-accent px-3 h-8 text-[13px] font-medium text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] transition hover:bg-accent-2 disabled:opacity-60";
/** One step up from the card, with a hairline, for everything else. */
export const BUTTON_SECONDARY =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-panel-2 px-3.5 text-sm font-medium text-ink transition hover:bg-panel-3 disabled:cursor-not-allowed disabled:opacity-60";
/** No frame until hovered: toolbars and quiet actions. */
export const BUTTON_GHOST =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition hover:bg-panel-2 hover:text-ink";

/** A card: a step above the ground, a hairline, 12px corners, a faint light on its top edge (globals.css). */
export const CARD = "rounded-xl border border-line bg-panel";
/** A field, sunk into its card. */
export const INPUT =
  "h-9 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent/20";
/** A field's label, or a small heading over a group: sentence case, medium. */
export const LABEL = "mb-1.5 block text-[13px] font-medium text-ink";
/** The grey line under a label or a title. */
export const HINT = "text-[13px] text-ink-3";

type Tone = "neutral" | "accent" | "up" | "down" | "warn";

const TONES: Record<Tone, string> = {
  neutral: "bg-panel-2 text-ink-2 ring-line-strong",
  accent: "bg-accent-soft text-accent-ink ring-accent/25",
  up: "bg-up-soft text-up ring-up/25",
  down: "bg-down-soft text-down ring-down/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
};

/** A badge: small, sentence case, 6px corners, a soft tint for its tone edged in the same hue. */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4 ring-1 ring-inset ${TONES[tone]} ${className}`}>{children}</span>;
}

/** The badge classes alone, for a link or a button that looks like one. */
export const badgeClass = (tone: Tone = "neutral") => `inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium leading-4 ring-1 ring-inset ${TONES[tone]}`;

/**
 * The top of every page: the title in Cal Sans, one grey line under it, and the page's actions on the right (one green
 * button at most). No eyebrow: where a page sits is the sidebar's job.
 */
export function PageHeader({ title, subtitle, actions, className = "" }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl leading-tight tracking-[-0.01em] text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A figure in a card: the label over it, the figure in Cal Sans, an optional badge or note beside or under it. */
export function Stat({ label, value, aside, note }: { label: React.ReactNode; value: React.ReactNode; aside?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className={`${CARD} px-4 py-3.5`}>
      <p className="text-[13px] text-ink-3">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-display text-2xl leading-none text-ink">{value}</span>
        {aside}
      </div>
      {note && <p className="mt-1.5 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
