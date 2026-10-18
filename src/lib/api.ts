"use client";

import { getSupabase } from "@/lib/supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Authentication is not configured. Add the Supabase settings to .env.local.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Could not verify your sign-in. Please sign in again.");
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.detail ?? `Request failed (${response.status}). Please try again.`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type Preferences = {
  display_name: string;
  english_level: "beginner" | "intermediate" | "advanced";
  primary_goal: string;
  explanation_language: "english" | "hinglish";
  daily_target_minutes: number;
  career_target: string;
  timezone: string;
};

export type PracticeSession = {
  id: string;
  scenario: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  transcript_consent: boolean;
  completed: boolean;
};

export type Mistake = {
  id: string;
  session_id: string | null;
  original: string;
  corrected: string;
  explanation: string;
  alternative: string;
  example: string;
  exercise: string;
  category: string;
  is_suggestion: boolean;
  understood: boolean;
  created_at: string;
};
