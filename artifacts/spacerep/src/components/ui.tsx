import React from "react";
import { C, btnStyle, inputStyle } from "../constants";

export function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${color}33`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: color + "18", padding: "9px 14px", fontSize: 13, fontWeight: 700, color, borderBottom: `1px solid ${color}22` }}>{title}</div>
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

export function TaskRow({
  done, color, onToggle, label, sublabel, onRename, onPostpone, note, onNoteChange, progress,
}: {
  done: boolean; color: string; onToggle: () => void;
  label: string; sublabel: string; onRename: () => void;
  onPostpone?: () => void;
  note?: string; onNoteChange?: (n: string) => void;
  progress?: { completed: number; total: number };
}) {
  const [showNote, setShowNote] = React.useState(false);
  return (
    <div style={{ background: done ? C.bg : C.card, borderRadius: 8, border: `1px solid ${done ? C.border : color + "33"}`, opacity: done ? 0.55 : 1, transition: "all 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px" }}>
        <button onClick={onToggle} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${color}`, background: done ? color : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 900, fontSize: 13 }}>
          {done ? "✓" : ""}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textDecoration: done ? "line-through" : "none", color: done ? C.muted : C.text }}>{label}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{sublabel}</div>
          {progress && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <div style={{ flex: 1, maxWidth: 100, height: 3, background: C.faint, borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(progress.completed / progress.total) * 100}%`, background: progress.completed === progress.total ? C.green : C.yellow, borderRadius: 100 }} />
              </div>
              <span style={{ fontSize: 9, color: C.muted }}>{progress.completed}/{progress.total} revisions done</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {onNoteChange && (
            <button onClick={() => setShowNote(s => !s)} title="Note" style={{ background: "none", border: "none", color: note ? C.yellow : C.muted, cursor: "pointer", fontSize: 14, padding: "2px 5px", borderRadius: 5 }}>📝</button>
          )}
          {onPostpone && (
            <button onClick={onPostpone} title="Postpone to tomorrow" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: "2px 5px", borderRadius: 5 }}>⏭</button>
          )}
          <button onClick={onRename} title="Rename" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "2px 5px", borderRadius: 5 }}>✎</button>
        </div>
      </div>
      {showNote && onNoteChange && (
        <div style={{ padding: "0 10px 8px" }}>
          <textarea
            rows={2}
            placeholder="Add a note, page number, link…"
            value={note ?? ""}
            onChange={e => onNoteChange(e.target.value)}
            style={{ width: "100%", ...inputStyle, fontSize: 12, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
          />
        </div>
      )}
    </div>
  );
}

export function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", background: color + "18", border: `1px solid ${color}44`, borderRadius: 5, padding: "2px 7px", fontSize: 11, color, fontWeight: 600, marginRight: 3, marginBottom: 2 }}>
      {children}
    </span>
  );
}

export function Callout({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: color + "18", border: `1px solid ${color}44`, borderRadius: 10, padding: "14px 18px", color, fontSize: 14 }}>
      {children}
    </div>
  );
}

export function SettingCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{desc}</div>
      {children}
    </div>
  );
}

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const isHot = streak >= 7;
  const isMid = streak >= 3;
  const color = isHot ? C.red : isMid ? C.yellow : C.green;
  const bg    = isHot ? C.redDim : isMid ? C.yellowDim : C.greenDim;
  const emoji = isHot ? "🔥" : isMid ? "⚡" : "✨";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: bg, border: `1px solid ${color}55`, borderRadius: 20, padding: "4px 10px" }}>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{streak}</span>
      <span style={{ fontSize: 10, color, opacity: 0.8, fontWeight: 500 }}>day{streak !== 1 ? "s" : ""}</span>
    </div>
  );
}

export { btnStyle, inputStyle };
