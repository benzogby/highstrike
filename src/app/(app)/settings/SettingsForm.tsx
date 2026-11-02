"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseConfig";
import { toastSuccess } from "@/lib/toastBus";

const inputClass =
  "h-9 w-full rounded-lg border border-line bg-panel px-3 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";
const labelClass = "mb-1.5 block text-[13px] font-medium text-ink";


type Initial = {
  name: string;
  bio: string;
  avatarUrl: string | null;
};

export default function SettingsForm({
  userId,
  email,
  hasPassword,
  membership,
  initial,
}: {
  userId: string;
  email: string;
  hasPassword: boolean;
  /** What the account has: the $397 lifetime membership, or an admin's access. */
  membership: "lifetime" | "admin";
  initial: Initial;
}) {
  const router = useRouter();

  // Profile
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveProfile() {
    setProfileBusy(true);
    setProfileMsg(null);
    const { error } = await supabaseBrowser()
      .from("profiles")
      .update({ name: name.trim() || null, bio: bio.trim() || null })
      .eq("id", userId);
    setProfileBusy(false);
    if (error) {
      setProfileMsg({ ok: false, text: error.message });
      return;
    }
    toastSuccess("Profile saved");
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ ok: false, text: "Image must be under 5MB." });
      return;
    }
    setProfileBusy(true);
    setProfileMsg(null);
    try {
      const supabase = supabaseBrowser();
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600" });
      if (upErr) throw upErr;
      const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
      const { error: setErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (setErr) throw setErr;
      setAvatarUrl(url);
      toastSuccess("Profile photo updated");
      router.refresh();
    } catch (e) {
      setProfileMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setProfileBusy(false);
    }
  }

  async function removeAvatar() {
    setProfileBusy(true);
    setProfileMsg(null);
    const { error } = await supabaseBrowser()
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    setProfileBusy(false);
    if (error) {
      setProfileMsg({ ok: false, text: error.message });
      return;
    }
    setAvatarUrl(null);
    toastSuccess("Profile photo removed");
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.length < 8) {
      setPwMsg({ ok: false, text: "Password must be at least 8 characters." });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: "Passwords don't match." });
      return;
    }
    setPwBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) {
      setPwMsg({ ok: false, text: error.message });
      return;
    }
    setPw("");
    setPw2("");
    toastSuccess(hasPassword ? "Password updated" : "Password set — email sign-in now works too");
  }

  const displayName = name.trim() || email.split("@")[0];

  return (
    <div className="space-y-10">
      {/* Profile */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="font-display text-[15px] text-ink">
          Profile
        </h2>
        <div className="mt-5 flex flex-col gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile photo"
                className="h-24 w-24 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-2xl font-medium uppercase text-accent-ink">
                {displayName.slice(0, 2)}
              </span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-panel-2"
              >
                {avatarUrl ? "Replace" : "Upload"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={profileBusy}
                  onClick={removeAvatar}
                  className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-down/50 hover:text-down"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label htmlFor="set-name" className={labelClass}>
                Display name
              </label>
              <input
                id="set-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="set-email" className={labelClass}>
                Email
              </label>
              <input id="set-email" value={email} disabled className={`${inputClass} opacity-60`} />
            </div>
            <div>
              <label htmlFor="set-bio" className={labelClass}>
                Bio
              </label>
              <textarea
                id="set-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="A line or two about how you trade"
                className="w-full rounded-lg border border-line bg-panel p-3.5 text-sm leading-relaxed text-ink placeholder:text-ink-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <p className="mt-1 text-right text-xs text-ink-3">{bio.length}/300</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileBusy}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
              >
                {profileBusy ? "Saving…" : "Save profile"}
              </button>
              {profileMsg && (
                <span className={`text-sm ${profileMsg.ok ? "text-up" : "text-down"}`}>
                  {profileMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="font-display text-[15px] text-ink">
          Security
        </h2>
        {!hasPassword && (
          <p className="mt-3 rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm text-ink-2">
            You signed up with Google, so there&apos;s no password on this account yet. Setting one
            below adds email + password as a second way to sign in.
          </p>
        )}
        <form onSubmit={changePassword} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="set-pw" className={labelClass}>
              New password
            </label>
            <input
              id="set-pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="set-pw2" className={labelClass}>
              Confirm new password
            </label>
            <input
              id="set-pw2"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              placeholder="Same password again"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={pwBusy || !pw}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-2 disabled:opacity-60"
            >
              {pwBusy ? "Updating…" : hasPassword ? "Update password" : "Set password"}
            </button>
            {pwMsg && (
              <span className={`text-sm ${pwMsg.ok ? "text-up" : "text-down"}`}>{pwMsg.text}</span>
            )}
          </div>
        </form>
      </section>

      {/* Membership: one payment, nothing to manage */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="font-display text-[15px] text-ink">
          Membership
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
          <div>
            <p className="text-sm font-medium text-ink">
              {membership === "admin" ? "Admin access" : "Lifetime access"}
            </p>
            <p className="mt-0.5 text-sm text-ink-2">
              {membership === "admin"
                ? "Everything in HighStrike is open to this account."
                : "Paid once. The daily trades, the tools and HighStrike Trading School are yours, with nothing to renew."}
            </p>
          </div>
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">
            Active
          </span>
        </div>
        {membership === "lifetime" && (
          <p className="mt-3 text-sm text-ink-3">
            Stripe emailed your receipt when you paid. Questions about a payment go to{" "}
            <a href="mailto:support@highstrike.com" className="text-ink-2 underline-offset-2 hover:underline">
              support@highstrike.com
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}
