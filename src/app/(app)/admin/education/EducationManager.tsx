"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import type { LessonKind, Module } from "@/lib/education";
import { clock, lessonHref, moduleLabel } from "@/lib/educationShared";
import NotesEditor from "./NotesEditor";
import type { PipelineProgress } from "./videoPipeline";

// Admin → Trading School (Ben, 2026-11-02: "Give me an education tab in admin panel to edit each lesson, including video
// uploads, and supporting text"). Modules and their lessons on the left (reorder, add); the chosen lesson on the right:
// title, module, notes, its video (upload, replace, remove, or a YouTube id) and its files. Every change goes through
// the admin routes in src/app/api/admin/education.

export type AdminLesson = { id: string; moduleId: string; title: string; kind: LessonKind; durationSec: number | null };

type Detail = {
  lesson: { id: string; moduleId: string; title: string; youtubeId: string | null; durationSec: number | null };
  body: unknown;
  video: { version: string; durationSec: number; resolution: string; poster: string | null } | null;
  files: { path: string; name: string; bytes: number; url: string | null }[];
};

const inputClass =
  "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60";
const smallButton =
  "rounded-lg border border-line-strong px-3 py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent disabled:opacity-50";
const dangerButton =
  "rounded-lg border border-line-strong px-3 py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-down/50 hover:text-down disabled:opacity-50";
const primaryButton =
  "rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60";

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json;
}
const lessonUrl = (id: string, rest = "") => `/api/admin/education/lessons/${encodeURIComponent(id)}${rest}`;

