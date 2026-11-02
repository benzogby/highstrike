"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import GoogleAuthButton, { AuthDivider } from "@/components/GoogleAuthButton";
import { authInputClass, authLabelClass } from "@/components/AuthShell";
import { LIFETIME_PRICE, type Library } from "@/lib/offer";
import { JOIN_EVENT, JOIN_LINK, type JoinIntent } from "./events";
import LifetimeCheckout, { PAY_BUTTON, Spinner } from "./LifetimeCheckout";

type Step =
  | { at: "closed" }
  /** Asking where this browser stands (/api/billing/lifetime). */
  | { at: "checking" }
  | { at: "account" }
  | { at: "login" }
  /** Signed up, but the account waits on its email link (only if Supabase ever asks for one again). */
  | { at: "email"; email: string }
  | { at: "pay" }
  /** On to the app. */
  | { at: "leaving"; title: string };

const UNREACHABLE = "We couldn't reach HighStrike just now. Check your connection and try again.";
const NO_SUBSCRIBE = () => () => {};

/**
 * The homepage's popup, in getripping.com's way (its index's account popup): Get lifetime access opens it, it asks where
 * the browser stands, and everything happens in it. Signed out: a new account (Google, or an email and a password; the
 * account opens at once, as HighStrike doesn't ask for an email link) or Sign in. Signed in without the membership: the
 * $397 checkout (LifetimeCheckout), paid in the popup, then /welcome with access on. A member goes straight to the app.
 * Google's way back lands on /?join=1, which opens it again at checkout. Mounted once per page; JoinButton opens it.
 * It's drawn on <body>, outside the homepage's [data-landing] frame, whose element resets would undo its spacing;
 * landing.css → .hs-join gives it the homepage's colours.
 */
