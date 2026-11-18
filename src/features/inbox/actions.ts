"use server";

import { randomBytes } from "node:crypto";
import { requireFounder } from "@/features/inbox/platform";
import { UserError } from "@/features/inbox/errors";
import { ensureMigrated } from "@/features/inbox/platform";
import { signedUploadUrl } from "@/features/inbox/platform";
import { track } from "@/features/inbox/platform";
import { EMAIL, GMAIL_BUSY } from "@/lib/inbox-mail";
import { InboxNotReady, disconnect, saveClient } from "./google";
import {
  GmailError, INBOX_BUCKET, MAX_FILES_BYTES, UPLOAD_PATH, createLabel, deleteDraft, deleteLabel, deleteThreads, dropUploads, emptyLabel,
  isAttachmentId, isDraftId, isLabelId, isThreadId, modifyMessages, modifyThreads, renameLabel, saveDraft, sendDraft, trashThreads,
} from "./gmail";
import type { ComposeFile, DraftInput, InboxLabel, SavedDraft } from "./types";

/**
 * Admin → Inbox's changes (Ben, 2026-10-28): archive, label, star, read, spam, trash and delete forever, labels made and
 * renamed, drafts saved, sent and discarded, files uploaded. Founders only, each one, with every id checked for shape
 * before it reaches Gmail. Sending is always Ben's own press of Send in the page; nothing here sends by itself.
 */

/** Gmail's and the connection's troubles, as words for the page's toast. */
async function gmail<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof InboxNotReady) throw new UserError(e.message);
    // Gmail busy for a minute: its own words name a quota; these say it passes (a draft saves itself again: ./compose.tsx).
    if (e instanceof GmailError && e.busy) throw new UserError(GMAIL_BUSY);
    if (e instanceof GmailError) throw new UserError(`Gmail: ${e.message}`);
    throw e;
  }
}

const threadIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(isThreadId)) throw new UserError("Pick some conversations first.");
  return ids as string[];
};
const labelIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every(isLabelId)) throw new UserError("That isn't a label.");
  return ids as string[];
};
const labelName = (name: unknown): string => {
  const n = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!n || n.length > 225 || /^\/|\/$|\/\//.test(n)) throw new UserError("Give the label a name (a / nests it under another).");
  return n;
};

/** The Google app's client ID and secret, pasted from Google Cloud on the Inbox's setup card. */
export async function saveInboxApp(clientId: string, secret: string) {
  await requireFounder();
  await ensureMigrated().catch(() => null);
  await saveClient(String(clientId ?? ""), String(secret ?? ""));
}

export async function disconnectInbox() {
  const { user } = await requireFounder();
  await disconnect();
  await track("inbox_disconnected", { userId: user.id });
}

/** Labels on or off whole conversations: archive (INBOX off), read (UNREAD off), spam, important, a label, a move. */
export async function inboxModify(ids: string[], add: string[], remove: string[]) {
  await requireFounder();
  const t = threadIds(ids);
  const a = labelIds(add);
  const r = labelIds(remove);
  if (!a.length && !r.length) return;
  await gmail(() => modifyThreads(t, a, r));
}

/** Labels on or off single messages: a star, or "Mark unread" on the latest message, as Gmail does. */
export async function inboxModifyMessages(ids: string[], add: string[], remove: string[]) {
  await requireFounder();
  const m = threadIds(ids);
  await gmail(() => modifyMessages(m, labelIds(add), labelIds(remove)));
}

export async function inboxTrash(ids: string[], back = false) {
  await requireFounder();
  const t = threadIds(ids);
  await gmail(() => trashThreads(t, !!back));
}

/** Delete forever: only what's in Trash or Spam already, as Gmail allows it. */
export async function inboxDeleteForever(ids: string[]) {
  await requireFounder();
  const t = threadIds(ids);
  await gmail(() => deleteThreads(t));
}

export async function inboxEmpty(which: "TRASH" | "SPAM") {
  await requireFounder();
  if (which !== "TRASH" && which !== "SPAM") throw new UserError("Only Trash and Spam can be emptied.");
  return gmail(() => emptyLabel(which));
}

export async function inboxCreateLabel(name: string): Promise<InboxLabel> {
  await requireFounder();
  const n = labelName(name);
  return gmail(() => createLabel(n));
}

export async function inboxRenameLabel(id: string, name: string) {
  await requireFounder();
  if (!isLabelId(id) || !id.startsWith("Label_")) throw new UserError("Only your own labels can be renamed.");
  const n = labelName(name);
  await gmail(() => renameLabel(id, n));
}

