"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { KeyboardIcon, MenuIcon, PencilIcon, SettingsIcon } from "lucide-react";
import { useZone } from "@/features/inbox/use-zone";
import { Button } from "@/components/kit/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/kit/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/kit/sheet";
import { errMsg } from "@/features/inbox/errors";
import { SYSTEM_VIEWS, parseRoute, routeHash, viewKey, type Addr, type Route, type View } from "@/lib/inbox-mail";
import { InboxFetchError, useInboxApi, type ListQuery } from "./api";
import { Mailbox as MailboxContext, type Actions, type MailboxCtx } from "./context";
import { disconnectInbox } from "./actions";
import { plural } from "./format";
import { Setup } from "./setup";
import { Rail } from "./rail";
import { ListView } from "./list-view";
import { ThreadView } from "./thread-view";
import { ComposeWindow, type ComposeWin } from "./compose";
import { SearchBar } from "./search-bar";
import { AskDialog, PromptDialog, ShortcutsDialog } from "./dialogs";
import type { ComposeSeed, InboxMeta, InboxState, NotReady, Thread, ThreadPage, ThreadRow } from "./types";

/**
 * Admin → Inbox (Ben, 2026-10-28: "Give me inbox in admin that allows me to basically treat that tab as my entire Gmail
 * for business@, support@ and ben@. All UI inlcluded, same as Gmail, in our design system."): Gmail's own layout and
 * behaviour on the app's light design. The address bar's hash is Gmail's (#inbox, #label/…, #search/…, a conversation's
 * id after it), so Back and Forward work and nothing reloads the page; lists, conversations and the rail's counts are
 * kept here and read again only when the mailbox's history id moves (the 15-second poll, api/admin/inbox/pulse).
 * Every change shows at once and is undone with z or the toast's Undo, as in Gmail; sending waits five seconds for Undo.
 */

type Initial = { meta: InboxMeta; page: ThreadPage } | null;
type Entry = ThreadPage & { at: number; view: View };
type Patch = { add?: string[]; remove?: string[]; drop?: boolean };

const STALE_MS = 60_000;
const listKey = (v: View, page: number) => `${viewKey(v)}|${page}`;
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const PREFS = "inbox:prefs";
type Prefs = { density: "comfortable" | "compact"; pane: "none" | "right"; rail: boolean };
const DEFAULT_PREFS: Prefs = { density: "comfortable", pane: "none", rail: true };
let prefsCache: { raw: string | null; value: Prefs } = { raw: null, value: DEFAULT_PREFS };
const readPrefs = (): Prefs => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFS);
  } catch { /* storage off */ }
  if (raw !== prefsCache.raw) {
    let value = DEFAULT_PREFS;
    try {
      value = { ...DEFAULT_PREFS, ...(JSON.parse(raw ?? "{}") as Partial<Prefs>) };
    } catch { /* a bad copy */ }
    prefsCache = { raw, value };
  }
  return prefsCache.value;
};
const prefListeners = new Set<() => void>();
const subscribePrefs = (cb: () => void) => {
  prefListeners.add(cb);
  return () => prefListeners.delete(cb);
};
const writePrefs = (p: Partial<Prefs>) => {
  try {
    localStorage.setItem(PREFS, JSON.stringify({ ...readPrefs(), ...p }));
  } catch { /* storage off */ }
  prefListeners.forEach((l) => l());
};

function patchLabels(ids: string[], p: Patch): string[] {
  const l = new Set(ids);
  p.add?.forEach((x) => l.add(x));
  p.remove?.forEach((x) => l.delete(x));
  return Array.from(l);
}
function patchRow(r: ThreadRow, p: Patch): ThreadRow {
  const labelIds = patchLabels(r.labelIds, p);
  return { ...r, labelIds, unread: labelIds.includes("UNREAD"), starred: labelIds.includes("STARRED"), important: labelIds.includes("IMPORTANT") };
}
function patchThread(t: Thread, p: Patch, only?: string[]): Thread {
  const messages = t.messages.map((m) => {
    if (only && !only.includes(m.id)) return m;
    const labelIds = patchLabels(m.labelIds, p);
    return { ...m, labelIds, unread: labelIds.includes("UNREAD"), starred: labelIds.includes("STARRED"), important: labelIds.includes("IMPORTANT") };
  });
  return { ...t, messages, labelIds: Array.from(new Set(messages.flatMap((m) => m.labelIds))) };
}

/** Whether a conversation still belongs in a list after a change: what Gmail would list there now. */
function belongs(v: View, r: ThreadRow, labelId: (name: string) => string | null): boolean {
  const l = new Set(r.labelIds);
  if (v.kind === "system" && v.key === "trash") return l.has("TRASH");
  if (v.kind === "system" && v.key === "spam") return l.has("SPAM") && !l.has("TRASH");
  const anywhere = v.kind === "search" && /\bin:(trash|spam|anywhere)\b/i.test(v.q);
  if ((l.has("TRASH") || l.has("SPAM")) && !anywhere) return false;
  if (v.kind === "system") {
    const sys = SYSTEM_VIEWS.find((s) => s.key === v.key);
    return v.key === "drafts" || !sys?.labelId || l.has(sys.labelId);
  }
  if (v.kind === "label") {
    const id = labelId(v.name);
    return !id || l.has(id);
  }
  return true;
}

