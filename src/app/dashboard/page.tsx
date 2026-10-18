"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { api, type Mistake, type PracticeSession, type Preferences } from "@/lib/api";

type Analytics = { today_minutes: number; week_minutes: number; week_sessions: number; total_sessions: number; mistake_categories: Record<string, number>; note: string };

export default function DashboardPage() {
  return <AuthGate>{(session) => <Dashboard session={session} />}</AuthGate>;
}

function Dashboard({ session }: { session: Session }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      api<Preferences>("/api/preferences"),
      api<Analytics>("/api/analytics/summary"),
      api<PracticeSession[]>("/api/sessions?limit=5"),
      api<Mistake[]>("/api/mistakes?understood=false"),
    ]).then(([prefs, stats, recent, review]) => {
      if (!mounted) return;
      setPreferences(prefs); setAnalytics(stats); setSessions(recent); setMistakes(review.slice(0, 3));
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Could not load your dashboard.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const name = preferences?.display_name || session.user.user_metadata.display_name || session.user.email?.split("@")[0] || "there";
  const target = preferences?.daily_target_minutes ?? 10;
  const todayMinutes = analytics?.today_minutes ?? 0;
  return <>
    <TopNav session={session} />
    <main className="dashboard-page">
      <div className="dashboard-welcome"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR SPACE TO GROW</div><h1>Good to see you, <em>{name}.</em></h1><p>A little speaking practice goes a long way. Let’s make today count.</p></div><Link href="/practice" className="button button-primary">Start a voice call <span>↗</span></Link></div>
      {loading && <div className="loading-card" role="status">Gathering your practice data…</div>}
      {error && <div className="error-banner" role="alert">{error} <button onClick={() => window.location.reload()}>Try again</button></div>}
      {analytics && <div className="stat-grid"><article className="stat-card stat-highlight"><div><span>TODAY’S PRACTICE</span><span className="stat-icon">◷</span></div><strong>{todayMinutes}<small> / {target} min</small></strong><div className="progress-track"><i style={{ width: `${Math.min(100, Math.round(todayMinutes / target * 100))}%` }} /></div><p>From completed sessions in your local timezone.</p></article><article className="stat-card"><div><span>THIS WEEK</span><span className="stat-icon">◫</span></div><strong>{analytics.week_minutes}<small> min practised</small></strong><p>Across {analytics.week_sessions} completed {analytics.week_sessions === 1 ? "session" : "sessions"}.</p></article><article className="stat-card"><div><span>SESSIONS</span><span className="stat-icon">⌁</span></div><strong>{analytics.total_sessions}<small> completed</small></strong><p>Your actual saved practice history.</p></article><article className="stat-card"><div><span>TO REVIEW</span><span className="stat-icon">✳</span></div><strong>{Object.values(analytics.mistake_categories).reduce((sum, count) => sum + count, 0)}<small> saved notes</small></strong><p>Revisit corrections whenever you’re ready.</p></article></div>}
      <div className="quick-links"><Link className="button button-outline" href="/feedback">Text feedback</Link><Link className="button button-outline" href="/onboarding">Learning preferences</Link><Link className="button button-outline" href="/challenge">Daily challenge</Link></div>
      <div className="dashboard-columns"><section className="dash-panel"><div className="panel-heading"><div><div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div><h2>Your recent sessions</h2></div><Link href="/practice">Practise now ↗</Link></div>
        {sessions.length ? <div className="session-list">{sessions.map((item) => <article key={item.id}><span className="session-symbol">◉</span><div><strong>{item.scenario.replaceAll("_", " ")}</strong><small>{new Date(item.started_at).toLocaleDateString()} · {item.mode}</small></div><span className="session-duration">{Math.round(item.duration_seconds / 60)} min</span></article>)}</div> : <div className="empty-state"><span>◌</span><h3>Your first conversation is waiting.</h3><p>Your completed practice sessions will show up here.</p><Link className="button button-outline" href="/practice">Start practising</Link></div>}
      </section><section className="dash-panel"><div className="panel-heading"><div><div className="eyebrow">A SMALL STEP FORWARD</div><h2>Review &amp; grow</h2></div><Link href="/notebook">Open notebook ↗</Link></div>
        {mistakes.length ? <div className="review-list">{mistakes.map((item) => <article key={item.id}><span className="review-category">{item.category.replaceAll("_", " ")}</span><p className="review-original">{item.original}</p><p className="review-corrected">→ {item.corrected}</p></article>)}</div> : <div className="empty-state compact"><span>✦</span><h3>No saved notes yet.</h3><p>Save a correction to make it easy to revisit later.</p></div>}
      </section></div>
      {analytics && <p className="analytics-disclaimer">{analytics.note}</p>}
    </main>
  </>;
}
