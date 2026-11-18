import type { Addr } from "@/lib/inbox-mail";

/**
 * Admin → Inbox's shapes, the same on the server (features/inbox/gmail.ts, the /api/admin/inbox routes) and in the page
 * (features/inbox/inbox-app.tsx). Times are milliseconds; nothing here holds a token.
 */

/** Where the connection stands, for the page's first screen. */
export type InboxState = {
  /** The Google app's client id and secret are saved. */
  configured: boolean;
  /** A refresh token is saved: the mailbox can be read. */
  connected: boolean;
  clientId: string | null;
  email: string | null;
  /** Why the last connection stopped (Google refused the token, a password change), for the reconnect card. */
  error: string | null;
  redirectUri: string;
};

export type InboxLabel = { id: string; name: string; type: "system" | "user"; glyph: number; unread: number; total: number; hidden: boolean };
export type SendAs = { email: string; name: string; signature: string; isDefault: boolean; isPrimary: boolean };
export type AddressView = { email: string; unread: number };
export type InboxMeta = { email: string; historyId: string; labels: InboxLabel[]; sendAs: SendAs[]; addresses: AddressView[] };

export type Person = Addr & { me: boolean; unread: boolean };

/** A conversation's line in a list. */
export type ThreadRow = {
  id: string; historyId: string; subject: string; snippet: string; date: number;
  unread: boolean; starred: boolean; important: boolean; labelIds: string[];
  /** Messages in it, drafts left out. */
  count: number;
  /** Who wrote it, in order, each once. */
  people: Person[];
  /** Who its latest message went to (Sent shows "To: …"). */
  to: Addr[];
  draft: boolean; attachment: boolean;
  lastMessageId: string;
  /** In Drafts, the draft this line opens. */
  draftId: string | null;
};
export type ThreadPage = { rows: ThreadRow[]; next: string | null; estimate: number };

export type Attachment = { messageId: string; id: string; name: string; type: string; size: number; cid: string | null; inline: boolean };

export type Message = {
  id: string; threadId: string; labelIds: string[]; date: number; snippet: string;
  from: Addr; to: Addr[]; cc: Addr[]; bcc: Addr[]; replyTo: Addr[]; deliveredTo: string[];
  subject: string; messageIdHeader: string; references: string; inReplyTo: string;
  /** The sender's HTML as it came: the page sanitizes it and shows it in a sandboxed frame (features/inbox/sanitize.ts). */
  html: string | null;
  text: string | null;
  attachments: Attachment[];
  unread: boolean; starred: boolean; important: boolean; draft: boolean; draftId: string | null;
  /** Sent from one of this mailbox's own addresses. */
  me: boolean;
  unsubscribe: { url: string | null; mailto: string | null } | null;
};
export type Thread = { id: string; historyId: string; subject: string; labelIds: string[]; messages: Message[] };

/** A file on a message being written: one uploaded from this browser, or one already in Gmail (a draft's, a forward's). */
export type ComposeFile =
  | { kind: "upload"; path: string; name: string; type: string; size: number }
  | { kind: "gmail"; messageId: string; id: string; name: string; type: string; size: number; cid: string | null };

/** What the server starts a reply, a forward or an opened draft with. */
export type ComposeSeed = {
  draftId: string | null; threadId: string | null;
  from: string | null; to: Addr[]; cc: Addr[]; bcc: Addr[]; subject: string;
  /** The part being written (an opened draft's), as editable HTML. */
  html: string;
  /** The quoted message below it, sent as it is and never edited here. */
  quote: string | null;
  files: ComposeFile[];
  inReplyTo: string | null; references: string | null;
};

/** A draft as the page saves it. */
export type DraftInput = {
  draftId: string | null; threadId: string | null;
  from: string; to: Addr[]; cc: Addr[]; bcc: Addr[]; subject: string;
  html: string; quote: string | null; files: ComposeFile[];
  inReplyTo: string | null; references: string | null;
};
export type SavedDraft = { draftId: string; messageId: string; threadId: string };

/** Why the mailbox can't be read right now. */
export type NotReady = "no_client" | "not_connected" | "revoked";
