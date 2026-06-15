import React, { useState } from "react";
import { C } from "../constants";
import { DayRow } from "../types";
import { formatDateShort, dateForDay } from "../engine";

interface HeatmapCell {
  day: number; total: number; doneCount: number; isFuture: boolean; isHoliday: boolean;
}

export function HeatmapView({ allDays, startDay, startDate, done, onJump }: {
  allDays: DayRow[];
  startDay: number;
  startDate: string;
  done: Record<string, boolean>;
  onJump: (day: number) => void;
}) {
  const [tooltip, setTooltip] = useState<{ day: number; x: number; y: number } | null>(null);

  const cells: HeatmapCell[] = allDays.map(row => {
    const keys = [
      ...row.lecs.map(ln => `new-${ln}`),
      ...row.revisions.map(r => `rev-${row.day}-${r.ln}-${r.iv}`),
    ];
    const total = keys.length;
    const doneCount = keys.filter(k => done[k]).length;
    const isHoliday = row.isStudy && row.count === 0;
    return { day: row.day, total, doneCount, isFuture: row.day > startDay, isHoliday };
  });

  let longestStreak = 0, cur = 0;
  for (const c of cells) {
    if (c.isFuture) break;
    if (c.total === 0) continue;
    if (c.doneCount === c.total) { cur++; longestStreak = Math.max(longestStreak, cur); }
    else cur = 0;
  }

  const totalCompleted = cells.filter(c => !c.isFuture && c.total > 0 && c.doneCount === c.total).length;
  const totalPartial   = cells.filter(c => !c.isFuture && c.total > 0 && c.doneCount > 0 && c.doneCount < c.total).length;
  const totalMissed    = cells.filter(c => !c.isFuture && c.total > 0 && c.doneCount === 0).length;

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const CELL = 18, GAP = 3;

  function cellColor(c: HeatmapCell) {
    if (c.isFuture) return C.faint;
    if (c.isHoliday) return C.redDim;
    if (c.total === 0) return C.surface;
    if (c.doneCount === 0) return "#3b0a0a";
    if (c.doneCount === c.total) return C.greenDim;
    return C.yellowDim;
  }

  function cellBorder(c: HeatmapCell) {
    if (c.isFuture) return C.faint;
    if (c.isHoliday) return C.red + "44";
    if (c.total === 0) return C.border;
    if (c.doneCount === 0) return C.red + "44";
    if (c.doneCount === c.total) return C.green + "66";
    return C.yellow + "55";
  }

  const tooltipCell = tooltip ? cells[tooltip.day - 1] : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {([["Completed", totalCompleted, C.green], ["Partial", totalPartial, C.yellow], ["Missed", totalMissed, C.red], ["Best Streak", longestStreak, C.accent]] as [string, number, string][]).map(([label, val, color]) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 9, color: C.muted }}>day{val !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>Legend:</span>
        {([["All done", C.green, C.greenDim], ["Partial", C.yellow, C.yellowDim], ["Missed", C.red, "#3b0a0a"], ["Holiday", C.red, C.redDim], ["No tasks", C.muted, C.surface], ["Future", C.faint, C.faint]] as [string, string, string][]).map(([label, border, bg]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: CELL, height: CELL, borderRadius: 4, background: bg, border: `1px solid ${border}` }} />
            <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: GAP, marginBottom: GAP, paddingLeft: startDate ? 28 : 0 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} style={{ width: CELL, fontSize: 8, color: C.muted, textAlign: "center" }}>{d}</div>
        ))}
      </div>

      <div style={{ position: "relative" }} onMouseLeave={() => setTooltip(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
          {weeks.map((week, wi) => {
            const firstDayInWeek = week[0];
            const monthLabel = startDate && firstDayInWeek
              ? (() => {
                  const d = dateForDay(startDate, firstDayInWeek.day);
                  const prev = wi > 0 ? dateForDay(startDate, weeks[wi - 1][0].day) : null;
                  if (d && (!prev || d.getMonth() !== prev.getMonth())) return d.toLocaleDateString("en-IN", { month: "short" });
                  return null;
                })()
              : null;

            return (
              <div key={wi} style={{ display: "flex", alignItems: "center", gap: GAP }}>
                {startDate && <div style={{ width: 24, fontSize: 8, color: C.accent, textAlign: "right", flexShrink: 0, marginRight: 2 }}>{monthLabel || ""}</div>}
                {week.map(c => (
                  <div
                    key={c.day}
                    onClick={() => !c.isFuture && onJump(c.day)}
                    onMouseEnter={e => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({ day: c.day, x: rect.left, y: rect.bottom });
                    }}
                    style={{ width: CELL, height: CELL, borderRadius: 4, background: cellColor(c), border: `1px solid ${cellBorder(c)}`, cursor: c.isFuture ? "default" : "pointer", transition: "transform 0.1s", flexShrink: 0, boxSizing: "border-box" }}
                    onMouseOver={e => { if (!c.isFuture) (e.currentTarget as HTMLElement).style.transform = "scale(1.3)"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {tooltip && tooltipCell && (
          <div style={{ position: "fixed", left: tooltip.x, top: tooltip.y + 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, zIndex: 500, pointerEvents: "none", boxShadow: "0 4px 16px #0008", minWidth: 140 }}>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 3 }}>Day {tooltipCell.day}</div>
            {startDate && <div style={{ color: C.accent, marginBottom: 4 }}>{formatDateShort(dateForDay(startDate, tooltipCell.day))}</div>}
            {tooltipCell.isFuture ? <div style={{ color: C.muted }}>Not yet</div>
              : tooltipCell.isHoliday ? <div style={{ color: C.red }}>Holiday</div>
              : tooltipCell.total === 0 ? <div style={{ color: C.muted }}>No tasks</div>
              : <>
                  <div style={{ color: tooltipCell.doneCount === tooltipCell.total ? C.green : tooltipCell.doneCount > 0 ? C.yellow : C.red }}>
                    {tooltipCell.doneCount}/{tooltipCell.total} tasks done
                  </div>
                  <div style={{ color: C.muted, marginTop: 2 }}>Click to jump to this day</div>
                </>
            }
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 16 }}>Click any past day to jump to it in the Today view.</div>
    </div>
  );
}
