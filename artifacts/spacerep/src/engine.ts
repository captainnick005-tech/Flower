import { Plan, Schedule, StorageV4, StudyDay, RevItem, DayRow } from "./types";
import { DEFAULT_INTERVALS, intervalsToLabels } from "./constants";

// ─── Storage ────────────────────────────────────────────────────────
const STORAGE_KEY = "srs_planner_v4";

export function saveAll(data: StorageV4) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function loadAll(): StorageV4 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StorageV4;
  } catch {}
  return null;
}

export function migrateFromV3(): StorageV4 | null {
  try {
    const raw = localStorage.getItem("srs_planner_v3") ?? sessionStorage.getItem("srs_planner_v3")
             ?? localStorage.getItem("srs_planner_v2") ?? sessionStorage.getItem("srs_planner_v2");
    if (!raw) return null;
    const old = JSON.parse(raw) as Record<string, unknown>;
    const plan = makePlan("Main Plan", old);
    return {
      plans: [plan],
      activePlanId: plan.id,
      notifTime: (old.notifTime as string) ?? "08:00",
      notifEnabled: (old.notifEnabled as boolean) ?? false,
    };
  } catch {}
  return null;
}

export function makePlan(name: string, seed?: Record<string, unknown>): Plan {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    totalDays: (seed?.totalDays as number) ?? 20,
    inputs: (seed?.inputs as Record<number, string | number>) ?? {},
    startDate: (seed?.startDate as string) ?? todayYMD(),
    startDay: (seed?.startDay as number) ?? 1,
    lectureNames: (seed?.lectureNames as Record<number, string>) ?? {},
    lectureNotes: (seed?.lectureNotes as Record<number, string>) ?? {},
    lectureTags: (seed?.lectureTags as Record<number, string>) ?? {},
    done: (seed?.done as Record<string, boolean>) ?? {},
    customIntervals: (seed?.customIntervals as number[]) ?? [...DEFAULT_INTERVALS],
    postponed: (seed?.postponed as Record<string, number>) ?? {},
  };
}

// ─── Date helpers ───────────────────────────────────────────────────
export const toYMD = (date: Date) => date.toISOString().slice(0, 10);
export const todayYMD = () => toYMD(new Date());

export function dateForDay(startDateStr: string, dayNum: number): Date | null {
  if (!startDateStr) return null;
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + dayNum - 1);
  return d;
}

export function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

export function formatDateShort(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
}

export function currentDayNum(startDateStr: string): number {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((now.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

// ─── Schedule engine ────────────────────────────────────────────────
export function buildSchedule(
  totalDays: number,
  inputs: Record<number, string | number>,
  startDay: number,
  intervals: number[],
  postponed: Record<string, number>,
): Schedule {
  const labels = intervalsToLabels(intervals);
  let lecNum = 1;
  const studyDays: StudyDay[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const raw = inputs[d];
    const count = raw === undefined ? 2 : Math.max(0, parseInt(String(raw)) || 0);
    const lecs: number[] = [];
    for (let i = 0; i < count; i++) lecs.push(lecNum++);
    studyDays.push({ day: d, count, lecs });
  }

  const totalLectures = lecNum - 1;
  const planEnd = totalDays + Math.max(...intervals, 90);

  const revMap: Record<number, RevItem[]> = {};
  for (let d = 1; d <= planEnd; d++) revMap[d] = [];

  for (const { day, lecs } of studyDays) {
    for (const ln of lecs) {
      for (let i = 0; i < intervals.length; i++) {
        const scheduledDay = day + intervals[i];
        const originalKey = `${day}-${ln}-${intervals[i]}`;
        const targetDay = postponed[originalKey] ?? scheduledDay;
        if (targetDay <= planEnd) {
          revMap[targetDay].push({
            ln,
            iv: intervals[i],
            ivLabel: labels[i],
            fromDay: day,
            originalKey,
            postponed: !!postponed[originalKey],
          });
        }
      }
    }
  }

  const allDays: DayRow[] = [];
  for (let d = 1; d <= planEnd; d++) {
    const sd = studyDays[d - 1];
    allDays.push({
      day: d,
      isStudy: d <= totalDays,
      count: sd?.count ?? 0,
      lecs: sd?.lecs ?? [],
      revisions: revMap[d],
    });
  }

  const todayRow = startDay >= 1 && startDay <= planEnd ? allDays[startDay - 1] : null;
  return { allDays, totalLectures, planEnd, studyDays, todayRow };
}

// ─── Lecture progress ────────────────────────────────────────────────
// How many revision sessions for a lecture have been completed (not counting new)
export function getLectureRevProgress(
  ln: number,
  schedule: Schedule,
  done: Record<string, boolean>,
  totalRevisions: number,
): { completed: number; total: number } {
  let completed = 0;
  for (const row of schedule.allDays) {
    for (const rev of row.revisions) {
      if (rev.ln !== ln) continue;
      const key = `rev-${row.day}-${rev.ln}-${rev.iv}`;
      if (done[key]) completed++;
    }
  }
  return { completed, total: totalRevisions };
}
