"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";
import { refreshScanNow } from "./actions";

/** Admin only: rebuild the Scanner now instead of waiting for the next 5-minute run. */
export default function RefreshNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  return (
    <div className="flex items-center gap-2">
      {note && <span className="text-xs text-ink-3">{note}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshScanNow();
            setNote(r.error ?? `${r.stocks} names, ${r.contracts} contracts`);
            router.refresh();
          })
        }
        className={BUTTON_SECONDARY}
      >
        {pending ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
