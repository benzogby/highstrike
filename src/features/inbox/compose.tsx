"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BoldIcon, ForwardIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, Maximize2Icon, Minimize2Icon, MinusIcon, PaperclipIcon, RemoveFormattingIcon,
  ReplyAllIcon, ReplyIcon, SquareArrowOutUpRightIcon, StrikethroughIcon, TextQuoteIcon, Trash2Icon, TypeIcon, UnderlineIcon, XIcon,
} from "lucide-react";
import { Button } from "@/components/kit/button";
import { errMsg } from "@/features/inbox/errors";
import {
  COMPOSE_BACKUP_PREFIX, EMAIL, GMAIL_BUSY, backupStale, backupToRestore, composeBackupKey, escapeHtml, formatBytes, parseAddresses, saveCanRetry,
  uniqueAddrs, type Addr, type ComposeBackup,
} from "@/lib/inbox-mail";
import { useInboxApi } from "./api";
import { useMailbox } from "./context";
import { MessageFrame } from "./message-frame";
import { sanitizeForEditor, sanitizeMail } from "./sanitize";
import type { ComposeFile, ComposeSeed, DraftInput, SavedDraft } from "./types";

/**
 * Gmail's compose: a window at the bottom right (folded to its bar, or opened full size), or a reply under its
 * conversation. From picks one of the mailbox's addresses (Gmail's send-as: ben@, support@), each with its own
 * signature; To, Cc and Bcc take addresses as chips, suggesting people from the mail on screen; the body is a rich text
 * editor (bold, lists, links, a quote) whose HTML is the page's own; files upload straight to private storage. It saves
 * itself to Gmail's Drafts as you write. Send saves it once more and hands it to the page, which holds it five seconds for
 * Undo before Gmail sends it.
 *
 * A save Gmail turns away tries again by itself while the window is open, and what's written and not yet in Gmail is
 * kept in this browser, put back when its reply or draft opens again (2026-11-03: Gmail refused a reply's saves for its
 * quota, and leaving the conversation then saved the draft with an empty body).
 */

export type ComposeWin = { key: string; seed: ComposeSeed; inline: string | null; minimized: boolean; maximized: boolean; fresh: boolean; mode?: "reply" | "all" | "forward"; dirty?: boolean };
type UiFile = ComposeFile & { key: string; sent?: number; uploading?: boolean; error?: string };

const MAX_BYTES = 25 * 1024 * 1024;
/** How long a refused save waits before it tries again: Gmail's quota frees up within a minute. */
const RETRY_MS = [10_000, 20_000, 40_000, 60_000, 60_000, 120_000];

/**
 * Windows open now (and ones still saving as they leave), by their own id: a copy one of them keeps isn't put back into
 * another window as well (Reply clicked again while the reply before it is still saving).
 */
const live = new Set<string>();

/** This browser's copy (a private window or a full disk can refuse it). */
function stored(k: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null");
  } catch {
    return null;
  }
}
function store(k: string, v: ComposeBackup | null) {
  try {
    if (v) localStorage.setItem(k, JSON.stringify(v));
    else localStorage.removeItem(k);
  } catch { /* not kept */ }
}
function pruneBackups(now: number) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(COMPOSE_BACKUP_PREFIX) && backupStale(localStorage.getItem(k), now)) localStorage.removeItem(k);
    }
  } catch { /* nothing kept */ }
}

/** A body's words apart from its signature, read from an inert copy (nothing in it loads). */
function textOf(html: string): string {
  const t = document.createElement("template");
  t.innerHTML = html;
  t.content.querySelectorAll(".gmail_signature").forEach((s) => s.remove());
  return (t.content.textContent ?? "").trim() || (t.content.querySelector("img") ? "picture" : "");
}
const signatureHtml = (sig: string) => `<div class="gmail_signature">-- <br>${sanitizeForEditor(sig)}</div>`;
const stripUi = (f: UiFile): ComposeFile => (f.kind === "upload"
  ? { kind: "upload", path: f.path, name: f.name, type: f.type, size: f.size }
  : { kind: "gmail", messageId: f.messageId, id: f.id, name: f.name, type: f.type, size: f.size, cid: f.cid });

