"use client";

import { useState, useTransition } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";
import { setAdmin, setMembership } from "./actions";

/** The account page's buttons, each asking first, since they change what someone can open. */
export default function AccountActions({ id, email, granted, admin, self }: { id: string; email: string; granted: boolean; admin: boolean; self: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (question: string, act: () => Promise<void>) => {
    if (!window.confirm(question)) return;
    setError("");
    start(async () => {
      try {
        await act();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't work.");
      }
    });
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={BUTTON_SECONDARY}
          onClick={() =>
            run(
              granted
                ? `Take the free access away from ${email}? A membership they pay for keeps going.`
                : `Give ${email} free access, with nothing to pay? It doesn't touch a membership they pay for in Stripe.`,
              () => setMembership(id, !granted)
            )
          }
        >
          {granted ? "Remove free access" : "Grant free access"}
        </button>
        {!(self && admin) && (
          <button
            type="button"
            disabled={pending}
            className={BUTTON_SECONDARY}
            onClick={() => run(admin ? `Remove ${email} as an admin?` : `Make ${email} an admin? Admins see everything here.`, () => setAdmin(id, !admin))}
          >
            {admin ? "Remove admin" : "Make admin"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-down">{error}</p>}
    </div>
  );
}
