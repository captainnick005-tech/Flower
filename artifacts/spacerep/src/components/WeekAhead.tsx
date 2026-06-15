import React from "react";
import { C } from "../constants";
import { Tag } from "./ui";
import { DayRow } from "../types";
import { formatDateShort, dateForDay } from "../engine";

export function WeekAhead({ allDays, fromDay, planEnd, startDate, getLecName, onJump }: {
  allDays: DayRow[];
  fromDay: number;
  planEnd: number;
  startDate: string;
  getLecName: (ln: number) => string;
  onJump: (day: number) => void;
}) {
  const days = allDays.slice(fromDay - 1, fromDay + 6).filter(r => r.day <= planEnd);
  if (!days.length) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        Next 7 Days
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {days.map(row => {
          const isHoliday = row.isStudy && row.count === 0;
          const totalTasks = row.lecs.length + row.revisions.length;
          const dateStr = startDate ? formatDateShort(dateForDay(startDate, row.day)) : "";
          return (
            <div
              key={row.day}
              onClick={() => onJump(row.day)}
              style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}
              onMouseOver={e => (e.currentTarget.style.borderColor = C.accent)}
              onMouseOut={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <div style={{ minWidth: 54, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.muted }}>DAY</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: isHoliday ? C.red : row.isStudy ? C.blue : C.muted }}>{row.day}</div>
              </div>
              {dateStr && <div style={{ fontSize: 10, color: C.accent, minWidth: 80 }}>{dateStr}</div>}
              <div style={{ flex: 1, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {isHoliday
                  ? <Tag color={C.red}>Holiday</Tag>
                  : row.lecs.length > 0
                  ? <Tag color={C.green}>{row.lecs.length} new</Tag>
                  : null
                }
                {row.revisions.length > 0 && <Tag color={C.yellow}>{row.revisions.length} revisions</Tag>}
                {totalTasks === 0 && !isHoliday && <span style={{ fontSize: 11, color: C.faint }}>No tasks</span>}
              </div>
              <div style={{ fontSize: 10, color: C.muted }}>→</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
