import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/features/inbox/platform";
import { UserError } from "@/features/inbox/errors";
import { captureError } from "@/features/inbox/platform";
import {
  ADDRESSES, EMAIL, GMAIL_BUSY, MAILBOX_DOMAIN, addressQuery, buildMime, decodeBytes, decodeEntities, decodeWords, escapeHtml, formatAddress, forwardSubject,
  glyphFor, gmailBusy, gmailCallCost, headerOf, headersOf, htmlToText, messageParts, parseAddresses, partById, replyFrom, replyRecipients, replySubject, textToHtml,
  threading, type Addr, type GmailPart, type MimeAttachment, type PartInfo,
} from "@/lib/inbox-mail";
import { accessToken, dropAccessToken, InboxNotReady } from "./google";
import type { Attachment, ComposeFile, ComposeSeed, DraftInput, InboxLabel, InboxMeta, Message, Person, SavedDraft, SendAs, Thread, ThreadPage, ThreadRow } from "./types";

/**
 * Admin → Inbox's Gmail (Ben, 2026-10-28: "basically treat that tab as my entire Gmail for business@, support@ and ben@"):
 * every call to the Gmail API, made from this server alone with the mailbox's own token (features/inbox/google.ts). The
 * page reads through the /api/admin/inbox routes and changes things through features/inbox/actions.ts, founders only.
 * Gmail's per-user quota is 250 units a second, so lists fetch eight conversations at a time and back off on a 429, and
 * a conversation's line is kept here, by its history id, until the conversation changes.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me/";
const UPLOAD = "https://gmail.googleapis.com/upload/gmail/v1/users/me/";
/** Files added to a message being written, before it's sent (features/inbox/actions.ts → inboxUploadLink). Private. */
export const INBOX_BUCKET = "inbox-files";
export const UPLOAD_PATH = /^uploads\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{16}-[A-Za-z0-9._-]{1,120}$/;
/** Gmail's own ceiling for a message's files. */
export const MAX_FILES_BYTES = 25 * 1024 * 1024;

