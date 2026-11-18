/**
 * Admin → Inbox's mail rules (Ben, 2026-10-28: "Give me inbox in admin that allows me to basically treat that tab as my
 * entire Gmail for business@, support@ and ben@"): the views and their addresses (#inbox, #label/…, #search/…, Gmail's
 * own), the address lists in a header, the encoded words in one, the MIME a reply or a new message goes out as, who a
 * reply goes to, and the CSS of a sender's HTML with its addresses rewritten. Plain functions with no imports, used by the
 * server (features/inbox/gmail.ts) and the page alike, and tested as they are: `node --test src/lib/inbox-mail.test.mjs`,
 * or with the rest through `npm run test:export`.
 */

export type Addr = { name: string; email: string };

/** The mailbox: highstrike.com's one Google Workspace seat (ben@), with support@ a group that delivers to it and a Send mail as address on it. */
export const MAILBOX_DOMAIN = "highstrike.com";
export const ADDRESSES = ["ben@highstrike.com", "support@highstrike.com"];

/* ───────────── views and the address bar ───────────── */

export type SystemView = "inbox" | "starred" | "important" | "sent" | "drafts" | "all" | "spam" | "trash";
export type View =
  | { kind: "system"; key: SystemView }
  | { kind: "label"; name: string }
  | { kind: "addr"; email: string }
  | { kind: "search"; q: string };
export type Route = { view: View; thread: string | null; page: number };

/** Gmail's own folders, in its order. `labelId` is the system label a view lists (All mail has none). */
export const SYSTEM_VIEWS: { key: SystemView; label: string; labelId: string | null }[] = [
  { key: "inbox", label: "Inbox", labelId: "INBOX" },
  { key: "starred", label: "Starred", labelId: "STARRED" },
  { key: "important", label: "Important", labelId: "IMPORTANT" },
  { key: "sent", label: "Sent", labelId: "SENT" },
  { key: "drafts", label: "Drafts", labelId: "DRAFT" },
  { key: "all", label: "All mail", labelId: null },
  { key: "spam", label: "Spam", labelId: "SPAM" },
  { key: "trash", label: "Trash", labelId: "TRASH" },
];
const SYSTEM_KEYS = new Set<string>(SYSTEM_VIEWS.map((v) => v.key));
const THREAD_ID = /^[0-9a-f]{8,32}$/i;
const LOCAL_PART = /^[a-z0-9][a-z0-9._+-]{0,63}$/i;

const unhash = (s: string) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
};

/**
 * Where the address bar's hash points, as Gmail writes it: "#inbox", "#inbox/p2", "#label/Clients/18c2f…",
 * "#search/from%3Ajane/18c2f…", and "#addr/support" for one address's mail. Anything else is the inbox.
 */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#/, "").split("/");
  const head = parts[0] ?? "";
  let view: View = { kind: "system", key: "inbox" };
  let rest: string[] = [];
  if (SYSTEM_KEYS.has(head)) {
    view = { kind: "system", key: head as SystemView };
    rest = parts.slice(1);
  } else if (head === "label" && parts[1]) {
    view = { kind: "label", name: unhash(parts[1]) };
    rest = parts.slice(2);
  } else if (head === "addr" && parts[1] && LOCAL_PART.test(unhash(parts[1]))) {
    view = { kind: "addr", email: `${unhash(parts[1]).toLowerCase()}@${MAILBOX_DOMAIN}` };
    rest = parts.slice(2);
  } else if (head === "search" && parts.length > 1) {
    view = { kind: "search", q: unhash(parts[1]) };
    rest = parts.slice(2);
  }
  let page = 1;
  let thread: string | null = null;
  for (const seg of rest) {
    const p = /^p(\d{1,4})$/.exec(seg);
    if (p) page = Math.max(1, Number(p[1]));
    else if (THREAD_ID.test(seg)) thread = seg.toLowerCase();
  }
  return { view, thread, page };
}

/** The hash for a route: parseRoute's inverse. */
export function routeHash(r: Route): string {
  const v = r.view;
  const base = v.kind === "system" ? v.key
    : v.kind === "label" ? `label/${encodeURIComponent(v.name)}`
    : v.kind === "addr" ? `addr/${encodeURIComponent(v.email.split("@")[0])}`
    : `search/${encodeURIComponent(v.q)}`;
  return `#${base}${r.page > 1 ? `/p${r.page}` : ""}${r.thread ? `/${r.thread}` : ""}`;
}

