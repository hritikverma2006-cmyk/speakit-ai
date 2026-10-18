"use client";

import Link from "next/link";
import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { api } from "@/lib/api";

type FeedbackItem = {
  original: string;
  corrected: string;
  explanation: string;
  alternative: string;
  category: string;
  example: string;
  exercise: string;
  is_suggestion: boolean;
};

export default function FeedbackPage() {
  return <AuthGate>{(session) => <Feedback session={session} />}</AuthGate>;
}

function Feedback({ session }: { session: Session }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setItems([]);
    try {
      const result = await api<{ items: FeedbackItem[] }>("/api/feedback", { method: "POST", body: JSON.stringify({ text }) });
      setItems(result.items);
      if (!result.items.length) setNotice("That already reads clearly. Keep up the good work.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not get feedback.");
    } finally {
      setBusy(false);
    }
  }

  async function save(item: FeedbackItem) {
    try {
      await api("/api/mistakes", { method: "POST", body: JSON.stringify(item) });
      setNotice("Saved to your mistake notebook.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this correction.");
    }
  }

  return <>
    <TopNav session={session} />
    <main className="feedback-page">
      <div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Text feedback</span></div>
      <div className="feedback-heading"><div className="eyebrow">A CLEARER WAY TO SAY IT</div><h1>Bring your words.<br /><em>We’ll work on them together.</em></h1><p>Write a sentence or a short paragraph. We’ll help with useful, respectful feedback—not accent judgments or invented scores.</p></div>
      <form className="feedback-form" onSubmit={submit}><label htmlFor="learner-text">What would you like to say?</label><textarea id="learner-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} minLength={1} required placeholder="Write a sentence, an interview answer, or a short paragraph…" /><div className="feedback-form-bottom"><span>{text.length}/2000</span><button className="button button-primary" type="submit" disabled={busy || !text.trim()}>{busy ? "Thinking it through…" : "Get feedback"} <span>↗</span></button></div></form>
      {error && <p className="error-banner" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
      {items.length > 0 && <section className="feedback-results" aria-live="polite"><div className="eyebrow">YOUR LEARNING MOMENTS</div><h2>A few helpful things to notice.</h2>{items.map((item, index) => <article className="feedback-card" key={`${index}-${item.original}`}><div className="mistake-meta"><span className="review-category">{item.category.replaceAll("_", " ")}</span>{item.is_suggestion && <span className="suggestion-label">STYLE SUGGESTION</span>}</div><div className="mistake-sentence"><span>YOUR WORDS</span><p>{item.original}</p></div><div className="mistake-sentence fixed"><span>{item.is_suggestion ? "A NATURAL ALTERNATIVE" : "CORRECTED"}</span><p>{item.corrected}</p></div><p className="mistake-explanation">{item.explanation}</p>{item.alternative && <p className="mistake-alternative"><strong>Another natural option:</strong> {item.alternative}</p>}{item.example && <p className="mistake-example"><strong>Example:</strong> {item.example}</p>}{item.exercise && <div className="exercise-prompt"><strong>Try it:</strong> {item.exercise}</div>}<button className="text-button save-feedback" onClick={() => void save(item)}>Save to my notebook ↗</button></article>)}</section>}
    </main>
  </>;
}