export default function JoinDialog({ library }: { library: Library | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const emailBox = useRef<HTMLInputElement>(null);
  const passwordBox = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ at: "closed" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState("");
  // On <body> once there is one (not while the server renders or the page hydrates).
  const mounted = useSyncExternalStore(NO_SUBSCRIBE, () => true, () => false);

  const leave = useCallback((to: string, title: string) => {
    setStep({ at: "leaving", title });
    window.location.assign(new URL(to, window.location.origin).href);
  }, []);

  /** Where the browser stands, and the step that follows. `from` is the step to show while signed out. */
  const decide = useCallback(
    async (from: JoinIntent) => {
      setStep({ at: "checking" });
      const response = await fetch("/api/billing/lifetime", { cache: "no-store" }).catch(() => null);
      const a = (await response?.json().catch(() => null)) as { signedIn?: boolean; member?: boolean } | null;
      if (!response?.ok || !a) {
        setStep({ at: from === "login" ? "login" : "account" });
        setProblem(UNREACHABLE);
        return;
      }
      if (!a.signedIn) return setStep({ at: from === "login" ? "login" : "account" });
      if (a.member) return leave("/dashboard", "You're a member. Opening HighStrike");
      setStep({ at: "pay" });
    },
    [leave]
  );

  const open = useCallback(
    (intent: JoinIntent) => {
      setProblem("");
      if (!dialog.current?.open) dialog.current?.showModal();
      void decide(intent);
    },
    [decide]
  );

  // The buttons' event, and ?join=1 on arrival (taken off the address after, so a reload doesn't open it again).
  useEffect(() => {
    if (!mounted) return;
    const onJoin = (e: Event) => open((e as CustomEvent<JoinIntent>).detail === "login" ? "login" : "start");
    window.addEventListener(JOIN_EVENT, onJoin);
    const q = new URLSearchParams(window.location.search);
    let t: number | undefined;
    if (q.get("join") === "1") {
      q.delete("join");
      const rest = q.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
      t = window.setTimeout(() => open("start"), 0);
    }
    return () => {
      window.removeEventListener(JOIN_EVENT, onJoin);
      window.clearTimeout(t);
    };
  }, [open, mounted]);

  const close = () => {
    if (!paying) dialog.current?.close();
  };

  /** To another step with its first empty field focused (in the same tick, so a phone keeps its keyboard). */
  const goTo = (s: Step) => {
    flushSync(() => {
      setStep(s);
      setProblem("");
    });
    (email.trim() ? passwordBox.current : emailBox.current)?.focus();
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const address = email.trim().toLowerCase();
    if (password.length < 8) {
      setProblem("Use at least 8 characters for your password.");
      passwordBox.current?.focus();
      return;
    }
    setBusy(true);
    setProblem("");
    const { data, error } = await supabaseBrowser()
      .auth.signUp({
        email: address,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(JOIN_LINK)}` },
      })
      .catch(() => ({ data: null, error: { message: UNREACHABLE } }));
    setBusy(false);
    if (error) {
      if (/already (registered|exists)/i.test(error.message)) {
        setStep({ at: "login" });
        setProblem("That email already has an account. Sign in to continue.");
        return;
      }
      setProblem(/rate limit/i.test(error.message) ? "A lot of traders are signing up right now. Try again in a few minutes." : error.message);
      return;
    }
    if (data?.session) return void decide("start");
    // An address with an account already comes back without a session or an identity.
    if (data?.user && data.user.identities?.length === 0) {
      setStep({ at: "login" });
      setProblem("That email already has an account. Sign in to continue.");
      return;
    }
    setStep({ at: "email", email: address });
  };

  const logIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem("");
    const { error } = await supabaseBrowser()
      .auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      .catch(() => ({ error: { message: UNREACHABLE } }));
    setBusy(false);
    if (error) {
      setProblem(/invalid login credentials/i.test(error.message) ? "That email and password don't match. Try again, or reset your password." : error.message);
      return;
    }
    void decide("start");
  };

  const plain = step.at === "checking" || step.at === "leaving" || step.at === "closed";
  const title =
    step.at === "account" ? "Create your account" : step.at === "login" ? "Sign in" : step.at === "email" ? "Check your email" : step.at === "pay" ? "Get lifetime access" : "";

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="hs-join-title"
      className="hs-join m-auto max-h-[92svh] outline-none w-[min(100%-2rem,28rem)] overflow-y-auto rounded-2xl border border-line-strong bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      onCancel={(e) => {
        if (paying) e.preventDefault();
      }}
      onClose={() => {
        setStep({ at: "closed" });
        setPassword("");
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      {!plain && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="hs-join-title" className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={paying}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-ink-2 transition hover:bg-panel-2 hover:text-ink disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {(step.at === "checking" || step.at === "closed") && (
        <div className="px-6 py-14 text-center text-accent">
          <Spinner className="mx-auto size-5" />
          <h2 id={plain ? "hs-join-title" : undefined} className="sr-only">
            Getting ready
          </h2>
        </div>
      )}

      {step.at === "leaving" && (
        <div className="px-6 py-12 text-center">
          <Spinner className="mx-auto size-5 text-accent" />
          <h2 id="hs-join-title" className="mt-4 text-base font-semibold">
            {step.title}
          </h2>
        </div>
      )}

      {step.at === "account" && (
        <form onSubmit={(e) => void create(e)} className="px-5 py-5">
          <p className="text-sm leading-relaxed text-ink-2">
            First your account, then checkout: {LIFETIME_PRICE} once, and everything opens the moment it goes through.
          </p>
          <div className="mt-5">
            <GoogleAuthButton label="Continue with Google" next={JOIN_LINK} />
          </div>
          <div className="my-4">
            <AuthDivider />
          </div>
          <label htmlFor="hs-join-email" className={authLabelClass}>
            Email
          </label>
          <input ref={emailBox} id="hs-join-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={authInputClass} />
          <label htmlFor="hs-join-password" className={`mt-4 ${authLabelClass}`}>
            Password
          </label>
          <input ref={passwordBox} id="hs-join-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={authInputClass} />
          {problem && <Problem text={problem} onSignIn={() => goTo({ at: "login" })} />}
          <button type="submit" disabled={busy} className={`mt-5 ${PAY_BUTTON}`}>
            {busy && <Spinner />}
            {busy ? "Creating your account…" : "Continue to checkout"}
          </button>
          <p className="mt-4 text-center text-xs text-ink-3">
            Have an account?{" "}
            <button type="button" onClick={() => goTo({ at: "login" })} className="font-semibold text-ink underline-offset-2 hover:underline">
              Sign in
            </button>
          </p>
        </form>
      )}

      {step.at === "login" && (
        <form onSubmit={(e) => void logIn(e)} className="px-5 py-5">
          <GoogleAuthButton label="Continue with Google" next={JOIN_LINK} />
          <div className="my-4">
            <AuthDivider />
          </div>
          <label htmlFor="hs-join-login-email" className={authLabelClass}>
            Email
          </label>
          <input ref={emailBox} id="hs-join-login-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={authInputClass} />
          <label htmlFor="hs-join-login-password" className={`mt-4 ${authLabelClass}`}>
            Password
          </label>
          <input ref={passwordBox} id="hs-join-login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className={authInputClass} />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline">
              Forgot your password?
            </Link>
          </div>
          {problem && <Problem text={problem} />}
          <button type="submit" disabled={busy} className={`mt-5 ${PAY_BUTTON}`}>
            {busy && <Spinner />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-4 text-center text-xs text-ink-3">
            New here?{" "}
            <button type="button" onClick={() => goTo({ at: "account" })} className="font-semibold text-ink underline-offset-2 hover:underline">
              Create your account
            </button>
          </p>
        </form>
      )}

      {step.at === "email" && (
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-ink-2">
            We sent a link to <b className="font-semibold text-ink">{step.email}</b>. Open it and you&apos;ll come straight back here to check out.
          </p>
        </div>
      )}

      {step.at === "pay" && (
        <div className="px-5 py-5">
          <LifetimeCheckout library={library} back={JOIN_LINK} onPaying={setPaying} />
        </div>
      )}
    </dialog>,
    document.body
  );
}

/** An error in a red box; where it says to sign in, "Sign in" goes to that step. */
function Problem({ text, onSignIn }: { text: string; onSignIn?: () => void }) {
  const at = onSignIn ? text.search(/\bSign in\b/) : -1;
  return (
    <p role="alert" className="mt-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2.5 text-sm text-down">
      {at < 0 ? (
        text
      ) : (
        <>
          {text.slice(0, at)}
          <button type="button" onClick={onSignIn} className="font-semibold underline underline-offset-2">
            {text.slice(at, at + 7)}
          </button>
          {text.slice(at + 7)}
        </>
      )}
    </p>
  );
}
