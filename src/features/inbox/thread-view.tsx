"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, EllipsisVerticalIcon, FileIcon,
  ForwardIcon, MailIcon, OctagonAlertIcon, PaperclipIcon, ReplyAllIcon, ReplyIcon, ShieldCheckIcon, Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/kit/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/kit/popover";
import { formatBytes, parseAddresses, shownName, textToHtml, type Addr } from "@/lib/inbox-mail";
import { useInboxApi } from "./api";
import { useMailbox, type MailboxCtx } from "./context";
import { Avatar, LabelChip, Star } from "./bits";
import { LabelPicker, MovePicker } from "./pickers";
import { MessageFrame } from "./message-frame";
import { sanitizeMail } from "./sanitize";
import { ago, fullDate, listDate } from "./format";
import type { Attachment, ComposeSeed, Message, Thread, ThreadRow } from "./types";
import type { ComposeWin } from "./compose";

/**
 * Gmail's reading view: the toolbar (back, archive, spam, delete, unread, move, labels, more, "3 of 50"), the subject
 * with its labels, and the messages, older ones folded to a line (more than three in a row fold to "N older messages"),
 * the newest and the unread ones open. A message's HTML shows in its sandboxed frame with the sender's pictures held
 * back until Show images; its files download through the server. Reply, Reply all and Forward open under the last one.
 */

/* Senders whose pictures always show (Gmail's "Always display images from …"), kept in this browser. */
const TRUSTED = "inbox:images";
let trustedCache: { raw: string | null; list: string[] } = { raw: null, list: [] };
const listeners = new Set<() => void>();
const readTrusted = (): string[] => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRUSTED);
  } catch { /* storage off */ }
  if (raw !== trustedCache.raw) {
    let list: string[] = [];
    try {
      list = (JSON.parse(raw ?? "[]") as string[]).filter((x) => typeof x === "string");
    } catch { /* a bad copy */ }
    trustedCache = { raw, list };
  }
  return trustedCache.list;
};
const NONE: string[] = [];
const trust = (email: string) => {
  try {
    localStorage.setItem(TRUSTED, JSON.stringify(Array.from(new Set([...readTrusted(), email.toLowerCase()])).slice(-500)));
  } catch { /* storage off */ }
  listeners.forEach((l) => l());
};
const useTrusted = () => useSyncExternalStore((cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
}, readTrusted, () => NONE);

