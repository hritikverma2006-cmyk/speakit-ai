"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      if (error) setMessage(`Could not check your sign-in: ${error.message}`);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setMessage("Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/onboarding` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    }
  }

  if (loading) return <div className="center-state" role="status">Checking your session…</div>;
  if (session) return <>{children(session)}</>;

  return (
    <main className="auth-screen">
      <Link className="brand" href="/"><span className="brand-mark">S</span>Speak<span>IT</span></Link>
      <section className="auth-card">
        <div className="eyebrow">YOUR NEXT CONVERSATION STARTS HERE</div>
        <h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1>
        <p className="muted">{mode === "signin" ? "Sign in to continue your practice." : "Build confidence, one conversation at a time."}</p>
        <form onSubmit={submit} className="form-stack">
          {mode === "signup" && <label>Your name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>
          <label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          {message && <p className="form-message" role="alert">{message}</p>}
          <button className="button button-primary full-width" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        {mode === "signin" && <button className="text-button forgot-link" onClick={async () => {
          const supabase = getSupabase();
          if (!supabase || !email) return setMessage("Enter your email address first.");
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/update-password` });
          setMessage(error?.message ?? "If an account exists for that email, a reset link has been sent.");
        }}>Forgot password?</button>}
        <p className="auth-switch">{mode === "signin" ? "New to SpeakIT? " : "Already have an account? "}
          <button className="text-button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
      <p className="auth-legal">By continuing, you agree to use the AI tutor as a learning tool—not a certified examiner.</p>
    </main>
  );
}
