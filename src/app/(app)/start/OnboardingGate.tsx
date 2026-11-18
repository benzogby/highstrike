"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { OnboardingCopy } from "@/lib/onboardingCopy";
import StartQuestions from "./StartQuestions";

/**
 * The three first questions as a popup over the whole app, the page behind blurred, until they're answered (Ben,
 * 2026-11-18: "Force onboarding popup in a full screen / background blurred format"). No way to close it: answering is
 * the way in. Not over /start itself, /welcome (the payment's own card) or Admin (so the words can be edited).
 */
export default function OnboardingGate({ copy }: { copy: OnboardingCopy }) {
  const path = usePathname();
  const [mounted, setMounted] = useState(false);
  const hidden = path.startsWith("/start") || path.startsWith("/welcome") || path.startsWith("/admin");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the portal needs document.body, so it waits for the browser
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (hidden) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [hidden]);

  if (!mounted || hidden) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg/60 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Three questions to start">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
        <div className="anim-pop w-full max-w-2xl rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-10">
          <StartQuestions initial={null} firstTime copy={copy} />
        </div>
      </div>
    </div>,
    document.body
  );
}