/** One key per list, for the page's copy of it. */
export function viewKey(v: View): string {
  return v.kind === "system" ? v.key : v.kind === "label" ? `label:${v.name}` : v.kind === "addr" ? `addr:${v.email}` : `search:${v.q}`;
}

export function sameView(a: View, b: View): boolean {
  return viewKey(a) === viewKey(b);
}

/**
 * One address's mail, in Gmail's own search: naming it as a recipient (To or Cc), or delivered to it. Whether Gmail writes
 * an alias's mail's Delivered-To as the alias or as the mailbox's own address (ben@) isn't settled, so the mailbox's own
 * view (ADDRESSES[0]) leaves out mail it only got by delivery when that mail names one of the aliases: right either way.
 */
export function addressQuery(email: string): string {
  const e = email.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
  if (e !== ADDRESSES[0]) return `{deliveredto:${e} to:${e} cc:${e}}`;
  const aliases = ADDRESSES.slice(1).map((a) => `-to:${a} -cc:${a}`).join(" ");
  return `(to:${e} OR cc:${e} OR (deliveredto:${e} ${aliases}))`;
}

/** What threads.list is asked for one view: its label, its search, and whether Spam and Trash are in it. */
export function listParams(v: { system?: SystemView | null; labelId?: string | null; addr?: string | null; q?: string | null }): { labelIds: string[]; q: string; includeSpamTrash: boolean } {
  if (v.labelId) return { labelIds: [v.labelId], q: "", includeSpamTrash: false };
  if (v.addr) return { labelIds: [], q: addressQuery(v.addr), includeSpamTrash: false };
  if (v.q !== null && v.q !== undefined && v.q !== "") return { labelIds: [], q: v.q, includeSpamTrash: /\bin:(spam|trash|anywhere)\b/i.test(v.q) };
  const sys = SYSTEM_VIEWS.find((s) => s.key === (v.system ?? "inbox")) ?? SYSTEM_VIEWS[0];
  return { labelIds: sys.labelId ? [sys.labelId] : [], q: "", includeSpamTrash: sys.key === "spam" || sys.key === "trash" };
}

/** Gmail's search options (the slider beside the search box) as one search. Empty fields are left out. */
export function searchFromOptions(o: { from?: string; to?: string; subject?: string; words?: string; without?: string; attachment?: boolean; after?: string; before?: string }): string {
  const group = (s: string) => (/\s/.test(s.trim()) ? `(${s.trim()})` : s.trim());
  const out: string[] = [];
  if (o.from?.trim()) out.push(`from:${group(o.from)}`);
  if (o.to?.trim()) out.push(`to:${group(o.to)}`);
  if (o.subject?.trim()) out.push(`subject:${group(o.subject)}`);
  if (o.words?.trim()) out.push(o.words.trim());
  if (o.without?.trim()) out.push(`-{${o.without.trim()}}`);
  if (o.attachment) out.push("has:attachment");
  if (o.after && /^\d{4}-\d{2}-\d{2}$/.test(o.after)) out.push(`after:${o.after.replace(/-/g, "/")}`);
  if (o.before && /^\d{4}-\d{2}-\d{2}$/.test(o.before)) out.push(`before:${o.before.replace(/-/g, "/")}`);
  return out.join(" ");
}

/* ───────────── headers ───────────── */

