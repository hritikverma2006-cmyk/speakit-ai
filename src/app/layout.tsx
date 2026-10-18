import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpeakIT AI — Speak English with Confidence",
  description: "Practice spoken English with a patient AI coach and prepare for your IT career.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