/** A mailto: link as a new message: its address, and the subject, cc and body it names. */
export function mailtoSeed(href: string): Partial<ComposeSeed> {
  const [addr, query = ""] = href.replace(/^mailto:/i, "").split("?");
  const p = new URLSearchParams(query);
  const dec = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return { to: parseAddresses(dec(addr)), cc: parseAddresses(p.get("cc") ?? ""), bcc: parseAddresses(p.get("bcc") ?? ""), subject: p.get("subject") ?? "", html: p.get("body") ? textToHtml(p.get("body") ?? "") : "" };
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]]/g;
function Linked({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    out.push(text.slice(last, at));
    out.push(<a key={at} href={m[0]} target="_blank" rel="noopener noreferrer" className="link break-all">{m[0]}</a>);
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

/** A plain-text message, its quoted history ("> …" under "On … wrote:") folded behind Gmail's "•••". */
function PlainText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cut = lines.findIndex((l, i) => i > 0 && /^>/.test(l));
  if (cut > 0 && /wrote:\s*$/.test(lines[cut - 1] ?? "")) cut -= 1;
  const main = cut > 0 ? lines.slice(0, cut).join("\n").trimEnd() : text;
  const quote = cut > 0 ? lines.slice(cut).join("\n") : "";
  return (
    <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
      <Linked text={main} />
      {quote && (
        <details className="mt-2">
          <summary title="Show trimmed content" className="inline-block list-none rounded-md bg-panel-3 px-2 text-xs leading-4 tracking-widest text-ink-3 [&::-webkit-details-marker]:hidden">•••</summary>
          <div className="mt-2 border-l pl-3 text-ink-3"><Linked text={quote} /></div>
        </details>
      )}
    </div>
  );
}

const named = (list: Addr[], mine: Set<string>) => list.map((a) => (mine.has(a.email.toLowerCase()) ? "me" : a.name || a.email)).join(", ");

function Details({ m, ctx }: { m: Message; ctx: MailboxCtx }) {
  const to = [...m.to, ...m.cc];
  const row = (k: string, v: string) => (v ? <div className="contents"><dt className="text-right text-ink-3">{k}:</dt><dd className="break-words">{v}</dd></div> : null);
  const full = (list: Addr[]) => list.map((a) => (a.name ? `${a.name} <${a.email}>` : a.email)).join(", ");
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" onClick={(e) => e.stopPropagation()} className="flex max-w-full items-center gap-0.5 truncate text-xs text-ink-3 hover:text-ink" />}>
        <span className="truncate">to {to.length ? named(to, ctx.mine) : "(undisclosed recipients)"}{m.bcc.length ? `, bcc: ${named(m.bcc, ctx.mine)}` : ""}</span>
        <ChevronDownIcon className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(30rem,calc(100vw-2rem))]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {row("from", full([m.from]))}
          {row("reply-to", full(m.replyTo))}
          {row("to", full(m.to))}
          {row("cc", full(m.cc))}
          {row("bcc", full(m.bcc))}
          {row("date", fullDate(m.date, ctx.zone))}
          {row("subject", m.subject)}
          {row("delivered to", m.deliveredTo.join(", "))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

function Files({ m }: { m: Message }) {
  const api = useInboxApi();
  const files = m.attachments.filter((a) => !(a.inline && a.cid));
  if (!files.length) return null;
  const card = (a: Attachment) => {
    const picture = /^image\/(png|jpe?g|gif|webp)$/i.test(a.type) && a.size < 15_000_000;
    const view = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/i.test(a.type);
    return (
      <div key={a.id} className="group/file relative w-44 overflow-hidden rounded-lg border bg-panel">
        <a href={api.fileUrl(a.messageId, a.id, a.name, view)} target="_blank" rel="noopener noreferrer" className="block" title={a.name}>
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- a file from the mailbox, through this site's own route
            <img src={api.fileUrl(a.messageId, a.id, a.name, true)} alt={a.name} loading="lazy" className="h-24 w-full bg-panel-2 object-cover" />
          ) : (
            <span className="grid h-24 place-items-center bg-panel-2 text-ink-3"><FileIcon className="size-8" /></span>
          )}
          <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs">
            <PaperclipIcon className="size-3 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
          </span>
          <span className="block px-2 pb-1.5 text-[11px] text-ink-3">{formatBytes(a.size)}</span>
        </a>
        <a href={api.fileUrl(a.messageId, a.id, a.name)} download={a.name} aria-label={`Download ${a.name}`} title="Download"
          className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-panel/90 text-ink opacity-0 shadow-sm group-hover/file:opacity-100 focus-visible:opacity-100">
          <DownloadIcon className="size-3.5" />
        </a>
      </div>
    );
  };
  return (
    <div className="mt-5 border-t pt-3">
      <p className="mb-2 text-xs font-medium text-ink-3">{files.length === 1 ? "One attachment" : `${files.length} attachments`}</p>
      <div className="flex flex-wrap gap-2">{files.map(card)}</div>
    </div>
  );
}

function Body({ m }: { m: Message }) {
  const ctx = useMailbox();
  const api = useInboxApi();
  const trusted = useTrusted();
  const [show, setShow] = useState(false);
  const images = show || trusted.includes(m.from.email.toLowerCase());
  const clean = useMemo(() => (m.html ? sanitizeMail(m.html, { showImages: images, origin: typeof window === "undefined" ? "" : window.location.origin, files: m.attachments, fileUrl: (a) => api.fileUrl(a.messageId, a.id, a.name, true) }) : null), [m.html, m.attachments, images, api]);
  return (
    <>
      {clean && clean.remote > 0 && !images && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-panel-2 px-3 py-2 text-xs text-ink-3">
          <span>Images are not displayed.</span>
          <button type="button" className="link font-medium" onClick={() => setShow(true)}>Display images below</button>
          <button type="button" className="link" onClick={() => trust(m.from.email)}>Always display images from {m.from.email}</button>
        </div>
      )}
      {clean ? (
        <MessageFrame html={clean.html} images={images} onMailto={(href) => ctx.open.compose(mailtoSeed(href))} />
      ) : m.text ? (
        <PlainText text={m.text} />
      ) : (
        <p className="text-sm text-ink-3">(This message has no text.)</p>
      )}
    </>
  );
}