const b64FromBytes = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Standard or URL-safe base64, padded or not, into bytes. Anything that isn't base64 is skipped rather than thrown on. */
export function bytesFromBase64(data: string): Uint8Array {
  const clean = data.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
  const padded = clean + "===".slice((clean.length + 3) % 4);
  const bin = atob(padded.length % 4 === 1 ? padded.slice(0, -1) : padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** UTF-8 text as standard base64. */
export function base64Utf8(text: string): string {
  return b64FromBytes(new TextEncoder().encode(text));
}

/** Base64 broken into 76-character lines, as MIME wants it. */
export function wrap76(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? [""]).join("\r\n");
}

/** Bytes in a charset as text. "iso-8859-1" reads as windows-1252, as browsers read it; an unknown charset as UTF-8. */
export function decodeBytes(bytes: Uint8Array, charset: string | null | undefined): string {
  const cs = (charset ?? "utf-8").trim().toLowerCase().replace(/^["']|["']$/g, "") || "utf-8";
  if (cs !== "utf-8" && cs !== "utf8" && cs !== "us-ascii") {
    // Some senders declare a single-byte charset over UTF-8 bytes. Real Latin-1 text almost never forms valid UTF-8
    // sequences, so bytes that do are read as what they are.
    if (/^(iso-8859-1|latin1|windows-1252|cp1252|iso-8859-15)$/.test(cs) && bytes.some((b) => b > 0x7f)) {
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch { /* not UTF-8: the declared charset it is */ }
    }
    try {
      return new TextDecoder(cs).decode(bytes);
    } catch { /* an unknown label */ }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

const ENCODED_WORD = /=\?([^?\s*]+)(?:\*[^?\s]*)?\?([BbQq])\?([^?\s]*)\?=/g;

function wordBytes(kind: string, data: string): Uint8Array {
  if (kind.toUpperCase() === "B") return bytesFromBase64(data);
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if (c === "_") out.push(0x20);
    else if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(data.slice(i + 1, i + 3))) {
      out.push(parseInt(data.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(c.charCodeAt(0) & 0xff);
  }
  return new Uint8Array(out);
}

/**
 * RFC 2047 encoded words ("=?UTF-8?B?…?=") as text. Words side by side are one run: the space between them goes, and
 * their bytes are joined before they're read, because some mailers split one character across two words.
 */
export function decodeWords(value: string | null | undefined): string {
  const v = value ?? "";
  if (!v.includes("=?")) return v;
  type Run = { charset: string; bytes: number[] };
  const pieces: (string | Run)[] = [];
  let last = 0;
  for (const m of v.matchAll(ENCODED_WORD)) {
    const start = m.index ?? 0;
    const between = v.slice(last, start);
    const charset = m[1].toLowerCase();
    const bytes = Array.from(wordBytes(m[2], m[3]));
    const prev = pieces[pieces.length - 1];
    if (prev !== undefined && typeof prev !== "string" && /^\s*$/.test(between)) {
      if (prev.charset === charset) prev.bytes.push(...bytes);
      else pieces.push({ charset, bytes });
    } else {
      if (between) pieces.push(between);
      pieces.push({ charset, bytes });
    }
    last = start + m[0].length;
  }
  if (last < v.length) pieces.push(v.slice(last));
  return pieces.map((p) => (typeof p === "string" ? p : decodeBytes(new Uint8Array(p.bytes), p.charset))).join("");
}

/**
 * A header's text as RFC 2047 words when it isn't plain ASCII: UTF-8 base64, at most 45 bytes a word (so each stays
 * under the 75-character limit), never splitting a character, folded onto continuation lines.
 */
export function encodeWords(text: string): string {
  const t = text.replace(/[\r\n]+/g, " ");
  if (/^[\x20-\x7e]*$/.test(t) && !t.includes("=?")) return t;
  const enc = new TextEncoder();
  const words: string[] = [];
  let chunk = "";
  for (const ch of t) {
    if (chunk && enc.encode(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64FromBytes(enc.encode(w))}?=`).join("\r\n ");
}

/** One header's value from a Gmail message part's headers, by name, any case. */
export function headerOf(headers: { name: string; value: string }[] | undefined, name: string): string {
  const n = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";
}

/** Every value of a header that can repeat (Delivered-To). */
export function headersOf(headers: { name: string; value: string }[] | undefined, name: string): string[] {
  const n = name.toLowerCase();
  return (headers ?? []).filter((h) => h.name.toLowerCase() === n).map((h) => h.value);
}

/** A parameter of a structured header ("text/html; charset=utf-8" → charset → "utf-8"). */
export function headerParam(value: string, param: string): string | null {
  const re = new RegExp(`(?:^|;)\\s*${param}\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|([^;\\s]*))`, "i");
  const m = re.exec(value);
  if (!m) return null;
  return (m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1");
}

/* ───────────── addresses ───────────── */

export const EMAIL = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

/**
 * An address header's list: `"Doe, Jane" <jane@x.com>, bob@y.com, =?UTF-8?B?…?= <z@w.com>, Team: a@b.com;`. Commas in
 * quotes, angle brackets and comments don't split it; a group's name is dropped; names come back decoded and unquoted.
 */
export function parseAddresses(value: string | null | undefined): Addr[] {
  const v = value ?? "";
  if (!v.trim()) return [];
  const items: string[] = [];
  let cur = "";
  let quoted = false;
  let angle = 0;
  let paren = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (quoted) {
      cur += c;
      if (c === "\\" && i + 1 < v.length) cur += v[++i];
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "(") paren++;
    else if (c === ")" && paren) paren--;
    else if (!paren && c === "<") angle++;
    else if (!paren && c === ">" && angle) angle--;
    else if (!paren && !angle && (c === "," || c === ";")) {
      items.push(cur);
      cur = "";
      continue;
    } else if (!paren && !angle && c === ":") {
      cur = "";
      continue;
    }
    cur += c;
  }
  items.push(cur);
  const out: Addr[] = [];
  for (const raw of items) {
    const item = raw.replace(/\s+/g, " ").trim();
    if (!item) continue;
    const angled = /<([^<>]*)>/.exec(item);
    let email: string;
    let name: string;
    if (angled) {
      email = angled[1].trim();
      name = (item.slice(0, angled.index) + item.slice(angled.index + angled[0].length)).replace(/\([^)]*\)/g, "").trim();
    } else {
      const comment = /\(([^)]*)\)/.exec(item);
      email = item.replace(/\([^)]*\)/g, "").trim();
      name = comment ? comment[1].trim() : "";
    }
    if (/^".*"$/.test(name)) name = name.slice(1, -1).replace(/\\(.)/g, "$1");
    email = email.replace(/^mailto:/i, "");
    if (!email.includes("@")) continue;
    out.push({ name: decodeWords(name).trim(), email });
  }
  return out;
}

/** An address for a header: "Jane Doe" <jane@x.com>, the name as encoded words when it isn't ASCII. */
export function formatAddress(a: Addr): string {
  const email = a.email.replace(/[\r\n<>]/g, "").trim();
  const name = (a.name ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!name || name.toLowerCase() === email.toLowerCase()) return email;
  if (/^[\x20-\x7e]*$/.test(name)) return `"${name.replace(/(["\\])/g, "\\$1")}" <${email}>`;
  return `${encodeWords(name)} <${email}>`;
}

/** An address as a person reads it: the name, else the address. */
export const shownName = (a: Addr) => a.name || a.email;

/** A first name for a crowded list ("Jane" for Jane Doe; the address's own name for an address). */
export function firstName(a: Addr): string {
  const n = a.name.replace(/^["']|["']$/g, "").trim();
  if (n) return n.includes(",") ? (n.split(",")[1]?.trim().split(/\s+/)[0] || n) : n.split(/\s+/)[0];
  return a.email.split("@")[0];
}

/** The list without repeats (by address, any case) and without any address in `drop`. */
export function uniqueAddrs(list: Addr[], drop: Iterable<string> = []): Addr[] {
  const seen = new Set<string>(Array.from(drop, (e) => e.toLowerCase()));
  const out: Addr[] = [];
  for (const a of list) {
    const k = a.email.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/* ───────────── replying and forwarding ───────────── */

export type Replyable = { from: Addr; to: Addr[]; cc: Addr[]; replyTo: Addr[]; deliveredTo: string[]; subject: string; messageIdHeader: string; references: string };

/**
 * Who a reply goes to, as Gmail decides it: the sender, or its Reply-To; with Reply all, everyone else on it too, minus
 * this mailbox's own addresses. A reply to a message sent from here goes back to the people it was sent to.
 */
export function replyRecipients(m: Replyable, mine: string[], all: boolean): { to: Addr[]; cc: Addr[] } {
  const me = new Set(mine.map((e) => e.toLowerCase()));
  const own = me.has(m.from.email.toLowerCase());
  const to = own ? (m.to.length ? m.to : [m.from]) : m.replyTo.length ? m.replyTo : [m.from];
  const toList = uniqueAddrs(to, own ? [] : me);
  if (!all) return { to: toList.length ? toList : uniqueAddrs(to), cc: [] };
  const cc = uniqueAddrs(own ? m.cc : [...m.to, ...m.cc], [...me, ...toList.map((a) => a.email)]);
  return { to: toList.length ? toList : uniqueAddrs(to), cc };
}

/**
 * Which of this mailbox's addresses a reply goes out from (Gmail's "reply from the same address the message was sent
 * to"): the sender's when the message was sent from here, else the first one named on it (To, then Cc), else the one it
 * was delivered to. The names come before Delivered-To because Gmail may write the mailbox's own address there for an
 * alias's mail, which would answer support@'s mail from ben@.
 */
export function replyFrom(m: Replyable, sendAs: string[]): string | null {
  const own = sendAs.map((e) => e.toLowerCase());
  if (own.includes(m.from.email.toLowerCase())) return m.from.email.toLowerCase();
  for (const a of [...m.to, ...m.cc]) if (own.includes(a.email.toLowerCase())) return a.email.toLowerCase();
  for (const d of m.deliveredTo) if (own.includes(d.toLowerCase())) return d.toLowerCase();
  return null;
}

export const replySubject = (s: string) => (/^\s*re\s*:/i.test(s) ? s.trim() : `Re: ${s.trim() || "(no subject)"}`.trim());
export const forwardSubject = (s: string) => (/^\s*(fwd?|fw)\s*:/i.test(s) ? s.trim() : `Fwd: ${s.trim()}`.trim());

/** A reply's In-Reply-To and References: the message's own id after its references, the last twenty kept. */
export function threading(m: Replyable): { inReplyTo: string; references: string } {
  const id = m.messageIdHeader.trim();
  const refs = `${m.references} ${id}`.trim().split(/\s+/).filter(Boolean);
  return { inReplyTo: id, references: refs.slice(-20).join(" ") };
}

/* ───────────── text and HTML ───────────── */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", zwnj: "\u200c", zwj: "\u200d", shy: "" };

/** HTML entities as characters (Gmail's snippets come escaped: "I&#39;m"). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Plain text as HTML: escaped, its links live, its line breaks kept. */
export function textToHtml(text: string): string {
  const out: string[] = [];
  let last = 0;
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]]/g)) {
    const at = m.index ?? 0;
    out.push(escapeHtml(text.slice(last, at)));
    const u = escapeHtml(m[0]);
    out.push(`<a href="${u}">${u}</a>`);
    last = at + m[0].length;
  }
  out.push(escapeHtml(text.slice(last)));
  return out.join("").replace(/\r?\n/g, "<br>");
}

/** HTML as plain text, for a message's text/plain half and a quote's preview: blocks on their own lines, links kept. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<a\b[^>]*href\s*=\s*["']?(https?:[^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
        const label = inner.replace(/<[^>]+>/g, "").trim();
        return !label || label === href ? href : `${label} \u0001${href}\u0002`;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|tr|table|ul|ol|blockquote|pre)>/gi, "\n")
      .replace(/<(p|div|h[1-6]|tr|table|blockquote|pre)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\u0001/g, "<")
    .replace(/\u0002/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ───────────── MIME ───────────── */

export type MimeAttachment = { name: string; type: string; base64: string; cid?: string | null };
export type MimeMessage = {
  from: string; to: string[]; cc: string[]; bcc: string[]; subject: string; html: string; text: string;
  inReplyTo?: string | null; references?: string | null; attachments: MimeAttachment[];
};

const cleanHeader = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/** A file name for MIME headers: plain when it's ASCII, with RFC 2231's UTF-8 form beside an ASCII fallback when not. */
function fileParam(key: "name" | "filename", raw: string): string {
  const name = raw.replace(/[\r\n"\\/]/g, "_").trim().slice(0, 180) || "attachment";
  if (/^[\x20-\x7e]*$/.test(name)) return `${key}="${name}"`;
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  const star = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${key}="${ascii}"; ${key}*=UTF-8''${star}`;
}

/**
 * A message as RFC 5322 text with CRLF line ends: text and HTML as alternatives, files beside them (inline ones, with a
 * Content-ID, kept with the HTML). Bcc stays in the headers: Gmail reads its recipients from it and takes it off what
 * the others receive. `seed` makes the part boundaries; the server passes random bytes, a test a fixed word.
 */
export function buildMime(m: MimeMessage, seed: string): string {
  const b = (n: number) => `=_${seed}_${n}`;
  const lines: string[] = [];
  const head = (k: string, v: string) => lines.push(`${k}: ${v}`);
  head("From", cleanHeader(m.from));
  if (m.to.length) head("To", m.to.map(cleanHeader).join(", "));
  if (m.cc.length) head("Cc", m.cc.map(cleanHeader).join(", "));
  if (m.bcc.length) head("Bcc", m.bcc.map(cleanHeader).join(", "));
  head("Subject", encodeWords(cleanHeader(m.subject)));
  if (m.inReplyTo) head("In-Reply-To", cleanHeader(m.inReplyTo));
  if (m.references) head("References", cleanHeader(m.references));
  head("MIME-Version", "1.0");

  const textPart = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(base64Utf8(m.text))];
  const htmlPart = ["Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(base64Utf8(m.html))];
  const filePart = (a: MimeAttachment) => {
    const type = MIME_TYPE.test(a.type) ? a.type.toLowerCase() : "application/octet-stream";
    return [
      `Content-Type: ${type}; ${fileParam("name", a.name)}`,
      `Content-Disposition: ${a.cid ? "inline" : "attachment"}; ${fileParam("filename", a.name)}`,
      ...(a.cid ? [`Content-ID: <${cleanHeader(a.cid).replace(/[<>]/g, "")}>`] : []),
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(a.base64.replace(/[^A-Za-z0-9+/=]/g, "")),
    ];
  };
  const multipart = (type: string, boundary: string, parts: string[][]) => [
    `Content-Type: multipart/${type}; boundary="${boundary}"`,
    "",
    ...parts.flatMap((p) => [`--${boundary}`, ...p]),
    `--${boundary}--`,
  ];

  const inline = m.attachments.filter((a) => a.cid);
  const files = m.attachments.filter((a) => !a.cid);
  const alternative = multipart("alternative", b(1), [textPart, htmlPart]);
  const body = inline.length ? multipart("related", b(2), [alternative, ...inline.map(filePart)]) : alternative;
  const whole = files.length ? multipart("mixed", b(3), [body, ...files.map(filePart)]) : body;
  return [...lines, ...whole, ""].join("\r\n");
}

/* ───────────── a message's parts ───────────── */

export type GmailPart = {
  partId?: string; mimeType?: string; filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};
export type PartInfo = {
  mimeType: string; charset: string | null; filename: string; attachmentId: string | null; data: string | null;
  size: number; cid: string | null; inline: boolean; partId: string | null;
};

const containsHtml = (p: GmailPart): boolean => (p.mimeType ?? "").toLowerCase() === "text/html" || (p.parts ?? []).some(containsHtml);
const HIDDEN = /^application\/(pgp|pkcs7|x-pkcs7)-signature$/i;

function info(p: GmailPart): PartInfo {
  const type = (p.mimeType ?? "application/octet-stream").toLowerCase();
  const ctype = headerOf(p.headers, "Content-Type");
  const disp = headerOf(p.headers, "Content-Disposition");
  const cid = headerOf(p.headers, "Content-ID").replace(/[<>\s]/g, "") || null;
  const name = p.filename || decodeWords(headerParam(disp, "filename") ?? headerParam(ctype, "name") ?? "");
  return {
    mimeType: type, charset: headerParam(ctype, "charset"), filename: name, attachmentId: p.body?.attachmentId ?? null,
    data: p.body?.data ?? null, size: p.body?.size ?? 0, cid, inline: /^\s*inline/i.test(disp), partId: p.partId ?? null,
  };
}

/**
 * A Gmail message's payload sorted out: the HTML to show (every inline HTML part, in order, as Apple Mail splits one
 * around its pictures), the plain text when there's no HTML, and the files. Of alternatives, the richest is shown.
 */
export function messageParts(payload: GmailPart | undefined): { html: PartInfo[]; text: PartInfo[]; files: PartInfo[] } {
  const html: PartInfo[] = [];
  const text: PartInfo[] = [];
  const files: PartInfo[] = [];
  const walk = (p: GmailPart) => {
    const type = (p.mimeType ?? "").toLowerCase();
    if (type === "multipart/alternative" && p.parts?.length) {
      const rich = [...p.parts].reverse().find(containsHtml);
      if (rich) return walk(rich);
      const plain = p.parts.find((k) => (k.mimeType ?? "").toLowerCase() === "text/plain") ?? p.parts[0];
      return walk(plain);
    }
    if (type.startsWith("multipart/")) {
      for (const k of p.parts ?? []) walk(k);
      return;
    }
    const i = info(p);
    const attached = /^\s*attachment/i.test(headerOf(p.headers, "Content-Disposition"));
    if (!attached && !i.filename && type === "text/html") html.push(i);
    else if (!attached && !i.filename && type === "text/plain") text.push(i);
    else if (!HIDDEN.test(type)) {
      if (!i.filename) i.filename = type === "message/rfc822" ? "forwarded-message.eml" : type === "text/calendar" ? "invite.ics" : "attachment";
      files.push(i);
    }
  };
  if (payload) walk(payload);
  return { html, text, files };
}

/** One part of a payload by its partId ("1.2"), for a small file Gmail keeps inside the message rather than apart. */
export function partById(payload: GmailPart | undefined, partId: string): GmailPart | null {
  if (!payload) return null;
  if (payload.partId === partId) return payload;
  for (const k of payload.parts ?? []) {
    const hit = partById(k, partId);
    if (hit) return hit;
  }
  return null;
}

/* ───────────── a sender's CSS ───────────── */

/**
 * A sender's CSS (a <style> block or a style attribute) with every address it would load rewritten by `map` (null drops
 * it), and the things that load or run anything else made invalid, so the browser drops the declaration: @import,
 * image-set(), expression(), behaviors and bindings. Comments and hex escapes go first, so none of that can hide in them.
 * The message's frame has its own Content-Security-Policy as well (features/inbox/message-frame.tsx); this is the part
 * that lets the allowed images through it.
 */
export function rewriteCss(css: string, map: (url: string) => string | null): string {
  let s = css.replace(/\u0000/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/\\([0-9a-f]{1,6})\s?/gi, (_m, hex: string) => {
    const ch = String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff) || 0xfffd);
    return /["'\\()\n\r]/.test(ch) ? " " : ch;
  });
  s = s.replace(/@import[^;]*;?/gi, "");
  s = s.replace(/(-webkit-)?image-set\s*\(/gi, "x-removed(").replace(/expression\s*\(/gi, "x-removed(");
  s = s.replace(/(behavior|-moz-binding)\s*:/gi, "x-removed:");
  s = s.replace(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi, (_m, a?: string, b?: string, c?: string) => {
    const mapped = map((a ?? b ?? c ?? "").trim());
    return mapped ? `\u0000("${mapped.replace(/["\\\n\r]/g, "")}")` : "none";
  });
  return s.replace(/url\s*\(/gi, "x-removed(").replace(/\u0000\(/g, "url(");
}

/* ───────────── small things ───────────── */

/** "1.2 MB", "340 KB", "12 bytes". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** A hostname that is this site (or the machine): a sender's picture must never make the browser call us with its cookies. */
export function isOwnHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return h === MAILBOX_DOMAIN || h.endsWith(`.${MAILBOX_DOMAIN}`) || h.endsWith(".vercel.app") || h === "localhost" || h.endsWith(".localhost") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "[::1]" || h.startsWith("[");
}

/**
 * A Gmail label's colour as one of the design's twelve glyph hues (globals.css --glyph-0 … --glyph-11), so a label's dot
 * keeps its hue in the app's own palette; -1 for a grey one or none.
 */
export function glyphFor(hex: string | null | undefined): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const bl = (n & 255) / 255;
  const max = Math.max(r, g, bl);
  const min = Math.min(r, g, bl);
  if (max - min < 0.12) return -1;
  const d = max - min;
  let h = max === r ? ((g - bl) / d) % 6 : max === g ? (bl - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const HUES = [358, 22, 42, 85, 142, 174, 192, 221, 243, 266, 292, 333];
  let best = 0;
  let bestD = 999;
  HUES.forEach((x, i) => {
    const dist = Math.min(Math.abs(x - h), 360 - Math.abs(x - h));
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  });
  return best;
}

/* ───────────── Gmail's quota ───────────── */

/**
 * What one Gmail API call costs of the mailbox's quota, in Google's units (developers.google.com/gmail/api/reference/
 * quota), by its method and path ("threads/1a2b" is a threads.get). A quota refusal's note names what was spending it
 * (features/inbox/gmail.ts → call; 2026-11-03, a reply's saves were refused with "Quota exceeded … Units per minute per
 * user" while it was being written). A call not listed here counts 5.
 */
export function gmailCallCost(method: string, path: string): { kind: string; units: number } {
  const m = method.toUpperCase();
  const p = path.replace(/^\/+/, "").split("?")[0];
  const one = (kind: string, units: number) => ({ kind, units });
  if (p === "profile") return one("profile", 1);
  if (p.startsWith("settings/")) return one("settings", 1);
  if (p === "labels" || p.startsWith("labels/")) return m === "GET" ? one("labels.get", 1) : one("labels.change", 5);
  if (p === "history") return one("history.list", 2);
  if (p === "threads") return one("threads.list", 10);
  if (/^threads\/[^/]+\/(modify|trash|untrash)$/.test(p)) return one("threads.modify", 10);
  if (/^threads\/[^/]+$/.test(p)) return m === "DELETE" ? one("threads.delete", 20) : one("threads.get", 10);
  if (p === "messages") return one("messages.list", 5);
  if (p === "messages/batchModify" || p === "messages/batchDelete") return one("messages.batch", 50);
  if (p === "messages/send") return one("messages.send", 100);
  if (/^messages\/[^/]+\/attachments\//.test(p)) return one("attachments.get", 5);
  if (/^messages\/[^/]+\/(modify|trash|untrash)$/.test(p)) return one("messages.modify", 5);
  if (/^messages\/[^/]+$/.test(p)) return m === "DELETE" ? one("messages.delete", 10) : one("messages.get", 5);
  if (p === "drafts") return m === "POST" ? one("drafts.create", 10) : one("drafts.list", 5);
  if (p === "drafts/send") return one("drafts.send", 100);
  if (/^drafts\/[^/]+$/.test(p)) return m === "PUT" ? one("drafts.update", 15) : m === "DELETE" ? one("drafts.delete", 10) : one("drafts.get", 5);
  return one(`${m} ${p.split("/")[0] || "?"}`, 5);
}

/** Gmail turning a call away for the mailbox's quota or rate limit (a 429, or a 403 that says so): nothing was done. */
export function gmailBusy(status: number, message: string): boolean {
  return status === 429 || (status === 403 && /quota|rate ?limit|too many/i.test(message));
}

/** Those refusals, in place of Google's words: it works again within a minute, and a draft saves itself again. */
export const GMAIL_BUSY = "Gmail is busy for a moment (too many requests to it this minute). It works again within a minute.";

/**
 * A draft save that can work by itself a little later (features/inbox/compose.tsx): Gmail busy or failing, or the site not
 * answering. Not a mistake in the message (an address, a file too big, From not the mailbox's), which waits for the next
 * change. A UserError's words ride in its digest (lib/errors.ts).
 */
export function saveCanRetry(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string" || !digest.startsWith("user:")) return true;
  const said = digest.slice(5);
  return said === GMAIL_BUSY || said.startsWith("Gmail: ");
}

/* ───────────── a message being written, kept in this browser ───────────── */

/**
 * What a compose window holds that Gmail hasn't saved yet, kept in this browser until it has (features/inbox/
 * compose.tsx; 2026-11-03, a reply written while Gmail refused its saves was gone from Drafts). `text` is its words
 * without the signature; `owner` is the window that wrote it.
 */
export type ComposeBackup = { html: string; text: string; subject: string; to: Addr[]; cc: Addr[]; bcc: Addr[]; at: number; owner: string };

export const COMPOSE_BACKUP_PREFIX = "highstrike.inbox.compose:";
/** How long a copy is kept. */
export const COMPOSE_BACKUP_MS = 7 * 86_400_000;

/**
 * Where a window's copy is kept: by its draft once Gmail has one, else by the conversation it replies to (or forwards
 * from). A new message has none until its first save.
 */
export function composeBackupKey(o: { draftId: string | null; threadId: string | null; forward: boolean }): string | null {
  if (o.draftId) return `${COMPOSE_BACKUP_PREFIX}d:${o.draftId}`;
  if (o.threadId) return `${COMPOSE_BACKUP_PREFIX}${o.forward ? "f" : "t"}:${o.threadId}`;
  return null;
}

const words = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * A kept copy to put back when its window opens again: under a week old, with words in it that aren't what the draft
 * itself holds (`draftText`: its words without the signature). Null otherwise, and for anything that isn't a copy.
 */
export function backupToRestore(v: unknown, o: { draftText: string; now: number }): ComposeBackup | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Partial<ComposeBackup>;
  if (typeof b.html !== "string" || typeof b.text !== "string" || typeof b.at !== "number" || !(o.now - b.at < COMPOSE_BACKUP_MS)) return null;
  if (!words(b.text) || words(b.text) === words(o.draftText)) return null;
  const addrs = (x: unknown): Addr[] => (Array.isArray(x) ? x.filter((a) => a && typeof a === "object" && typeof (a as Addr).email === "string").map((a) => ({ name: String((a as Addr).name ?? ""), email: (a as Addr).email })) : []);
  return {
    html: b.html, text: b.text, subject: typeof b.subject === "string" ? b.subject : "", to: addrs(b.to), cc: addrs(b.cc), bcc: addrs(b.bcc), at: b.at,
    owner: typeof b.owner === "string" ? b.owner : "",
  };
}

/** A stored copy past keeping: not a copy, or a week old. */
export function backupStale(raw: string | null, now: number): boolean {
  try {
    const b = JSON.parse(raw ?? "") as Partial<ComposeBackup> | null;
    return !b || typeof b !== "object" || typeof b.at !== "number" || !(now - b.at < COMPOSE_BACKUP_MS);
  } catch {
    return true;
  }
}
