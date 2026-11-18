"use client";

import { createContext, useContext } from "react";
import type { Addr, Route } from "@/lib/inbox-mail";
import type { ComposeSeed, InboxLabel, InboxMeta, ThreadRow } from "./types";

/** What every part of the mailbox page reaches for, from features/inbox/inbox-app.tsx (Mailbox). */
export type Actions = {
  archive: (ids: string[]) => void;
  toInbox: (ids: string[]) => void;
  trash: (ids: string[]) => void;
  forever: (ids: string[]) => void;
  spam: (ids: string[]) => void;
  notSpam: (ids: string[]) => void;
  read: (ids: string[]) => void;
  unread: (ids: string[]) => void;
  star: (ids: string[], on: boolean) => void;
  important: (ids: string[], on: boolean) => void;
  labels: (ids: string[], add: string[], remove: string[]) => void;
  move: (ids: string[], to: string) => void;
  /** Star or unstar one message (a thread's message header). */
  starMessage: (threadId: string, messageId: string, on: boolean) => void;
  unreadFrom: (threadId: string, messageIds: string[]) => void;
  discardDrafts: (draftIds: string[]) => void;
  empty: (which: "TRASH" | "SPAM") => void;
  refresh: () => void;
  undo: () => void;
};

export type ComposeOpen = {
  /** A new message, optionally started with some fields (a mailto: link, an address view's From). */
  compose: (seed?: Partial<ComposeSeed>) => void;
  reply: (threadId: string, messageId: string, mode: "reply" | "all" | "forward") => void;
  draft: (draftId: string, threadId?: string | null) => void;
};

export type MailboxCtx = {
  meta: InboxMeta | null;
  zone: string;
  now: number;
  route: Route;
  go: (r: Route) => void;
  labelById: (id: string) => InboxLabel | undefined;
  labelIdByName: (name: string) => string | null;
  /** The label the current view lists (INBOX, a label), which "Remove label" and Move take off. */
  viewLabel: string | null;
  mine: Set<string>;
  actions: Actions;
  open: ComposeOpen;
  contacts: () => Addr[];
  rowsById: (id: string) => ThreadRow | undefined;
  ask: (q: { title: string; body?: string; action: string; danger?: boolean }) => Promise<boolean>;
  prompt: (q: { title: string; label: string; initial?: string; action: string }) => Promise<string | null>;
  density: "comfortable" | "compact";
  /** The rail's labels and counts read again (after a label is made, renamed or deleted). */
  reloadMeta: () => void;
  /** A conversation's kept copy dropped, so it's read again when it opens (a draft was saved into it). */
  invalidate: (threadId: string) => void;
};

export const Mailbox = createContext<MailboxCtx | null>(null);
export function useMailbox(): MailboxCtx {
  const v = useContext(Mailbox);
  if (!v) throw new Error("useMailbox outside the mailbox");
  return v;
}
