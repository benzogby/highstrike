"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, ExternalLinkIcon, MailIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/kit/button";
import { Input } from "@/components/kit/input";
import { errMsg } from "@/features/inbox/errors";
import { useInboxApi } from "./api";
import { saveInboxApp } from "./actions";
import type { InboxState, NotReady } from "./types";

/**
 * Admin → Inbox before the mailbox is connected: the five steps Ben takes in Google once (Ben, 2026-10-28, picking
 * "Private Google app"), the redirect address to copy, the boxes for the app's client ID and secret, and Connect Gmail.
 * Also what he sees when Google ends the connection (a password change does), with why, and why the last Connect didn't
 * finish, in Google's own words where it gave any (kept on the row by app/api/admin/inbox/callback).
 */

const CONNECT_WORDS: Record<string, string> = {
  denied: "Google's screen was closed without allowing access. Connect again and press Allow.",
  expired: "That connection took too long or was started in another tab. Connect again.",
  scope: "Gmail access wasn't allowed on Google's screen. Connect again and leave the Gmail box ticked.",
  account: "That wasn't a highstrike.com account. Connect again and pick ben@highstrike.com.",
  gmail: "Gmail didn't answer for that account. Check step 2 (the Gmail API turned on), then connect again.",
  failed: "Google didn't finish the connection. Connect again.",
  setup: "Save the Google app's client ID and secret first.",
};

const STEPS: { text: ReactNode; href?: string }[] = [
  { text: <>Signed in as <b>ben@highstrike.com</b>, make a new Google Cloud project called <b>HighStrike Inbox</b>.</>, href: "https://console.cloud.google.com/projectcreate" },
  { text: <>Turn on the <b>Gmail API</b> for it (APIs &amp; Services → Library → Gmail API → Enable).</>, href: "https://console.cloud.google.com/apis/library/gmail.googleapis.com" },
  { text: <>Google Auth Platform → Get started: app name <b>HighStrike Inbox</b>, support email ben@highstrike.com, Audience <b>Internal</b> → Create.</>, href: "https://console.cloud.google.com/auth/overview" },
  { text: <>Clients → Create client → <b>Web application</b>, with the Authorized redirect URI below → Create. Keep the Client ID and Client secret (Google shows the secret once).</>, href: "https://console.cloud.google.com/auth/clients" },
  { text: <>Paste both here and press Save, then <b>Connect Gmail</b>, pick ben@highstrike.com and press Allow.</> },
];

/** Google's page for the Gmail API in the app's own project (the number that leads its client ID), with its Enable button. */
const gmailApiPage = (clientId: string | null) => {
  const project = clientId?.match(/^(\d+)-/)?.[1];
  return project ? `https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=${project}` : "https://console.cloud.google.com/apis/library/gmail.googleapis.com";
};

export function Setup({ state, reason, notice }: { state: InboxState; reason: NotReady; notice?: string | null }) {
  const api = useInboxApi();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const configured = state.configured || saved;
  const [editing, setEditing] = useState(!configured);
  const [clientId, setClientId] = useState(state.clientId ?? "");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // The page's own words for this return from Google, then what the row kept: why Google ended it, or why the last
  // Connect was refused (after a reload too).
  const words = notice ? CONNECT_WORDS[notice] ?? null : null;
  const kept = state.error;
  const problem = words ?? (reason === "revoked" ? (kept ?? "Google ended the Gmail connection. Connect again.") : kept ? "The last Connect didn't finish." : null);
  const detail = kept && kept !== problem ? kept : null;
  const apiOff = notice === "gmail" || /gmail api/i.test(kept ?? "");

  const save = async () => {
    setBusy(true);
    try {
      await saveInboxApp(clientId, secret);
      setSaved(true);
      setEditing(false);
      setSecret("");
      toast.success("Google app saved. Now connect Gmail.");
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e, "That didn't save."));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy it by hand: select the address and copy.");
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5 py-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2"><MailIcon className="size-5" /></span>
        <div>
          <h1 className="text-2xl">{reason === "revoked" ? "Reconnect Gmail" : "Connect the highstrike.com mailbox"}</h1>
          <p className="mt-1 text-sm text-ink-3">
            The Inbox reads and sends ben@ and support@ through Gmail&apos;s own API, from this site&apos;s server. It needs a private Google app under
            highstrike.com, made once: only highstrike.com accounts can use it, so Google needs no review, and you can cut it off any time from your Google account.
          </p>
        </div>
      </div>

      {problem && (
        <div role="alert" className="grid gap-1.5 rounded-xl border border-down/30 bg-down/5 px-4 py-3 text-sm text-down">
          <p>{problem}</p>
          {detail && <p className="break-words text-xs opacity-90">{detail}</p>}
          {apiOff && (
            <a href={gmailApiPage(state.clientId)} target="_blank" rel="noopener noreferrer" className="link inline-flex w-fit items-center gap-0.5 text-xs">
              Turn on the Gmail API for this app<ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
      )}

      {configured && !editing ? (
        <section className="grid gap-3 rounded-2xl border bg-panel p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm"><CheckIcon className="size-4 text-up" />Google app saved{state.clientId ? <span className="text-ink-3"> (client {state.clientId.split("-")[0]})</span> : null}.</p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={api.connectUrl} className={buttonVariants({ size: "lg", className: "px-4" })}>Connect Gmail</a>
            <Button variant="ghost" onClick={() => setEditing(true)}>Change the app</Button>
          </div>
          <p className="text-xs text-ink-3">Google asks you to pick an account and allow access; you come back here to the Inbox.</p>
        </section>
      ) : (
        <section className="grid gap-4 rounded-2xl border bg-panel p-5 shadow-sm">
          <ol className="grid gap-3 text-sm">
            {STEPS.map((s, i) => {
              // Step 2 opens the Gmail API in the saved app's own project once there is one (not whichever project is picked).
              const href = i === 1 && state.clientId ? gmailApiPage(state.clientId) : s.href;
              return (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-panel-2 text-xs font-semibold tabular-nums">{i + 1}</span>
                  <span className="pt-0.5">
                    {s.text}{" "}
                    {href && <a href={href} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-0.5 whitespace-nowrap">Open<ExternalLinkIcon className="size-3" /></a>}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-ink-3">Authorized redirect URI</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border bg-panel-2 px-2.5 py-1.5 text-xs">{state.redirectUri}</code>
              <Button variant="outline" size="sm" onClick={() => void copy()}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? "Copied" : "Copy"}</Button>
            </div>
          </div>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-3">Client ID</span>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="123456789012-abc….apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-3">Client secret</span>
              <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="GOCSPX-…" autoComplete="off" spellCheck={false} />
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy || !clientId.trim() || !secret.trim()}>{busy ? "Saving…" : "Save"}</Button>
              {configured && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
              <span className="text-xs text-ink-3">Kept encrypted on the server; never shown again.</span>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