export function InboxApp({ state, initial, initialError, now, notice = null }: { state: InboxState; initial: Initial; initialError: string | null; now: number; notice?: string | null }) {
  // "Revoked" only once it had been connected (the row keeps the address): a first Connect that failed is still "not yet".
  const [notReady, setNotReady] = useState<NotReady | null>(state.connected ? null : !state.configured ? "no_client" : state.error && state.email ? "revoked" : "not_connected");
  // Back from Google (app/api/admin/inbox/callback): said once, then the address is tidied.
  useEffect(() => {
    if (!notice) return;
    if (notice === "connected") toast.success("Gmail connected.");
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [notice]);
  if (notReady) return <Setup state={state} reason={notReady} notice={notice === "connected" ? null : notice} />;
  return <Mailbox initial={initial} initialError={initialError} serverNow={now} email={state.email ?? ""} onNotReady={setNotReady} />;
}

function Mailbox({ initial, initialError, serverNow, email, onNotReady }: { initial: Initial; initialError: string | null; serverNow: number; email: string; onNotReady: (r: NotReady) => void }) {
  const api = useInboxApi();
  const zone = useZone();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const route = useMemo(() => parseRoute(hash), [hash]);
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);
  const [now, setNow] = useState(serverNow);
  const [meta, setMeta] = useState<InboxMeta | null>(initial?.meta ?? null);
  const [metaError, setMetaError] = useState<string | null>(initialError);
  const [lists, setLists] = useState<Record<string, Entry>>(() => {
    const inbox: View = { kind: "system", key: "inbox" };
    return initial ? { [listKey(inbox, 1)]: { ...initial.page, at: serverNow, view: inbox } } : {};
  });
  const [listErrors, setListErrors] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [threadErrors, setThreadErrors] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{ view: string; keys: string[] }>({ view: "", keys: [] });
  const [cursor, setCursor] = useState<{ view: string; index: number }>({ view: "", index: 0 });
  const [wins, setWins] = useState<ComposeWin[]>([]);
  const [railSheet, setRailSheet] = useState(false);
  const [help, setHelp] = useState(false);
  const [picker, setPicker] = useState<"labels" | "move" | null>(null);
  const [askState, setAskState] = useState<{ q: { title: string; body?: string; action: string; danger?: boolean }; done: (ok: boolean) => void } | null>(null);
  const [promptState, setPromptState] = useState<{ q: { title: string; label: string; initial?: string; action: string }; done: (v: string | null) => void } | null>(null);
  const known = useRef(initial?.meta.historyId ?? "");
  const inflight = useRef(new Set<string>());
  const undoRef = useRef<(() => void) | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const prefix = useRef<{ key: string; at: number } | null>(null);
  const winSeq = useRef(0);

  const vk = viewKey(route.view);
  const key = listKey(route.view, route.page);
  const entry = lists[key];
  const rows = useMemo(() => entry?.rows ?? [], [entry]);
  const rowKey = (r: ThreadRow) => r.draftId ?? r.id;
  const selected = selection.view === vk ? selection.keys.filter((k) => rows.some((r) => rowKey(r) === k)) : [];
  const cursorIndex = cursor.view === vk ? Math.min(cursor.index, Math.max(0, rows.length - 1)) : 0;
  const labels = useMemo(() => meta?.labels ?? [], [meta]);
  const labelById = (id: string) => labels.find((l) => l.id === id);
  const labelIdByName = (name: string) => labels.find((l) => l.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  const mine = useMemo(() => new Set([email, ...(meta?.sendAs.map((s) => s.email) ?? [])].filter(Boolean)), [email, meta]);
  const viewLabel = route.view.kind === "system" ? (SYSTEM_VIEWS.find((s) => s.key === (route.view as { key: string }).key)?.labelId ?? null)
    : route.view.kind === "label" ? labelIdByName(route.view.name) : route.view.kind === "addr" ? "INBOX" : null;
  const findRow = (id: string): ThreadRow | undefined => rows.find((r) => r.id === id) ?? Object.values(lists).flatMap((e) => e.rows).find((r) => r.id === id);
  const queryOf = (v: View): ListQuery | null => {
    if (v.kind === "system") return { view: v.key };
    if (v.kind === "label") {
      const id = labelIdByName(v.name);
      return id ? { label: id } : null;
    }
    if (v.kind === "addr") return { addr: v.email };
    return { q: v.q };
  };

  const go = (r: Route) => {
    const h = routeHash(r);
    if (window.location.hash !== h) window.location.hash = h;
  };

  /* ───────────── reading ───────────── */

  const notReadyOf = (e: unknown) => (e instanceof InboxFetchError ? e.reason : null);

  // The current list: read when it's missing or older than a minute (kept on screen while it's read again).
  const pageToken = route.page > 1 ? lists[listKey(route.view, route.page - 1)]?.next : null;
  const labelsReady = route.view.kind !== "label" || !!meta;
  useEffect(() => {
    if (!labelsReady || inflight.current.has(key)) return;
    if (entry && Date.now() - entry.at < STALE_MS) return;
    if (route.page > 1 && !pageToken) {
      const h = routeHash({ view: route.view, thread: null, page: 1 });
      if (window.location.hash !== h) window.location.hash = h;
      return;
    }
    const q = queryOf(route.view);
    if (!q) {
      queueMicrotask(() => setListErrors((p) => ({ ...p, [key]: `There's no label called "${(route.view as { name: string }).name}".` })));
      return;
    }
    const view = route.view;
    inflight.current.add(key);
    api.list(q, pageToken ?? null).then(
      (page) => {
        setLists((p) => ({ ...p, [key]: { ...page, at: Date.now(), view } }));
        setListErrors((p) => (p[key] ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)) : p));
      },
      (e) => {
        const why = notReadyOf(e);
        if (why) onNotReady(why);
        else setListErrors((p) => ({ ...p, [key]: errMsg(e, "The list didn't load.") }));
      },
    ).finally(() => inflight.current.delete(key));
    // queryOf reads the labels, which `labelsReady` and `meta` stand for here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, entry, labelsReady, pageToken, api, meta]);

  // The open conversation: read when it isn't here, or its line says it changed since.
  const openId = route.thread;
  const openRow = openId ? findRow(openId) : undefined;
  const openThread = openId ? threads[openId] : undefined;
  const threadStale = !!openThread && !!openRow?.historyId && openThread.historyId !== openRow.historyId;

  const loadMeta = () => {
    void api.meta().then(
      (m) => {
        setMeta(m);
        setMetaError(null);
      },
      (e) => {
        const why = notReadyOf(e);
        if (why) onNotReady(why);
        else setMetaError(errMsg(e, "Gmail didn't answer."));
      },
    );
  };
  const softMeta = () => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(loadMeta, 900);
  };

  /** Everything read again: the lists kept on screen until their new copy comes, the counts, the open conversation. */
  /** A conversation read again where it stands: its old copy stays on screen (and a reply being written under it stays open). */
  const reloadThread = (id: string) => {
    if (inflight.current.has(`t:${id}`)) return;
    inflight.current.add(`t:${id}`);
    void api.thread(id).then(
      (t) => setThreads((p) => ({ ...p, [t.id]: t })),
      () => setThreads((p) => (p[id] ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== id)) : p)),
    ).finally(() => inflight.current.delete(`t:${id}`));
  };

  const refresh = () => {
    setLists((p) => Object.fromEntries(Object.entries(p).map(([k, e]) => [k, { ...e, at: 0 }])));
    setThreads((p) => (openId ? Object.fromEntries(Object.entries(p).filter(([k]) => k === openId)) : {}));
    if (openId) reloadThread(openId);
    softMeta();
  };

  const tick = useEffectEvent(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const { historyId } = await api.pulse();
      if (historyId && historyId !== known.current) {
        const first = !known.current;
        known.current = historyId;
        if (!first) refresh();
      }
    } catch (e) {
      const why = notReadyOf(e);
      if (why) onNotReady(why);
    }
  });
  const minute = useEffectEvent(() => setNow(Date.now()));
  const firstMeta = useEffectEvent(() => {
    if (!initial) loadMeta();
  });
  useEffect(() => {
    firstMeta();
    const poll = setInterval(() => void tick(), 15_000);
    const clock = setInterval(() => minute(), 30_000);
    const wake = () => {
      if (document.visibilityState === "visible") {
        minute();
        void tick();
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, []);

  /* ───────────── changing ───────────── */

  const apply = (ids: string[], p: Patch, only?: string[]) => {
    setLists((prev) => {
      const next: Record<string, Entry> = {};
      for (const [k, e] of Object.entries(prev)) {
        if (!e.rows.some((r) => ids.includes(r.id))) {
          next[k] = e;
          continue;
        }
        const kept = e.rows.flatMap((r) => {
          if (!ids.includes(r.id)) return [r];
          if (p.drop) return [];
          const nr = patchRow(r, p);
          return belongs(e.view, nr, labelIdByName) ? [nr] : [];
        });
        next[k] = { ...e, rows: kept, estimate: Math.max(kept.length, e.estimate - (e.rows.length - kept.length)) };
      }
      return next;
    });
    setThreads((prev) => {
      if (!ids.some((id) => prev[id])) return prev;
      const next = { ...prev };
      for (const id of ids) if (next[id]) next[id] = p.drop ? next[id] : patchThread(next[id], p, only);
      return next;
    });
  };

  /** Off the conversation when it leaves the view (Gmail's "go back to the list" after an archive or a delete). */
  const leaveIf = (ids: string[]) => {
    if (route.thread && ids.includes(route.thread)) go({ ...route, thread: null });
  };

  /**
   * A change sent to Gmail after it shows. `reload` for one that can bring conversations into the list on screen (Move to
   * Inbox, Not spam, an Undo): the lists are read again once Gmail has it, rather than at the next poll.
   */
  const run = (label: string | null, work: () => Promise<unknown>, undo?: () => void, reload = false) => {
    void work().then(
      () => {
        undoRef.current = undo ?? null;
        if (label) toast(label, undo ? { action: { label: "Undo", onClick: () => { undoRef.current = null; undo(); } } } : undefined);
        if (reload) setLists((p) => Object.fromEntries(Object.entries(p).map(([k, e]) => [k, { ...e, at: 0 }])));
        softMeta();
      },
      (e) => {
        toast.error(errMsg(e, "That didn't go through. Try again."));
        refresh();
      },
    );
  };

  const lastMessageOf = (id: string) => {
    const t = threads[id];
    const fromThread = t ? [...t.messages].reverse().find((m) => !m.draft)?.id : undefined;
    return fromThread ?? findRow(id)?.lastMessageId ?? "";
  };
  const conv = (ids: string[]) => plural(ids.length, "conversation");
  const markRead = (ids: string[]) => {
    apply(ids, { remove: ["UNREAD"] });
    run(null, () => api.modify(ids, [], ["UNREAD"]));
  };

  const ask = (q: { title: string; body?: string; action: string; danger?: boolean }) => new Promise<boolean>((done) => setAskState({ q, done }));
  const prompt = (q: { title: string; label: string; initial?: string; action: string }) => new Promise<string | null>((done) => setPromptState({ q, done }));

  const actions: Actions = {
    archive: (ids) => {
      apply(ids, { remove: ["INBOX"] });
      leaveIf(ids);
      run(`${conv(ids)} archived.`, () => api.modify(ids, [], ["INBOX"]), () => actions.toInbox(ids));
    },
    toInbox: (ids) => {
      const trashed = ids.filter((id) => findRow(id)?.labelIds.includes("TRASH") || threads[id]?.labelIds.includes("TRASH"));
      apply(ids, { add: ["INBOX"], remove: ["TRASH", "SPAM"] });
      leaveIf(ids.filter(() => route.view.kind === "system" && (route.view.key === "trash" || route.view.key === "spam")));
      run(`${conv(ids)} moved to Inbox.`, async () => {
        if (trashed.length) await api.trash(trashed, true);
        await api.modify(ids, ["INBOX"], ["SPAM"]);
      }, undefined, true);
    },
    trash: (ids) => {
      const hadInbox = ids.filter((id) => (findRow(id)?.labelIds ?? threads[id]?.labelIds ?? []).includes("INBOX"));
      apply(ids, { add: ["TRASH"] });
      leaveIf(ids);
      run(`${conv(ids)} moved to Trash.`, () => api.trash(ids, false), () => {
        apply(ids, { remove: ["TRASH"] });
        run("Action undone.", async () => {
          await api.trash(ids, true);
          if (hadInbox.length) await api.modify(hadInbox, ["INBOX"], []);
        }, undefined, true);
      });
    },
    forever: (ids) => {
      void ask({ title: `Delete ${ids.length === 1 ? "this conversation" : `${ids.length} conversations`} forever?`, body: "They're gone for good. This can't be undone.", action: "Delete forever", danger: true }).then((ok) => {
        if (!ok) return;
        apply(ids, { drop: true });
        leaveIf(ids);
        run(`${conv(ids)} deleted forever.`, () => api.deleteForever(ids));
      });
    },
    spam: (ids) => {
      apply(ids, { add: ["SPAM"], remove: ["INBOX"] });
      leaveIf(ids);
      run(`${conv(ids)} marked as spam.`, () => api.modify(ids, ["SPAM"], ["INBOX"]), () => actions.notSpam(ids));
    },
    notSpam: (ids) => {
      apply(ids, { add: ["INBOX"], remove: ["SPAM"] });
      leaveIf(ids.filter(() => route.view.kind === "system" && route.view.key === "spam"));
      run(`${conv(ids)} unmarked as spam.`, () => api.modify(ids, ["INBOX"], ["SPAM"]), undefined, true);
    },
    read: (ids) => {
      apply(ids, { remove: ["UNREAD"] });
      run(null, () => api.modify(ids, [], ["UNREAD"]), () => actions.unread(ids));
    },
    unread: (ids) => {
      const last = ids.map(lastMessageOf).filter(Boolean);
      apply(ids, { add: ["UNREAD"] }, last);
      leaveIf(ids);
      run(null, () => api.modifyMessages(last, ["UNREAD"], []), () => actions.read(ids));
    },
    star: (ids, on) => {
      if (on) {
        const last = ids.map(lastMessageOf).filter(Boolean);
        apply(ids, { add: ["STARRED"] }, last);
        run(null, () => api.modifyMessages(last, ["STARRED"], []), () => actions.star(ids, false), viewLabel === "STARRED");
      } else {
        apply(ids, { remove: ["STARRED"] });
        run(null, () => api.modify(ids, [], ["STARRED"]), () => actions.star(ids, true));
      }
    },
    important: (ids, on) => {
      apply(ids, on ? { add: ["IMPORTANT"] } : { remove: ["IMPORTANT"] });
      run(`${conv(ids)} marked as ${on ? "important" : "not important"}.`, () => api.modify(ids, on ? ["IMPORTANT"] : [], on ? [] : ["IMPORTANT"]), () => actions.important(ids, !on), on && viewLabel === "IMPORTANT");
    },
    labels: (ids, add, remove) => {
      if (!add.length && !remove.length) return;
      apply(ids, { add, remove });
      const names = (l: string[]) => l.map((id) => `"${labelById(id)?.name ?? id}"`).join(", ");
      const said = add.length ? `${conv(ids)} added to ${names(add)}.` : `${conv(ids)} removed from ${names(remove)}.`;
      run(said, () => api.modify(ids, add, remove), () => actions.labels(ids, remove, add), !!viewLabel && add.includes(viewLabel));
    },
    move: (ids, to) => {
      if (to === "TRASH") return actions.trash(ids);
      if (to === "SPAM") return actions.spam(ids);
      if (to === "INBOX") return actions.toInbox(ids);
      const from = viewLabel && (viewLabel === "INBOX" || viewLabel.startsWith("Label_")) && viewLabel !== to ? [viewLabel] : [];
      apply(ids, { add: [to], remove: from });
      leaveIf(ids.filter(() => from.length > 0));
      run(`${conv(ids)} moved to "${labelById(to)?.name ?? to}".`, () => api.modify(ids, [to], from), () => {
        apply(ids, { add: from, remove: [to] });
        run("Action undone.", () => api.modify(ids, from, [to]), undefined, true);
      });
    },
    starMessage: (threadId, messageId, on) => {
      apply([threadId], on ? { add: ["STARRED"] } : { remove: ["STARRED"] }, [messageId]);
      run(null, () => api.modifyMessages([messageId], on ? ["STARRED"] : [], on ? [] : ["STARRED"]));
    },
    unreadFrom: (threadId, messageIds) => {
      apply([threadId], { add: ["UNREAD"] }, messageIds);
      go({ ...route, thread: null });
      run(null, () => api.modifyMessages(messageIds, ["UNREAD"], []));
    },
    discardDrafts: (draftIds) => {
      setLists((prev) => Object.fromEntries(Object.entries(prev).map(([k, e]) => [k, e.rows.some((r) => r.draftId && draftIds.includes(r.draftId)) ? { ...e, rows: e.rows.filter((r) => !r.draftId || !draftIds.includes(r.draftId)) } : e])));
      run(draftIds.length === 1 ? "Draft discarded." : `${draftIds.length} drafts discarded.`, () => api.discardDrafts(draftIds, []));
    },
    empty: (which) => {
      void ask({ title: which === "TRASH" ? "Empty Trash now?" : "Delete all spam messages now?", body: "Every conversation there is deleted forever. This can't be undone.", action: which === "TRASH" ? "Empty Trash" : "Delete all", danger: true }).then((ok) => {
        if (!ok) return;
        setLists((prev) => Object.fromEntries(Object.entries(prev).map(([k, e]) => [k, e.view.kind === "system" && e.view.key === (which === "TRASH" ? "trash" : "spam") ? { ...e, rows: [], estimate: 0 } : e])));
        void api.empty(which).then(
          (r) => {
            toast(r.more ? `${r.deleted} messages deleted. More are left: empty it again.` : `${r.deleted === 1 ? "1 message" : `${r.deleted} messages`} deleted forever.`);
            refresh();
          },
          (e) => toast.error(errMsg(e, "That didn't go through.")),
        );
      });
    },
    refresh: () => {
      refresh();
      toast("Checking for new mail…", { duration: 1200 });
    },
    undo: () => {
      const u = undoRef.current;
      undoRef.current = null;
      if (u) u();
      else toast("Nothing to undo.");
    },
  };

  // The open conversation, read (and marked read) once the actions above exist.
  useEffect(() => {
    if (!openId || (openThread && !threadStale) || inflight.current.has(`t:${openId}`)) return;
    inflight.current.add(`t:${openId}`);
    api.thread(openId).then(
      (t) => {
        setThreads((p) => ({ ...p, [t.id]: t }));
        setThreadErrors((p) => (p[t.id] ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== t.id)) : p));
        if (t.messages.some((m) => m.unread)) markRead([t.id]);
      },
      (e) => {
        const why = notReadyOf(e);
        if (why) onNotReady(why);
        else setThreadErrors((p) => ({ ...p, [openId]: errMsg(e, "The conversation didn't load.") }));
      },
    ).finally(() => inflight.current.delete(`t:${openId}`));
    // markRead and onNotReady are the page's own; the read depends on the conversation alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, openThread, threadStale, api]);

  /* ───────────── writing ───────────── */

  const addWin = (w: Omit<ComposeWin, "key">) => {
    winSeq.current += 1;
    const win = { ...w, key: `w${winSeq.current}` };
    setWins((p) => {
      const others = w.inline ? p.filter((x) => x.inline !== w.inline) : p;
      const floating = others.filter((x) => !x.inline);
      // Gmail keeps three open at most; the oldest folds away.
      const folded = floating.length >= 3 ? others.map((x) => (x === floating[0] ? { ...x, minimized: true } : x)) : others;
      return [...folded, win];
    });
  };
  const open: MailboxCtx["open"] = {
    compose: (seed) => {
      const defaultFrom = route.view.kind === "addr" ? route.view.email : null;
      addWin({ seed: { draftId: null, threadId: null, from: defaultFrom, to: [], cc: [], bcc: [], subject: "", html: "", quote: null, files: [], inReplyTo: null, references: null, ...seed }, inline: null, minimized: false, maximized: false, fresh: true });
    },
    reply: (threadId, messageId, mode) => {
      void api.reply(messageId, mode, zone).then(
        (seed) => addWin({ seed, inline: threadId, minimized: false, maximized: false, fresh: true, mode }),
        (e) => toast.error(errMsg(e, "That message couldn't be opened for a reply.")),
      );
    },
    draft: (draftId, threadId) => {
      const already = wins.find((w) => w.seed.draftId === draftId);
      if (already) {
        setWins((p) => p.map((w) => (w.key === already.key ? { ...w, minimized: false } : w)));
        return;
      }
      void api.draft(draftId).then(
        (seed) => {
          const inline = threadId && route.thread === threadId && seed.inReplyTo ? threadId : null;
          addWin({ seed, inline, minimized: false, maximized: false, fresh: false });
        },
        (e) => toast.error(errMsg(e, "That draft couldn't be opened.")),
      );
    },
  };
  const closeWin = (k: string) => setWins((p) => p.filter((w) => w.key !== k));
  const patchWin = (k: string, p: Partial<ComposeWin>) => setWins((all) => all.map((w) => (w.key === k ? { ...w, ...p } : w)));

  /** A saved draft sent after five seconds, unless Undo (the toast's, or z) takes it back into its window first. */
  const sendLater = (draftId: string, uploads: string[], again: ComposeSeed) => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      pendingSends.delete(t);
      void api.send(draftId, uploads).then(
        (sent) => {
          toast("Message sent.", { action: { label: "View message", onClick: () => go({ view: { kind: "system", key: "sent" }, thread: sent.threadId, page: 1 }) } });
          refresh();
        },
        (e) => {
          toast.error(errMsg(e, "It didn't send. It's kept in Drafts."));
          addWin({ seed: again, inline: null, minimized: false, maximized: false, fresh: false });
        },
      );
    }, 5000);
    pendingSends.add(t);
    let shown: string | number = "";
    const undoSend = () => {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(t);
      pendingSends.delete(t);
      toast.dismiss(shown);
      toast("Sending undone.");
      addWin({ seed: again, inline: null, minimized: false, maximized: false, fresh: false });
    };
    undoRef.current = undoSend;
    shown = toast("Sending…", { duration: 5000, action: { label: "Undo", onClick: undoSend } });
  };

  const contacts = useMemo(() => {
    const seen = new Map<string, Addr>();
    const add = (a: Addr) => {
      const k = a.email.toLowerCase();
      if (!a.email.includes("@") || mine.has(k)) return;
      const prev = seen.get(k);
      if (!prev || (!prev.name && a.name)) seen.set(k, a);
    };
    for (const e of Object.values(lists)) for (const r of e.rows) [...r.people, ...r.to].forEach(add);
    for (const t of Object.values(threads)) for (const m of t.messages) [m.from, ...m.to, ...m.cc].forEach(add);
    return Array.from(seen.values());
  }, [lists, threads, mine]);

  /* ───────────── keys ───────────── */

  const targets = (): string[] => {
    if (route.thread) return [route.thread];
    if (selected.length) return selected.map((k) => rows.find((r) => rowKey(r) === k)?.id).filter((x): x is string => !!x);
    const r = rows[cursorIndex];
    return r ? [r.id] : [];
  };
  const openRowAt = (i: number) => {
    const r = rows[i];
    if (!r) return;
    if (r.draftId) return open.draft(r.draftId, r.id);
    if (r.unread) markRead([r.id]);
    setCursor({ view: vk, index: i });
    go({ ...route, thread: r.id });
  };
  const threadIndex = route.thread ? rows.findIndex((r) => r.id === route.thread) : -1;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target instanceof HTMLElement ? e.target : null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.closest("[data-compose], [role=menu], [role=dialog], [role=listbox]"))) return;
    if (askState || promptState || help || picker) return;
    const k = e.key;
    const pre = prefix.current && Date.now() - prefix.current.at < 1500 ? prefix.current.key : null;
    prefix.current = null;
    const done = () => e.preventDefault();
    if (pre === "g") {
      const to: Record<string, View> = { i: { kind: "system", key: "inbox" }, s: { kind: "system", key: "starred" }, t: { kind: "system", key: "sent" }, d: { kind: "system", key: "drafts" }, a: { kind: "system", key: "all" } };
      if (to[k]) {
        done();
        go({ view: to[k], thread: null, page: 1 });
      }
      return;
    }
    if (pre === "*") {
      const pick = (f: (r: ThreadRow) => boolean) => setSelection({ view: vk, keys: rows.filter(f).map(rowKey) });
      const sel: Record<string, (r: ThreadRow) => boolean> = { a: () => true, n: () => false, r: (r) => !r.unread, u: (r) => r.unread, s: (r) => r.starred, t: (r) => !r.starred };
      if (sel[k]) {
        done();
        pick(sel[k]);
      }
      return;
    }
    if (k === "g" || k === "*") {
      prefix.current = { key: k, at: Date.now() };
      return;
    }
    const ids = targets();
    const inThread = !!route.thread;
    switch (k) {
      case "c": done(); open.compose(); return;
      case "/": done(); searchRef.current?.focus(); return;
      case "?": done(); setHelp(true); return;
      case "z": done(); actions.undo(); return;
      case "N": done(); actions.refresh(); return;
      case "j":
      case "k": {
        done();
        const step = k === "j" ? 1 : -1;
        if (inThread) {
          const next = rows[threadIndex + step];
          if (next) openRowAt(threadIndex + step);
        } else setCursor({ view: vk, index: Math.min(Math.max(0, cursorIndex + step), Math.max(0, rows.length - 1)) });
        return;
      }
      case "o":
      case "Enter":
        if (!inThread) {
          done();
          openRowAt(cursorIndex);
        }
        return;
      case "u":
        if (inThread) {
          done();
          go({ ...route, thread: null });
        }
        return;
      case "x":
        if (!inThread && rows[cursorIndex]) {
          done();
          const rk = rowKey(rows[cursorIndex]);
          setSelection({ view: vk, keys: selected.includes(rk) ? selected.filter((s) => s !== rk) : [...selected, rk] });
        }
        return;
    }
    if (!ids.length) return;
    switch (k) {
      case "e": done(); return route.view.kind === "system" && route.view.key === "trash" ? actions.toInbox(ids) : actions.archive(ids);
      case "y": done(); return viewLabel && viewLabel !== "INBOX" && viewLabel.startsWith("Label_") ? actions.labels(ids, [], [viewLabel]) : actions.archive(ids);
      case "#": done(); return route.view.kind === "system" && (route.view.key === "trash" || route.view.key === "spam") ? actions.forever(ids) : actions.trash(ids);
      case "!": done(); return route.view.kind === "system" && route.view.key === "spam" ? actions.notSpam(ids) : actions.spam(ids);
      case "s": {
        done();
        const on = !ids.every((id) => findRow(id)?.starred ?? threads[id]?.messages.some((m) => m.starred));
        return actions.star(ids, on);
      }
      case "+":
      case "=": done(); return actions.important(ids, true);
      case "-": done(); return actions.important(ids, false);
      case "I": done(); return actions.read(ids);
      case "U": done(); return actions.unread(ids);
      case "l": done(); return setPicker("labels");
      case "v": done(); return setPicker("move");
      case "[":
      case "]":
        if (inThread) {
          done();
          const next = rows[threadIndex + (k === "]" ? 1 : -1)];
          actions.archive(ids);
          if (next) setTimeout(() => go({ ...route, thread: next.id }), 0);
        }
        return;
      case "r":
      case "a":
      case "f":
        if (inThread && openThread) {
          done();
          const last = [...openThread.messages].reverse().find((m) => !m.draft);
          if (last) open.reply(openThread.id, last.id, k === "r" ? "reply" : k === "a" ? "all" : "forward");
        }
        return;
    }
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingSends.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /* ───────────── the page ───────────── */

  const ctx: MailboxCtx = {
    meta, zone, now, route, go, labelById, labelIdByName, viewLabel, mine, actions, open, contacts: () => contacts,
    rowsById: findRow, ask, prompt, density: prefs.density, reloadMeta: loadMeta,
    invalidate: (threadId) => {
      if (threads[threadId]) reloadThread(threadId);
    },
  };
  const split = prefs.pane === "right";
  const listView = (
    <ListView
      entry={entry ?? null}
      error={listErrors[key] ?? null}
      selected={selected}
      setSelected={(keys) => setSelection({ view: vk, keys })}
      cursor={cursorIndex}
      onOpen={openRowAt}
      picker={route.thread ? null : picker}
      setPicker={setPicker}
      onRetry={() => setLists((p) => ({ ...p, [key]: { ...(p[key] ?? { rows: [], next: null, estimate: 0, view: route.view }), at: 0 } }))}
      compact={split}
    />
  );
  const threadView = route.thread ? (
    <ThreadView
      key={route.thread}
      id={route.thread}
      thread={openThread ?? null}
      row={openRow ?? null}
      error={threadErrors[route.thread] ?? null}
      position={{ index: threadIndex, total: entry?.estimate ?? rows.length, newer: threadIndex > 0 ? () => openRowAt(threadIndex - 1) : null, older: threadIndex >= 0 && threadIndex < rows.length - 1 ? () => openRowAt(threadIndex + 1) : null }}
      picker={picker}
      setPicker={setPicker}
      inline={wins.filter((w) => w.inline === route.thread)}
      renderWin={(w) => <ComposeWindow key={w.key} win={w} onClose={() => closeWin(w.key)} onPatch={(p) => patchWin(w.key, p)} onSend={sendLater} />}
    />
  ) : null;

  return (
    <MailboxContext.Provider value={ctx}>
      <div className="hs-inbox flex min-h-[calc(100dvh-9rem)] flex-col gap-2 md:h-full md:min-h-0">
        <header className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Main menu" title="Main menu" onClick={() => (window.matchMedia("(min-width: 768px)").matches ? writePrefs({ rail: !prefs.rail }) : setRailSheet(true))}>
            <MenuIcon />
          </Button>
          <SearchBar inputRef={searchRef} />
          <div className="ml-auto flex items-center gap-0.5">
            <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className="hidden sm:inline-flex" onClick={() => setHelp(true)}><KeyboardIcon /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" title="Settings" />}><SettingsIcon /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>{meta?.email ?? email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Density</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={prefs.density} onValueChange={(v) => writePrefs({ density: v as Prefs["density"] })}>
                  <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuLabel>Reading pane</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={prefs.pane} onValueChange={(v) => writePrefs({ pane: v as Prefs["pane"] })}>
                  <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">Right of inbox</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setHelp(true)}>Keyboard shortcuts</DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open("https://mail.google.com/mail/u/?authuser=" + encodeURIComponent(meta?.email ?? email), "_blank", "noopener")}>Open in Gmail</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => void ask({ title: "Disconnect Gmail?", body: "The Inbox stops reading the mailbox until you connect it again. Nothing in Gmail changes.", action: "Disconnect", danger: true }).then((ok) => {
                  if (!ok) return;
                  void disconnectInbox().then(() => onNotReady("not_connected"), (e) => toast.error(errMsg(e)));
                })}>Disconnect Gmail</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 gap-2">
          <Rail collapsed={!prefs.rail} className="hidden md:flex" error={metaError} onRetry={loadMeta} />
          <Sheet open={railSheet} onOpenChange={setRailSheet}>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Mailbox</SheetTitle>
              <Rail collapsed={false} className="flex h-full overflow-y-auto pt-3" error={metaError} onRetry={loadMeta} onPick={() => setRailSheet(false)} />
            </SheetContent>
          </Sheet>
          <main className="flex min-h-[70dvh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-panel shadow-sm md:min-h-0">
            {split ? (
              <div className="flex min-h-0 flex-1">
                <div className={`min-h-0 flex-col border-r lg:flex lg:w-[42%] lg:max-w-xl ${route.thread ? "hidden" : "flex w-full"}`}>{listView}</div>
                {threadView ?? <div className="hidden flex-1 items-center justify-center text-sm text-ink-3 lg:flex">No conversation selected</div>}
              </div>
            ) : (threadView ?? listView)}
          </main>
        </div>
      </div>
      {/* Gmail's phone Compose: a pill over the list, above the app's tab bar. */}
      {!route.thread && (
        <Button onClick={() => open.compose()} className="fixed bottom-24 right-4 z-30 h-12 rounded-2xl px-4 shadow-pop md:hidden"><PencilIcon className="size-5" />Compose</Button>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end justify-end gap-3 px-3 md:px-6">
        {wins.filter((w) => !w.inline).map((w) => (
          <ComposeWindow key={w.key} win={w} onClose={() => closeWin(w.key)} onPatch={(p) => patchWin(w.key, p)} onSend={sendLater} />
        ))}
      </div>
      <AskDialog state={askState} onDone={(ok) => { askState?.done(ok); setAskState(null); }} />
      <PromptDialog state={promptState} onDone={(v) => { promptState?.done(v); setPromptState(null); }} />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </MailboxContext.Provider>
  );
}

/** Sends waiting out their five seconds: leaving the page asks first while any are. */
const pendingSends = new Set<ReturnType<typeof setTimeout>>();
