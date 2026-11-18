"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { FolderInputIcon, InboxIcon, OctagonAlertIcon, PlusIcon, TagIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/kit/popover";
import { errMsg } from "@/features/inbox/errors";
import { useInboxApi } from "./api";
import { useMailbox } from "./context";
import { GLYPH_DOT } from "./bits";
import type { InboxLabel } from "./types";

/**
 * Gmail's "Label as" (l) and "Move to" (v): a search box over the labels, ticks that can be half on when only some of
 * the picked conversations carry a label, and "Create new".
 */

const byName = (a: InboxLabel, b: InboxLabel) => a.name.localeCompare(b.name);

function useUserLabels() {
  const { meta } = useMailbox();
  return (meta?.labels ?? []).filter((l) => l.type === "user" && !l.hidden).sort(byName);
}

function LabelList({ ids, labelsOf, onDone }: { ids: string[]; labelsOf: (id: string) => string[]; onDone: () => void }) {
  const { actions, prompt, reloadMeta } = useMailbox();
  const api = useInboxApi();
  const labels = useUserLabels();
  const [q, setQ] = useState("");
  const [choice, setChoice] = useState<Record<string, boolean>>({});
  const state = (id: string) => {
    const n = ids.filter((t) => labelsOf(t).includes(id)).length;
    return n === 0 ? "none" : n === ids.length ? "all" : "some";
  };
  const shown = labels.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()));
  const changed = Object.keys(choice).length > 0;
  const apply = () => {
    const add = Object.entries(choice).filter(([id, on]) => on && state(id) !== "all").map(([id]) => id);
    const remove = Object.entries(choice).filter(([id, on]) => !on && state(id) !== "none").map(([id]) => id);
    actions.labels(ids, add, remove);
    onDone();
  };
  const create = async () => {
    onDone();
    const name = await prompt({ title: "New label", label: "Please enter a new label name", initial: q.trim(), action: "Create" });
    if (!name) return;
    try {
      const l = await api.createLabel(name);
      reloadMeta();
      actions.labels(ids, [l.id], []);
    } catch (e) {
      toast.error(errMsg(e, "The label wasn't made."));
    }
  };
  return (
    <div className="grid gap-2">
      <p className="px-1 text-xs font-medium text-ink-3">Label as:</p>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search labels" onKeyDown={(e) => { if (e.key === "Enter" && changed) apply(); }}
        className="h-8 w-full rounded-lg border border-line-strong bg-panel px-2.5 text-sm outline-none placeholder:text-ink-3 focus-visible:border-accent" />
      <div className="max-h-64 overflow-y-auto">
        {shown.map((l) => {
          const s = state(l.id);
          const on = choice[l.id] ?? s === "all";
          return (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-panel-2">
              <input type="checkbox" className="size-4 accent-accent" checked={on}
                ref={(el) => { if (el) el.indeterminate = choice[l.id] === undefined && s === "some"; }}
                onChange={() => setChoice((c) => ({ ...c, [l.id]: !on }))} />
              {l.glyph >= 0 && <span aria-hidden className={`size-2 shrink-0 rounded-full ${GLYPH_DOT[l.glyph]}`} />}
              <span className="truncate">{l.name}</span>
            </label>
          );
        })}
        {!shown.length && <p className="px-1.5 py-1 text-sm text-ink-3">{labels.length ? "No label by that name." : "No labels yet."}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <Button variant="ghost" size="sm" onClick={() => void create()}><PlusIcon />Create new</Button>
        <Button size="sm" disabled={!changed} onClick={apply}>Apply</Button>
      </div>
    </div>
  );
}

export function LabelPicker({ ids, labelsOf, open, onOpenChange, trigger }: { ids: string[]; labelsOf: (id: string) => string[]; open: boolean; onOpenChange: (o: boolean) => void; trigger?: ReactElement }) {
  return (
    <Popover open={open && ids.length > 0} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger ?? <Button variant="ghost" size="icon-sm" aria-label="Labels" title="Labels (l)" disabled={!ids.length} />}><TagIcon /></PopoverTrigger>
      <PopoverContent align="start" className="w-64">{open && <LabelList ids={ids} labelsOf={labelsOf} onDone={() => onOpenChange(false)} />}</PopoverContent>
    </Popover>
  );
}

function MoveList({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { actions, viewLabel } = useMailbox();
  const labels = useUserLabels();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const places = [
    ...(viewLabel !== "INBOX" ? [{ id: "INBOX", name: "Inbox", icon: <InboxIcon className="size-4" /> }] : []),
    ...labels.filter((l) => l.id !== viewLabel).map((l) => ({ id: l.id, name: l.name, icon: <TagIcon className="size-4" /> })),
    { id: "SPAM", name: "Spam", icon: <OctagonAlertIcon className="size-4" /> },
    { id: "TRASH", name: "Trash", icon: <Trash2Icon className="size-4" /> },
  ].filter((p) => p.name.toLowerCase().includes(t));
  const go = (id: string) => {
    actions.move(ids, id);
    onDone();
  };
  return (
    <div className="grid gap-2">
      <p className="px-1 text-xs font-medium text-ink-3">Move to:</p>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" onKeyDown={(e) => { if (e.key === "Enter" && places[0]) go(places[0].id); }}
        className="h-8 w-full rounded-lg border border-line-strong bg-panel px-2.5 text-sm outline-none placeholder:text-ink-3 focus-visible:border-accent" />
      <div className="max-h-64 overflow-y-auto">
        {places.map((p) => (
          <button key={p.id} type="button" onClick={() => go(p.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-panel-2">
            <span className="text-ink-3">{p.icon}</span><span className="truncate">{p.name}</span>
          </button>
        ))}
        {!places.length && <p className="px-1.5 py-1 text-sm text-ink-3">Nowhere by that name.</p>}
      </div>
    </div>
  );
}

export function MovePicker({ ids, open, onOpenChange }: { ids: string[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Popover open={open && ids.length > 0} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Move to" title="Move to (v)" disabled={!ids.length} />}><FolderInputIcon /></PopoverTrigger>
      <PopoverContent align="start" className="w-64">{open && <MoveList ids={ids} onDone={() => onOpenChange(false)} />}</PopoverContent>
    </Popover>
  );
}
