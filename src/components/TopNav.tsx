"use client";

import Link from "next/link";
import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export function TopNav({ session }: { session?: Session | null }) {
  const [error, setError] = useState("");

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Authentication is not configured.");
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Could not sign out: ${signOutError.message}`);
  }

  return (
    <header className="top-nav">
      <Link className="brand" href="/"><span className="brand-mark">S</span>Speak<span>IT</span></Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/#features">Features</Link>
        <Link href="/#how-it-works">How it works</Link>
        {session && <Link href="/notebook">Notebook</Link>}
      </nav>
      <div className="nav-actions">
        {session ? <button className="button button-quiet" onClick={() => void signOut()}>Sign out</button> :
          <Link href="/dashboard" className="button button-quiet">Sign in</Link>}
        <Link href={session ? "/dashboard" : "/dashboard"} className="button button-small button-primary">{session ? "Dashboard" : "Start free"}</Link>
        {error && <span className="nav-feedback" role="alert">{error}</span>}
      </div>
    </header>
  );
}