function KindMark({ lesson }: { lesson: AdminLesson }) {
  if (lesson.kind === "video") return <span className="shrink-0 font-mono-nums text-[11px] text-accent">▶ {lesson.durationSec ? clock(lesson.durationSec) : ""}</span>;
  if (lesson.kind === "youtube") return <span className="shrink-0 text-[11px] text-ink-3">YouTube</span>;
  if (lesson.kind === "processing") return <span className="shrink-0 text-[11px] text-ink-3">Video soon</span>;
  return <span className="shrink-0 text-[11px] text-ink-3">Notes</span>;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function EducationManager({ modules: initialModules, lessons: initialLessons }: { modules: Module[]; lessons: AdminLesson[] }) {
  const [modules, setModules] = useState(initialModules);
  const [lessons, setLessons] = useState(initialLessons);
  // A lesson picked from the address (?lesson=…) opens on load.
  const linkedId = useSearchParams().get("lesson");
  const linked = initialLessons.find((l) => l.id === linkedId) ?? null;
  const [selected, setSelected] = useState<string | null>(linked?.id ?? null);
  const [open, setOpen] = useState<Set<string>>(() => new Set([linked?.moduleId ?? initialModules[0]?.id ?? ""]));
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ moduleId: string; title: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  function pick(id: string | null) {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("lesson", id);
    else url.searchParams.delete("lesson");
    window.history.replaceState(null, "", url);
  }

  const byModule = useMemo(() => {
    const map = new Map<string, AdminLesson[]>(modules.map((m) => [m.id, []]));
    for (const l of lessons) map.get(l.moduleId)?.push(l);
    return map;
  }, [modules, lessons]);

  const q = filter.trim().toLowerCase();

  async function move(moduleId: string, id: string, by: -1 | 1) {
    const list = (byModule.get(moduleId) ?? []).map((l) => l.id);
    const i = list.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const rank = new Map(list.map((x, k) => [x, k]));
    const before = lessons;
    setLessons((all) => [...all].sort((a, b) => (a.moduleId === moduleId && b.moduleId === moduleId ? rank.get(a.id)! - rank.get(b.id)! : 0)));
    try {
      await call(`/api/admin/education/modules/${encodeURIComponent(moduleId)}`, "PATCH", { order: list });
    } catch (e) {
      setLessons(before);
      setError(e instanceof Error ? e.message : "Couldn't reorder.");
    }
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!adding?.title.trim()) return;
    setBusy("add");
    setError("");
    try {
      const { lesson } = (await call("/api/admin/education/lessons", "POST", adding)) as { lesson: AdminLesson & { youtubeId: null } };
      setLessons((all) => {
        const last = all.map((l) => l.moduleId).lastIndexOf(lesson.moduleId);
        const row: AdminLesson = { id: lesson.id, moduleId: lesson.moduleId, title: lesson.title, kind: "text", durationSec: null };
        return last < 0 ? [...all, row] : [...all.slice(0, last + 1), row, ...all.slice(last + 1)];
      });
      setAdding(null);
      pick(lesson.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the lesson.");
    } finally {
      setBusy(null);
    }
  }

  async function renameModule(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming?.title.trim()) return;
    setBusy(renaming.id);
    try {
      await call(`/api/admin/education/modules/${encodeURIComponent(renaming.id)}`, "PATCH", { title: renaming.title });
      setModules((all) => all.map((m) => (m.id === renaming.id ? { ...m, title: renaming.title.trim() } : m)));
      setRenaming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't rename the module.");
    } finally {
      setBusy(null);
    }
  }

  const current = lessons.find((l) => l.id === selected) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">Library</h2>
          <span className="text-xs text-ink-3">
            {modules.length} modules · {lessons.length} lessons
          </span>
        </div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a lesson…" aria-label="Find a lesson" className={`${inputClass} mt-3`} />
        <ul className="mt-3 space-y-2">
          {modules.map((m) => {
            const all = byModule.get(m.id) ?? [];
            const shown = q ? all.filter((l) => l.title.toLowerCase().includes(q)) : all;
            if (q && !shown.length) return null;
            const isOpen = q ? true : open.has(m.id);
            const label = moduleLabel(m.title);
            return (
              <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-panel">
                {renaming?.id === m.id ? (
                  <form onSubmit={renameModule} className="flex gap-2 p-2">
                    <input autoFocus value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} aria-label="Module title" maxLength={200} className={inputClass} />
                    <button type="submit" disabled={busy === m.id} className={smallButton}>Save</button>
                    <button type="button" onClick={() => setRenaming(null)} className={smallButton}>✕</button>
                  </form>
                ) : (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <span className={`text-[10px] text-ink-3 transition ${isOpen ? "rotate-90" : ""}`}>▶</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] uppercase tracking-wider text-ink-3">{label.eyebrow}</span>
                        <span className="block truncate font-display text-sm font-semibold text-ink">{label.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-3">{all.length}</span>
                    </button>
                    <button type="button" onClick={() => setRenaming({ id: m.id, title: m.title })} aria-label={`Rename ${m.title}`} title="Rename module" className="px-3 py-2 text-xs text-ink-3 hover:text-ink">
                      ✎
                    </button>
                  </div>
                )}
                {isOpen && (
                  <div className="border-t border-line">
                    <ol>
                      {shown.map((l) => {
                        const i = all.indexOf(l);
                        return (
                          <li key={l.id} className={`group flex items-center gap-1 border-l-2 pr-1 ${l.id === selected ? "border-accent bg-panel-2" : "border-transparent hover:bg-panel-2"}`}>
                            <button type="button" onClick={() => pick(l.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 text-left text-sm">
                              <span className="w-5 shrink-0 text-right font-mono-nums text-[11px] text-ink-3">{i + 1}</span>
                              <span className={`min-w-0 flex-1 truncate ${l.id === selected ? "text-ink" : "text-ink-2"}`}>{l.title}</span>
                              <KindMark lesson={l} />
                            </button>
                            {!q && (
                              <span className="flex shrink-0 opacity-60 group-hover:opacity-100">
                                <button type="button" disabled={i === 0} onClick={() => move(m.id, l.id, -1)} aria-label={`Move ${l.title} up`} className="px-1.5 py-1 text-xs text-ink-3 hover:text-ink disabled:opacity-30">↑</button>
                                <button type="button" disabled={i === all.length - 1} onClick={() => move(m.id, l.id, 1)} aria-label={`Move ${l.title} down`} className="px-1.5 py-1 text-xs text-ink-3 hover:text-ink disabled:opacity-30">↓</button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    {!q &&
                      (adding?.moduleId === m.id ? (
                        <form onSubmit={addLesson} className="flex gap-2 border-t border-line p-2">
                          <input autoFocus value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} placeholder="New lesson title" aria-label="New lesson title" maxLength={200} className={inputClass} />
                          <button type="submit" disabled={busy === "add" || !adding.title.trim()} className={smallButton}>Add</button>
                          <button type="button" onClick={() => setAdding(null)} className={smallButton}>✕</button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => setAdding({ moduleId: m.id, title: "" })} className="w-full border-t border-line px-3 py-2 text-left text-xs font-semibold text-accent hover:bg-panel-2">
                          + Add lesson
                        </button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0">
        {error && (
          <p className="mb-4 rounded-lg border border-down/40 bg-panel px-4 py-3 text-sm text-down">
            {error}{" "}
            <button type="button" onClick={() => setError("")} className="ml-2 text-xs text-ink-3 underline">dismiss</button>
          </p>
        )}
        {current ? (
          <LessonEditor
            key={current.id}
            lesson={current}
            modules={modules}
            onChange={(patch) => setLessons((all) => all.map((l) => (l.id === current.id ? { ...l, ...patch } : l)))}
            onMoved={(moduleId) => {
              setLessons((all) => [...all.filter((l) => l.id !== current.id), { ...current, moduleId }].sort((a, b) => modules.findIndex((m) => m.id === a.moduleId) - modules.findIndex((m) => m.id === b.moduleId)));
              setOpen((s) => new Set(s).add(moduleId));
            }}
            onDeleted={() => {
              setLessons((all) => all.filter((l) => l.id !== current.id));
              pick(null);
            }}
            onError={setError}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-ink-3">
            Pick a lesson on the left to edit its title, notes, video and files.
          </div>
        )}
      </section>
    </div>
  );
}

function LessonEditor({
  lesson,
  modules,
  onChange,
  onMoved,
  onDeleted,
  onError,
}: {
  lesson: AdminLesson;
  modules: Module[];
  onChange: (patch: Partial<AdminLesson>) => void;
  onMoved: (moduleId: string) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState(lesson.title);
  const [moduleId, setModuleId] = useState(lesson.moduleId);
  const [body, setBody] = useState<JSONContent | null | undefined>(undefined);
  const [youtube, setYoutube] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const d = (await call(lessonUrl(lesson.id), "GET")) as Detail;
    setDetail(d);
    setYoutube(d.lesson.youtubeId ?? "");
    return d;
  }

  useEffect(() => {
    let live = true;
    call(lessonUrl(lesson.id), "GET")
      .then((d: Detail) => {
        if (!live) return;
        setDetail(d);
        setYoutube(d.lesson.youtubeId ?? "");
      })
      .catch((e) => live && onError(e instanceof Error ? e.message : "Couldn't load the lesson."));
    return () => {
      live = false;
    };
    // Only when another lesson is picked (the editor remounts per lesson anyway).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const dirty = detail !== null && (title.trim() !== detail.lesson.title || moduleId !== detail.lesson.moduleId || body !== undefined);
  const uploading = progress !== null;

  // Leaving mid-upload would stop the conversion; leaving with unsaved notes would lose them.
  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  useEffect(() => () => abort.current?.abort(), []);

  async function save() {
    if (!detail) return;
    setBusy("save");
    onError("");
    try {
      const patch: Record<string, unknown> = {};
      if (title.trim() !== detail.lesson.title) patch.title = title;
      if (body !== undefined) patch.body = body;
      if (moduleId !== detail.lesson.moduleId) patch.moduleId = moduleId;
      await call(lessonUrl(lesson.id), "PATCH", patch);
      if (patch.title) onChange({ title: title.trim() });
      if (patch.moduleId) onMoved(moduleId);
      setDetail({ ...detail, body: body === undefined ? detail.body : body, lesson: { ...detail.lesson, title: title.trim(), moduleId } });
      setBody(undefined);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  async function saveYoutube() {
    setBusy("youtube");
    onError("");
    try {
      await call(lessonUrl(lesson.id), "PATCH", { youtubeId: youtube });
      const d = await load();
      onChange({ kind: d.video ? "video" : d.lesson.youtubeId ? "youtube" : d.lesson.durationSec ? "processing" : "text" });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save the YouTube video.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadVideo(file: File) {
    onError("");
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ stage: "loading", fraction: 0 });
    try {
      const { uploadLessonVideo } = await import("./videoPipeline");
      const durationSec = await uploadLessonVideo(lesson.id, file, setProgress, controller.signal);
      onChange({ kind: "video", durationSec });
      await load();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) onError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  }

  async function removeVideo() {
    if (!window.confirm("Remove this lesson's video? Members will see the notes only (or the YouTube video, if it has one).")) return;
    setBusy("video");
    onError("");
    try {
      await call(lessonUrl(lesson.id, "/video"), "DELETE");
      const d = await load();
      onChange({ kind: d.lesson.youtubeId ? "youtube" : "text", durationSec: null });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't remove the video.");
    } finally {
      setBusy(null);
    }
  }

  async function addFile(file: File) {
    setBusy("file");
    onError("");
    try {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const { LESSONS_BUCKET } = await import("@/lib/educationShared");
      const type = file.type || "application/octet-stream";
      const { path, token } = (await call(lessonUrl(lesson.id, "/files"), "POST", { action: "sign", filename: file.name, contentType: type, bytes: file.size })) as { path: string; token: string };
      const { error } = await supabaseBrowser().storage.from(LESSONS_BUCKET).uploadToSignedUrl(path, token, file, { contentType: type });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      await call(lessonUrl(lesson.id, "/files"), "POST", { action: "add", path, filename: file.name });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't add the file.");
    } finally {
      setBusy(null);
    }
  }

  async function removeFile(path: string, name: string) {
    if (!window.confirm(`Remove ${name} from this lesson?`)) return;
    setBusy("file");
    onError("");
    try {
      await call(lessonUrl(lesson.id, "/files"), "DELETE", { path });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't remove the file.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteLesson() {
    if (!window.confirm(`Delete "${lesson.title}" for good? Its video, notes and files go with it.`)) return;
    setBusy("delete");
    onError("");
    try {
      await call(lessonUrl(lesson.id), "DELETE");
      onDeleted();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't delete the lesson.");
      setBusy(null);
    }
  }

  const stageWords: Record<PipelineProgress["stage"], string> = {
    loading: "Loading the converter…",
    reading: "Reading the video…",
    converting: "Converting and uploading",
    publishing: "Publishing…",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          Lesson <span className="font-mono-nums">{lesson.id}</span>
        </p>
        <Link href={lessonHref(lesson.id)} target="_blank" className="text-xs font-semibold text-accent hover:underline">
          View as a member ↗
        </Link>
      </div>

      {/* Title, module, notes */}
      <div className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-3">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={`${inputClass} mt-1`} />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-3">Module</span>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={`${inputClass} mt-1`}>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wider text-ink-3">Notes</span>
          <div className="mt-1">{detail ? <NotesEditor initial={detail.body} onChange={setBody} /> : <div className="h-64 animate-pulse rounded-xl bg-panel-2" />}</div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={!dirty || busy === "save" || !title.trim()} className={primaryButton}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-xs text-accent">Saved — members see it now.</span>}
          {dirty && !saved && <span className="text-xs text-ink-3">Unsaved changes</span>}
        </div>
      </div>

      {/* Video */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">Video</h3>
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadVideo(f);
            e.target.value = "";
          }}
        />
        {detail?.video ? (
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {detail.video.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.video.poster} alt="" className="aspect-video w-56 rounded-lg border border-line object-cover" />
            ) : (
              <div className="grid aspect-video w-56 place-items-center rounded-lg border border-line bg-panel-2 text-xs text-ink-3">No poster</div>
            )}
            <div className="space-y-1 text-sm">
              <p className="text-ink">Our player · {clock(detail.video.durationSec)}</p>
              <p className="text-xs text-ink-3">{detail.video.resolution || "—"}</p>
              <div className="flex gap-2 pt-2">
                <button type="button" disabled={uploading || busy !== null} onClick={() => videoInput.current?.click()} className={smallButton}>Replace video</button>
                <button type="button" disabled={uploading || busy !== null} onClick={removeVideo} className={dangerButton}>Remove video</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <button type="button" disabled={uploading || !detail || busy !== null} onClick={() => videoInput.current?.click()} className={smallButton}>
              Upload a video
            </button>
            <p className="mt-2 text-xs text-ink-3">Any length or size. It plays in our own player, and replaces a YouTube video if the lesson has one.</p>
          </div>
        )}

        {progress && (
          <div className="mt-4 rounded-xl border border-line bg-panel-2 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink">
                {stageWords[progress.stage]}
                {progress.stage === "converting" ? ` · ${Math.round(progress.fraction * 100)}%` : ""}
              </span>
              <button type="button" onClick={() => abort.current?.abort()} className="text-ink-3 underline hover:text-down">Cancel</button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-3">Keep this tab open. It takes about as long as the video plays; members keep seeing the old version until it&apos;s done.</p>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <label className="block text-xs uppercase tracking-wider text-ink-3" htmlFor="yt">YouTube video {detail?.video ? "(used only without our video)" : ""}</label>
          <div className="mt-1 flex gap-2">
            <input id="yt" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="YouTube link or video id" className={inputClass} />
            <button type="button" disabled={!detail || busy !== null || youtube.trim() === (detail.lesson.youtubeId ?? "")} onClick={saveYoutube} className={smallButton}>
              {busy === "youtube" ? "Saving…" : youtube.trim() ? "Save" : "Clear"}
            </button>
          </div>
        </div>
      </div>

      {/* Files */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">Files</h3>
          <button type="button" disabled={!detail || busy !== null} onClick={() => fileInput.current?.click()} className={smallButton}>
            {busy === "file" ? "Working…" : "+ Add file"}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.txt,.csv,.zip,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.docx,.pptx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addFile(f);
            e.target.value = "";
          }}
        />
        <ul className="mt-3 divide-y divide-line">
          {(detail?.files ?? []).map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 py-2 text-sm">
              {f.url ? (
                <a href={f.url} className="min-w-0 truncate text-ink hover:text-accent">{f.name}</a>
              ) : (
                <span className="min-w-0 truncate text-ink">{f.name}</span>
              )}
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-ink-3">{kb(f.bytes)}</span>
                <button type="button" disabled={busy !== null} onClick={() => removeFile(f.path, f.name)} className="text-xs text-ink-3 hover:text-down">Remove</button>
              </span>
            </li>
          ))}
          {detail && !detail.files.length && <li className="py-2 text-sm text-ink-3">No files. PDFs, sheets, slides, docs, images or zips up to 50 MB.</li>}
        </ul>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={busy !== null || uploading} onClick={deleteLesson} className={dangerButton}>
          {busy === "delete" ? "Deleting…" : "Delete lesson"}
        </button>
      </div>
    </div>
  );
}
