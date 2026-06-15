import React, { useMemo } from "react";
import { C } from "../constants";
import { DayRow, Schedule } from "../types";
import { getLectureRevProgress } from "../engine";

function grade(pct: number): { letter: string; color: string } {
  if (pct >= 90) return { letter: "A", color: C.green };
  if (pct >= 75) return { letter: "B", color: C.blue };
  if (pct >= 50) return { letter: "C", color: C.yellow };
  if (pct >= 25) return { letter: "D", color: C.orange };
  return { letter: "F", color: C.red };
}

export function Reports({ schedule, done, startDay, getLecName }: {
  schedule: Schedule;
  done: Record<string, boolean>;
  startDay: number;
  getLecName: (ln: number) => string;
}) {
  // ── Weekly report ──────────────────────────────────────────────────
  const weeks = useMemo(() => {
    const pastDays = schedule.allDays.filter(r => r.day <= startDay);
    const result: { weekNum: number; days: DayRow[]; total: number; doneCount: number }[] = [];
    for (let i = 0; i < pastDays.length; i += 7) {
      const chunk = pastDays.slice(i, i + 7);
      let total = 0, doneCount = 0;
      for (const row of chunk) {
        const keys = [...row.lecs.map(ln => `new-${ln}`), ...row.revisions.map(r => `rev-${row.day}-${r.ln}-${r.iv}`)];
        total += keys.length;
        doneCount += keys.filter(k => done[k]).length;
      }
      result.push({ weekNum: Math.floor(i / 7) + 1, days: chunk, total, doneCount });
    }
    return result.reverse();
  }, [schedule.allDays, done, startDay]);

  // ── Lecture completion tracker ──────────────────────────────────────
  const lectureProgress = useMemo(() => {
    const totalRevs = schedule.allDays[0]?.revisions.length !== undefined
      ? (() => {
          // Count how many revision slots exist per lecture by examining revision intervals
          const ln1Revs = schedule.allDays.flatMap(r => r.revisions.filter(rv => rv.ln === 1));
          return ln1Revs.length;
        })()
      : 0;

    return Array.from({ length: schedule.totalLectures }, (_, i) => {
      const ln = i + 1;
      const prog = getLectureRevProgress(ln, schedule, done, totalRevs || 8);
      const newDone = !!done[`new-${ln}`];
      return { ln, ...prog, newDone };
    });
  }, [schedule, done]);

  const totalPct = weeks.length > 0
    ? Math.round(weeks.reduce((a, w) => a + w.doneCount, 0) / Math.max(1, weeks.reduce((a, w) => a + w.total, 0)) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          ["Total weeks tracked", weeks.length, C.accent],
          ["Overall completion", `${totalPct}%`, totalPct >= 75 ? C.green : totalPct >= 50 ? C.yellow : C.red],
          ["Lectures tracked", schedule.totalLectures, C.blue],
        ].map(([label, val, color]) => (
          <div key={String(label)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", textAlign: "center", flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: String(color) }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Weekly report card */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Weekly Report Card</div>
        {weeks.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13 }}>No completed weeks yet — keep studying!</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "80px 60px 1fr 80px 40px", gap: 8, padding: "4px 12px", fontSize: 10, color: C.muted, fontWeight: 600 }}>
              <span>WEEK</span><span>DAYS</span><span>PROGRESS</span><span>TASKS</span><span>GRADE</span>
            </div>
            {weeks.map(w => {
              const pct = w.total === 0 ? 100 : Math.round((w.doneCount / w.total) * 100);
              const g = grade(pct);
              const startD = w.days[0]?.day;
              const endD = w.days[w.days.length - 1]?.day;
              return (
                <div key={w.weekNum} style={{ display: "grid", gridTemplateColumns: "80px 60px 1fr 80px 40px", gap: 8, alignItems: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Week {w.weekNum}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>D{startD}–{endD}</div>
                  <div>
                    <div style={{ height: 6, background: C.faint, borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct >= 75 ? C.green : pct >= 50 ? C.yellow : C.red, borderRadius: 100 }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{pct}%</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{w.doneCount}/{w.total}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: g.color }}>{g.letter}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lecture completion tracker */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>Lecture Completion Tracker</div>
        {schedule.totalLectures === 0 ? (
          <div style={{ color: C.muted, fontSize: 13 }}>No lectures in your plan yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px", gap: 8, padding: "3px 10px", fontSize: 10, color: C.muted, fontWeight: 600 }}>
              <span>LECTURE</span><span>REVISION PROGRESS</span><span>STATUS</span>
            </div>
            {lectureProgress.map(({ ln, completed, total, newDone }) => {
              const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
              const allRevsDone = completed === total;
              const statusColor = allRevsDone ? C.green : completed > 0 ? C.yellow : newDone ? C.blue : C.muted;
              const statusText = allRevsDone ? "✓ Complete" : completed > 0 ? `${completed}/${total}` : newDone ? "Learned" : "Pending";
              return (
                <div key={ln} style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px", gap: 8, alignItems: "center", background: C.surface, border: `1px solid ${allRevsDone ? C.green + "44" : C.border}`, borderRadius: 7, padding: "7px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: allRevsDone ? C.green : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getLecName(ln)}
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {Array.from({ length: total }, (_, i) => (
                        <div key={i} style={{ flex: 1, height: 5, borderRadius: 100, background: i < completed ? C.green : C.faint }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: statusColor, textAlign: "right" }}>{statusText}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