function MessageCard({ m, thread, open, onToggle }: { m: Message; thread: Thread; open: boolean; onToggle: () => void }) {
  const ctx = useMailbox();
  const api = useInboxApi();
  const { zone, now, actions } = ctx;
  if (m.draft) {
    return (
      <div className="flex items-center gap-3 border-t py-3 text-sm">
        <Avatar addr={m.from} />
        <span className="font-medium text-down">Draft</span>
        <span className="min-w-0 flex-1 truncate text-ink-3">{m.snippet || "(no text yet)"}</span>
        {m.draftId && (
          <>
            <Button size="sm" variant="outline" onClick={() => ctx.open.draft(m.draftId!, thread.id)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => { actions.discardDrafts([m.draftId!]); ctx.invalidate(thread.id); }}>Discard</Button>
          </>
        )}
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 border-t px-1 py-3 text-left text-sm hover:bg-panel-2/50">
        <Avatar addr={m.from} />
        <span className={`w-36 shrink-0 truncate sm:w-44 ${m.unread ? "font-semibold" : ""}`}>{ctx.mine.has(m.from.email.toLowerCase()) ? "me" : shownName(m.from)}</span>
        <span className="min-w-0 flex-1 truncate text-ink-3">{m.snippet}</span>
        <span className="shrink-0 text-xs text-ink-3">{listDate(m.date, zone, now)}</span>
      </button>
    );
  }
  const others = new Set([...m.to, ...m.cc, m.from].map((a) => a.email.toLowerCase()).filter((e) => !ctx.mine.has(e)));
  return (
    <article className="border-t py-4">
      <div className="flex cursor-pointer gap-3" onClick={onToggle}>
        <Avatar addr={m.from} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{m.from.name || m.from.email}</span>
            {m.from.name && <span className="text-xs text-ink-3">&lt;{m.from.email}&gt;</span>}
            {m.unsubscribe && (m.unsubscribe.url ? (
              <a href={m.unsubscribe.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="link text-xs">Unsubscribe</a>
            ) : m.unsubscribe.mailto ? (
              <button type="button" className="link text-xs" onClick={(e) => { e.stopPropagation(); ctx.open.compose(mailtoSeed(m.unsubscribe!.mailto!)); }}>Unsubscribe</button>
            ) : null)}
            <span className="ml-auto flex items-center gap-0.5 text-xs text-ink-3" onClick={(e) => e.stopPropagation()}>
              <span className="mr-1 hidden sm:inline">{fullDate(m.date, zone)} {ago(m.date, now)}</span>
              <span className="mr-1 sm:hidden">{listDate(m.date, zone, now)}</span>
              <Star on={m.starred} label={m.starred ? "Unstar this message" : "Star this message"} onToggle={() => actions.starMessage(thread.id, m.id, !m.starred)} />
              <Button variant="ghost" size="icon-sm" aria-label="Reply" title="Reply" onClick={() => ctx.open.reply(thread.id, m.id, "reply")}><ReplyIcon /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" title="More" />}><EllipsisVerticalIcon /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => ctx.open.reply(thread.id, m.id, "reply")}><ReplyIcon />Reply</DropdownMenuItem>
                  {others.size > 1 && <DropdownMenuItem onClick={() => ctx.open.reply(thread.id, m.id, "all")}><ReplyAllIcon />Reply all</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => ctx.open.reply(thread.id, m.id, "forward")}><ForwardIcon />Forward</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => actions.unreadFrom(thread.id, thread.messages.slice(thread.messages.findIndex((x) => x.id === m.id)).filter((x) => !x.draft).map((x) => x.id))}><MailIcon />Mark unread from here</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(api.originalUrl(m.id), "_blank", "noopener")}>Show original</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
          <Details m={m} ctx={ctx} />
        </div>
      </div>
      <div className="mt-3 md:pl-12">
        <Body m={m} />
        <Files m={m} />
      </div>
    </article>
  );
}

