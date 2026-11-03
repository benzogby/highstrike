"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A panel over the page: a sheet up from the bottom on a phone, or with `menu`, from sm up, a dropdown under the top
 * bar's right end. For the keyboard and screen readers it's a modal dialog: focus moves into it and stays there (Tab
 * wraps), Escape or a tap outside closes it, and focus goes back to whatever opened it. The page behind holds still
 * while it's open. Drawn into <body>, since the top bar's blur would trap a fixed panel inside the bar.
 */
export default function Sheet({
  open,
  onClose,
  label,
  menu = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  menu?: boolean;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panel.current;
    node?.focus({ preventScroll: true });
    const items = () => [...(node?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.getClientRects().length > 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === node || !node.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !node.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={() => close.current()}
        className={`anim-fade absolute inset-0 bg-black/60 backdrop-blur-[2px] ${menu ? "sm:bg-black/20 sm:backdrop-blur-none" : ""}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`anim-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-b-0 border-line-strong bg-panel pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/60 outline-none ${
          menu
            ? "anim-menu sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-[calc(3.5rem_+_env(safe-area-inset-top)_+_0.5rem)] sm:max-h-[min(36rem,calc(100dvh_-_6rem))] sm:w-96 sm:rounded-xl sm:border-b sm:pb-0 lg:right-8"
            : ""
        }`}
      >
        {/* The sheet's grab handle (a drawn cue only; Escape, a tap outside or a link closes it). */}
        <span aria-hidden="true" className={`mx-auto mt-2 block h-1 w-9 flex-none rounded-full bg-line-strong ${menu ? "sm:hidden" : ""}`} />
        {children}
      </div>
    </div>,
    document.body
  );
}
