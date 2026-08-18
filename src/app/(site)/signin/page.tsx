"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import AuthShell, {
  authInputClass,
  authButtonClass,
  authLabelClass,
} from "@/components/AuthShell";
import GoogleAuthButton, { AuthDivider } from "@/components/GoogleAuthButton";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "Invalid email or password."
          : err.message
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="mb-1.5 text-xs text-ink-3 transition hover:text-ink"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className={authInputClass}
        />
      </div>
      {error && <p className="text-sm text-down">{error}</p>}
      <button type="submit" disabled={loading} className={authButtonClass}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your HighStrike account."
      footer={
        <>
          New to HighStrike?{" "}
          <Link href="/signup" className="font-semibold text-accent transition hover:text-accent-2">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleAuthButton label="Continue with Google" />
      <div className="my-4">
        <AuthDivider />
      </div>
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