function Messages({ thread, hide }: { thread: Thread; hide: Set<string> }) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(false);
  const list = thread.messages.filter((m) => !(m.draft && m.draftId && hide.has(m.draftId)));
  const lastReal = [...list].reverse().find((m) => !m.draft)?.id;
  const isOpen = (m: Message) => toggled[m.id] ?? (m.id === lastReal || m.unread);
  let cut = list.length;
  for (let i = 1; i < list.length; i++) {
    if (isOpen(list[i]) || list[i].draft || i >= list.length - 2) {
      cut = i;
      break;
    }
  }
  const folded = !all && cut - 1 >= 3 ? list.slice(1, cut) : [];
  const card = (m: Message) => <MessageCard key={m.id} m={m} thread={thread} open={isOpen(m)} onToggle={() => setToggled((t) => ({ ...t, [m.id]: !isOpen(m) }))} />;
  if (!folded.length) return <>{list.map(card)}</>;
  return (
    <>
      {card(list[0])}
      <div className="relative border-t py-2">
        <button type="button" onClick={() => setAll(true)} className="mx-auto flex items-center gap-2 rounded-full border bg-panel px-3 py-1 text-xs font-medium text-ink-3 shadow-sm hover:text-ink">
          {folded.length} older messages
        </button>
      </div>
      {list.slice(cut).map(card)}
    </>
  );
}

