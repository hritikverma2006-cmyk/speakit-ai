"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Preferences } from "@/lib/api";
import { api } from "@/lib/api";

type CallState = "idle" | "connecting" | "connected" | "reconnecting" | "failed" | "ended";
type TranscriptLine = { speaker: string; content: string };

export function VoiceRoom({ preferences }: { preferences: Preferences }) {
  const [status, setStatus] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [scenario, setScenario] = useState("daily");
  const [mode, setMode] = useState("conversation");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const activeRef = useRef(false);
  const callTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [turnsSupported, setTurnsSupported] = useState(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    if (callTimerRef.current !== null) window.clearTimeout(callTimerRef.current);
    callTimerRef.current = null;
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    if (status !== "connected") return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  function captureEvent(event: MessageEvent<string>) {
    let item: { type?: string; transcript?: string; item?: { role?: string; content?: Array<{ text?: string; transcript?: string }> } };
    try {
      item = JSON.parse(event.data);
    } catch {
      return;
    }
    const speaker = item.type?.includes("output_audio_transcript") ? "AI" : "You";
    const text = item.transcript ?? item.item?.content?.find((part) => part.transcript || part.text)?.transcript ?? item.item?.content?.find((part) => part.text)?.text;
    if (!text || !item.type?.includes("transcript")) return;
    setTurnsSupported(true);
    const line = { speaker, content: text };
    if (transcriptRef.current.length >= 300) return;
    transcriptRef.current = [...transcriptRef.current, line];
    setTranscript(transcriptRef.current);
  }

  async function startCall() {
    if (activeRef.current || status === "connecting" || status === "connected") return;
    setError("");
    setTranscript([]);
    transcriptRef.current = [];
    setElapsed(0);
    setTurnsSupported(false);
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError("This browser does not support WebRTC microphone calls. Try a recent version of Chrome, Edge, or Firefox.");
      setStatus("failed");
      return;
    }
    activeRef.current = true;
    setStatus("connecting");
    try {
      const practice = await api<{ id: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ scenario, mode, transcript_consent: consent }),
      });
      sessionIdRef.current = practice.id;
      const credential = await api<{ client_secret: string; max_duration_seconds: number }>("/api/realtime-session", {
        method: "POST",
        body: JSON.stringify({ scenario, mode }),
      });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      peer.addTrack(stream.getAudioTracks()[0], stream);
      peer.ontrack = (event) => {
        if (audioRef.current) audioRef.current.srcObject = event.streams[0];
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "disconnected") {
          setStatus("reconnecting");
          reconnectTimerRef.current = window.setTimeout(() => {
            if (peer.connectionState === "disconnected") {
              setError("The voice connection could not recover. Your call has ended.");
              void endCall().then(() => setStatus("failed"));
            }
          }, 15000);
        } else if (peer.connectionState === "connected") {
          if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
          setStatus("connected");
        } else if (peer.connectionState === "failed") {
          setError("The voice connection was interrupted. End the call and try again.");
          void endCall().then(() => setStatus("failed"));
        }
      };
      const channel = peer.createDataChannel("oai-events");
      channel.onmessage = captureEvent;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${credential.client_secret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!answerResponse.ok) throw new Error(answerResponse.status === 401
        ? "The short-lived voice credential expired. Start a new call."
        : "The voice provider could not establish the call. Check model access and try again.");
      await peer.setRemoteDescription({ type: "answer", sdp: await answerResponse.text() });
      startedAtRef.current = Date.now();
      setStatus("connected");
      callTimerRef.current = window.setTimeout(() => { void endCall(); }, credential.max_duration_seconds * 1000);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Could not start the voice call.";
      setError((cause instanceof DOMException && cause.name === "NotAllowedError") || text.includes("Permission") || text.includes("NotAllowed")
        ? "Microphone access was denied. Allow microphone access in your browser settings to practise by voice."
        : text);
      setStatus("failed");
      cleanup();
      if (sessionIdRef.current) {
        try {
          await api(`/api/sessions/${sessionIdRef.current}/complete`, { method: "POST", body: JSON.stringify({ turns: [] }) });
        } catch (saveCause) {
          const reason = saveCause instanceof Error ? saveCause.message : "request failed";
          setError((previous) => `${previous} The incomplete session could not be recorded (${reason}).`);
        }
        sessionIdRef.current = null;
      }
    }
  }

  async function endCall() {
    const sessionId = sessionIdRef.current;
    cleanup();
    setStatus("ended");
    if (sessionId) {
      try {
        await api(`/api/sessions/${sessionId}/complete`, {
          method: "POST",
          body: JSON.stringify({
            turns: consent ? transcriptRef.current.map((turn) => ({ speaker: turn.speaker === "AI" ? "assistant" : "user", content: turn.content })) : [],
          }),
        });
      } catch (cause) {
        setError(cause instanceof Error ? `Call ended, but session history could not be saved: ${cause.message}` : "Call ended, but session history could not be saved.");
      }
    }
    sessionIdRef.current = null;
  }

  function toggleMute() {
    const nextMuted = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  }

  const minutes = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const isLive = status === "connected" || status === "connecting" || status === "reconnecting";
  return (
    <section className="voice-room">
      <div className="voice-room-head">
        <div><div className="eyebrow">YOUR PRIVATE PRACTICE ROOM</div><h2>Let’s find your voice.</h2></div>
        <span className={`status-pill status-${status}`}><i />{status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : status === "reconnecting" ? "Reconnecting" : status === "failed" ? "Connection issue" : status === "ended" ? "Call ended" : "Ready when you are"}</span>
      </div>
      <div className="voice-controls">
        <label>Practice track<select value={scenario} onChange={(event) => setScenario(event.target.value)} disabled={isLive}>
          <option value="daily">Everyday conversation</option><option value="college">College life</option>
          <option value="self_intro">Self-introduction</option><option value="teamwork">Teamwork</option>
          <option value="workplace">Workplace English</option><option value="meeting">Meetings</option>
          <option value="presentation">Presentations</option><option value="hr_interview">HR interview</option>
          <option value="project">Project explanation</option><option value="technical_interview">Technical interview</option>
          <option value="group_discussion">Group discussion</option>
        </select></label>
        <label>Coaching style<select value={mode} onChange={(event) => setMode(event.target.value)} disabled={isLive}>
          <option value="conversation">Conversation</option><option value="fluency">Fluency — corrections after</option>
          <option value="interview">Mock interview</option>
        </select></label>
      </div>
      <div className={`voice-orb ${status === "connected" ? "orb-live" : ""}`} aria-hidden="true"><div className="orb-core"><span>Speak</span><small>IT AI</small></div><i className="orb-ring ring-a" /><i className="orb-ring ring-b" /></div>
      <p className="voice-coach-copy">{status === "connected" ? "I’m listening. Take your time." : "A kind, patient coach is ready to practise with you."}</p>
      <p className="voice-timer" aria-live="polite">{minutes}</p>
      {/* Live captions are rendered below when the provider emits transcript events. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Realtime transcript events are rendered as live captions below. */}
      <audio ref={audioRef} autoPlay aria-label="SpeakIT AI spoken response" />
      {!isLive ? <button className="button button-primary button-call" onClick={startCall}>Start voice practice</button> :
        <div className="call-buttons"><button className={`button ${muted ? "button-warning" : "button-quiet"}`} onClick={toggleMute} aria-pressed={muted} disabled={status !== "connected"}>{muted ? "Unmute microphone" : "Mute microphone"}</button><button className="button button-danger" onClick={endCall} disabled={status === "connecting"}>End call</button></div>}
      <label className="consent-option"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={isLive} />Save an available transcript with this session <span>(optional; off by default)</span></label>
      <p className="privacy-note">Your microphone audio is streamed to the AI provider for this call and is not saved by SpeakIT. Transcript storage happens only if you opt in.</p>
      {error && <p className="form-message" role="alert">{error}</p>}
      {transcript.length > 0 && <div className="transcript-box" aria-live="polite"><h3>Live captions</h3>{transcript.map((line, index) => <p key={`${index}-${line.speaker}`}><strong>{line.speaker}:</strong> {line.content}</p>)}</div>}
      {status === "connected" && !turnsSupported && <p className="muted">Live captions are not available in this session. {consent ? "No transcript will be saved." : ""}</p>}
      {status === "ended" && <p className="success-message" role="status">Nice work showing up for your practice today.</p>}
      <span className="sr-only">Current learner level: {preferences.english_level}</span>
    </section>
  );
}
