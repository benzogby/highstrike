"use client";

import { useState } from "react";
import { BUTTON_GHOST } from "@/components/ui";

/** Shares a saved setup's public page: the phone's share sheet where there is one, else the link copied. */
export default function ShareButton({ token, title }: { token: string; title: string }) {
  const [done, setDone] = useState("");
  const share = async () => {
    const url = `${window.location.origin}/s/${token}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone("Link copied");
    } catch {
      /* the person closed the share sheet */
    }
  };
  return (
    <button type="button" onClick={() => void share()} className={BUTTON_GHOST}>
      {done || "Share"}
    </button>
  );
}