export function ThreadView({ id, thread, row, error, position, picker, setPicker, inline, renderWin }: {
  id: string; thread: Thread | null; row: ThreadRow | null; error: string | null;
  position: { index: number; total: number; newer: (() => void) | null; older: (() => void) | null };
  picker: "labels" | "move" | null; setPicker: (p: "labels" | "move" | null) => void;
  inline: ComposeWin[]; renderWin: (w: ComposeWin) => ReactNode;
}) {
  const ctx = useMailbox();
  const api = useInboxApi();
  const { route, go, actions, open, labelById } = ctx;
  const labelIds = thread?.labelIds ?? row?.labelIds ?? [];
  const subject = thread?.subject || row?.subject || "(no subject)";
  const ids = [id];
  const inTrash = labelIds.includes("TRASH");
  const inSpam = labelIds.includes("SPAM");
  const last = thread ? [...thread.messages].reverse().find((m) => !m.draft) : undefined;
  const hide = new Set(inline.map((w) => w.seed.draftId).filter((x): x is string => !!x));
  const chips = labelIds.filter((l) => l === "INBOX" || l.startsWith("Label_")).map((l) => (l === "INBOX" ? { id: l, name: "Inbox", glyph: -1 } : labelById(l))).filter((l): l is NonNullable<typeof l> => !!l);
  const starred = thread ? thread.messages.some((m) => m.starred) : !!row?.starred;
  const important = labelIds.includes("IMPORTANT");
  const others = last ? new Set([...last.to, ...last.cc, last.from].map((a) => a.email.toLowerCase()).filter((e) => !ctx.mine.has(e))) : new Set<string>();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-2">
        <Button variant="ghost" size="icon-sm" aria-label="Back to the list" title="Back (u)" onClick={() => go({ ...route, thread: null })}><ArrowLeftIcon /></Button>
        {inTrash || inSpam || !labelIds.includes("INBOX")
          ? <Button variant="ghost" size="icon-sm" aria-label="Move to Inbox" title="Move to Inbox" onClick={() => actions.toInbox(ids)}><ArchiveRestoreIcon /></Button>
          : <Button variant="ghost" size="icon-sm" aria-label="Archive" title="Archive (e)" onClick={() => actions.archive(ids)}><ArchiveIcon /></Button>}
        {inSpam
          ? <Button variant="ghost" size="sm" title="Not spam (!)" onClick={() => actions.notSpam(ids)}><ShieldCheckIcon />Not spam</Button>
          : <Button variant="ghost" size="icon-sm" aria-label="Report spam" title="Report spam (!)" onClick={() => actions.spam(ids)}><OctagonAlertIcon /></Button>}
        {inTrash || inSpam
          ? <Button variant="ghost" size="sm" title="Delete forever" onClick={() => actions.forever(ids)}><Trash2Icon />Delete forever</Button>
          : <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete (#)" onClick={() => actions.trash(ids)}><Trash2Icon /></Button>}
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <Button variant="ghost" size="icon-sm" aria-label="Mark as unread" title="Mark as unread (⇧U)" onClick={() => actions.unread(ids)}><MailIcon /></Button>
        <MovePicker ids={ids} open={picker === "move"} onOpenChange={(o) => setPicker(o ? "move" : null)} />
        <LabelPicker ids={ids} labelsOf={() => labelIds} open={picker === "labels"} onOpenChange={(o) => setPicker(o ? "labels" : null)} />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" title="More" />}><EllipsisVerticalIcon /></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => actions.important(ids, !important)}>{important ? "Mark as not important" : "Mark as important"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.star(ids, !starred)}>{starred ? "Remove star" : "Add star"}</DropdownMenuItem>
            {last && <DropdownMenuItem onClick={() => window.open(api.originalUrl(last.id), "_blank", "noopener")}>Show original</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1 text-xs text-ink-3">
          {position.index >= 0 && <span className="hidden tabular-nums sm:inline">{(position.index + 1).toLocaleString("en-US")} of {position.total.toLocaleString("en-US")}</span>}
          <Button variant="ghost" size="icon-sm" aria-label="Newer" title="Newer (k)" disabled={!position.newer} onClick={() => position.newer?.()}><ChevronLeftIcon /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Older" title="Older (j)" disabled={!position.older} onClick={() => position.older?.()}><ChevronRightIcon /></Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-5xl px-3 pb-12 pt-5 md:px-6">
          <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:pl-12">
            <h2 className="text-[22px] leading-tight">{subject}</h2>
            {chips.map((l) => <LabelChip key={l.id} label={l} onRemove={() => (l.id === "INBOX" ? actions.archive(ids) : actions.labels(ids, [], [l.id]))} />)}
          </header>
          {!thread ? (
            error ? (
              <div className="grid place-items-center gap-3 py-16 text-center text-sm text-ink-3"><p>{error}</p><Button variant="outline" size="sm" onClick={() => go({ ...route, thread: null })}>Back to the list</Button></div>
            ) : (
              <div aria-busy className="grid gap-3 border-t pt-4">
                <div className="flex items-center gap-3"><span className="skeleton size-9 rounded-full" /><span className="skeleton h-3 w-48 rounded" /></div>
                <span className="skeleton h-3 w-full rounded" /><span className="skeleton h-3 w-11/12 rounded" /><span className="skeleton h-3 w-2/3 rounded" />
              </div>
            )
          ) : (
            <>
              <Messages thread={thread} hide={hide} />
              <div className="border-t" />
            </>
          )}
          {/* Outside the conversation's own loading, so a reply being written never goes while the conversation is read again. */}
          {inline.length ? (
            <div className="mt-4 grid gap-4">{inline.map(renderWin)}</div>
          ) : thread && last ? (
            <div className="mt-5 flex flex-wrap gap-2 md:pl-12">
              <Button variant="outline" className="rounded-full px-4" onClick={() => open.reply(thread.id, last.id, "reply")}><ReplyIcon />Reply</Button>
              {others.size > 1 && <Button variant="outline" className="rounded-full px-4" onClick={() => open.reply(thread.id, last.id, "all")}><ReplyAllIcon />Reply all</Button>}
              <Button variant="outline" className="rounded-full px-4" onClick={() => open.reply(thread.id, last.id, "forward")}><ForwardIcon />Forward</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
