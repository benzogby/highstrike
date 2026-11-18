"use client";

import { useRef, type ReactNode } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, MailIcon, MailOpenIcon, OctagonAlertIcon, PaperclipIcon, RefreshCwIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/kit/dropdown-menu";
import { SYSTEM_VIEWS } from "@/lib/inbox-mail";
import { useMailbox, type MailboxCtx } from "./context";
import { Check, LabelChip, Star } from "./bits";
import { LabelPicker, MovePicker } from "./pickers";
import { listDate, peopleLine, toLine } from "./format";
import type { ThreadPage, ThreadRow } from "./types";

/**
 * Gmail's list: the toolbar (select with its menu, refresh, then the actions for what's ticked), "1–50 of 2,345" with
 * its arrows, and a line per conversation: tick, star, people, labels, subject and snippet, a paperclip, the date, and on
 * hover Archive, Delete and Mark as read in the date's place. Unread lines are white and bold, read ones a shade under.
 */

const PAGE = 50;
const keyOf = (r: ThreadRow) => r.draftId ?? r.id;

function viewName(ctx: MailboxCtx): string {
  const v = ctx.route.view;
  if (v.kind === "system") return SYSTEM_VIEWS.find((s) => s.key === v.key)?.label ?? "Inbox";
  if (v.kind === "label") return v.name;
  if (v.kind === "addr") return v.email;
  return "Search results";
}

function emptyText(ctx: MailboxCtx): string {
  const v = ctx.route.view;
  if (v.kind === "search") return "No messages matched your search.";
  if (v.kind === "system" && v.key === "inbox") return "Your inbox is empty.";
  if (v.kind === "system" && v.key === "spam") return "Hooray, no spam here!";
  if (v.kind === "system" && v.key === "drafts") return "You don't have any saved drafts.";
  return `No conversations in ${viewName(ctx)}.`;
}

function People({ r, ctx }: { r: ThreadRow; ctx: MailboxCtx }) {
  const v = ctx.route.view;
  if (r.draftId) return <><span className="text-down">Draft</span>{r.to.length > 0 && <span className="text-ink-3"> · {toLine(r.to).replace(/^To: /, "")}</span>}</>;
  if (v.kind === "system" && v.key === "sent") return <>{toLine(r.to)}{r.count > 1 && <span className="ml-1 text-xs text-ink-3">{r.count}</span>}</>;
  const { parts, count } = peopleLine(r);
  if (!parts.length && r.draft) return <span className="text-down">Draft</span>;
  return (
    <>
      {parts.map((p, i) => <span key={i} className={p.unread ? "font-semibold text-ink" : ""}>{i > 0 && p.text !== "…" && parts[i - 1].text !== "…" ? ", " : i > 0 ? " " : ""}{p.text}</span>)}
      {!parts.length && <span className="text-ink-3">(no sender)</span>}
      {count > 1 && <span className="ml-1 text-xs text-ink-3">{count}</span>}
      {r.draft && <span className="text-down">, Draft</span>}
    </>
  );
}

