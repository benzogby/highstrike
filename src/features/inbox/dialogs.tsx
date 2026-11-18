"use client";

import { useState } from "react";
import { Button } from "@/components/kit/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/kit/dialog";
import { Input } from "@/components/kit/input";

/** Admin → Inbox's questions: a yes or no before something that can't be undone, and a name for a label. */

type AskQ = { title: string; body?: string; action: string; danger?: boolean };

export function AskDialog({ state, onDone }: { state: { q: AskQ } | null; onDone: (ok: boolean) => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onDone(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.q.title}</DialogTitle>
          {state?.q.body && <DialogDescription>{state.q.body}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onDone(false)}>Cancel</Button>
          <Button variant={state?.q.danger ? "destructive" : "default"} autoFocus onClick={() => onDone(true)}>{state?.q.action}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PromptQ = { title: string; label: string; initial?: string; action: string };

function PromptForm({ q, onDone }: { q: PromptQ; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(q.initial ?? "");
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onDone(v.trim()); }}>
      <DialogHeader><DialogTitle>{q.title}</DialogTitle></DialogHeader>
      <label className="grid gap-1.5 text-sm">
        <span className="text-ink-3">{q.label}</span>
        <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} maxLength={225} />
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>Cancel</Button>
        <Button type="submit" disabled={!v.trim()}>{q.action}</Button>
      </DialogFooter>
    </form>
  );
}

export function PromptDialog({ state, onDone }: { state: { q: PromptQ } | null; onDone: (v: string | null) => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onDone(null); }}>
      <DialogContent>{state && <PromptForm key={state.q.title + (state.q.initial ?? "")} q={state.q} onDone={onDone} />}</DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  ["Write", [["c", "Compose"], ["r", "Reply"], ["a", "Reply all"], ["f", "Forward"], ["⌘ Enter", "Send (in a message)"], ["⌘ ⇧ C / ⌘ ⇧ B", "Add Cc / Bcc"]]],
  ["Move around", [["j / k", "Older / newer conversation"], ["o or Enter", "Open conversation"], ["u", "Back to the list"], ["/", "Search mail"], ["g then i", "Go to Inbox"], ["g then s", "Go to Starred"], ["g then t", "Go to Sent"], ["g then d", "Go to Drafts"], ["g then a", "Go to All mail"]]],
  ["Act", [["e", "Archive"], ["y", "Remove from this label"], ["#", "Delete"], ["!", "Report spam"], ["s", "Star or unstar"], ["+ / -", "Important / not important"], ["⇧ I / ⇧ U", "Mark read / unread"], ["l", "Label as"], ["v", "Move to"], ["[ / ]", "Archive and go newer / older"], ["z", "Undo"], ["⇧ N", "Check for new mail"]]],
  ["Select", [["x", "Select conversation"], ["* then a", "Select all"], ["* then n", "Select none"], ["* then r / u", "Select read / unread"], ["* then s / t", "Select starred / unstarred"]]],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle><DialogDescription>Gmail&apos;s own, everywhere in the Inbox except while you type.</DialogDescription></DialogHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUTS.map(([group, list]) => (
            <section key={group}>
              <p className="section-label mb-2">{group}</p>
              <dl className="grid gap-1.5">
                {list.map(([k, what]) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-ink-3">{what}</dt>
                    <dd><kbd className="rounded-md border bg-panel-2 px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