function AddressField({ label, value, onChange, onSubmit, autoFocus, extra }: { label: string; value: Addr[]; onChange: (v: Addr[]) => void; onSubmit: () => void; autoFocus?: boolean; extra?: ReactNode }) {
  const ctx = useMailbox();
  const [text, setText] = useState("");
  const [hi, setHi] = useState(0);
  const [focused, setFocused] = useState(false);
  const t = text.trim().toLowerCase();
  const sugg = t && focused
    ? ctx.contacts().filter((c) => (c.email.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)) && !value.some((v) => v.email.toLowerCase() === c.email.toLowerCase())).slice(0, 6)
    : [];
  const commit = (raw = text) => {
    const r = raw.trim().replace(/[,;]+$/, "");
    if (!r) return;
    const parsed = parseAddresses(r);
    onChange(uniqueAddrs([...value, ...(parsed.length ? parsed : [{ name: "", email: r }])]));
    setText("");
    setHi(0);
  };
  const pick = (a: Addr) => {
    onChange(uniqueAddrs([...value, a]));
    setText("");
    setHi(0);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      commit();
      setTimeout(onSubmit, 0);
    } else if ((e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") && (sugg.length || text.trim())) {
      e.preventDefault();
      if (sugg.length && (e.key === "Enter" || e.key === "Tab")) pick(sugg[Math.min(hi, sugg.length - 1)]);
      else commit();
    } else if (e.key === "ArrowDown" && sugg.length) {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, sugg.length - 1));
    } else if (e.key === "ArrowUp" && sugg.length) {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="relative flex flex-wrap items-center gap-1 border-b px-3 py-1.5 text-sm">
      <span className="mr-1 text-ink-3">{label}</span>
      {value.map((a) => {
        const ok = EMAIL.test(a.email);
        return (
          <span key={a.email} title={a.email} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${ok ? "bg-panel-2" : "border-down/40 bg-down/10 text-down"}`}>
            <span className="truncate">{a.name || a.email}</span>
            <button type="button" aria-label={`Remove ${a.email}`} className="rounded-full px-0.5 text-ink-3 hover:text-ink" onClick={() => onChange(value.filter((v) => v !== a))}>×</button>
          </span>
        );
      })}
      <input
        autoFocus={autoFocus}
        aria-label={label}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHi(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (text.includes("@")) commit();
        }}
        onKeyDown={onKey}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (pasted.includes("@") && /[,;\n<]/.test(pasted)) {
            e.preventDefault();
            commit(pasted.replace(/\n/g, ","));
          }
        }}
        className="min-w-24 flex-1 bg-transparent py-0.5 outline-none"
      />
      {extra}
      {sugg.length > 0 && (
        <div role="listbox" className="absolute left-10 top-full z-20 mt-1 w-[min(22rem,calc(100%-3rem))] overflow-hidden rounded-lg bg-panel p-1 shadow-pop ring-1 ring-ink/10">
          {sugg.map((a, i) => (
            <button key={a.email} type="button" role="option" aria-selected={i === hi} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)}
              className={`flex w-full flex-col rounded-md px-2 py-1 text-left ${i === hi ? "bg-panel-2" : "hover:bg-panel-2"}`}>
              <span className="truncate text-sm">{a.name || a.email}</span>
              {a.name && <span className="truncate text-xs text-ink-3">{a.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FormatBar({ run }: { run: (cmd: string, arg?: string) => void }) {
  const b = (label: string, icon: ReactNode, cmd: string, arg?: string) => (
    <Button key={label} variant="ghost" size="icon-sm" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={() => run(cmd, arg)}>{icon}</Button>
  );
  return (
    <div className="mx-3 mb-1 flex flex-wrap items-center gap-0.5 rounded-lg border bg-panel px-1 py-0.5 shadow-sm">
      {b("Bold (⌘B)", <BoldIcon />, "bold")}
      {b("Italic (⌘I)", <ItalicIcon />, "italic")}
      {b("Underline (⌘U)", <UnderlineIcon />, "underline")}
      {b("Strikethrough", <StrikethroughIcon />, "strikeThrough")}
      <span aria-hidden className="mx-1 h-4 w-px bg-line" />
      {b("Bulleted list", <ListIcon />, "insertUnorderedList")}
      {b("Numbered list", <ListOrderedIcon />, "insertOrderedList")}
      {b("Quote", <TextQuoteIcon />, "formatBlock", "blockquote")}
      <span aria-hidden className="mx-1 h-4 w-px bg-line" />
      {b("Remove formatting", <RemoveFormattingIcon />, "removeFormat")}
    </div>
  );
}

export function ComposeWindow({ win, onClose, onPatch, onSend }: { win: ComposeWin; onClose: () => void; onPatch: (p: Partial<ComposeWin>) => void; onSend: (draftId: string, uploads: string[], again: ComposeSeed) => void }) {
  const ctx = useMailbox();
  const api = useInboxApi();
  const seed = win.seed;
  const sendAs = useMemo(() => ctx.meta?.sendAs ?? [], [ctx.meta]);
  const [from, setFrom] = useState(() => {
    const want = seed.from?.toLowerCase();
    return (want && sendAs.some((s) => s.email === want) ? want : null) ?? sendAs.find((s) => s.isDefault)?.email ?? sendAs[0]?.email ?? want ?? "";
  });
  const [to, setTo] = useState<Addr[]>(seed.to);
  const [cc, setCc] = useState<Addr[]>(seed.cc);
  const [bcc, setBcc] = useState<Addr[]>(seed.bcc);
  const [showCc, setShowCc] = useState(seed.cc.length > 0);
  const [showBcc, setShowBcc] = useState(seed.bcc.length > 0);
  const [subject, setSubject] = useState(seed.subject);
  const [files, setFiles] = useState<UiFile[]>(() => seed.files.map((f, i) => ({ ...f, key: `s${i}` })));
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "busy" | "retrying" | "error">(seed.draftId ? "saved" : "");
  const [failNote, setFailNote] = useState("");
  const [restored, setRestored] = useState(false);
  const [format, setFormat] = useState(false);
  const [sending, setSending] = useState(false);
  const [self] = useState(() => Math.random().toString(36).slice(2));
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = useRef({ draftId: seed.draftId, threadId: seed.threadId });
  const edits = useRef(0);
  const savedAt = useRef(0);
  const saving = useRef<Promise<SavedDraft | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<{ timer: ReturnType<typeof setTimeout> | null; n: number }>({ timer: null, n: 0 });
  const keepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);
  const gone = useRef(false);
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileSeq = useRef(0);
  // The body's last HTML: React has let go of the editor by the time a window that's gone saves (it saved "" until 2026-11-03).
  const lastHtml = useRef(seed.html ?? "");
  // When the mailbox's addresses came after the window opened, it goes out from the default one.
  const fromNow = from || sendAs.find((s) => s.isDefault)?.email || sendAs[0]?.email || "";
  const latest = useRef({ from: fromNow, to, cc, bcc, subject, files });
  useLayoutEffect(() => {
    latest.current = { from: fromNow, to, cc, bcc, subject, files };
  });

  /** The body as written: the editor's, or its last once the editor has gone (a reply saving as it leaves its conversation). */
  const bodyHtml = () => editor.current?.innerHTML ?? lastHtml.current;
  /** What's written so far, as the server saves it. */
  const input = (): DraftInput => {
    const l = latest.current;
    return {
      draftId: ids.current.draftId, threadId: ids.current.threadId, from: l.from, to: l.to, cc: l.cc, bcc: l.bcc, subject: l.subject,
      html: bodyHtml(), quote: seed.quote, inReplyTo: seed.inReplyTo, references: seed.references,
      files: l.files.filter((f) => !f.uploading && !f.error && (f.kind === "gmail" || f.path)).map(stripUi),
    };
  };
  const bodyText = () => textOf(bodyHtml());
  const blank = (i: DraftInput) => !i.to.length && !i.cc.length && !i.bcc.length && !i.subject.trim() && !bodyText() && !i.files.some((f) => f.kind === "upload");

  /** Where this window's copy is kept in this browser (lib/inbox-mail.ts → composeBackupKey): its draft, else its conversation. */
  const keptAt = () => composeBackupKey({ draftId: ids.current.draftId, threadId: ids.current.threadId ?? seed.threadId, forward: win.mode === "forward" });
  /** What's written and not in Gmail yet, kept in this browser until it is (an empty body keeps nothing). */
  const keep = () => {
    if (keepTimer.current) {
      clearTimeout(keepTimer.current);
      keepTimer.current = null;
    }
    const k = keptAt();
    if (!k || edits.current === savedAt.current) return;
    const html = bodyHtml();
    const text = textOf(html);
    const l = latest.current;
    store(k, text ? { html, text, subject: l.subject, to: l.to, cc: l.cc, bcc: l.bcc, at: Date.now(), owner: self } : null);
  };

  const save = async (): Promise<SavedDraft | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (retry.current.timer) {
      clearTimeout(retry.current.timer);
      retry.current.timer = null;
    }
    if (saving.current) await saving.current.catch(() => null);
    const at = edits.current;
    const i = input();
    if (!ids.current.draftId && blank(i)) return null;
    if (ids.current.draftId && at === savedAt.current) return { draftId: ids.current.draftId, messageId: "", threadId: ids.current.threadId ?? "" };
    setStatus("saving");
    const before = keptAt();
    const p = api.saveDraft(i).then(
      (saved) => {
        const first = !ids.current.draftId;
        ids.current = { draftId: saved.draftId, threadId: saved.threadId };
        savedAt.current = at;
        retry.current.n = 0;
        setFailNote("");
        setStatus(edits.current === at ? "saved" : "");
        // Gmail has it: the copy here goes (moved to the draft's own key when more was written meanwhile).
        for (const k of new Set([before, keptAt()])) if (k) store(k, null);
        if (edits.current !== at) keep();
        if (first && !closed.current) onPatch({ seed: { ...seed, draftId: saved.draftId, threadId: saved.threadId } });
        return saved;
      },
      (e) => {
        // Gmail busy for a minute (or the site not answering): it tries again by itself while the window's open.
        const why = errMsg(e, "It didn't save.");
        const again = saveCanRetry(e) && retry.current.n < RETRY_MS.length;
        setFailNote(why);
        setStatus(again ? (why === GMAIL_BUSY ? "busy" : "retrying") : "error");
        if (again) {
          retry.current.timer = setTimeout(() => {
            retry.current.timer = null;
            if (!closed.current && !gone.current) void save().catch(() => null);
          }, RETRY_MS[retry.current.n++]);
        }
        throw e;
      },
    );
    saving.current = p;
    try {
      return await p;
    } finally {
      if (saving.current === p) saving.current = null;
    }
  };

  const changed = () => {
    edits.current += 1;
    lastHtml.current = editor.current?.innerHTML ?? lastHtml.current;
    setStatus("");
    setFailNote("");
    if (timer.current) clearTimeout(timer.current);
    if (retry.current.timer) clearTimeout(retry.current.timer);
    retry.current = { timer: null, n: 0 };
    timer.current = setTimeout(() => void save().catch(() => null), latest.current.files.length ? 8000 : 2500);
    if (keepTimer.current) clearTimeout(keepTimer.current);
    keepTimer.current = setTimeout(keep, 400);
  };

  // The body, once: an opened draft's own HTML, or an empty line with the From address's signature under it.
  useEffect(() => {
    const el = editor.current;
    if (!el || el.dataset.ready) return;
    el.dataset.ready = "1";
    const sig = sendAs.find((s) => s.email === from)?.signature ?? "";
    el.innerHTML = seed.html ? sanitizeForEditor(seed.html) : `<div><br></div>${sig ? `<div><br></div>${signatureHtml(sig)}` : ""}`;
    lastHtml.current = el.innerHTML;
    // What was written here before and never reached Gmail (the page closed, or Gmail refused its saves) comes back,
    // unless a window open now is still keeping it.
    const now = Date.now();
    pruneBackups(now);
    const k = keptAt();
    const back = k ? backupToRestore(stored(k), { draftText: textOf(seed.html ?? ""), now }) : null;
    if (back && !live.has(back.owner)) {
      el.innerHTML = sanitizeForEditor(back.html);
      setTo(back.to);
      setCc(back.cc);
      setBcc(back.bcc);
      setSubject(back.subject);
      if (back.cc.length) setShowCc(true);
      if (back.bcc.length) setShowBcc(true);
      setRestored(true);
      changed();
    } else if (win.dirty) {
      // A reply popped out before its last words were saved: this window saves them.
      changed();
    }
    if (win.minimized) return;
    if (!seed.to.length && !win.inline && win.mode !== "reply" && win.mode !== "all") return;
    el.focus();
    const r = document.createRange();
    r.setStart(el, 0);
    r.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
    // Once, when the window opens: the body it starts with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A reply that leaves with its conversation (or a window when the page goes) is kept in Drafts, as Gmail keeps it, and in
  // this browser until Gmail has it.
  useEffect(() => {
    gone.current = false;
    live.add(self);
    if (leave.current) {
      clearTimeout(leave.current);
      leave.current = null;
    }
    return () => {
      gone.current = true;
      if (closed.current) {
        live.delete(self);
        return;
      }
      keep();
      leave.current = setTimeout(() => {
        if (edits.current !== savedAt.current) {
          void save()
            .catch(() => {
              const k = keptAt();
              toast.error(k && stored(k)
                ? "A message you were writing didn't save to Drafts. It's kept in this browser and comes back when you open it again."
                : "A message you were writing couldn't be saved to Drafts.");
            })
            .finally(() => live.delete(self));
        } else live.delete(self);
        onClose();
      }, 0);
    };
    // The window's own lifetime: save, keep and onClose read only refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeFrom = (email: string) => {
    setFrom(email);
    const el = editor.current;
    const sig = sendAs.find((s) => s.email === email)?.signature ?? "";
    const old = el?.querySelector(".gmail_signature");
    if (old) {
      if (sig) old.outerHTML = signatureHtml(sig);
      else old.remove();
    } else if (el && sig) el.insertAdjacentHTML("beforeend", `<div><br></div>${signatureHtml(sig)}`);
    changed();
  };

  const addFiles = (list: File[]) => {
    let total = latest.current.files.reduce((n, f) => n + f.size, 0);
    for (const file of list) {
      total += file.size;
      if (total > MAX_BYTES) {
        toast.error("Gmail takes at most 25 MB of files on one message.");
        return;
      }
      fileSeq.current += 1;
      const key = `u${fileSeq.current}`;
      setFiles((fs) => [...fs, { kind: "upload", key, path: "", name: file.name, type: file.type || "application/octet-stream", size: file.size, uploading: true, sent: 0 }]);
      void (async () => {
        try {
          const { url, path } = await api.uploadLink({ name: file.name, type: file.type, size: file.size });
          await api.put(url, file, (n) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, sent: n } : f))));
          setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, path, uploading: false } : f)));
          setTimeout(changed, 0);
        } catch (e) {
          setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, uploading: false, error: errMsg(e, "It didn't upload.") } : f)));
        }
      })();
    }
  };

  const run = (cmd: string, arg?: string) => {
    editor.current?.focus();
    document.execCommand(cmd, false, arg);
    changed();
  };
  const link = async () => {
    const sel = window.getSelection();
    const range = sel && sel.rangeCount && editor.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const raw = await ctx.prompt({ title: "Edit link", label: "Web address or email address", action: "OK" });
    if (!raw) return;
    const href = /^(https?:|mailto:)/i.test(raw) ? raw : raw.includes("@") && !raw.includes("/") ? `mailto:${raw}` : `https://${raw}`;
    editor.current?.focus();
    if (range) {
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    if (range && !range.collapsed) document.execCommand("createLink", false, href);
    else document.execCommand("insertHTML", false, `<a href="${escapeHtml(href)}">${escapeHtml(raw)}</a>`);
    changed();
  };

  const close = async () => {
    closed.current = true;
    try {
      await save();
    } catch (e) {
      closed.current = false;
      toast.error(errMsg(e, "The draft wasn't saved. Try again."));
      return;
    }
    if (win.inline) ctx.invalidate(win.inline);
    onClose();
  };

  const discard = async () => {
    closed.current = true;
    if (timer.current) clearTimeout(timer.current);
    if (keepTimer.current) clearTimeout(keepTimer.current);
    await saving.current?.catch(() => null);
    const k = keptAt();
    if (k) store(k, null);
    const uploads = latest.current.files.filter((f): f is UiFile & { kind: "upload" } => f.kind === "upload" && !!f.path).map((f) => f.path);
    const draftId = ids.current.draftId;
    onClose();
    if (!draftId && !uploads.length) return;
    try {
      await api.discardDrafts(draftId ? [draftId] : [], uploads);
      toast("Draft discarded.");
      if (win.inline) ctx.invalidate(win.inline);
    } catch (e) {
      toast.error(errMsg(e, "The draft wasn't discarded."));
    }
  };

  const popOut = async () => {
    await saving.current?.catch(() => null);
    closed.current = true;
    // The window it becomes saves what's left (dirty); this one's timers would save it a second time.
    for (const t of [timer, keepTimer]) if (t.current) clearTimeout(t.current);
    const l = latest.current;
    onPatch({
      inline: null, fresh: false, dirty: edits.current !== savedAt.current,
      seed: { ...seed, draftId: ids.current.draftId, threadId: ids.current.threadId, from: l.from, to: l.to, cc: l.cc, bcc: l.bcc, subject: l.subject, html: bodyHtml(), files: l.files.filter((f) => !f.uploading && !f.error).map(stripUi) },
    });
  };

  const send = async () => {
    if (sending) return;
    const l = latest.current;
    const everyone = [...l.to, ...l.cc, ...l.bcc];
    if (!everyone.length) return void toast.error("Please specify at least one recipient.");
    const bad = everyone.find((a) => !EMAIL.test(a.email));
    if (bad) return void toast.error(`The address "${bad.email}" isn't recognised. Please make sure that all addresses are properly formed.`);
    if (l.files.some((f) => f.uploading)) return void toast("Wait for the files to finish uploading.");
    if (l.files.some((f) => f.error)) return void toast.error("A file didn't upload. Remove it first.");
    if (!sendAs.some((s) => s.email === l.from)) return void toast.error("Pick who it's from.");
    if (!l.subject.trim() && !(await ctx.ask({ title: "Send this message without a subject?", action: "Send" }))) return;
    if (!bodyText() && !seed.quote && !l.files.length && !(await ctx.ask({ title: "Send this message without text in the body?", action: "Send" }))) return;
    setSending(true);
    let saved: SavedDraft | null;
    try {
      edits.current += 1;
      saved = await save();
    } catch (e) {
      setSending(false);
      return void toast.error(errMsg(e, "It couldn't be sent. It's kept here."));
    }
    if (!saved) return void setSending(false);
    const uploads = l.files.filter((f): f is UiFile & { kind: "upload" } => f.kind === "upload" && !!f.path).map((f) => f.path);
    const again: ComposeSeed = {
      ...seed, draftId: saved.draftId, threadId: saved.threadId, from: l.from, to: l.to, cc: l.cc, bcc: l.bcc, subject: l.subject,
      html: bodyHtml(), files: l.files.map(stripUi),
    };
    closed.current = true;
    onClose();
    if (win.inline) ctx.invalidate(win.inline);
    onSend(saved.draftId, uploads, again);
  };

  const keys = (e: KeyboardEvent<HTMLElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      setTimeout(() => void send(), 0);
    } else if (mod && e.shiftKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      setShowCc(true);
    } else if (mod && e.shiftKey && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      setShowBcc(true);
    } else if (mod && (e.key === "k" || e.key === "K") && editor.current?.contains(e.target as Node)) {
      e.preventDefault();
      void link();
    }
  };
  const paste = (e: ClipboardEvent<HTMLDivElement>) => {
    const pastedFiles = Array.from(e.clipboardData.files);
    if (pastedFiles.length) {
      e.preventDefault();
      addFiles(pastedFiles);
      return;
    }
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      document.execCommand("insertHTML", false, sanitizeForEditor(html));
    }
  };
  const drop = (e: DragEvent<HTMLElement>) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      addFiles(Array.from(e.dataTransfer.files));
      return;
    }
    // HTML dragged in from another page goes through the editor's own wall, as a paste does.
    const html = e.dataTransfer.getData("text/html");
    const el = editor.current;
    if (!html || !el || !el.contains(e.target as Node)) return;
    e.preventDefault();
    const at = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    el.focus();
    if (at) {
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(at);
    }
    document.execCommand("insertHTML", false, sanitizeForEditor(html));
    changed();
  };

  const quoteHtml = useMemo(() => (seed.quote && quoteOpen
    ? sanitizeMail(seed.quote, { showImages: false, origin: typeof window === "undefined" ? "" : window.location.origin, files: files.flatMap((f) => (f.kind === "gmail" && f.cid ? [{ messageId: f.messageId, id: f.id, name: f.name, type: f.type, size: f.size, cid: f.cid, inline: true }] : [])), fileUrl: (a) => api.fileUrl(a.messageId, a.id, a.name, true) }).html
    : ""), [seed.quote, quoteOpen, files, api]);
  const shownFiles = files.filter((f) => !(f.kind === "gmail" && f.cid));
  const title = subject.trim() || (win.mode === "forward" ? "Forward" : seed.inReplyTo ? "Reply" : "New Message");
  const statusText = { "": "", saving: "Saving…", saved: "Draft saved", busy: "Gmail's busy. Trying again…", retrying: "Not saved yet. Trying again…", error: "Couldn't save" }[status];

  const body = (
    <div className={`min-h-0 flex-1 flex-col ${win.minimized ? "hidden" : "flex"}`} onDragOver={(e) => e.preventDefault()} onDrop={drop}>
      {sendAs.length > 1 && (
        <label className="flex items-center gap-2 border-b px-3 py-1.5 text-sm">
          <span className="text-ink-3">From</span>
          <select value={fromNow} onChange={(e) => changeFrom(e.target.value)} className="min-w-0 flex-1 cursor-pointer bg-transparent outline-none">
            {sendAs.map((s) => <option key={s.email} value={s.email}>{s.name ? `${s.name} <${s.email}>` : s.email}</option>)}
          </select>
        </label>
      )}
      <AddressField label="To" value={to} onChange={(v) => { setTo(v); changed(); }} onSubmit={() => void send()} autoFocus={!seed.to.length && !win.minimized && !win.inline}
        extra={<span className="ml-auto flex gap-2 text-ink-3">
          {!showCc && <button type="button" className="hover:text-ink hover:underline" onClick={() => setShowCc(true)}>Cc</button>}
          {!showBcc && <button type="button" className="hover:text-ink hover:underline" onClick={() => setShowBcc(true)}>Bcc</button>}
        </span>} />
      {showCc && <AddressField label="Cc" value={cc} onChange={(v) => { setCc(v); changed(); }} onSubmit={() => void send()} />}
      {showBcc && <AddressField label="Bcc" value={bcc} onChange={(v) => { setBcc(v); changed(); }} onSubmit={() => void send()} />}
      {!win.inline && (
        <input value={subject} onChange={(e) => { setSubject(e.target.value); changed(); }} placeholder="Subject" aria-label="Subject"
          className="border-b bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-3" />
      )}
      <div className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 ${win.inline ? "max-h-[60dvh]" : ""}`}>
        {restored && (
          <p className="mb-2 flex items-center gap-2 rounded-md bg-panel-2 px-2 py-1 text-xs text-ink-3">
            <span className="min-w-0 flex-1">Brought back what you wrote here that hadn&apos;t saved.</span>
            <button type="button" aria-label="Hide" className="rounded px-1 hover:text-ink" onClick={() => setRestored(false)}>×</button>
          </p>
        )}
        <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Message Body" onInput={changed} onPaste={paste}
          className={`text-[14px] leading-relaxed outline-none [&_a]:text-accent-ink [&_a]:underline [&_blockquote]:border-l [&_blockquote]:pl-3 [&_blockquote]:text-ink-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 ${win.inline ? "min-h-28" : "min-h-40"}`} />
        {seed.quote && (
          <div className="mt-2">
            <button type="button" title={quoteOpen ? "Hide trimmed content" : "Show trimmed content"} onClick={() => setQuoteOpen((o) => !o)}
              className="rounded-md bg-panel-3 px-2 text-xs leading-4 tracking-widest text-ink-3 hover:text-ink">•••</button>
            {quoteOpen && <div className="mt-2 rounded-lg border p-2"><MessageFrame html={quoteHtml} images={false} /></div>}
          </div>
        )}
        {shownFiles.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {shownFiles.map((f) => (
              <div key={f.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${f.error ? "border-down/40 text-down" : "bg-panel-2/60"}`}>
                <PaperclipIcon className="size-3.5 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">{f.error ? f.error : f.uploading ? `${Math.round(((f.sent ?? 0) / Math.max(1, f.size)) * 100)}%` : formatBytes(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.name}`} className="rounded px-1 text-ink-3 hover:text-ink" onClick={() => { setFiles((fs) => fs.filter((x) => x.key !== f.key)); setTimeout(changed, 0); }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {format && <FormatBar run={run} />}
      <footer className="flex shrink-0 items-center gap-1 border-t px-3 py-2">
        <Button onClick={() => void send()} disabled={sending} title="Send (⌘Enter)" className="rounded-full px-5">{sending ? "Sending…" : "Send"}</Button>
        <Button variant="ghost" size="icon-sm" aria-label="Formatting options" title="Formatting options" aria-pressed={format} onClick={() => setFormat((f) => !f)}><TypeIcon /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Attach files" title="Attach files" onClick={() => fileInput.current?.click()}><PaperclipIcon /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Insert link" title="Insert link (⌘K)" onMouseDown={(e) => e.preventDefault()} onClick={() => void link()}><LinkIcon /></Button>
        <span className={`ml-auto truncate text-xs ${status === "error" ? "text-down" : "text-ink-3"}`} title={failNote || undefined} aria-live="polite">{statusText}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Discard draft" title="Discard draft" onClick={() => void discard()}><Trash2Icon /></Button>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </footer>
    </div>
  );

  if (win.inline) {
    const Icon = win.mode === "forward" ? ForwardIcon : win.mode === "all" ? ReplyAllIcon : ReplyIcon;
    return (
      <section data-compose aria-label={title} onKeyDown={keys} className="flex flex-col overflow-hidden rounded-2xl border bg-panel shadow-panel md:ml-12">
        <header className="flex h-10 items-center gap-2 border-b pl-3 pr-1.5 text-sm text-ink-3">
          <Icon className="size-4" />
          <span className="min-w-0 flex-1 truncate">{win.mode === "forward" ? "Forward" : win.mode === "all" ? "Reply all" : "Reply"}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Pop out reply" title="Pop out reply" onClick={() => void popOut()}><SquareArrowOutUpRightIcon /></Button>
          <Button variant="ghost" size="icon-xs" aria-label="Save and close" title="Save & close" onClick={() => void close()}><XIcon /></Button>
        </header>
        {body}
      </section>
    );
  }
  return (
    <>
      {win.maximized && <div aria-hidden className="pointer-events-auto fixed inset-0 z-40 bg-ink/20" onClick={() => onPatch({ maximized: false })} />}
      <section
        role="dialog"
        data-compose
        aria-label={title}
        onKeyDown={keys}
        className={`pointer-events-auto flex flex-col overflow-hidden border bg-panel shadow-pop ${
          win.maximized ? "fixed inset-3 z-50 rounded-2xl md:inset-x-[8%] md:inset-y-[6%]"
            : win.minimized ? "w-64 rounded-t-xl border-b-0"
            : "fixed inset-0 z-50 md:static md:z-auto md:h-[min(36rem,calc(100dvh-5rem))] md:w-[34rem] md:rounded-t-xl md:border-b-0"
        }`}
      >
        <header className="flex h-10 shrink-0 cursor-pointer items-center gap-1 bg-panel-2 pl-4 pr-1.5" onClick={() => onPatch({ minimized: !win.minimized, maximized: false })}>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
          <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-xs" aria-label={win.minimized ? "Open" : "Minimise"} title={win.minimized ? "Open" : "Minimise"} onClick={() => onPatch({ minimized: !win.minimized, maximized: false })}><MinusIcon /></Button>
            <Button variant="ghost" size="icon-xs" className="hidden md:inline-flex" aria-label={win.maximized ? "Exit full screen" : "Full screen"} title={win.maximized ? "Exit full screen" : "Full screen"} onClick={() => onPatch({ maximized: !win.maximized, minimized: false })}>
              {win.maximized ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Save and close" title="Save & close" onClick={() => void close()}><XIcon /></Button>
          </span>
        </header>
        {body}
      </section>
    </>
  );
}
