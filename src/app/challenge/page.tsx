"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { api, ApiError } from "@/lib/api";

type Exercise = {
  prompt: string;
  based_on_saved_mistakes: boolean;
  category?: string;
  self_check?: { original: string; corrected: string; explanation: string };
};

export default function ChallengePage() {
  return <AuthGate>{(session) => <Challenge session={session} />}</AuthGate>;
}

function Challenge({ session }: { session: Session }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [showSelfCheck, setShowSelfCheck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Exercise>("/api/practice/exercise", { method: "POST", body: JSON.stringify({}) })
      .then(setExercise).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not prepare the exercise."));
  }, []);
  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setFeedback("");
    try {
      const result = await api<{ items: Array<{ corrected: string; explanation: string }> }>("/api/feedback", { method: "POST", body: JSON.stringify({ text: answer }) });
      setFeedback(result.items.length ? result.items.map((item) => `${item.corrected} — ${item.explanation}`).join("\n") : "Your answer is clear. Keep practising!");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 503) {
        setOfflineMode(true);
        setError("");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not check your answer.");
      }
    } finally {
      setBusy(false);
    }
  }
  return <>
    <TopNav session={session} />
    <main className="challenge-page"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Daily challenge</span></div>
      <div className="challenge-card"><div className="eyebrow">A SMALL DAILY CHALLENGE</div><h1>One prompt.<br /><em>One step forward.</em></h1>
        {exercise ? <><span className="review-category">{exercise.based_on_saved_mistakes ? `PRACTISE: ${exercise.category ?? "A SAVED NOTE"}` : "SPEAKING PROMPT"}</span><p className="challenge-prompt">{exercise.prompt}</p><form onSubmit={check}><label htmlFor="challenge-answer">{offlineMode ? "Your answer (not sent to AI)" : "Write your answer to get friendly language feedback"}</label><textarea id="challenge-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} required maxLength={2000} rows={5} /><button className="button button-primary" disabled={busy}>{busy ? "Reviewing…" : offlineMode ? "Try AI feedback again" : "Check my answer"} ↗</button></form></> : !error && <p role="status">Preparing your prompt…</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}{feedback && <div className="challenge-feedback" role="status"><strong>A helpful next step</strong><p>{feedback}</p><Link href="/feedback" className="text-link">Explore more feedback ↗</Link></div>}
        {offlineMode && <section className="offline-fallback" aria-live="polite"><strong>Self-guided practice mode</strong><p>AI feedback is not configured, so SpeakIT has not graded or corrected your answer. Review it yourself: does the verb tense match the time, does each subject agree with its verb, and is your meaning clear?</p>{exercise?.self_check && <><button className="button button-outline" onClick={() => setShowSelfCheck((shown) => !shown)}>{showSelfCheck ? "Hide saved correction" : "Compare with your saved correction"}</button>{showSelfCheck && <div className="self-check-answer"><span>YOUR SAVED NOTE · NOT NEW AI FEEDBACK</span><p><strong>Original:</strong> {exercise.self_check.original}</p><p><strong>Correction you saved:</strong> {exercise.self_check.corrected}</p><p>{exercise.self_check.explanation}</p></div>}</>}<Link href="/notebook" className="text-link">Add or review your own notes ↗</Link></section>}
      </div>
    </main>
  </>;
}