export async function inboxDeleteLabel(id: string) {
  await requireFounder();
  if (!isLabelId(id) || !id.startsWith("Label_")) throw new UserError("Only your own labels can be deleted.");
  await gmail(() => deleteLabel(id));
}

/** Where the browser puts a file for a message being written: a private storage link, good for two hours. */
export async function inboxUploadLink(input: { name: string; type: string; size: number }): Promise<{ url: string; path: string }> {
  await requireFounder();
  const size = Number(input?.size);
  if (!(size > 0) || size > MAX_FILES_BYTES) throw new UserError("Gmail takes files up to 25 MB.");
  const safe = String(input?.name ?? "file").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "file";
  const path = `uploads/${new Date().toISOString().slice(0, 10)}/${randomBytes(8).toString("hex")}-${safe}`;
  const u = await signedUploadUrl(INBOX_BUCKET, path);
  return { url: u.signedUrl, path: u.path };
}

const cleanFiles = (files: unknown): ComposeFile[] => {
  if (!Array.isArray(files) || files.length > 40) throw new UserError("That's too many files for one message.");
  return files.map((f: ComposeFile) => {
    if (f?.kind === "upload" && UPLOAD_PATH.test(f.path)) return { kind: "upload", path: f.path, name: String(f.name).slice(0, 200), type: String(f.type).slice(0, 100), size: Number(f.size) || 0 };
    if (f?.kind === "gmail" && isThreadId(f.messageId) && isAttachmentId(f.id)) {
      return { kind: "gmail", messageId: f.messageId, id: f.id, name: String(f.name).slice(0, 200), type: String(f.type).slice(0, 100), size: Number(f.size) || 0, cid: typeof f.cid === "string" ? f.cid.slice(0, 200) : null };
    }
    throw new UserError("One of the files went missing. Remove it and add it again.");
  });
};
const cleanAddrs = (list: unknown) => {
  if (!Array.isArray(list) || list.length > 100) throw new UserError("That's too many people for one message.");
  return list.map((a: { name?: unknown; email?: unknown }) => {
    const email = String(a?.email ?? "").trim();
    if (!EMAIL.test(email)) throw new UserError(`"${email}" isn't an email address.`);
    return { name: String(a?.name ?? "").slice(0, 200), email };
  });
};

/** Save a draft to Gmail (made the first time). The page saves as Ben writes, and before every send. */
export async function inboxSaveDraft(input: DraftInput): Promise<SavedDraft> {
  await requireFounder();
  if (input.draftId !== null && !isDraftId(input.draftId)) throw new UserError("That draft went missing.");
  if (input.threadId !== null && !isThreadId(input.threadId)) throw new UserError("That conversation went missing.");
  const html = String(input.html ?? "");
  const quote = input.quote === null ? null : String(input.quote);
  if (html.length + (quote?.length ?? 0) > 3_500_000) throw new UserError("That message is too long to save.");
  const clean: DraftInput = {
    draftId: input.draftId, threadId: input.threadId, from: String(input.from ?? ""), to: cleanAddrs(input.to), cc: cleanAddrs(input.cc), bcc: cleanAddrs(input.bcc),
    subject: String(input.subject ?? "").slice(0, 900), html, quote, files: cleanFiles(input.files),
    inReplyTo: input.inReplyTo ? String(input.inReplyTo).slice(0, 1000) : null, references: input.references ? String(input.references).slice(0, 8000) : null,
  };
  return gmail(() => saveDraft(clean));
}

/** Send a saved draft: only ever on Ben's own press of Send (the page holds it five seconds first, for Undo). */
export async function inboxSend(draftId: string, uploads: string[]): Promise<{ id: string; threadId: string }> {
  const { user } = await requireFounder();
  if (!isDraftId(draftId)) throw new UserError("That draft went missing. Open it from Drafts and send it again.");
  const sent = await gmail(() => sendDraft(draftId));
  await dropUploads(Array.isArray(uploads) ? uploads.filter((p) => typeof p === "string") : []);
  await track("inbox_sent", { userId: user.id });
  return sent;
}

/** Discard drafts, and the files uploaded for them. */
export async function inboxDiscardDrafts(draftIds: string[], uploads: string[] = []) {
  await requireFounder();
  if (!Array.isArray(draftIds) || draftIds.length > 500 || !draftIds.every(isDraftId)) throw new UserError("Those drafts went missing.");
  for (const id of draftIds) await gmail(() => deleteDraft(id));
  await dropUploads(Array.isArray(uploads) ? uploads.filter((p) => typeof p === "string") : []);
}
