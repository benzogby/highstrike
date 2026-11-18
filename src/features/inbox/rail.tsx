"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { AtSignIcon, BookmarkIcon, EllipsisVerticalIcon, FileIcon, InboxIcon, MailsIcon, OctagonAlertIcon, PencilIcon, PlusIcon, SendIcon, StarIcon, TagIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/kit/dropdown-menu";
import { errMsg } from "@/features/inbox/errors";
import { SYSTEM_VIEWS, sameView, type SystemView, type View } from "@/lib/inbox-mail";
import { useInboxApi } from "./api";
import { useMailbox } from "./context";
import { GLYPH_TEXT } from "./format";
import type { InboxLabel } from "./types";

/**
 * Gmail's left rail: Compose, the folders with their counts (Inbox's unread conversations in bold, Drafts' number of
 * drafts), one view per address of the mailbox (ben@, support@: Gmail's own search for mail to each), and the
 * labels, nested on their "/", each with Rename and Delete. Folded to icons by the menu button beside the search box.
 */

const ICONS: Record<SystemView, LucideIcon> = { inbox: InboxIcon, starred: StarIcon, important: BookmarkIcon, sent: SendIcon, drafts: FileIcon, all: MailsIcon, spam: OctagonAlertIcon, trash: Trash2Icon };

function Item({ view, icon: Icon, label, count, bold, collapsed, iconClass = "", onPick, menu }: {
  view: View; icon: LucideIcon; label: string; count: number; bold: boolean; collapsed: boolean; iconClass?: string; onPick?: () => void; menu?: ReactNode;
}) {
  const { route, go } = useMailbox();
  const on = sameView(route.view, view);
  return (
    <div className="group/item relative">
      <button
        type="button"
        title={collapsed ? `${label}${count ? ` (${count})` : ""}` : label}
        onClick={() => {
          go({ view, thread: null, page: 1 });
          onPick?.();
        }}
        className={`flex h-8 w-full items-center gap-3 rounded-full text-sm ${collapsed ? "justify-center px-0" : "pl-3.5 pr-3"} ${on ? "nav-on font-semibold" : "text-ink/85 hover:bg-panel/70"} ${bold && !on ? "font-semibold text-ink" : ""}`}
      >
        <span className="relative">
          <Icon className={`size-4 shrink-0 ${iconClass}`} />
          {collapsed && bold && count > 0 && <span aria-hidden className="absolute -right-1 -top-1 size-2 rounded-full bg-accent-ink" />}
        </span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
        {!collapsed && count > 0 && <span className={`text-xs tabular-nums ${menu ? "group-hover/item:invisible" : ""}`}>{count > 999 ? "999+" : count.toLocaleString("en-US")}</span>}
      </button>
      {!collapsed && menu}
    </div>
  );
}