export class GmailError extends Error {
  status: number;
  /** Turned away for the mailbox's quota or rate limit (lib/inbox-mail.ts → gmailBusy): nothing was done. */
  busy: boolean;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GmailError";
    this.status = status;
    this.busy = gmailBusy(status, message);
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;
const qs = (q?: Query) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The calls this server made to Gmail in the last minute, by kind and cost (lib/inbox-mail.ts → gmailCallCost): what a
 * quota refusal's note says was spending it, at most once a minute (2026-11-03: a reply's saves were refused with "Quota
 * exceeded … Units per minute per user", and nothing said what had used it).
 */
const spent: { at: number; kind: string; units: number }[] = [];
let quotaToldAt = 0;
function spend(method: string, path: string) {
  const now = Date.now();
  spent.push({ at: now, ...gmailCallCost(method, path) });
  while (spent.length && (now - spent[0].at > 60_000 || spent.length > 5000)) spent.shift();
}
function spentLine(): string {
  const by = new Map<string, { n: number; units: number }>();
  for (const x of spent) {
    const k = by.get(x.kind) ?? { n: 0, units: 0 };
    k.n++;
    k.units += x.units;
    by.set(x.kind, k);
  }
  const total = [...by.values()].reduce((a, k) => a + k.units, 0);
  return `${total} units in the last minute from this server: ${[...by].sort((a, b) => b[1].units - a[1].units).slice(0, 8).map(([kind, k]) => `${kind} ×${k.n}`).join(", ")}`;
}

/** One Gmail call: a new token on a 401, backing off on Gmail's rate limits and its 5xx, Google's own words on a failure. */
async function call<T>(path: string, o: { method?: string; query?: Query; json?: unknown; body?: string; contentType?: string; base?: string } = {}, attempt = 0): Promise<T> {
  const token = await accessToken();
  spend(o.method ?? (o.json !== undefined || o.body !== undefined ? "POST" : "GET"), path);
  const res = await fetch(`${o.base ?? API}${path}${qs(o.query)}`, {
    method: o.method ?? (o.json !== undefined || o.body !== undefined ? "POST" : "GET"),
    headers: { authorization: `Bearer ${token}`, ...(o.json !== undefined ? { "content-type": "application/json" } : o.contentType ? { "content-type": o.contentType } : {}) },
    body: o.json !== undefined ? JSON.stringify(o.json) : o.body,
    cache: "no-store",
  });
  if (res.status === 401 && attempt === 0) {
    dropAccessToken();
    return call<T>(path, o, 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // A rate limit means Gmail did nothing, so anything is asked again. A 5xx may come after the work was done, so only
    // what can safely happen twice is: a read, a label change, a trash, a delete. Never a send or a new draft.
    const method = o.method ?? (o.json !== undefined || o.body !== undefined ? "POST" : "GET");
    const repeatable = method !== "POST" || /\/(modify|trash|untrash)$|^messages\/batch(Modify|Delete)$/.test(path);
    const busy = res.status === 429 || (res.status === 403 && /rate ?limit|quota/i.test(text)) || (res.status >= 500 && repeatable);
    if (busy && attempt < 4) {
      await sleep(500 * 2 ** attempt + Math.random() * 400);
      return call<T>(path, o, attempt + 1);
    }
    let message = text.slice(0, 300);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message || message;
    } catch { /* not JSON */ }
    const err = new GmailError(res.status, message || `Gmail answered ${res.status}`);
    if (err.busy && Date.now() - quotaToldAt > 60_000) {
      quotaToldAt = Date.now();
      await captureError(new Error(`Gmail refused ${path} for its quota: ${spentLine()}`), { source: "server", path: "gmail" }).catch(() => null);
    }
    throw err;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** A whole message (RFC 822 text) up to Gmail through its upload door, which takes up to 35 MB where JSON takes 5. */
function upload<T>(path: string, method: "POST" | "PUT", meta: unknown, raw: string): Promise<T> {
  const boundary = `inbox_${randomBytes(12).toString("hex")}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n${raw}\r\n--${boundary}--`;
  return call<T>(path, { base: UPLOAD, method, query: { uploadType: "multipart" }, body, contentType: `multipart/related; boundary=${boundary}` });
}

/** `fn` over the list, `limit` at a time, in order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

type GMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; historyId?: string; internalDate?: string; payload?: GmailPart; raw?: string };
type GThread = { id: string; historyId?: string; messages?: GMessage[] };
type GLabel = { id: string; name: string; type?: string; labelListVisibility?: string; threadsUnread?: number; threadsTotal?: number; messagesTotal?: number; color?: { backgroundColor?: string } };
type GDraft = { id: string; message: GMessage };
type GSendAs = { sendAsEmail: string; displayName?: string; signature?: string; isDefault?: boolean; isPrimary?: boolean; verificationStatus?: string };

/* ───────────── the mailbox ───────────── */

export async function profile(): Promise<{ email: string; historyId: string }> {
  const p = await call<{ emailAddress?: string; historyId?: string }>("profile");
  return { email: (p.emailAddress ?? "").toLowerCase(), historyId: String(p.historyId ?? "") };
}

let sendAsCache: { list: SendAs[]; at: number } | null = null;

/** The addresses mail can go out from (Gmail's "Send mail as"): ben@ first, then support@. */
export async function sendAsList(): Promise<SendAs[]> {
  if (sendAsCache && Date.now() - sendAsCache.at < 5 * 60_000) return sendAsCache.list;
  const r = await call<{ sendAs?: GSendAs[] }>("settings/sendAs");
  const order = (e: string) => {
    const i = ADDRESSES.indexOf(e);
    return i < 0 ? ADDRESSES.length : i;
  };
  const list = (r.sendAs ?? [])
    .filter((s) => s.isPrimary || !s.verificationStatus || s.verificationStatus === "accepted")
    .map((s) => ({ email: s.sendAsEmail.toLowerCase(), name: s.displayName ?? "", signature: s.signature ?? "", isDefault: !!s.isDefault, isPrimary: !!s.isPrimary }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || order(a.email) - order(b.email));
  sendAsCache = { list, at: Date.now() };
  return list;
}

/** Every address that is this mailbox's own, for "me" in a list and for leaving it out of a reply. */
async function ownAddresses(): Promise<Set<string>> {
  const list = await sendAsList().catch(() => [] as SendAs[]);
  return new Set([...ADDRESSES, ...list.map((s) => s.email)]);
}

const SYSTEM_COUNTED = new Set(["INBOX", "DRAFT", "SPAM", "STARRED", "IMPORTANT", "SENT", "TRASH"]);

/** The labels, with Gmail's counts: unread conversations, and for Drafts the number of drafts. */
export async function labelsWithCounts(): Promise<InboxLabel[]> {
  const r = await call<{ labels?: GLabel[] }>("labels");
  const wanted = (r.labels ?? []).filter((l) => l.type === "user" || SYSTEM_COUNTED.has(l.id));
  const full = await mapLimit(wanted, 8, (l) => call<GLabel>(`labels/${encodeURIComponent(l.id)}`).catch(() => l));
  return full.map((l) => ({
    id: l.id, name: l.name, type: l.type === "user" ? "user" : "system", glyph: glyphFor(l.color?.backgroundColor),
    unread: l.threadsUnread ?? 0, total: l.id === "DRAFT" ? (l.messagesTotal ?? 0) : (l.threadsTotal ?? 0), hidden: l.labelListVisibility === "labelHide",
  }));
}

/** One address's unread conversations in the inbox (up to 100, so the count is exact). */
async function addressUnread(email: string): Promise<number> {
  const r = await call<{ threads?: unknown[] }>("threads", { query: { q: `${addressQuery(email)} is:unread in:inbox`, maxResults: 100 } });
  return r.threads?.length ?? 0;
}

/** The left rail's numbers and the mailbox's addresses: one read for the page and after each change. */
export async function inboxMeta(): Promise<InboxMeta> {
  const [p, labels, sendAs] = await Promise.all([profile(), labelsWithCounts(), sendAsList()]);
  const emails = [...ADDRESSES, ...sendAs.map((s) => s.email).filter((e) => e.endsWith(`@${MAILBOX_DOMAIN}`) && !ADDRESSES.includes(e))];
  const unread = await mapLimit(emails, 4, (e) => addressUnread(e).catch(() => 0));
  return { email: p.email, historyId: p.historyId, labels, sendAs, addresses: emails.map((email, i) => ({ email, unread: unread[i] })) };
}

/* ───────────── lists ───────────── */

const META_HEADERS = ["From", "To", "Subject", "Content-Type"];
const lines = new Map<string, ThreadRow>();
const keep = (key: string, row: ThreadRow) => {
  if (lines.size >= 4000) lines.delete(lines.keys().next().value as string);
  lines.set(key, row);
};
const has = (m: GMessage, label: string) => !!m.labelIds?.includes(label);

/** A conversation's line from its messages' headers: Gmail's people column, its subject, the latest snippet and date. */
function summarize(t: GThread, mine: Set<string>): ThreadRow {
  const all = t.messages ?? [];
  const real = all.filter((m) => !has(m, "DRAFT"));
  const shown = real.length ? real : all;
  const last = shown[shown.length - 1];
  const head = (m: GMessage | undefined, n: string) => headerOf(m?.payload?.headers, n);
  const people: Person[] = [];
  for (const m of real) {
    const from = parseAddresses(head(m, "From"))[0] ?? { name: "", email: "" };
    const unread = has(m, "UNREAD");
    const prev = people.find((p) => p.email.toLowerCase() === from.email.toLowerCase());
    if (prev) prev.unread = prev.unread || unread;
    else people.push({ ...from, me: mine.has(from.email.toLowerCase()), unread });
  }
  const labelIds = Array.from(new Set(all.flatMap((m) => m.labelIds ?? [])));
  return {
    id: t.id, historyId: String(t.historyId ?? ""), subject: decodeWords(head(all[0], "Subject")).trim(), snippet: decodeEntities(last?.snippet ?? ""),
    date: Number(last?.internalDate ?? 0), unread: real.some((m) => has(m, "UNREAD")), starred: all.some((m) => has(m, "STARRED")),
    important: all.some((m) => has(m, "IMPORTANT")), labelIds, count: real.length, people, to: parseAddresses(head(last, "To")),
    draft: all.some((m) => has(m, "DRAFT")), attachment: all.some((m) => /multipart\/mixed/i.test(head(m, "Content-Type"))),
    lastMessageId: last?.id ?? "", draftId: null,
  };
}

/** One page of a list: Gmail's threads with each one's line (from this server's copy while the conversation is unchanged). */
export async function listThreads(p: { labelIds: string[]; q: string; includeSpamTrash: boolean; pageToken?: string | null; max?: number }): Promise<ThreadPage> {
  const [list, mine] = await Promise.all([
    call<{ threads?: { id: string; historyId?: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>("threads", {
      query: { labelIds: p.labelIds, q: p.q, includeSpamTrash: p.includeSpamTrash, pageToken: p.pageToken, maxResults: p.max ?? 50 },
    }),
    ownAddresses(),
  ]);
  const rows = await mapLimit(list.threads ?? [], 8, async (t) => {
    const key = `${t.id}:${t.historyId ?? ""}`;
    const hit = lines.get(key);
    if (hit) return hit;
    try {
      const row = summarize(await call<GThread>(`threads/${t.id}`, { query: { format: "metadata", metadataHeaders: META_HEADERS } }), mine);
      keep(key, row);
      return row;
    } catch (e) {
      if (e instanceof GmailError && e.status === 404) return null;
      throw e;
    }
  });
  const found = rows.filter((r): r is ThreadRow => r !== null);
  return { rows: found, next: list.nextPageToken ?? null, estimate: Math.max(list.resultSizeEstimate ?? 0, found.length) };
}

/** A message a search found: who sent it, its subject and Gmail's snippet of its text (lib/email/unsubscribe-sweep.ts). */
export type FoundMessage = { id: string; threadId: string; from: string; subject: string; snippet: string };

/**
 * The messages a search finds, newest first, up to `max`, each read for its sender, subject and snippet; the ids in `skip`
 * (already read) are left out unread.
 */
export async function searchMessages(q: string, o: { max?: number; skip?: ReadonlySet<string> } = {}): Promise<FoundMessage[]> {
  const max = o.max ?? 100;
  const ids: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await call<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }>("messages", { query: { q, maxResults: Math.min(max, 500), pageToken } });
    ids.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);
  const found = await mapLimit(ids.slice(0, max).filter((m) => !o.skip?.has(m.id)), 8, async (m) => {
    try {
      const g = await call<GMessage>(`messages/${m.id}`, { query: { format: "metadata", metadataHeaders: ["From", "Subject"] } });
      return { id: g.id, threadId: g.threadId ?? m.threadId, from: headerOf(g.payload?.headers, "From"), subject: decodeWords(headerOf(g.payload?.headers, "Subject")).trim(), snippet: decodeEntities(g.snippet ?? "") };
    } catch (e) {
      if (e instanceof GmailError && e.status === 404) return null;
      throw e;
    }
  });
  return found.filter((m): m is FoundMessage => m !== null);
}

/** A label's id by its name, made first when there's none. */
export async function labelNamed(name: string): Promise<string> {
  const r = await call<{ labels?: GLabel[] }>("labels");
  const have = (r.labels ?? []).find((l) => l.name.toLowerCase() === name.toLowerCase());
  return have ? have.id : (await createLabel(name)).id;
}

/** Drafts, one line each (Gmail lists drafts there, not conversations): each line opens its draft. */
export async function listDrafts(pageToken?: string | null): Promise<ThreadPage> {
  const list = await call<{ drafts?: GDraft[]; nextPageToken?: string; resultSizeEstimate?: number }>("drafts", { query: { maxResults: 50, pageToken } });
  const rows = await mapLimit(list.drafts ?? [], 8, async (d) => {
    try {
      const m = await call<GMessage>(`messages/${d.message.id}`, { query: { format: "metadata", metadataHeaders: META_HEADERS } });
      const head = (n: string) => headerOf(m.payload?.headers, n);
      const row: ThreadRow = {
        id: m.threadId, historyId: String(m.historyId ?? ""), subject: decodeWords(head("Subject")).trim(), snippet: decodeEntities(m.snippet ?? ""),
        date: Number(m.internalDate ?? 0), unread: false, starred: has(m, "STARRED"), important: has(m, "IMPORTANT"), labelIds: m.labelIds ?? [],
        count: 1, people: [], to: parseAddresses(head("To")), draft: true, attachment: /multipart\/mixed/i.test(head("Content-Type")),
        lastMessageId: m.id, draftId: d.id,
      };
      return row;
    } catch (e) {
      if (e instanceof GmailError && e.status === 404) return null;
      throw e;
    }
  });
  const found = rows.filter((r): r is ThreadRow => r !== null);
  return { rows: found, next: list.nextPageToken ?? null, estimate: Math.max(list.resultSizeEstimate ?? 0, found.length) };
}

/* ───────────── a conversation ───────────── */

const HTML_MAX = 2_000_000;
const TEXT_MAX = 500_000;

/** A body part's text, read in its own charset; a big one Gmail keeps as an attachment is fetched. */
async function partText(messageId: string, p: PartInfo): Promise<string> {
  let data = p.data;
  if (!data && p.attachmentId) data = (await call<{ data?: string }>(`messages/${messageId}/attachments/${encodeURIComponent(p.attachmentId)}`)).data ?? "";
  return decodeBytes(new Uint8Array(Buffer.from(data ?? "", "base64url")), p.charset);
}

/** List-Unsubscribe's web address or mail address, for the Unsubscribe link beside a sender. */
function unsubscribeOf(value: string): Message["unsubscribe"] {
  if (!value) return null;
  const links = Array.from(value.matchAll(/<([^>]+)>/g), (m) => m[1].trim());
  const url = links.find((l) => /^https:\/\//i.test(l)) ?? null;
  const mailto = links.find((l) => /^mailto:/i.test(l)) ?? null;
  return url || mailto ? { url, mailto } : null;
}

async function readMessage(m: GMessage, mine: Set<string>, drafts: Map<string, string>): Promise<Message> {
  const h = m.payload?.headers;
  const parts = messageParts(m.payload);
  const html = parts.html.length ? (await Promise.all(parts.html.map((p) => partText(m.id, p)))).join("\n").slice(0, HTML_MAX) : null;
  const text = !html && parts.text.length ? (await Promise.all(parts.text.map((p) => partText(m.id, p)))).join("\n\n").slice(0, TEXT_MAX) : null;
  const from = parseAddresses(headerOf(h, "From"))[0] ?? { name: "", email: "" };
  // A small file can come inside the message with no attachment id of its own: it's fetched by its part number instead.
  const attachments: Attachment[] = parts.files
    .filter((f) => f.attachmentId || (f.data !== null && f.partId))
    .map((f) => ({ messageId: m.id, id: f.attachmentId ?? `part.${f.partId}`, name: f.filename, type: f.mimeType, size: f.size, cid: f.cid, inline: f.inline && !!f.cid }));
  return {
    id: m.id, threadId: m.threadId, labelIds: m.labelIds ?? [], date: Number(m.internalDate ?? 0), snippet: decodeEntities(m.snippet ?? ""),
    from, to: parseAddresses(headerOf(h, "To")), cc: parseAddresses(headerOf(h, "Cc")), bcc: parseAddresses(headerOf(h, "Bcc")),
    replyTo: parseAddresses(headerOf(h, "Reply-To")), deliveredTo: headersOf(h, "Delivered-To").map((d) => d.trim().toLowerCase()),
    subject: decodeWords(headerOf(h, "Subject")).trim(), messageIdHeader: headerOf(h, "Message-ID") || headerOf(h, "Message-Id"),
    references: headerOf(h, "References"), inReplyTo: headerOf(h, "In-Reply-To"),
    html, text, attachments,
    unread: has(m, "UNREAD"), starred: has(m, "STARRED"), important: has(m, "IMPORTANT"), draft: has(m, "DRAFT"), draftId: drafts.get(m.id) ?? null,
    me: mine.has(from.email.toLowerCase()), unsubscribe: unsubscribeOf(headerOf(h, "List-Unsubscribe")),
  };
}

/** The drafts' ids for these draft messages (Gmail addresses a draft by its own id, which the message doesn't carry). */
async function draftIdsFor(messageIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!messageIds.length) return map;
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await call<{ drafts?: GDraft[]; nextPageToken?: string }>("drafts", { query: { maxResults: 100, pageToken } });
    for (const d of r.drafts ?? []) map.set(d.message.id, d.id);
    if (messageIds.every((id) => map.has(id)) || !r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  return map;
}

export async function getThread(id: string): Promise<Thread> {
  let t: GThread;
  try {
    t = await call<GThread>(`threads/${id}`, { query: { format: "full" } });
  } catch (e) {
    if (e instanceof GmailError && e.status === 404) throw new UserError("That conversation isn't in the mailbox any more.");
    throw e;
  }
  const msgs = t.messages ?? [];
  const [mine, drafts] = await Promise.all([ownAddresses(), draftIdsFor(msgs.filter((m) => has(m, "DRAFT")).map((m) => m.id))]);
  const messages = await mapLimit(msgs, 4, (m) => readMessage(m, mine, drafts));
  const first = messages.find((m) => !m.draft) ?? messages[0];
  return { id: t.id, historyId: String(t.historyId ?? ""), subject: first?.subject ?? "", labelIds: Array.from(new Set(msgs.flatMap((m) => m.labelIds ?? []))), messages };
}

/** One message's text as it came (Show original), at most 5 MB of it. */
export async function originalText(id: string): Promise<string> {
  const m = await call<GMessage>(`messages/${id}`, { query: { format: "raw" } });
  return decodeBytes(new Uint8Array(Buffer.from(m.raw ?? "", "base64url").subarray(0, 5_000_000)), "utf-8");
}

/** A file's bytes: by its attachment id, or ("part.1.2") read out of its message. */
export async function attachmentBytes(messageId: string, attachmentId: string): Promise<Buffer> {
  if (attachmentId.startsWith("part.")) {
    const m = await call<GMessage>(`messages/${messageId}`, { query: { format: "full" } });
    const part = partById(m.payload, attachmentId.slice(5));
    if (!part?.body?.data) throw new GmailError(404, "That file isn't in the message any more.");
    return Buffer.from(part.body.data, "base64url");
  }
  const r = await call<{ data?: string }>(`messages/${messageId}/attachments/${encodeURIComponent(attachmentId)}`);
  return Buffer.from(r.data ?? "", "base64url");
}

/* ───────────── changing things ───────────── */

export async function modifyThreads(ids: string[], add: string[], remove: string[]) {
  await mapLimit(ids, 8, (id) => call(`threads/${id}/modify`, { json: { addLabelIds: add, removeLabelIds: remove } }));
}

export async function modifyMessages(ids: string[], add: string[], remove: string[]) {
  for (let i = 0; i < ids.length; i += 1000) await call("messages/batchModify", { json: { ids: ids.slice(i, i + 1000), addLabelIds: add, removeLabelIds: remove } });
}

export async function trashThreads(ids: string[], back = false) {
  await mapLimit(ids, 8, (id) => call(`threads/${id}/${back ? "untrash" : "trash"}`, { method: "POST" }));
}

/** Delete forever (Trash and Spam only, as in Gmail). */
export async function deleteThreads(ids: string[]) {
  await mapLimit(ids, 8, (id) => call(`threads/${id}`, { method: "DELETE" }));
}

/** "Empty Trash now" / "Delete all spam messages now": 500 at a time for up to 40 seconds; returns how many went and whether any are left. */
export async function emptyLabel(labelId: "TRASH" | "SPAM"): Promise<{ deleted: number; more: boolean }> {
  const until = Date.now() + 40_000;
  let deleted = 0;
  while (Date.now() < until) {
    const r = await call<{ messages?: { id: string }[] }>("messages", { query: { labelIds: [labelId], includeSpamTrash: true, maxResults: 500 } });
    const ids = (r.messages ?? []).map((m) => m.id);
    if (!ids.length) return { deleted, more: false };
    await call("messages/batchDelete", { json: { ids } });
    deleted += ids.length;
  }
  return { deleted, more: true };
}

export async function createLabel(name: string): Promise<InboxLabel> {
  const l = await call<GLabel>("labels", { json: { name, labelListVisibility: "labelShow", messageListVisibility: "show" } });
  return { id: l.id, name: l.name, type: "user", glyph: glyphFor(l.color?.backgroundColor), unread: 0, total: 0, hidden: false };
}

export async function renameLabel(id: string, name: string) {
  await call(`labels/${encodeURIComponent(id)}`, { method: "PATCH", json: { name } });
}

export async function deleteLabel(id: string) {
  await call(`labels/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ───────────── writing ───────────── */

/** "Tue, Oct 28, 2026 at 10:42 AM" in the viewer's zone, as Gmail writes it above a quote. */
function quoteDate(ms: number, zone: string): string {
  const d = new Date(ms);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} at ${time}`;
}

const who = (a: Addr) => (a.name ? `${escapeHtml(a.name)} &lt;${escapeHtml(a.email)}&gt;` : escapeHtml(a.email));

/** A message's body for quoting in what goes out: its <body>'s inside, without the page parts and anything that runs. */
function quotedBody(m: Message): string {
  if (!m.html) return textToHtml(m.text ?? "");
  let s = m.html;
  const body = /<body[^>]*>([\s\S]*?)(<\/body>|$)/i.exec(s);
  if (body) s = body[1];
  return s
    .replace(/<(head|title|script|style|noscript|template|iframe|object)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(meta|link|base)\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

const asFile = (a: Attachment): ComposeFile => ({ kind: "gmail", messageId: a.messageId, id: a.id, name: a.name, type: a.type, size: a.size, cid: a.cid });

/**
 * What Reply, Reply all or Forward starts with: who it goes to and from (the address the message came to), the subject,
 * the threading headers, and the quote Gmail puts under it. A reply keeps the message's inline pictures for its quote;
 * a forward carries its files too.
 */
export async function composeSeed(messageId: string, mode: "reply" | "all" | "forward", zone: string): Promise<ComposeSeed> {
  const [raw, sendAs] = await Promise.all([call<GMessage>(`messages/${messageId}`, { query: { format: "full" } }), sendAsList()]);
  const mine = new Set([...ADDRESSES, ...sendAs.map((s) => s.email)]);
  const m = await readMessage(raw, mine, new Map());
  const own = sendAs.map((s) => s.email);
  const from = replyFrom(m, own) ?? sendAs.find((s) => s.isDefault)?.email ?? own[0] ?? null;
  const inline = m.attachments.filter((a) => a.cid).map(asFile);
  if (mode === "forward") {
    const head = [
      "---------- Forwarded message ---------",
      `From: <strong class="gmail_sendername" dir="auto">${escapeHtml(m.from.name || m.from.email)}</strong> <span dir="auto">&lt;${escapeHtml(m.from.email)}&gt;</span>`,
      `Date: ${quoteDate(m.date, zone)}`,
      `Subject: ${escapeHtml(m.subject)}`,
      `To: ${m.to.map(who).join(", ")}`,
      ...(m.cc.length ? [`Cc: ${m.cc.map(who).join(", ")}`] : []),
    ].join("<br>");
    return {
      draftId: null, threadId: m.threadId, from, to: [], cc: [], bcc: [], subject: forwardSubject(m.subject), html: "",
      quote: `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">${head}<br></div><br><br>${quotedBody(m)}</div>`,
      files: [...m.attachments.filter((a) => !a.cid).map(asFile), ...inline], inReplyTo: null, references: null,
    };
  }
  const { to, cc } = replyRecipients(m, own, mode === "all");
  const { inReplyTo, references } = threading(m);
  return {
    draftId: null, threadId: m.threadId, from, to, cc, bcc: [], subject: replySubject(m.subject), html: "",
    quote: `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">On ${quoteDate(m.date, zone)} ${who(m.from)} wrote:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">${quotedBody(m)}</blockquote></div>`,
    files: inline, inReplyTo: inReplyTo || null, references: references || null,
  };
}

const QUOTE_START = /(?:<br\s*\/?>\s*)?<div[^>]*class="[^"]*\bgmail_quote\b[^"]*"[^>]*>/i;

/** An opened draft: the part being written apart from the quote under it (Gmail's own gmail_quote), which goes out as it is. */
export async function draftSeed(draftId: string): Promise<ComposeSeed> {
  const d = await call<GDraft>(`drafts/${encodeURIComponent(draftId)}`, { query: { format: "full" } });
  const m = await readMessage(d.message, await ownAddresses(), new Map());
  let html = m.html ?? textToHtml(m.text ?? "");
  const body = /<body[^>]*>([\s\S]*?)(<\/body>|$)/i.exec(html);
  if (body) html = body[1];
  const at = QUOTE_START.exec(html);
  const quote = at ? html.slice(at.index).replace(/^<br\s*\/?>\s*/i, "") : null;
  let mine = at ? html.slice(0, at.index) : html;
  const wrapped = /^\s*<div dir="ltr">([\s\S]*)<\/div>\s*$/i.exec(mine);
  if (wrapped) mine = wrapped[1];
  return {
    draftId, threadId: m.threadId, from: m.from.email.toLowerCase() || null, to: m.to, cc: m.cc, bcc: m.bcc, subject: m.subject, html: mine, quote,
    files: m.attachments.map(asFile), inReplyTo: m.inReplyTo || null, references: m.references || null,
  };
}

/** A file's bytes for a message being written: from this browser's upload, or from Gmail. */
async function fileFor(f: ComposeFile): Promise<MimeAttachment & { size: number }> {
  if (f.kind === "upload") {
    if (!UPLOAD_PATH.test(f.path)) throw new UserError("That file's upload went missing. Remove it and add it again.");
    const { data, error } = await supabaseAdmin().storage.from(INBOX_BUCKET).download(f.path);
    if (error || !data) throw new UserError(`"${f.name}" didn't finish uploading. Remove it and add it again.`);
    const buf = Buffer.from(await data.arrayBuffer());
    return { name: f.name, type: f.type, base64: buf.toString("base64"), size: buf.length };
  }
  const buf = await attachmentBytes(f.messageId, f.id);
  return { name: f.name, type: f.type, base64: buf.toString("base64"), cid: f.cid, size: buf.length };
}

/** A draft saved to Gmail (made the first time), as the message it would send. Its address must be one of the mailbox's own. */
export async function saveDraft(input: DraftInput): Promise<SavedDraft> {
  const sendAs = await sendAsList();
  const from = sendAs.find((s) => s.email === input.from.toLowerCase());
  if (!from) throw new UserError(`${input.from} isn't one of this mailbox's addresses.`);
  for (const a of [...input.to, ...input.cc, ...input.bcc]) if (!EMAIL.test(a.email)) throw new UserError(`"${a.email}" isn't an email address.`);
  const files = await mapLimit(input.files, 4, fileFor);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_FILES_BYTES) throw new UserError("Gmail takes at most 25 MB of files on one message.");
  const html = `<div dir="ltr">${input.html}</div>${input.quote ? `<br>${input.quote}` : ""}`;
  const raw = buildMime({
    from: formatAddress({ name: from.name, email: from.email }), to: input.to.map(formatAddress), cc: input.cc.map(formatAddress), bcc: input.bcc.map(formatAddress),
    subject: input.subject, html, text: htmlToText(html), inReplyTo: input.inReplyTo, references: input.references, attachments: files,
  }, randomBytes(9).toString("hex"));
  const meta = input.threadId ? { message: { threadId: input.threadId } } : { message: {} };
  const d = input.draftId
    ? await upload<GDraft>(`drafts/${encodeURIComponent(input.draftId)}`, "PUT", { id: input.draftId, ...meta }, raw).catch((e) => {
        // A draft discarded elsewhere (Gmail's own tab) is made again rather than lost.
        if (e instanceof GmailError && e.status === 404) return upload<GDraft>("drafts", "POST", meta, raw);
        throw e;
      })
    : await upload<GDraft>("drafts", "POST", meta, raw);
  return { draftId: d.id, messageId: d.message.id, threadId: d.message.threadId };
}

/** Send a saved draft as it is. */
export async function sendDraft(draftId: string): Promise<{ id: string; threadId: string }> {
  const m = await call<GMessage>("drafts/send", { json: { id: draftId } });
  return { id: m.id, threadId: m.threadId };
}

export async function deleteDraft(draftId: string) {
  try {
    await call(`drafts/${encodeURIComponent(draftId)}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof GmailError && e.status === 404)) throw e;
  }
}

/** Files uploaded for a message that's now sent or discarded. */
export async function dropUploads(paths: string[]) {
  const ok = paths.filter((p) => UPLOAD_PATH.test(p));
  if (ok.length) await supabaseAdmin().storage.from(INBOX_BUCKET).remove(ok).catch(() => null);
}

/** Anything thrown here, as the page should hear it: not connected, Google's own words, or what went wrong. */
export function inboxErrorText(e: unknown): { status: number; error: string; reason?: string } {
  if (e instanceof InboxNotReady) return { status: 409, error: e.message, reason: e.reason };
  if (e instanceof UserError) return { status: 400, error: e.message };
  // Gmail busy for a minute: its own words name a quota, these say it passes (a 429, so the routes don't report it).
  if (e instanceof GmailError && e.busy) return { status: 429, error: GMAIL_BUSY };
  if (e instanceof GmailError) return { status: e.status === 404 ? 404 : 502, error: `Gmail: ${e.message}` };
  return { status: 500, error: e instanceof Error ? e.message : "Something went wrong" };
}

export const isThreadId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8,32}$/i.test(s);
export const isLabelId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s);
export const isDraftId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s);
export const isAttachmentId = (s: unknown): s is string => typeof s === "string" && (/^[A-Za-z0-9_-]{8,2048}$/.test(s) || /^part\.\d{1,4}(\.\d{1,4}){0,10}$/.test(s));
