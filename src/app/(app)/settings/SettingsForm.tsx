"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUPABASE_URL } from "@/lib/supabaseConfig";

const inputClass =
  "h-11 w-full rounded-lg border border-line bg-panel-2 px-3.5 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-1 block text-[10px] uppercase tracking-wider text-ink-3";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "account only",
    blurb: "Waitlist access and the blog — terminal locked.",
  },
  {
    key: "monthly",
    name: "Monthly",
    price: "$99",
    cadence: "per month",
    blurb: "Full terminal access, billed monthly.",
  },
  {
    key: "annual",
    name: "Alpha (Annual)",
    price: "$79",
    cadence: "per month, billed annually",
    blurb: "Full terminal access at the founder rate.",
  },
  {
    key: "lifetime",
    name: "Lifetime",
    price: "$1,995",
    cadence: "one-time payment",
    blurb: "Permanent access, every future feature included.",
  },
] as const;

type Initial = {
  name: string;
  bio: string;
  avatarUrl: string | null;
  plan: string;
};

export default function SettingsForm({
  userId,
  email,
  hasPassword,
  billing,
  billingNotice,
  initial,
}: {
  userId: string;
  email: string;
  hasPassword: boolean;
  billing: boolean;
  billingNotice: "success" | "cancelled" | null;
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

  // Plan
  const [plan, setPlan] = useState(initial.plan);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    setProfileMsg({ ok: true, text: "Profile saved." });
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
      setProfileMsg({ ok: true, text: "Photo updated." });
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
    setProfileMsg({ ok: true, text: "Photo removed." });
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
    setPwMsg({ ok: true, text: hasPassword ? "Password updated." : "Password set — you can now sign in with email + password too." });
  }

  async function choosePlan(key: string) {
    if (key === plan) return;
    setPlanBusy(key);
    setPlanMsg(null);

    // Live billing: paid plans go through Stripe Checkout; downgrades go
    // through the customer portal (cancel there).
    if (billing && key !== "free") {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: key }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
        window.location.href = data.url;
        return;
      } catch (e) {
        setPlanBusy(null);
        setPlanMsg({ ok: false, text: e instanceof Error ? e.message : "Checkout failed" });
        return;
      }
    }
    if (billing && key === "free") {
      const opened = await openPortal(false);
      setPlanBusy(null);
      if (opened) return;
      // No Stripe customer yet (e.g. beta-era plan) — fall through to direct set.
    }

    const { error } = await supabaseBrowser()
      .from("profiles")
      .update({ plan: key })
      .eq("id", userId);
    setPlanBusy(null);
    if (error) {
      setPlanMsg({ ok: false, text: error.message });
      return;
    }
    setPlan(key);
    setPlanMsg({
      ok: true,
      text:
        key === "free"
          ? "Downgraded to Free."
          : `Plan set to ${PLANS.find((p) => p.key === key)?.name}.`,
    });
  }

  async function openPortal(report = true): Promise<boolean> {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing portal");
      window.location.href = data.url;
      return true;
    } catch (e) {
      if (report) {
        setPlanMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't open billing portal" });
      }
      return false;
    }
  }

  const displayName = name.trim() || email.split("@")[0];

  return (
    <div className="space-y-10">
      {/* Profile */}
      <section className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
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
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent font-display text-2xl font-bold uppercase text-bg">
                {displayName.slice(0, 2)}
              </span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={profileBusy}
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-lg border border-line-strong px-3 py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
              >
                {avatarUrl ? "Replace" : "Upload"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={profileBusy}
                  onClick={removeAvatar}
                  className="rounded-lg border border-line-strong px-3 py-1.5 font-display text-xs font-semibold text-ink-2 transition hover:border-down/50 hover:text-down"
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
                className="w-full rounded-lg border border-line bg-panel-2 p-3.5 text-sm leading-relaxed text-ink placeholder:text-ink-3 outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
              />
              <p className="mt-1 text-right text-[10px] text-ink-3">{bio.length}/300</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={profileBusy}
                className="rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
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
      <section className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
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
              className="rounded-lg bg-accent px-5 py-2 font-display text-sm font-semibold text-bg transition hover:bg-accent-2 disabled:opacity-60"
            >
              {pwBusy ? "Updating…" : hasPassword ? "Update password" : "Set password"}
            </button>
            {pwMsg && (
              <span className={`text-sm ${pwMsg.ok ? "text-up" : "text-down"}`}>{pwMsg.text}</span>
            )}
          </div>
        </form>
      </section>

      {/* Plan */}
      <section className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-2">
            Plan
          </h2>
          {planMsg && (
            <span className={`text-sm ${planMsg.ok ? "text-up" : "text-down"}`}>
              {planMsg.text}
            </span>
          )}
        </div>
        {billingNotice === "success" && (
          <p className="mt-3 rounded-lg border border-accent/40 bg-panel-2 px-4 py-3 text-sm text-ink">
            <span className="mr-2 text-up">✓</span>
            Payment received — your plan updates within a few seconds. Refresh if it
            hasn&apos;t switched yet.
          </p>
        )}
        {billingNotice === "cancelled" && (
          <p className="mt-3 rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm text-ink-2">
            Checkout cancelled — no charge was made.
          </p>
        )}
        {billing ? (
          <p className="mt-2 text-sm text-ink-2">
            Secure checkout and billing management are handled by Stripe.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            Billing isn&apos;t connected during the beta — plan changes apply to your
            account immediately and nothing is charged.
          </p>
        )}
        {billing && plan !== "free" && (
          <button
            type="button"
            onClick={() => openPortal()}
            className="mt-3 rounded-lg border border-line-strong px-4 py-2 font-display text-sm font-semibold text-ink-2 transition hover:border-accent/50 hover:text-accent"
          >
            Manage billing →
          </button>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
            const current = plan === p.key;
            return (
              <div
                key={p.key}
                className={`flex flex-col rounded-2xl border p-5 ${
                  current ? "border-accent bg-panel-2" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold">{p.name}</h3>
                  {current && (
                    <span className="rounded-full bg-accent px-2 py-0.5 font-display text-[10px] font-bold text-bg">
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="mt-1">
                  <span className="font-display text-2xl font-bold">{p.price}</span>
                  <span className="ml-1.5 text-xs text-ink-3">{p.cadence}</span>
                </p>
                <p className="mt-2 flex-1 text-sm text-ink-2">{p.blurb}</p>
                <button
                  type="button"
                  disabled={current || planBusy !== null}
                  onClick={() => choosePlan(p.key)}
                  className={`mt-4 rounded-lg py-2 font-display text-sm font-semibold transition disabled:opacity-60 ${
                    current
                      ? "border border-line text-ink-3"
                      : "bg-accent text-bg hover:bg-accent-2"
                  }`}
                >
                  {planBusy === p.key ? "Switching…" : current ? "Current plan" : `Switch to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
