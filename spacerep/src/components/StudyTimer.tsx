import React, { useState, useEffect, useRef } from "react";
import { C, btnStyle } from "../constants";

type TimerMode = "work" | "short" | "long";

const PRESETS: Record<TimerMode, { label: string; minutes: number; color: string }> = {
  work:  { label: "Focus",       minutes: 25, color: C.accent },
  short: { label: "Short Break", minutes: 5,  color: C.green },
  long:  { label: "Long Break",  minutes: 15, color: C.blue },
};

export function StudyTimer() {
  const [mode, setMode]         = useState<TimerMode>("work");
  const [running, setRunning]   = useState(false);
  const [seconds, setSeconds]   = useState(PRESETS.work.minutes * 60);
  const [sessions, setSessions] = useState(0);
  const [custom, setCustom]     = useState<Record<TimerMode, number>>({ work: 25, short: 5, long: 15 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = custom[mode] * 60;
  const preset = PRESETS[mode];

  useEffect(() => {
    setSeconds(custom[mode] * 60);
    setRunning(false);
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (mode === "work") setSessions(n => n + 1);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ SpaceRep Timer", {
                body: mode === "work" ? "Focus session complete! Time for a break." : "Break over! Back to studying.",
                icon: "/favicon.svg",
              });
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode]);

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const progress = 1 - seconds / totalSeconds;

  const reset = () => {
    setRunning(false);
    setSeconds(custom[mode] * 60);
  };

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = circumference * (1 - progress);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, paddingTop: 10 }}>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, background: C.surface, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
        {(Object.keys(PRESETS) as TimerMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
            background: mode === m ? PRESETS[m].color : "transparent",
            color: mode === m ? "#fff" : C.muted,
            fontWeight: mode === m ? 700 : 400, fontSize: 13,
          }}>{PRESETS[m].label}</button>
        ))}
      </div>

      {/* Circular timer */}
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r={radius} fill="none" stroke={C.faint} strokeWidth="8" />
          <circle cx="100" cy="100" r={radius} fill="none" stroke={preset.color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={strokeDash}
            strokeLinecap="round" style={{ transition: running ? "stroke-dashoffset 1s linear" : "none" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: preset.color, letterSpacing: 2, fontVariantNumeric: "tabular-nums" }}>{mins}:{secs}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{preset.label}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setRunning(r => !r)} style={{ ...btnStyle(preset.color, true), minWidth: 100, fontSize: 15 }}>
          {running ? "⏸ Pause" : seconds === totalSeconds ? "▶ Start" : "▶ Resume"}
        </button>
        <button onClick={reset} style={btnStyle(C.surface)}>↺ Reset</button>
      </div>

      {/* Session count */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {Array.from({ length: Math.max(4, sessions) }, (_, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: i < sessions ? preset.color : C.faint, border: `1px solid ${i < sessions ? preset.color : C.border}` }} />
        ))}
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{sessions} session{sessions !== 1 ? "s" : ""} today</span>
      </div>

      {/* Custom durations */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>Custom Durations (minutes)</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {(Object.keys(PRESETS) as TimerMode[]).map(m => (
            <div key={m} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>{PRESETS[m].label}</div>
              <input type="number" min={1} max={120} value={custom[m]}
                onChange={e => {
                  const v = Math.max(1, Math.min(120, +e.target.value || 1));
                  setCustom(prev => ({ ...prev, [m]: v }));
                  if (mode === m) { setSeconds(v * 60); setRunning(false); }
                }}
                style={{ width: 52, padding: "5px 4px", background: C.bg, border: `1px solid ${PRESETS[m].color}`, borderRadius: 6, color: PRESETS[m].color, fontSize: 16, fontWeight: 700, textAlign: "center" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", maxWidth: 300 }}>
        Work 25 min → Short break 5 min. After 4 sessions → Long break 15 min.
      </div>
    </div>
  );
}
