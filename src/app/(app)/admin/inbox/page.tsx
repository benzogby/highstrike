import { notFound } from "next/navigation";
import { ensureMigrated, isAdminViewer } from "@/features/inbox/platform";
import { errMsg } from "@/features/inbox/errors";
import { listParams } from "@/lib/inbox-mail";
import { InboxNotReady, inboxState } from "@/features/inbox/google";
import { inboxMeta, listThreads } from "@/features/inbox/gmail";
import { InboxApp } from "@/features/inbox/inbox-app";
import { Toaster } from "@/components/kit/sonner";

export const dynamic = "force-dynamic";

const NOTICES = new Set(["denied", "expired", "scope", "account", "gmail", "failed", "setup"]);
function nowMs() { return Date.now(); }
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("Gmail is slow to answer")), ms))]);

/**
 * Admin → Inbox (Ben, 2026-11-17: "Build full inbox functionality into the admin panel of highstrike.com … send and
 * receive mail as both ben@ and support@ (same as the ripping inbox tab of the ripping app's admin panel)"): the
 * highstrike.com mailbox, ported from getripping.com's Inbox, Gmail's layout on HighStrike's design
 * (features/inbox/inbox-app.tsx). The first screen comes with the rail and the Inbox's first page already read when Gmail
 * answers in time; otherwise the page reads them itself. Before the mailbox is connected, the setup steps.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The founder's alone, checked here as well as in the layout: Next can render a page without the layouts above it.
  if (!(await isAdminViewer())) notFound();
  await ensureMigrated().catch(() => null);
  const sp = await searchParams;
  const connect = typeof sp.connect === "string" && NOTICES.has(sp.connect) ? sp.connect : null;
  const notice = sp.connected === "1" ? "connected" : connect;
  // The Inbox's table comes with its migration; Admin → Overview says when one is stuck.
  const read = await inboxState().then((s) => ({ s, why: null }), (e: unknown) => ({ s: null, why: errMsg(e, "its settings couldn't be read") }));
  if (!read.s) return <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">The Inbox isn&apos;t ready yet: {read.why}. Admin → Overview shows the database&apos;s state.</p>;
  let state = read.s;
  let initial: { meta: Awaited<ReturnType<typeof inboxMeta>>; page: Awaited<ReturnType<typeof listThreads>> } | null = null;
  let initialError: string | null = null;
  if (state.connected) {
    try {
      const [meta, page] = await within(Promise.all([inboxMeta(), listThreads({ ...listParams({ system: "inbox" }), pageToken: null })]), 8000);
      initial = { meta, page };
    } catch (e) {
      if (e instanceof InboxNotReady) state = await inboxState();
      else initialError = errMsg(e, "Gmail didn't answer.");
    }
  }
  return (
    // Gmail's frame: the list and the message scroll inside the window, not the page.
    <div className="md:h-[calc(100dvh-11rem)]">
      <InboxApp state={state} initial={initial} initialError={initialError} now={nowMs()} notice={notice} />
      <Toaster position="bottom-left" />
    </div>
  );
}
