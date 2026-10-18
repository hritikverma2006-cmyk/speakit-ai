"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setMessage("Password recovery is not configured for this app."); return; }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) setMessage("This password reset link is invalid or has expired. Request a new link.");
      else setReady(true);
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else window.location.assign("/dashboard");
  }
  return <main className="auth-screen"><Link className="brand" href="/"><span className="brand-mark">S</span>Speak<span>IT</span></Link><section className="auth-card"><div className="eyebrow">ACCOUNT SECURITY</div><h1>Choose a new password.</h1><p className="muted">Use at least 8 characters.</p>{ready && <form className="form-stack" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary full-width" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>}{message && <p className="form-message" role="alert">{message}</p>}</section></main>;
}
