import React, { useState } from "react";
import { C } from "../constants";
import { DayRow } from "../types";
import { dateForDay } from "../engine";

export function MonthlyCalendar({ allDays, startDate, startDay, done, onJump }: {
  allDays: DayRow[];
  startDate: string;
  startDay: number;
  done: Record<string, boolean>;
  onJump: (day: number) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  if (!startDate) return (
    <div style={{ color: C.muted, fontSize: 14 }}>Set a start date in Settings to use the calendar view.</div>
  );

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  function dayNumForDate(d: Date): number | null {
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - start.getTime()) / 86400000) + 1;
    if (diff < 1 || diff > allDays.length) return null;
    return diff;
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  let startWeekday = firstOfMonth.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1; // Mon=0

  const cells: (Date | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function cellInfo(date: Date | null) {
    if (!date) return null;
    const dn = dayNumForDate(new Date(date));
    if (!dn) return null;
    const row = allDays[dn - 1];
    if (!row) return null;
    const keys = [...row.lecs.map(ln => `new-${ln}`), ...row.revisions.map(r => `rev-${row.day}-${r.ln}-${r.iv}`)];
    const total = keys.length;
    const doneCount = keys.filter(k => done[k]).length;
    const isHoliday = row.isStudy && row.count === 0;
    const isFuture = dn > startDay;
    const isToday = dn === startDay;
    return { dn, row, total, doneCount, isHoliday, isFuture, isToday };
  }

  function cellBg(info: ReturnType<typeof cellInfo>) {
    if (!info) return "transparent";
    if (info.isToday) return C.accentDim;
    if (info.isHoliday) return C.redDim;
    if (info.isFuture) return C.faint + "44";
    if (info.total === 0) return C.surface;
    if (info.doneCount === info.total) return C.greenDim;
    if (info.doneCount > 0) return C.yellowDim;
    return "#3b0a0a";
  }

  function cellBorder(info: ReturnType<typeof cellInfo>) {
    if (!info) return "transparent";
    if (info.isToday) return C.accent;
    if (info.isHoliday) return C.red + "55";
    if (info.isFuture) return C.faint;
    if (info.total === 0) return C.border;
    if (info.doneCount === info.total) return C.green + "66";
    if (info.doneCount > 0) return C.yellow + "55";
    return C.red + "44";
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const monthName = firstOfMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <button onClick={prevMonth} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 12px", color: C.text, cursor: "pointer", fontSize: 16 }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: C.text }}>{monthName}</div>
        <button onClick={nextMonth} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 12px", color: C.text, cursor: "pointer", fontSize: 16 }}>›</button>
        <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          style={{ background: C.accentDim, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "4px 10px", color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          Today
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: C.muted, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((date, i) => {
          const info = cellInfo(date);
          return (
            <div key={i}
              onClick={() => info && !info.isFuture && onJump(info.dn)}
              style={{
                minHeight: 52, borderRadius: 8, padding: "5px 6px",
                background: date ? cellBg(info) : "transparent",
                border: `1px solid ${date ? cellBorder(info) : "transparent"}`,
                cursor: info && !info.isFuture ? "pointer" : "default",
                transition: "transform 0.1s",
              }}
              onMouseOver={e => { if (info && !info.isFuture) (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
              {date && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: info?.isToday ? C.accent : C.text }}>
                    {date.getDate()}
                  </div>
                  {info && (
                    <div style={{ marginTop: 2 }}>
                      {info.isHoliday && <div style={{ fontSize: 8, color: C.red }}>Holiday</div>}
                      {!info.isHoliday && info.row.lecs.length > 0 && (
                        <div style={{ fontSize: 8, color: C.green }}>{info.row.lecs.length} new</div>
                      )}
                      {!info.isHoliday && info.row.revisions.length > 0 && (
                        <div style={{ fontSize: 8, color: C.yellow }}>{info.row.revisions.length} rev</div>
                      )}
                      {!info.isFuture && info.total > 0 && (
                        <div style={{ fontSize: 8, color: info.doneCount === info.total ? C.green : info.doneCount > 0 ? C.yellow : C.red }}>
                          {info.doneCount}/{info.total}
                        </div>
                      )}
                      {info.isToday && <div style={{ fontSize: 8, color: C.accent, fontWeight: 700 }}>TODAY</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        {([["Done", C.green, C.greenDim], ["Partial", C.yellow, C.yellowDim], ["Missed", C.red, "#3b0a0a"], ["Holiday", C.red, C.redDim], ["Future", C.faint, C.faint + "44"]] as [string, string, string][]).map(([label, border, bg]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
            <span style={{ fontSize: 10, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
