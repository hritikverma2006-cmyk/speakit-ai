"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";
import { api, type Mistake } from "@/lib/api";

export default function NotebookPage() {
  return <AuthGate>{(session) => <Notebook session={session} />}</AuthGate>;
}

function Notebook({ session }: { session: Session }) {
  const [items, setItems] = useState<Mistake[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualOriginal, setManualOriginal] = useState("");
  const [manualCorrection, setManualCorrection] = useState("");
  const [manualCategory, setManualCategory] = useState("grammar");
  const [manualStatus, setManualStatus] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filter !== "all") params.set("understood", filter === "reviewed" ? "true" : "false");
    if (category !== "all") params.set("category", category);
    params.set("sort", sort);
    void api<Mistake[]>(`/api/mistakes?${params}`).then((data) => { setItems(data); setError(""); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load your notebook."));
  }, [category, filter, search, sort]);
  useEffect(() => { load(); }, [load]);

  async function markReviewed(item: Mistake) {
    try {
      await api(`/api/mistakes/${item.id}`, { method: "PATCH", body: JSON.stringify({ understood: !item.understood }) });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this correction.");
    }
  }
  async function remove(item: Mistake) {
    if (!window.confirm("Delete this saved correction? This cannot be undone.")) return;
    try {
      await api(`/api/mistakes/${item.id}`, { method: "DELETE" });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this correction.");
    }
  }
  async function saveManualNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setManualStatus("");
    try {
      await api("/api/mistakes", {
        method: "POST",
        body: JSON.stringify({
          original: manualOriginal,
          corrected: manualCorrection,
          explanation: "Self-entered learning note; this is not an AI judgment.",
          alternative: "",
          example: "",
          exercise: "",
          category: manualCategory,
          is_suggestion: false,
        }),
      });
      setManualOriginal(""); setManualCorrection("");
      setManualStatus("Your personal note is saved. You can use it for self-guided review.");
      setManualOpen(false);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your personal note.");
    }
  }
  function exportData() {
    const data = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = href; anchor.download = "speakit-mistakes.json"; anchor.click();
    URL.revokeObjectURL(href);
  }
  return <>
    <TopNav session={session} />
    <main className="notebook-page"><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>Mistake notebook</span></div>
      <div className="notebook-heading"><div><div className="eyebrow">YOUR PERSONAL LEARNING LIBRARY</div><h1>Mistakes are <em>moments to grow.</em></h1><p>Keep the corrections that matter. Come back whenever you want.</p></div><button className="button button-outline" onClick={exportData} disabled={!items.length}>Export filtered notes</button></div>
      <div className="notebook-actions"><div className="notebook-toolbar"><label className="search-control"><span aria-hidden="true">⌕</span><input aria-label="Search corrections" placeholder="Search your corrections…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-control"><span className="sr-only">Review status</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All corrections</option><option value="review">Needs review</option><option value="reviewed">Understood</option></select></label><label className="filter-control"><span className="sr-only">Error category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option><option value="grammar">Grammar</option><option value="tense">Tense</option><option value="agreement">Agreement</option><option value="articles_prepositions">Articles &amp; prepositions</option><option value="structure">Structure</option><option value="vocabulary">Vocabulary</option><option value="word_order">Word order</option><option value="filler">Filler words</option><option value="clarity">Clarity</option></select></label><label className="filter-control"><span className="sr-only">Sort notes</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="category">Category</option></select></label></div><button className="button button-outline" onClick={() => setManualOpen((open) => !open)}>{manualOpen ? "Cancel personal note" : "Add a personal note"}</button></div>
      {manualOpen && <form className="manual-note-form" onSubmit={saveManualNote}><h2>Save your own self-check</h2><p>This is your personal note, not AI-generated feedback.</p><label>Original sentence<input value={manualOriginal} onChange={(event) => setManualOriginal(event.target.value)} maxLength={2000} required /></label><label>Your correction<input value={manualCorrection} onChange={(event) => setManualCorrection(event.target.value)} maxLength={2000} required /></label><label>Category<select value={manualCategory} onChange={(event) => setManualCategory(event.target.value)}><option value="grammar">Grammar</option><option value="tense">Tense</option><option value="agreement">Agreement</option><option value="articles_prepositions">Articles &amp; prepositions</option><option value="structure">Structure</option><option value="vocabulary">Vocabulary</option><option value="word_order">Word order</option><option value="filler">Filler words</option><option value="clarity">Clarity</option></select></label><button className="button button-primary" type="submit">Save personal note</button></form>}
      {manualStatus && <p className="success-message" role="status">{manualStatus}</p>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {items.length ? <div className="notebook-grid">{items.map((item) => <article className={`mistake-card ${item.understood ? "mistake-reviewed" : ""}`} key={item.id}>
        <div className="mistake-meta"><span className="review-category">{item.category.replaceAll("_", " ")}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></div>
        <div className="mistake-sentence"><span>YOUR WORDS</span><p>{item.original}</p></div><div className="mistake-sentence fixed"><span>TRY THIS</span><p>{item.corrected}</p></div>
        <p className="mistake-explanation">{item.explanation}</p>
        {item.alternative && <p className="mistake-alternative"><strong>More natural:</strong> {item.alternative}</p>}
        {item.example && <p className="mistake-example"><strong>Example:</strong> {item.example}</p>}
        {item.exercise && <div className="exercise-prompt"><strong>Try it:</strong> {item.exercise}</div>}
        <div className="mistake-actions"><button className="text-button" onClick={() => void markReviewed(item)}>{item.understood ? "Mark for review" : "I understand this"}</button><button className="text-button delete-link" onClick={() => void remove(item)}>Delete</button></div>
      </article>)}</div> : !error && <div className="notebook-empty"><span>✦</span><h2>Your notebook starts with a correction.</h2><p>Practise a conversation, save useful feedback, and it’ll be waiting here.</p><Link className="button button-primary" href="/practice">Start a practice session</Link></div>}
    </main>
  </>;
}
