"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import AuthShell, {
  authInputClass,
  authButtonClass,
  authLabelClass,
} from "@/components/AuthShell";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // If email confirmation is disabled, a session comes back immediately.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="One more step to activate your account."
      >
        <p className="text-sm leading-relaxed text-ink-2">
          We sent a confirmation link to{" "}
          <span className="text-ink">{email.trim()}</span>. Click it to activate
          your account — the link brings you straight back here, signed in.
        </p>
        <p className="mt-4 text-xs text-ink-3">
          Nothing arriving? Check spam, or try signing up again in a few minutes.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start trading with HighStrike AI Terminal."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-accent transition hover:text-accent-2">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={authInputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm" className={authLabelClass}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Same password again"
            className={authInputClass}
          />
        </div>
        {error && <p className="text-sm text-down">{error}</p>}
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-xs leading-relaxed text-ink-3">
          By creating an account you agree to our{" "}
          <a
            href="https://www.highstrike.com/terms-of-service"
            className="underline transition hover:text-ink"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="https://www.highstrike.com/privacy-policy"
            className="underline transition hover:text-ink"
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </AuthShell>
  );
}
