"use client";

import { createContext, useContext } from "react";
import {
  inboxCreateLabel, inboxDeleteForever, inboxDeleteLabel, inboxDiscardDrafts, inboxEmpty, inboxModify, inboxModifyMessages, inboxRenameLabel,
  inboxSaveDraft, inboxSend, inboxTrash, inboxUploadLink,
} from "./actions";
import type { ComposeSeed, InboxLabel, InboxMeta, NotReady, Thread, ThreadPage } from "./types";

/**
 * How Admin → Inbox's page reaches the mailbox: reads through the /api/admin/inbox routes (they run side by side, where
 * server actions would queue), changes through features/inbox/actions.ts. One object, so the page can be drawn against a
 * stand-in mailbox while it's being built (InboxApi below), and the real one everywhere else.
 */

/** A read the server refused, with why when Gmail isn't connected. */
export class InboxFetchError extends Error {
  reason: NotReady | null;
  status: number;
  constructor(message: string, status: number, reason: NotReady | null) {
    super(message);
    this.name = "InboxFetchError";
    this.status = status;
    this.reason = reason;
  }
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store", headers: { accept: "application/json" } });
  } catch {
    throw new InboxFetchError("You're offline, or the site didn't answer.", 0, null);
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string; reason?: NotReady | null }) | null;
  if (!res.ok || !json) throw new InboxFetchError(json?.error ?? `The site answered ${res.status}.`, res.status, json?.reason ?? null);
  return json;
}

/** A list's query: one folder, label (by id), address or search. */
export type ListQuery = { view?: string; label?: string; addr?: string; q?: string };

export const realApi = {
  meta: () => getJson<InboxMeta>("/api/admin/inbox/meta"),
  list: (q: ListQuery, page: string | null) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, v);
    if (page) p.set("page", page);
    return getJson<ThreadPage>(`/api/admin/inbox/threads?${p}`);
  },
  thread: (id: string) => getJson<Thread>(`/api/admin/inbox/thread?id=${encodeURIComponent(id)}`),
  pulse: () => getJson<{ historyId: string }>("/api/admin/inbox/pulse"),
  reply: (messageId: string, mode: "reply" | "all" | "forward", zone: string) =>
    getJson<ComposeSeed>(`/api/admin/inbox/compose?message=${encodeURIComponent(messageId)}&mode=${mode}&zone=${encodeURIComponent(zone)}`),
  draft: (draftId: string) => getJson<ComposeSeed>(`/api/admin/inbox/compose?draft=${encodeURIComponent(draftId)}`),
  modify: inboxModify,
  modifyMessages: inboxModifyMessages,
  trash: inboxTrash,
  deleteForever: inboxDeleteForever,
  empty: inboxEmpty,
  createLabel: inboxCreateLabel as (name: string) => Promise<InboxLabel>,
  renameLabel: inboxRenameLabel,
  deleteLabel: inboxDeleteLabel,
  uploadLink: inboxUploadLink,
  saveDraft: inboxSaveDraft,
  send: inboxSend,
  discardDrafts: inboxDiscardDrafts,
  /** Puts a file at a storage link (features/inbox/actions.ts → inboxUploadLink), reporting the bytes as they go. */
  put: (url: string, file: File, onBytes: (n: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => onBytes(e.loaded);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`storage answered ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("the connection dropped"));
      xhr.send(file);
    }),
  /** Where a file in the mailbox downloads from (and a picture or PDF shows, with `inline`). */
  fileUrl: (messageId: string, id: string, name: string, inline = false) =>
    `/api/admin/inbox/attachment?m=${encodeURIComponent(messageId)}&a=${encodeURIComponent(id)}&n=${encodeURIComponent(name)}${inline ? "&inline=1" : ""}`,
  originalUrl: (messageId: string) => `/api/admin/inbox/original?id=${encodeURIComponent(messageId)}`,
  connectUrl: "/api/admin/inbox/connect",
};

export type InboxApi = typeof realApi;

const ApiContext = createContext<InboxApi>(realApi);
export const InboxApiProvider = ApiContext.Provider;
export const useInboxApi = () => useContext(ApiContext);
