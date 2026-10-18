"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { VoiceRoom } from "@/components/VoiceRoom";
import { api, type Preferences } from "@/lib/api";

export default function PracticePage() {
  return <AuthGate>{(session) => <Practice session={session} />}</AuthGate>;
}

function Practice({ session }: { session: Session }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void api<Preferences>("/api/preferences").then(setPreferences).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load preferences."));
  }, []);
  return <>
    <TopNav session={session} />
    <main className="practice-page"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Voice practice</span></div>
      <div className="practice-layout"><div className="practice-side"><div className="eyebrow">SPEAK. LEARN. REPEAT.</div><h1>Make room<br />for <em>your voice.</em></h1><p>There’s no perfect way to begin. Pick a conversation and your coach will meet you where you are.</p>
        <div className="practice-tip"><span>✦</span><div><strong>A gentle reminder</strong><p>Take your time. Your coach is here to help you practise, not to judge.</p></div></div>
        <div className="practice-safety"><span>⌑</span><p>Your microphone is used only for the live call. Audio isn’t stored by SpeakIT.</p></div>
        <Link href="/notebook" className="text-link">Review your saved corrections <span>↗</span></Link>
      </div>{error ? <div className="error-banner" role="alert">{error}</div> : preferences ? <VoiceRoom preferences={preferences} /> : <div className="loading-card" role="status">Preparing your practice room…</div>}</div>
    </main>
  </>;
}