function Row({ r, i, ctx, selected, cursor, compact, onOpen, onToggle }: { r: ThreadRow; i: number; ctx: MailboxCtx; selected: boolean; cursor: boolean; compact: boolean; onOpen: (i: number) => void; onToggle: (i: number, shift: boolean) => void }) {
  const { actions, route, now, zone, density, labelById, viewLabel } = ctx;
  const v = route.view;
  const trashy = v.kind === "system" && (v.key === "trash" || v.key === "spam");
  const chips = r.labelIds.filter((id) => (id.startsWith("Label_") || (id === "INBOX" && viewLabel !== "INBOX")) && id !== viewLabel)
    .map((id) => (id === "INBOX" ? { id, name: "Inbox", glyph: -1 } : labelById(id))).filter((l): l is NonNullable<typeof l> => !!l);
  const date = listDate(r.date, zone, now);
  const subject = r.subject || "(no subject)";
  const tone = selected ? "bg-accent-soft" : r.unread ? "bg-panel" : "bg-panel-2/45";
  const stacked = compact ? "flex" : "flex md:hidden";
  const wide = compact ? "hidden" : "hidden md:flex";
  const hover = (label: string, icon: ReactNode, run: () => void) => (
    <button type="button" aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); run(); }} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-panel-3 hover:text-ink">{icon}</button>
  );
  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={() => onOpen(i)}
      className={`group relative flex cursor-pointer items-center gap-1 border-b pl-2 pr-3 text-sm transition-shadow hover:z-[1] hover:shadow-sm ${tone} ${cursor ? "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent-ink" : ""}`}
    >
      <span className="flex shrink-0 items-center gap-0.5 self-start pt-2 md:self-center md:pt-0">
        <span className="grid size-7 place-items-center"><Check checked={selected} label={`Select ${subject}`} onToggle={(shift) => onToggle(i, shift)} /></span>
        {!r.draftId && <Star on={r.starred} label={r.starred ? "Unstar" : "Star"} onToggle={() => actions.star([r.id], !r.starred)} />}
      </span>

      <div className={`${stacked} min-w-0 flex-1 flex-col gap-0.5 py-2 pl-1`}>
        <div className="flex items-baseline gap-2">
          <span className={`min-w-0 flex-1 truncate ${r.unread ? "font-semibold text-ink" : "text-ink/85"}`}><People r={r} ctx={ctx} /></span>
          {r.attachment && <PaperclipIcon className="size-3.5 shrink-0 self-center text-ink-3" />}
          <span className={`shrink-0 text-xs tabular-nums ${r.unread ? "font-semibold text-ink" : "text-ink-3"}`}>{date}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate ${r.unread ? "font-semibold" : ""}`}>{subject}</span>
          {chips.slice(0, 2).map((l) => <LabelChip key={l.id} label={l} />)}
        </div>
        <span className="truncate text-ink-3">{r.snippet}</span>
      </div>

      <div className={`${wide} min-w-0 flex-1 items-center gap-3 ${density === "compact" ? "h-8" : "h-10"}`}>
        <span className={`w-48 shrink-0 truncate pl-1 lg:w-52 ${r.unread ? "font-semibold text-ink" : "text-ink/85"}`}><People r={r} ctx={ctx} /></span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {chips.map((l) => <LabelChip key={l.id} label={l} />)}
          <span className="min-w-0 truncate">
            <span className={r.unread ? "font-semibold text-ink" : "text-ink/85"}>{subject}</span>
            {r.snippet && <span className="text-ink-3"> - {r.snippet}</span>}
          </span>
        </span>
        {r.attachment && <PaperclipIcon className="size-3.5 shrink-0 text-ink-3" />}
        <span className={`w-16 shrink-0 text-right text-xs tabular-nums group-hover:hidden ${r.unread ? "font-semibold text-ink" : "text-ink-3"}`}>{date}</span>
        <span className="hidden shrink-0 items-center group-hover:flex">
          {r.draftId ? hover("Discard draft", <Trash2Icon className="size-4" />, () => actions.discardDrafts([r.draftId!])) : (
            <>
              {!trashy && hover("Archive", <ArchiveIcon className="size-4" />, () => actions.archive([r.id]))}
              {v.kind === "system" && v.key === "trash" && hover("Move to Inbox", <ArchiveRestoreIcon className="size-4" />, () => actions.toInbox([r.id]))}
              {hover(trashy ? "Delete forever" : "Delete", <Trash2Icon className="size-4" />, () => (trashy ? actions.forever([r.id]) : actions.trash([r.id])))}
              {hover(r.unread ? "Mark as read" : "Mark as unread", r.unread ? <MailOpenIcon className="size-4" /> : <MailIcon className="size-4" />, () => (r.unread ? actions.read([r.id]) : actions.unread([r.id])))}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function ListView({ entry, error, selected, setSelected, cursor, onOpen, picker, setPicker, onRetry, compact }: {
  entry: ThreadPage | null; error: string | null; selected: string[]; setSelected: (keys: string[]) => void; cursor: number; onOpen: (i: number) => void;
  picker: "labels" | "move" | null; setPicker: (p: "labels" | "move" | null) => void; onRetry: () => void; compact: boolean;
}) {
  const ctx = useMailbox();
  const { route, go, actions } = ctx;
  const last = useRef<number | null>(null);
  const rows = entry?.rows ?? [];
  const v = route.view;
  const is = (key: string) => v.kind === "system" && v.key === key;
  const drafts = is("drafts");
  const trashy = is("trash") || is("spam");
  const picked = rows.filter((r) => selected.includes(keyOf(r)));
  const ids = picked.map((r) => r.id);
  const all = rows.length > 0 && picked.length === rows.length;
  const labelsOf = (id: string) => rows.find((r) => r.id === id)?.labelIds ?? [];

  const toggle = (i: number, shift: boolean) => {
    const k = keyOf(rows[i]);
    const on = !selected.includes(k);
    if (shift && last.current !== null && last.current < rows.length) {
      const [a, b] = [Math.min(last.current, i), Math.max(last.current, i)];
      const span = rows.slice(a, b + 1).map(keyOf);
      setSelected(on ? Array.from(new Set([...selected, ...span])) : selected.filter((s) => !span.includes(s)));
    } else setSelected(on ? [...selected, k] : selected.filter((s) => s !== k));
    last.current = i;
  };
  const pick = (f: (r: ThreadRow) => boolean) => setSelected(rows.filter(f).map(keyOf));

  const start = (route.page - 1) * PAGE + 1;
  const end = start + rows.length - 1;
  const total = entry ? (entry.next && entry.estimate <= end ? "many" : entry.estimate.toLocaleString("en-US")) : "";
  const anyUnread = picked.some((r) => r.unread);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-2">
        <span className="flex items-center">
          <span className="grid size-8 place-items-center"><Check checked={all} mixed={picked.length > 0 && !all} label="Select all" onToggle={() => setSelected(all || picked.length ? [] : rows.map(keyOf))} /></span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Select" className="-ml-1.5" />}><ChevronDownIcon /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuItem onClick={() => pick(() => true)}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => pick(() => false)}>None</DropdownMenuItem>
              <DropdownMenuItem onClick={() => pick((r) => !r.unread)}>Read</DropdownMenuItem>
              <DropdownMenuItem onClick={() => pick((r) => r.unread)}>Unread</DropdownMenuItem>
              <DropdownMenuItem onClick={() => pick((r) => r.starred)}>Starred</DropdownMenuItem>
              <DropdownMenuItem onClick={() => pick((r) => !r.starred)}>Unstarred</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
        {!picked.length ? (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Refresh" title="Refresh (⇧N)" onClick={actions.refresh}><RefreshCwIcon /></Button>
            {!drafts && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" title="More" />}><EllipsisVerticalIcon /></DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem disabled={!rows.some((r) => r.unread)} onClick={() => actions.read(rows.filter((r) => r.unread).map((r) => r.id))}>Mark all as read</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : drafts ? (
          <Button variant="ghost" size="sm" onClick={() => { actions.discardDrafts(picked.map((r) => r.draftId).filter((x): x is string => !!x)); setSelected([]); }}>Discard drafts</Button>
        ) : (
          <>
            {!trashy && <Button variant="ghost" size="icon-sm" aria-label="Archive" title="Archive (e)" onClick={() => actions.archive(ids)}><ArchiveIcon /></Button>}
            {is("trash") && <Button variant="ghost" size="icon-sm" aria-label="Move to Inbox" title="Move to Inbox" onClick={() => actions.toInbox(ids)}><ArchiveRestoreIcon /></Button>}
            {is("spam")
              ? <Button variant="ghost" size="sm" title="Not spam (!)" onClick={() => actions.notSpam(ids)}><ShieldCheckIcon />Not spam</Button>
              : <Button variant="ghost" size="icon-sm" aria-label="Report spam" title="Report spam (!)" onClick={() => actions.spam(ids)}><OctagonAlertIcon /></Button>}
            {trashy
              ? <Button variant="ghost" size="sm" title="Delete forever (#)" onClick={() => actions.forever(ids)}><Trash2Icon />Delete forever</Button>
              : <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete (#)" onClick={() => actions.trash(ids)}><Trash2Icon /></Button>}
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            <Button variant="ghost" size="icon-sm" aria-label={anyUnread ? "Mark as read" : "Mark as unread"} title={anyUnread ? "Mark as read (⇧I)" : "Mark as unread (⇧U)"} onClick={() => (anyUnread ? actions.read(ids) : actions.unread(ids))}>
              {anyUnread ? <MailOpenIcon /> : <MailIcon />}
            </Button>
            <MovePicker ids={ids} open={picker === "move"} onOpenChange={(o) => setPicker(o ? "move" : null)} />
            <LabelPicker ids={ids} labelsOf={labelsOf} open={picker === "labels"} onOpenChange={(o) => setPicker(o ? "labels" : null)} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" title="More" />}><EllipsisVerticalIcon /></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => actions.important(ids, true)}>Mark as important</DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.important(ids, false)}>Mark as not important</DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.star(ids, true)}>Add star</DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.star(ids, false)}>Remove star</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <div className="ml-auto flex items-center gap-1 text-xs text-ink-3">
          {rows.length > 0 && <span className="hidden tabular-nums sm:inline">{start.toLocaleString("en-US")}–{end.toLocaleString("en-US")} of {total}</span>}
          <Button variant="ghost" size="icon-sm" aria-label="Newer" title="Newer" disabled={route.page <= 1} onClick={() => go({ ...route, thread: null, page: route.page - 1 })}><ChevronLeftIcon /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Older" title="Older" disabled={!entry?.next} onClick={() => go({ ...route, thread: null, page: route.page + 1 })}><ChevronRightIcon /></Button>
        </div>
      </div>

      {trashy && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-panel-2/60 px-4 py-2 text-xs text-ink-3">
          <span>Messages that have been in {is("trash") ? "Trash" : "Spam"} more than 30 days will be automatically deleted.</span>
          <button type="button" className="link font-medium" onClick={() => actions.empty(is("trash") ? "TRASH" : "SPAM")}>{is("trash") ? "Empty Trash now" : "Delete all spam messages now"}</button>
        </div>
      )}

      <div role="grid" aria-label={viewName(ctx)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {error && !rows.length ? (
          <div className="grid place-items-center gap-3 px-6 py-16 text-center text-sm text-ink-3">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
          </div>
        ) : !entry ? (
          <div aria-busy className="divide-y">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex h-10 items-center gap-3 px-4">
                <span className="skeleton size-4 rounded" />
                <span className="skeleton h-3 w-36 rounded" />
                <span className="skeleton h-3 flex-1 rounded" />
                <span className="skeleton h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        ) : !rows.length ? (
          <p className="px-6 py-16 text-center text-sm text-ink-3">{emptyText(ctx)}</p>
        ) : (
          rows.map((r, i) => (
            <Row key={keyOf(r)} r={r} i={i} ctx={ctx} selected={selected.includes(keyOf(r))} cursor={i === cursor} compact={compact} onOpen={onOpen} onToggle={toggle} />
          ))
        )}
      </div>
    </div>
  );
}