function LabelMenu({ label }: { label: InboxLabel }) {
  const { prompt, ask, reloadMeta, route, go } = useMailbox();
  const api = useInboxApi();
  const rename = async () => {
    const name = await prompt({ title: "Edit label", label: "Label name", initial: label.name, action: "Save" });
    if (!name || name === label.name) return;
    try {
      await api.renameLabel(label.id, name);
      reloadMeta();
      if (route.view.kind === "label" && route.view.name === label.name) go({ view: { kind: "label", name }, thread: null, page: 1 });
    } catch (e) {
      toast.error(errMsg(e, "The label wasn't renamed."));
    }
  };
  const remove = async () => {
    if (!(await ask({ title: `Delete the label "${label.name}"?`, body: "Its conversations stay in the mailbox; only the label goes.", action: "Delete", danger: true }))) return;
    try {
      await api.deleteLabel(label.id);
      reloadMeta();
      if (route.view.kind === "label" && route.view.name === label.name) go({ view: { kind: "system", key: "inbox" }, thread: null, page: 1 });
      toast(`The label "${label.name}" was deleted.`);
    } catch (e) {
      toast.error(errMsg(e, "The label wasn't deleted."));
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Options for ${label.name}`} className="absolute right-1.5 top-1 opacity-0 group-hover/item:opacity-100 aria-expanded:opacity-100" />}>
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuItem onClick={() => void rename()}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => void remove()}>Remove label</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Rail({ collapsed, className = "", error, onRetry, onPick }: { collapsed: boolean; className?: string; error: string | null; onRetry: () => void; onPick?: () => void }) {
  const { meta, open, prompt, reloadMeta } = useMailbox();
  const api = useInboxApi();
  const byId = new Map((meta?.labels ?? []).map((l) => [l.id, l]));
  const user = (meta?.labels ?? []).filter((l) => l.type === "user" && !l.hidden).sort((a, b) => a.name.localeCompare(b.name));
  const create = async () => {
    const name = await prompt({ title: "New label", label: "Please enter a new label name (a / nests it under another)", action: "Create" });
    if (!name) return;
    try {
      await api.createLabel(name);
      reloadMeta();
    } catch (e) {
      toast.error(errMsg(e, "The label wasn't made."));
    }
  };
  return (
    <nav aria-label="Mailbox" className={`shrink-0 flex-col gap-0.5 overflow-y-auto pb-6 ${collapsed ? "w-14" : "w-56"} ${className}`}>
      <div className={`mb-3 ${collapsed ? "px-1" : "px-1.5"}`}>
        <Button onClick={() => { open.compose(); onPick?.(); }} title="Compose (c)" className={`h-12 rounded-2xl text-[15px] ${collapsed ? "w-12 px-0" : "px-5"}`}>
          <PencilIcon className="size-5" />{!collapsed && "Compose"}
        </Button>
      </div>
      {SYSTEM_VIEWS.map((v) => {
        const l = v.labelId ? byId.get(v.labelId) : undefined;
        const count = v.key === "inbox" || v.key === "spam" ? (l?.unread ?? 0) : v.key === "drafts" ? (l?.total ?? 0) : 0;
        return <Item key={v.key} view={{ kind: "system", key: v.key }} icon={ICONS[v.key]} label={v.label} count={count} bold={v.key === "inbox" && count > 0} collapsed={collapsed} onPick={onPick} />;
      })}
      {!collapsed && <p className="section-label mb-1 mt-4 px-4">Addresses</p>}
      {collapsed && <div className="mx-3 my-2 h-px bg-line" />}
      {(meta?.addresses ?? []).map((a) => (
        <Item key={a.email} view={{ kind: "addr", email: a.email }} icon={AtSignIcon} label={a.email.replace(/@.*/, "@")} count={a.unread} bold={a.unread > 0} collapsed={collapsed} onPick={onPick} />
      ))}
      {!collapsed && (
        <div className="mb-1 mt-4 flex items-center justify-between pl-4 pr-1.5">
          <p className="section-label">Labels</p>
          <Button variant="ghost" size="icon-xs" aria-label="Create new label" title="Create new label" onClick={() => void create()}><PlusIcon /></Button>
        </div>
      )}
      {collapsed && user.length > 0 && <div className="mx-3 my-2 h-px bg-line" />}
      {user.map((l) => {
        const depth = l.name.split("/").length - 1;
        return (
          <div key={l.id} className={collapsed ? "" : depth ? "pl-4" : ""}>
            <Item view={{ kind: "label", name: l.name }} icon={TagIcon} iconClass={l.glyph >= 0 ? GLYPH_TEXT[l.glyph] : ""} label={l.name.split("/").pop() ?? l.name} count={l.unread} bold={l.unread > 0} collapsed={collapsed} onPick={onPick} menu={<LabelMenu label={l} />} />
          </div>
        );
      })}
      {!collapsed && meta && !user.length && <p className="px-4 py-1 text-xs text-ink-3">No labels yet.</p>}
      {!collapsed && error && (
        <div className="mx-2 mt-3 rounded-lg border bg-panel p-2.5 text-xs text-ink-3">
          {error} <button type="button" className="link" onClick={onRetry}>Try again</button>
        </div>
      )}
    </nav>
  );
}
