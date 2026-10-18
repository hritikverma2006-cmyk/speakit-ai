"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { api, type Preferences } from "@/lib/api";

export default function OnboardingPage() {
  return <AuthGate>{(session) => <PreferencesPage session={session} />}</AuthGate>;
}

function PreferencesPage({ session }: { session: Session }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Preferences>("/api/preferences").then((data) => {
      setPrefs({ ...data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || data.timezone });
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load your learning preferences."));
  }, []);

  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((current) => current ? { ...current, [key]: value } : current);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prefs) return;
    setBusy(true); setStatus(""); setError("");
    try {
      await api("/api/preferences", { method: "PUT", body: JSON.stringify(prefs) });
      setStatus("Your learning preferences are saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    try {
      const result = await api<Record<string, unknown>>("/api/me/export");
      const href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = href; link.download = "speakit-account-data.json"; link.click();
      URL.revokeObjectURL(href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export your data.");
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your SpeakIT account and all associated practice data? This cannot be undone.")) return;
    const confirmation = window.prompt('Type DELETE to confirm permanent account deletion.');
    if (confirmation !== "DELETE") return;
    try {
      await api("/api/me", { method: "DELETE", body: JSON.stringify({ confirmation: "DELETE" }) });
      await import("@/lib/supabase").then(({ getSupabase }) => getSupabase()?.auth.signOut());
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete your account.");
    }
  }

  return <>
    <TopNav session={session} />
    <main className="onboarding-page">
      <div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Your learning preferences</span></div>
      <div className="feedback-heading"><div className="eyebrow">MAKE THIS YOURS</div><h1>Your goals.<br /><em>Your pace.</em></h1><p>Choose a starting point. You can update your preferences whenever you like.</p></div>
      {prefs && <form className="onboarding-form" onSubmit={save}>
        <label>What should we call you?<input value={prefs.display_name} onChange={(event) => change("display_name", event.target.value)} required maxLength={100} /></label>
        <div className="settings-form-row"><label>Your English level<select value={prefs.english_level} onChange={(event) => change("english_level", event.target.value as Preferences["english_level"])}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
          <label>Practice goal<select value={prefs.primary_goal} onChange={(event) => change("primary_goal", event.target.value)}><option value="everyday">Everyday communication</option><option value="college">College communication</option><option value="workplace">Workplace English</option><option value="hr_interview">HR interviews</option><option value="technical_interview">Technical interviews</option><option value="presentation">Presentations</option></select></label></div>
        <div className="settings-form-row"><label>Daily practice target<select value={prefs.daily_target_minutes} onChange={(event) => change("daily_target_minutes", Number(event.target.value))}><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option></select></label>
          <label>Explanation language<select value={prefs.explanation_language} onChange={(event) => change("explanation_language", event.target.value as Preferences["explanation_language"])}><option value="english">Simple English</option><option value="hinglish">Hinglish</option></select></label></div>
        <label>Career goal <span className="optional-label">(optional)</span><input value={prefs.career_target} onChange={(event) => change("career_target", event.target.value)} maxLength={100} placeholder="e.g. Software engineering internship" /></label>
        <div className="settings-form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button><Link href="/dashboard" className="text-link">Skip for now</Link></div>
      </form>}
      {error && <p className="error-banner" role="alert">{error}</p>}{status && <p className="success-message" role="status">{status}</p>}
      <section className="data-controls"><h2>Your data belongs to you.</h2><p>Download the practice data and notes associated with your account, or permanently delete your account and its records.</p><div><button className="button button-outline" onClick={() => void exportData()}>Export my data</button><button className="button button-danger" onClick={() => void deleteAccount()}>Delete my account</button></div></section>
    </main>
  </>;
}
