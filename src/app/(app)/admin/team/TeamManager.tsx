"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

const BUCKET = "site-assets";

type Member = {
  id: string;
  name: string;
  title: string;
  bio: string;
  photo_url: string | null;
  position: number;
  is_active: boolean;
};

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60";

function Photo({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      style={{ width: size, height: size }}
      className="flex-none rounded-full border border-line object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex flex-none items-center justify-center rounded-full bg-accent font-display text-lg font-bold uppercase text-bg"
    >
      {name.trim().slice(0, 2) || "?"}
    </span>
  );
}

export default function TeamManager() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "", title: "", bio: "" });
  const [editing, setEditing] = useState<Member | null>(null);
  const photoTarget = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("team_members")
      .select("id, name, title, bio, photo_url, position, is_active")
      .order("position")
      .order("created_at");
    setMembers((data ?? []) as Member[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy("add");
    setError("");
    const { error: err } = await supabaseBrowser().from("team_members").insert({
      name: draft.name.trim(),
      title: draft.title.trim(),
      bio: draft.bio.trim(),
      position: (members?.length ?? 0) + 1,
    });
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setDraft({ name: "", title: "", bio: "" });
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(editing.id);
    setError("");
    const { error: err } = await supabaseBrowser()
      .from("team_members")
      .update({
        name: editing.name.trim(),
        title: editing.title.trim(),
        bio: editing.bio.trim(),
      })
      .eq("id", editing.id);
    setBusy(null);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.name} from the team?`)) return;
    setBusy(m.id);
    await supabaseBrowser().from("team_members").delete().eq("id", m.id);
    setBusy(null);
    load();
  }

  async function move(m: Member, dir: -1 | 1) {
    if (!members) return;
    const idx = members.findIndex((x) => x.id === m.id);
    const other = members[idx + dir];
    if (!other) return;
    setBusy(m.id);
    const supabase = supabaseBrowser();
    await supabase.from("team_members").update({ position: other.position }).eq("id", m.id);
    await supabase.from("team_members").update({ position: m.position }).eq("id", other.id);
    setBusy(null);
    load();
  }

  async function uploadPhoto(file: File) {
    const id = photoTarget.current;
    if (!id) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB.");
      return;
    }
    setBusy(id);
    setError("");
    try {
      const supabase = supabaseBrowser();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `team/${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600" });
      if (upErr) throw upErr;
      const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      const { error: setErr } = await supabase
        .from("team_members")
        .update({ photo_url: url })
        .eq("id", id);
      if (setErr) throw setErr;
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
          Team
        </h2>
        <span className="text-xs text-ink-3">Shown publicly on /company</span>
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-down/40 bg-panel px-4 py-3 text-sm text-down">
          {error}
        </p>
      )}

      {/* Add member */}
      <form
        onSubmit={addMember}
        className="mt-4 grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-2"
      >
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Full name"
          aria-label="Name"
          className={inputClass}
          maxLength={80}
        />
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Title (e.g. Founder & CEO)"
          aria-label="Title"
          className={inputClass}
          maxLength={80}
        />
        <textarea
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          placeholder="Short description"
          aria-label="Description"
          rows={2}
          maxLength={400}
          className="w-full rounded-lg border border-line bg-panel-2 p-3 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy === "add" || !draft.name.trim()}
            className="rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
          >
            {busy === "add" ? "Adding…" : "Add team member"}
          </button>
        </div>
      </form>

      {/* Members */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadPhoto(f);
          e.target.value = "";
        }}
      />
      <ul className="mt-6 space-y-4">
        {(members ?? []).map((m, i) => (
          <li key={m.id} className="rounded-2xl border border-line bg-panel p-5">
            {editing?.id === m.id ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  aria-label="Name"
                  className={inputClass}
                  maxLength={80}
                />
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  aria-label="Title"
                  className={inputClass}
                  maxLength={80}
                />
                <textarea
                  value={editing.bio}
                  onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                  aria-label="Description"
                  rows={3}
                  maxLength={400}
                  className="w-full rounded-lg border border-line bg-panel-2 p-3 text-sm text-ink outline-none transition focus:border-accent/60 sm:col-span-2"
                />
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={busy === m.id}
                    className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg border border-line-strong px-4 py-2 font-display text-sm font-semibold text-ink-2 transition hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <Photo url={m.photo_url} name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold">{m.name}</p>
                  <p className="text-sm text-accent">{m.title}</p>
                  {m.bio && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{m.bio}</p>
                  )}
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={i === 0 || busy === m.id}
                    onClick={() => move(m, -1)}
                    aria-label="Move up"
                    className="rounded-lg border border-line px-2 py-1 text-xs text-ink-3 transition hover:text-ink disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === (members?.length ?? 0) - 1 || busy === m.id}
                    onClick={() => move(m, 1)}
                    aria-label="Move down"
                    className="rounded-lg border border-line px-2 py-1 text-xs text-ink-3 transition hover:text-ink disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      photoTarget.current = m.id;
                      fileRef.current?.click();
                    }}
                    disabled={busy === m.id}
                    className="rounded-lg border border-line-strong px-3 py-1 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
                  >
                    {m.photo_url ? "Replace photo" : "Upload photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    className="rounded-lg border border-line-strong px-3 py-1 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    disabled={busy === m.id}
                    className="rounded-lg border border-line-strong px-3 py-1 font-display text-xs font-semibold text-ink-2 transition hover:border-down/50 hover:text-down"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {members != null && members.length === 0 && (
          <li className="rounded-2xl border border-line bg-panel px-5 py-8 text-center text-sm text-ink-3">
            No team members yet — add the first one above.
          </li>
        )}
      </ul>
    </div>
  );
}
