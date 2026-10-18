import Link from "next/link";

export const metadata = { title: "Terms | SpeakIT AI" };

export default function TermsPage() {
  return <main className="privacy-page"><Link className="brand" href="/"><span className="brand-mark">S</span>Speak<span>IT</span></Link><article><div className="eyebrow">A PRACTICE TOOL, NOT A PROMISE</div><h1>Using SpeakIT AI.</h1>
    <p>SpeakIT AI is an educational practice tool for spoken and written English. It is not a human tutor, recruiter, certified language examiner, or provider of hiring advice.</p>
    <h2>AI feedback</h2><p>AI-generated responses and language corrections can be incomplete or incorrect. Review suggestions critically; dialects and informal English may be valid in context. The service does not guarantee employment, interview outcomes, or language proficiency.</p>
    <h2>Voice and third-party services</h2><p>Live voice requires microphone access and streams audio to the configured provider. Usage limits and costs depend on the deployment and provider. Use the service only where you have permission to share the content you speak or submit.</p>
    <h2>Your account</h2><p>Keep your sign-in information private. You can export or delete account data in Learning preferences when account deletion is configured for the deployment. Do not submit passwords, payment details, or other sensitive personal information for language feedback.</p>
    <p className="privacy-updated">This starter terms page is informational, not legal advice. Replace it with terms reviewed for your organization and jurisdiction before launch.</p>
    <Link href="/" className="text-link">← Back to SpeakIT</Link></article></main>;
}
