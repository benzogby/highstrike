"use client";

import { useState, useTransition } from "react";
import { BUTTON_SECONDARY } from "@/components/ui";
import { setAdmin, setMembership } from "./actions";

/** The account page's buttons, each asking first, since they change what someone can open. */
export default function AccountActions({ id, email, member, admin, self }: { id: string; email: string; member: boolean; admin: boolean; self: boolean }) {
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
              member ? `Take lifetime access away from ${email}? This doesn't refund anything in Stripe.` : `Give ${email} lifetime access without a payment?`,
              () => setMembership(id, !member)
            )
          }
        >
          {member ? "Revoke lifetime access" : "Grant lifetime access"}
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
