import Link from "next/link";
import { TopNav } from "@/components/TopNav";

const features = [
  ["01", "Real conversations", "Practise out loud with a patient AI coach that listens and responds naturally."],
  ["02", "Gentle corrections", "Understand grammar and word choice with simple, useful explanations."],
  ["03", "Interview practice", "Build confidence for HR rounds, project explanations, and technical interviews."],
  ["04", "Your learning path", "Focus your practice on your goals and the patterns you want to improve."],
  ["05", "Useful vocabulary", "Find more natural words for college, teamwork, and work."],
  ["06", "Progress that’s real", "Review your actual sessions and saved corrections—never invented scores."],
];

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE PRACTICE. A LOT MORE CONFIDENCE.</div>
            <h1>Speak English<br />with <em>confidence.</em><br />Build your IT career.</h1>
            <p className="hero-lede">A patient AI speaking coach for the conversations that move you forward—from your first introduction to your next interview.</p>
            <div className="hero-actions"><Link href="/dashboard" className="button button-primary">Start practising <span aria-hidden="true">↗</span></Link><a href="#features" className="button button-quiet">Explore features <span aria-hidden="true">↓</span></a></div>
            <div className="hero-proof"><div className="proof-avatars"><span>A</span><span>R</span><span>M</span></div><p><strong>Made for your next step</strong><br />Students · Freshers · Job seekers</p></div>
          </div>
          <div className="hero-art" aria-label="SpeakIT AI helps learners practise conversation">
            <div className="art-grid" />
            <div className="float-tag tag-top"><span className="tag-spark">✦</span> YOUR PERSONAL SPEAKING COACH</div>
            <div className="coach-card">
              <div className="coach-card-top"><span className="coach-avatar">S</span><div><strong>SpeakIT Coach</strong><small><i className="live-dot" /> Ready to practise</small></div><span className="sound-bars"><i /><i /><i /><i /><i /></span></div>
              <div className="coach-message">Tell me about a project you’re proud of. What did you build?</div>
              <div className="learner-message"><span>YOU</span> I have developed a college app with my team.</div>
              <div className="correction"><span className="correction-icon">✦</span><div><small>A MORE NATURAL WAY TO SAY IT</small><strong>“I developed a college app with my team.”</strong><p>Great start. “Developed” sounds natural when describing a completed project.</p></div></div>
              <div className="coach-card-bottom"><span>00:42</span><div className="waveform"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><span className="mic-chip">●</span></div>
            </div>
            <div className="float-tag tag-bottom"><span className="progress-icon">↗</span><div><small>YOUR PRACTICE</small><strong>One conversation at a time</strong></div></div>
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          </div>
          <div className="hero-index"><span>01</span><i /><span>04</span></div>
        </section>
        <section className="trust-strip"><p>BUILT FOR THE CONVERSATIONS THAT SHAPE YOUR CAREER</p><div><span>COLLEGE</span><span>INTERVIEWS</span><span>TEAMWORK</span><span>YOUR FIRST JOB</span></div></section>
        <section className="section section-features" id="features">
          <div className="section-heading"><div><div className="eyebrow">MORE THAN SPEAKING PRACTICE</div><h2>Find your words.<br /><em>Find your next step.</em></h2></div><p>Real practice for real moments—designed around your goals, your pace, and the way you learn best.</p></div>
          <div className="feature-grid">{features.map(([number, title, description]) => <article className="feature-card" key={number}><span className="feature-number">{number}</span><div className="feature-glyph">{["◉", "✳", "⌘", "↗", "Aa", "⌁"][Number(number) - 1]}</div><h3>{title}</h3><p>{description}</p><span className="card-arrow">↗</span></article>)}</div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-intro"><div className="eyebrow">SMALL STEPS. REAL PROGRESS.</div><h2>It starts with<br /><em>hello.</em></h2><p>No pressure, no perfect sentences. Just a place to practise until speaking feels more like you.</p><Link className="button button-primary" href="/dashboard">Try your first session <span>↗</span></Link></div>
          <div className="how-steps"><article><span>01</span><div><h3>Choose your conversation</h3><p>Everyday English, college, the workplace, or an interview—start where you are.</p></div></article><article><span>02</span><div><h3>Speak naturally</h3><p>Talk through your microphone. Your coach listens, responds, and gives you room to think.</p></div></article><article><span>03</span><div><h3>Learn one thing at a time</h3><p>Take away practical corrections you can use in the very next conversation.</p></div></article></div>
        </section>
        <section className="sample-section"><div className="sample-label"><div className="eyebrow">A LITTLE EXAMPLE</div><h2>Feedback that<br /><em>feels like help.</em></h2><p>Clear, kind, and focused on what you meant—not on making you sound like someone else.</p></div><div className="sample-card"><span className="sample-tag">YOUR WORDS</span><p className="sample-original">“Yesterday I am go to my college and meet my professor.”</p><div className="sample-line" /><span className="sample-tag cyan">A CLEARER WAY</span><p className="sample-corrected">“Yesterday I went to college and met my professor.”</p><div className="sample-explain"><span>✦</span><p>Since it happened yesterday, use past-tense verbs: <strong>went</strong> and <strong>met</strong>.</p></div><small>Illustrative example · feedback can vary</small></div></section>
        <section className="pricing-section"><div className="pricing-copy"><div className="eyebrow">START AT YOUR OWN PACE</div><h2>Your first step<br /><em>is on us.</em></h2><p>Begin with a free account and practise when you’re ready. Voice usage is limited, and provider charges may apply to the service.</p></div><div className="price-card"><div className="price-title"><span>THE STARTER</span><span className="free-pill">FREE TO START</span></div><div className="price-number">$<strong>0</strong><small>/ month</small></div><p>Everything you need to begin building your confidence.</p><ul><li>✓ AI-powered practice and language feedback*</li><li>✓ Personal mistake notebook</li><li>✓ Progress from your real sessions</li><li>✓ Your data stays under your control</li></ul><Link href="/dashboard" className="button button-primary full-width">Create your free account</Link><small>*Requires provider configuration. Voice use is subject to configured limits and provider availability.</small></div></section>
        <section className="faq-section"><div><div className="eyebrow">GOOD QUESTIONS</div><h2>A few things<br /><em>you might wonder.</em></h2></div><div className="faq-list"><details><summary>Do I need to be fluent to start?<span>+</span></summary><p>Not at all. The tutor adapts to beginner, intermediate, and advanced practice. You can take your time and speak at your own pace.</p></details><details><summary>Is the AI a real interviewer?<span>+</span></summary><p>No. The AI is a practice tool, not a human interviewer or certified language examiner. Use its feedback as guidance, not as a score or guarantee.</p></details><details><summary>Are my voice recordings stored?<span>+</span></summary><p>SpeakIT does not save raw audio. A session transcript is only saved if you explicitly opt in before starting the call.</p></details><details><summary>Is voice practice unlimited?<span>+</span></summary><p>No. Voice is subject to a daily limit configured by the service operator and any provider quotas or charges. Check the setup guide before enabling it.</p></details></div></section>
      </main>
      <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">S</span>Speak<span>IT</span></Link><p>Speak with confidence. Step into what’s next.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><span>AI practice tool · Not a certified examiner</span><small>© {new Date().getFullYear()} SpeakIT AI</small></div></footer>
    </>
  );
}
