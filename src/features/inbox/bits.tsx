"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { StarIcon } from "lucide-react";
import type { Addr } from "@/lib/inbox-mail";
import { GLYPH_BG, hueOf, initialOf } from "./format";
import type { InboxLabel } from "./types";

/** Admin → Inbox's small pieces: a person's round mark, a checkbox that can be half on, a star, a label's chip. */

export function Avatar({ addr, small = false }: { addr: Addr; small?: boolean }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-medium text-white ${GLYPH_BG[hueOf(addr.email)]} ${small ? "size-6 text-[11px]" : "size-9 text-sm"}`}>
      {initialOf(addr)}
    </span>
  );
}

export function Check({ checked, mixed = false, label, onToggle }: { checked: boolean; mixed?: boolean; label: string; onToggle: (shift: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={() => {}}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      className="size-4 shrink-0 cursor-pointer accent-accent"
    />
  );
}

export function Star({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={on ? "Starred" : "Not starred"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`grid size-7 shrink-0 place-items-center rounded-full hover:bg-panel-2 ${on ? "text-glyph-2" : "text-ink-3 hover:text-ink-3"}`}
    >
      <StarIcon className={`size-4 ${on ? "fill-current" : ""}`} />
    </button>
  );
}

/** A label as Gmail shows it beside a subject: its name, a dot of its colour, and an × to take it off where that's offered. */
export function LabelChip({ label, onRemove, children }: { label: InboxLabel | { name: string; glyph: number }; onRemove?: () => void; children?: ReactNode }) {
  return (
    <span className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-md bg-panel-2 px-1.5 py-px text-[11.5px] leading-4 text-ink-3">
      {label.glyph >= 0 && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${GLYPH_DOT[label.glyph]}`} />}
      <span className="truncate">{children ?? label.name.split("/").pop()}</span>
      {onRemove && (
        <button type="button" aria-label={`Remove the label ${label.name}`} title="Remove this label" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="-mr-0.5 rounded px-0.5 hover:bg-panel-3 hover:text-ink">×</button>
      )}
    </span>
  );
}

/** Written out so the build keeps every one (globals.css --glyph-N). */
export const GLYPH_DOT = GLYPH_BG;
