import React, { useState, useMemo, useEffect, useCallback } from "react";
import ExcelJS from "exceljs";
import { Plan, StorageV4 } from "./types";
import { buildSchedule, saveAll, loadAll, migrateFromV3, makePlan, dateForDay, formatDate, formatDateShort, currentDayNum, todayYMD } from "./engine";
import { C, btnStyle, inputStyle, DEFAULT_INTERVALS, intervalsToLabels } from "./constants";
import { Section, TaskRow, Tag, Callout, SettingCard, StreakBadge } from "./components/ui";
import { WeekAhead } from "./components/WeekAhead";
import { HeatmapView } from "./components/HeatmapView";
import { StudyTimer } from "./components/StudyTimer";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { Reports } from "./components/Reports";

// ─── Bootstrap storage ───────────────────────────────────────────────
function getInitialStorage(): StorageV4 {
  const v4 = loadAll();
  if (v4) return v4;
  const migrated = migrateFromV3();
  if (migrated) { saveAll(migrated); return migrated; }
  const plan = makePlan("Main Plan");
  const fresh: StorageV4 = { plans: [plan], activePlanId: plan.id, notifTime: "08:00", notifEnabled: false };
  saveAll(fresh);
  return fresh;
}

// ─── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [storage, setStorage] = useState<StorageV4>(getInitialStorage);

  const updateStorage = useCallback((patch: Partial<StorageV4>) => {
    setStorage(prev => ({ ...prev, ...patch }));
  }, []);

  const activePlan: Plan = useMemo(
    () => storage.plans.find(p => p.id === storage.activePlanId) ?? storage.plans[0],
    [storage.plans, storage.activePlanId]
  );

  const updatePlan = useCallback((patch: Partial<Plan>) => {
    setStorage(prev => ({
      ...prev,
      plans: prev.plans.map(p => p.id === prev.activePlanId ? { ...p, ...patch } : p),
    }));
  }, []);

  // ── Destructure active plan ─────────────────────────────────────────
  const { totalDays, inputs, startDate, startDay, lectureNames, lectureNotes, lectureTags, done, customIntervals, postponed } = activePlan;

  const setTotalDays    = (v: number)                                   => updatePlan({ totalDays: v });
  const setInputs       = (fn: (p: Record<number, string|number>) => Record<number, string|number>) => updatePlan({ inputs: fn(inputs) });
  const setStartDate    = (v: string)                                   => updatePlan({ startDate: v });
  const setStartDay     = (v: number | ((d: number) => number))        => updatePlan({ startDay: typeof v === "function" ? v(startDay) : v });
  const setLectureNames = (fn: (p: Record<number, string>) => Record<number, string>) => updatePlan({ lectureNames: fn(lectureNames) });
  const setLectureNotes = (fn: (p: Record<number, string>) => Record<number, string>) => updatePlan({ lectureNotes: fn(lectureNotes) });
  const setLectureTags  = (fn: (p: Record<number, string>) => Record<number, string>) => updatePlan({ lectureTags: fn(lectureTags) });
  const setDone         = (fn: (p: Record<string, boolean>) => Record<string, boolean>) => updatePlan({ done: fn(done) });
  const setCustomIntervals = (v: number[]) => updatePlan({ customIntervals: v });
  const setPostponed    = (fn: (p: Record<string, number>) => Record<string, number>) => updatePlan({ postponed: fn(postponed) });

  const { notifTime, notifEnabled } = storage;
  const setNotifTime    = (v: string)   => updateStorage({ notifTime: v });
  const setNotifEnabled = (v: boolean)  => updateStorage({ notifEnabled: v });

  // ── View state ──────────────────────────────────────────────────────
  const [view, setView]             = useState<string>("today");
  const [toast, setToast]           = useState<{msg: string; color: string} | null>(null);
  const [searchQ, setSearchQ]       = useState<string>("");
  const [tagFilter, setTagFilter]   = useState<string>("");
  const [schedPage, setSchedPage]   = useState<number>(1);
  const PAGE_SIZE = 30;
  const [editingName, setEditingName]   = useState<number | null>(null);
  const [bulkImport, setBulkImport]     = useState<string>("");
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [showShareCard, setShowShareCard]     = useState<boolean>(false);
  const [showPlanManager, setShowPlanManager] = useState<boolean>(false);
  const [newPlanName, setNewPlanName]         = useState<string>("");
  const [editPlanNameId, setEditPlanNameId]   = useState<string | null>(null);

  // ── Auto-advance day from startDate ────────────────────────────────
  useEffect(() => {
    if (startDate) {
      const d = currentDayNum(startDate);
      setStartDay(d);
    }
  }, [startDate]);

  // ── Schedule ────────────────────────────────────────────────────────
  const sched = useMemo(() =>
    buildSchedule(totalDays, inputs, startDay, customIntervals, postponed),
    [totalDays, inputs, startDay, customIntervals, postponed]
  );

  // ── Debounced save ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => saveAll(storage), 800);
    return () => clearTimeout(t);
  }, [storage]);

  // ── Helpers ─────────────────────────────────────────────────────────
  const showToast = (msg: string, color = C.green) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const getLecName = (ln: number) => lectureNames[ln] || `Lecture ${ln}`;
  const getLecTag  = (ln: number) => lectureTags[ln] || "";

  const toggleDone = (key: string) => setDone(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Notifications ───────────────────────────────────────────────────
  const fireNotif = useCallback(() => {
    if (!sched.todayRow || !("Notification" in window) || Notification.permission !== "granted") return;
    const today = sched.todayRow;
    const lastKey = "srs_notif_last_day";
    const todayKey = `${startDay}_${new Date().toDateString()}`;
    if (localStorage.getItem(lastKey) === todayKey) return;
    localStorage.setItem(lastKey, todayKey);
    new Notification("📚 Study Reminder – SpaceRep", {
      body: `Day ${startDay}: ${today.lecs.length} new + ${today.revisions.length} revisions due today.`,
      icon: "/favicon.svg", tag: "spacerep-daily",
    });
  }, [sched.todayRow, startDay]);

  const scheduleNotif = useCallback(() => {
    if (!notifEnabled || !sched.todayRow || Notification.permission !== "granted") return;
    const [h, m] = notifTime.split(":").map(Number);
    const now = new Date(), target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) { fireNotif(); target.setDate(target.getDate() + 1); }
    const tid = setTimeout(() => { fireNotif(); scheduleNotif(); }, target.getTime() - now.getTime());
    return () => clearTimeout(tid);
  }, [notifEnabled, notifTime, sched.todayRow, startDay, fireNotif]);

  useEffect(() => { if (notifEnabled) return scheduleNotif(); }, [notifEnabled, notifTime, scheduleNotif]);

  const requestNotif = async () => {
    if (!("Notification" in window)) { showToast("Notifications not supported", C.red); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") { setNotifEnabled(true); showToast("Notifications enabled!"); scheduleNotif(); }
    else showToast("Permission denied", C.red);
  };

  // ── Stats ───────────────────────────────────────────────────────────
  const realTodayDay = startDate ? currentDayNum(startDate) : startDay;

  const todayDoneCount = sched.todayRow
    ? [...sched.todayRow.lecs.map(ln => `new-${ln}`), ...sched.todayRow.revisions.map(r => `rev-${sched.todayRow!.day}-${r.ln}-${r.iv}`)].filter(k => done[k]).length
    : 0;
  const todayTotal = sched.todayRow ? sched.todayRow.lecs.length + sched.todayRow.revisions.length : 0;

  const isRealToday = startDay === realTodayDay;
  useEffect(() => {
    if (isRealToday && todayTotal > 0 && todayDoneCount === todayTotal) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(t);
    } else setShowCelebration(false);
  }, [todayDoneCount, todayTotal, isRealToday]);

  const overallStats = useMemo(() => {
    let totalTasks = 0, doneTasks = 0;
    for (const row of sched.allDays) {
      if (row.day > realTodayDay) break;
      const keys = [...row.lecs.map(ln => `new-${ln}`), ...row.revisions.map(r => `rev-${row.day}-${r.ln}-${r.iv}`)];
      totalTasks += keys.length; doneTasks += keys.filter(k => done[k]).length;
    }
    return { totalTasks, doneTasks };
  }, [sched.allDays, realTodayDay, done]);

  const streak = useMemo(() => {
    let count = 0;
    for (let d = startDay; d >= 1; d--) {
      const row = sched.allDays[d - 1];
      if (!row) break;
      const keys = [...row.lecs.map(ln => `new-${ln}`), ...row.revisions.map(r => `rev-${row.day}-${r.ln}-${r.iv}`)];
      if (keys.length === 0) continue;
      if (!keys.every(k => done[k])) break;
      count++;
    }
    return count;
  }, [startDay, sched.allDays, done]);

  // ── Lecture revision progress (per lecture, how many of 8 revisions done) ──
  const lecRevProgress = useCallback((ln: number) => {
    let completed = 0, total = 0;
    for (const row of sched.allDays) {
      for (const rev of row.revisions) {
        if (rev.ln !== ln) continue;
        total++;
        if (done[`rev-${row.day}-${rev.ln}-${rev.iv}`]) completed++;
      }
    }
    return { completed, total };
  }, [sched.allDays, done]);

  // ── Unique tags for filter ───────────────────────────────────────────
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    Object.values(lectureTags).forEach(t => t && tags.add(t));
    return Array.from(tags).sort();
  }, [lectureTags]);

  // ── Filtered schedule ────────────────────────────────────────────────
  const filteredDays = useMemo(() => {
    return sched.allDays.filter(row => {
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const matchNew = row.lecs.some(n => getLecName(n).toLowerCase().includes(q) || `l${n}`.includes(q));
        const matchRev = row.revisions.some(r => getLecName(r.ln).toLowerCase().includes(q) || `l${r.ln}`.includes(q));
        if (!matchNew && !matchRev && !`day ${row.day}`.includes(q)) return false;
      }
      if (tagFilter) {
        const matchNew = row.lecs.some(n => getLecTag(n) === tagFilter);
        const matchRev = row.revisions.some(r => getLecTag(r.ln) === tagFilter);
        if (!matchNew && !matchRev) return false;
      }
      return true;
    });
  }, [searchQ, tagFilter, sched.allDays, lectureNames, lectureTags]);

  useEffect(() => { setSchedPage(1); }, [searchQ, tagFilter]);

  // ── Postpone a revision ──────────────────────────────────────────────
  const postponeRevision = (originalKey: string, currentDay: number) => {
    setPostponed(prev => ({ ...prev, [originalKey]: currentDay + 1 }));
    showToast("Revision moved to tomorrow ⏭");
  };

  // ── Backup & Restore ─────────────────────────────────────────────────
  const exportBackup = () => {
    const json = JSON.stringify(storage, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "spacerep-backup.json"; a.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded ✓");
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as StorageV4;
        if (!data.plans || !data.activePlanId) throw new Error("Invalid backup file");
        setStorage(data);
        showToast("Backup restored ✓");
      } catch {
        showToast("Invalid backup file", C.red);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Excel export ─────────────────────────────────────────────────────
  const exportXLSX = async () => {
    const labels = intervalsToLabels(customIntervals);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Full Schedule");
    ws.addRow(["Day", "Date", "New Lectures", ...labels.map(l => `Revise (${l})`)]);
    for (const row of sched.allDays) {
      const d = dateForDay(startDate, row.day);
      const dateStr = d ? formatDate(d) : "";
      const newLecs = row.lecs.length ? row.lecs.map(n => getLecName(n)).join(", ") : row.count === 0 && row.isStudy ? "Holiday" : "—";
      const revCols = customIntervals.map(iv => {
        const r = row.revisions.filter(r => r.iv === iv).map(r => getLecName(r.ln)).join(", ");
        return r || "—";
      });
      ws.addRow([`Day ${row.day}`, dateStr, newLecs, ...revCols]);
    }
    ws.columns = [8, 18, 22, ...customIntervals.map(() => 18)].map(w => ({ width: w }));

    if (sched.todayRow) {
      const t = sched.todayRow;
      const ws2 = wb.addWorksheet("Today");
      ws2.addRow([`Today — Day ${startDay}  |  ${startDate ? formatDate(dateForDay(startDate, startDay)) : ""}`]);
      ws2.addRow([]);
      ws2.addRow(["New Lectures"]);
      t.lecs.forEach(n => ws2.addRow([getLecName(n)]));
      ws2.addRow([]); ws2.addRow(["Revisions Due"]);
      t.revisions.forEach(r => ws2.addRow([getLecName(r.ln), r.ivLabel]));
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "spacerep_schedule.xlsx"; a.click();
    URL.revokeObjectURL(url);
    showToast("Excel exported!");
  };

  // ── Share card text ───────────────────────────────────────────────────
  const shareCardText = useMemo(() => {
    if (!sched.todayRow) return "";
    const t = sched.todayRow;
    const dateStr = startDate ? formatDate(dateForDay(startDate, startDay)) : "";
    let text = `📚 SpaceRep — Day ${startDay}${dateStr ? ` (${dateStr})` : ""}\n\n`;
    if (t.lecs.length > 0) {
      text += `✅ New Lectures:\n${t.lecs.map(ln => `  • ${getLecName(ln)}`).join("\n")}\n\n`;
    }
    if (t.revisions.length > 0) {
      text += `🔄 Revisions:\n${t.revisions.map(r => `  • ${getLecName(r.ln)} (${r.ivLabel})`).join("\n")}\n\n`;
    }
    text += `Progress: ${todayDoneCount}/${todayTotal} done\nStreak: ${streak} day${streak !== 1 ? "s" : ""} 🔥`;
    return text;
  }, [sched.todayRow, startDay, startDate, lectureNames, todayDoneCount, todayTotal, streak]);

  // ── Nav ───────────────────────────────────────────────────────────────
  const navItems = [
    { id: "today",    label: "Today" },
    { id: "input",    label: "Log Lectures" },
    { id: "schedule", label: "Full Schedule" },
    { id: "heatmap",  label: "Heatmap" },
    { id: "calendar", label: "Calendar" },
    { id: "reports",  label: "Reports" },
    { id: "timer",    label: "Timer" },
    { id: "settings", label: "Settings" },
  ];

  // ── Missed days check ─────────────────────────────────────────────────
  const missedDays = realTodayDay - startDay;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 16, right: 16, background: toast.color, color: "#000", padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px #0006" }}>{toast.msg}</div>}

      {/* Celebration */}
      {showCelebration && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, pointerEvents: "none" }}>
          <div style={{ background: C.greenDim, border: `2px solid ${C.green}`, borderRadius: 20, padding: "28px 40px", textAlign: "center", boxShadow: "0 0 60px #34d39966", animation: "fadeInScale 0.4s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>Day Complete!</div>
            <div style={{ fontSize: 14, color: C.text, marginTop: 6 }}>All tasks done for today. Keep it up!</div>
          </div>
          <style>{`@keyframes fadeInScale { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }`}</style>
        </div>
      )}

      {/* Share card modal */}
      {showShareCard && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: 340, maxWidth: "95vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📋 Today's Summary</div>
            <pre style={{ background: C.surface, borderRadius: 8, padding: 12, fontSize: 11, color: C.text, whiteSpace: "pre-wrap", lineHeight: 1.6, border: `1px solid ${C.border}`, maxHeight: 300, overflowY: "auto" }}>{shareCardText}</pre>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => { navigator.clipboard.writeText(shareCardText).then(() => showToast("Copied!")); }} style={{ ...btnStyle(C.accent, true), flex: 1 }}>Copy Text</button>
              <button onClick={() => setShowShareCard(false)} style={{ ...btnStyle(C.surface), flex: 1 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Plan manager modal */}
      {showPlanManager && (
        <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: 360, maxWidth: "95vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Manage Study Plans</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {storage.plans.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: storage.activePlanId === p.id ? C.accentDim : C.surface, border: `1px solid ${storage.activePlanId === p.id ? C.accent : C.border}`, borderRadius: 8, padding: "8px 12px" }}>
                  {editPlanNameId === p.id ? (
                    <input autoFocus defaultValue={p.name}
                      onBlur={e => { setStorage(prev => ({ ...prev, plans: prev.plans.map(pl => pl.id === p.id ? { ...pl, name: e.target.value || pl.name } : pl) })); setEditPlanNameId(null); }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditPlanNameId(null); }}
                      style={{ flex: 1, ...inputStyle, fontSize: 13, padding: "4px 8px" }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: storage.activePlanId === p.id ? C.accent : C.text }}>{p.name}</span>
                  )}
                  <button onClick={() => updateStorage({ activePlanId: p.id })} style={{ ...btnStyle(storage.activePlanId === p.id ? C.accent : C.surface, storage.activePlanId === p.id), fontSize: 11, padding: "4px 8px" }}>
                    {storage.activePlanId === p.id ? "Active" : "Switch"}
                  </button>
                  <button onClick={() => setEditPlanNameId(p.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "2px 5px" }}>✎</button>
                  {storage.plans.length > 1 && (
                    <button onClick={() => {
                      if (!confirm(`Delete "${p.name}"?`)) return;
                      setStorage(prev => {
                        const plans = prev.plans.filter(pl => pl.id !== p.id);
                        return { ...prev, plans, activePlanId: prev.activePlanId === p.id ? plans[0].id : prev.activePlanId };
                      });
                    }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: "2px 5px" }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="New plan name…" value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newPlanName.trim()) { const p = makePlan(newPlanName.trim()); setStorage(prev => ({ ...prev, plans: [...prev.plans, p], activePlanId: p.id })); setNewPlanName(""); } }}
                style={{ flex: 1, ...inputStyle, fontSize: 13 }} />
              <button onClick={() => { if (!newPlanName.trim()) return; const p = makePlan(newPlanName.trim()); setStorage(prev => ({ ...prev, plans: [...prev.plans, p], activePlanId: p.id })); setNewPlanName(""); }} style={btnStyle(C.accent, true)}>Add</button>
            </div>
            <button onClick={() => setShowPlanManager(false)} style={{ ...btnStyle(C.surface), marginTop: 12, width: "100%" }}>Done</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.accent, letterSpacing: "-0.5px" }}>SpaceRep</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Spaced repetition · {sched.totalLectures} lectures · {sched.planEnd} day plan</div>
            </div>
            <StreakBadge streak={streak} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Plan switcher */}
            <button onClick={() => setShowPlanManager(true)} style={{ ...btnStyle(C.accentDim), fontSize: 11, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📁 {activePlan.name}
            </button>
            <button onClick={exportXLSX} style={btnStyle(C.accent, true)}>Export Excel</button>
          </div>
        </div>
      </div>

      {/* Stat bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexWrap: "wrap" }}>
          {([
            ["Current Day",   `Day ${startDay}`],
            ["Date",          startDate ? formatDateShort(dateForDay(startDate, startDay)) : "Not set"],
            ["Total Lectures", sched.totalLectures],
            ["Study Days",    totalDays],
            ["Plan Ends",     startDate ? formatDateShort(dateForDay(startDate, sched.planEnd)) : `Day ${sched.planEnd}`],
            ["Today Done",    todayTotal > 0 ? `${todayDoneCount}/${todayTotal}` : "—"],
            ["Overall",       overallStats.totalTasks > 0 ? `${Math.round((overallStats.doneTasks / overallStats.totalTasks) * 100)}%` : "—"],
          ] as [string, string|number][]).map(([l, v]) => (
            <div key={l} style={{ flex: 1, minWidth: 80, padding: "9px 16px", borderRight: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 2, padding: "0 12px", minWidth: "max-content" }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              padding: "10px 14px", background: "none", border: "none",
              borderBottom: view === n.id ? `2px solid ${C.accent}` : "2px solid transparent",
              color: view === n.id ? C.accent : C.muted,
              fontWeight: view === n.id ? 700 : 400, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
            }}>{n.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── TODAY VIEW ── */}
        {view === "today" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Day {startDay} <span style={{ color: C.muted, fontSize: 14, fontWeight: 400 }}>— Today's Plan</span></div>
                {startDate && <div style={{ fontSize: 13, color: C.accent, marginTop: 2, fontWeight: 500 }}>{formatDate(dateForDay(startDate, startDay))}</div>}
                {todayTotal > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ background: C.faint, borderRadius: 100, height: 6, width: 220, overflow: "hidden" }}>
                      <div style={{ background: C.green, height: "100%", width: `${(todayDoneCount / todayTotal) * 100}%`, transition: "width 0.4s", borderRadius: 100 }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{todayDoneCount}/{todayTotal} tasks done</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => setShowShareCard(true)} style={{ ...btnStyle(C.surface), fontSize: 11 }}>📋 Share</button>
                {startDay !== realTodayDay && (
                  <button onClick={() => setStartDay(realTodayDay)} style={{ ...btnStyle(C.accent, true), fontSize: 11 }}>↩ Jump to Today</button>
                )}
                <button onClick={() => setStartDay(d => Math.max(1, d - 1))} style={btnStyle(C.surface)}>Prev</button>
                <span style={{ fontSize: 13, color: C.muted }}>Day</span>
                <input type="number" min={1} max={sched.planEnd} value={startDay}
                  onChange={e => setStartDay(Math.max(1, Math.min(sched.planEnd, +e.target.value || 1)))}
                  style={{ width: 60, ...inputStyle }} />
                <button onClick={() => setStartDay(d => Math.min(sched.planEnd, d + 1))} style={btnStyle(C.surface)}>Next</button>
              </div>
            </div>

            {/* Missed days banner */}
            {isRealToday && missedDays > 1 && (
              <div style={{ background: C.orangeDim, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 13, color: C.orange }}>
                  ⚠️ You're currently on Day {startDay} but today is Day {realTodayDay} — you may have missed {missedDays - 1} day{missedDays - 1 !== 1 ? "s" : ""} of revisions.
                </div>
                <button onClick={() => setStartDay(realTodayDay)} style={{ ...btnStyle(C.orange, true), fontSize: 11 }}>Jump to Today</button>
              </div>
            )}

            {!sched.todayRow ? (
              <Callout color={C.muted}>No data for this day.</Callout>
            ) : sched.todayRow.count === 0 && sched.todayRow.isStudy ? (
              <Callout color={C.red}>Holiday — No lectures or revisions today. Rest up!</Callout>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sched.todayRow.lecs.length > 0 && (
                  <Section title="New Lectures Today" color={C.green}>
                    {sched.todayRow.lecs.map(ln => {
                      const key = `new-${ln}`;
                      const prog = lecRevProgress(ln);
                      return (
                        <TaskRow key={ln} done={!!done[key]} color={C.green}
                          onToggle={() => toggleDone(key)}
                          label={getLecName(ln)}
                          sublabel={`Learn + same-day review${getLecTag(ln) ? ` · 🏷 ${getLecTag(ln)}` : ""}`}
                          onRename={() => setEditingName(ln)}
                          note={lectureNotes[ln]}
                          onNoteChange={n => setLectureNotes(prev => ({ ...prev, [ln]: n }))}
                          progress={prog.total > 0 ? prog : undefined}
                        />
                      );
                    })}
                  </Section>
                )}

                {sched.todayRow.revisions.length > 0 && (
                  <Section title="Revisions Due Today" color={C.yellow}>
                    {sched.todayRow.revisions.map((r, i) => {
                      const key = `rev-${sched.todayRow!.day}-${r.ln}-${r.iv}`;
                      const prog = lecRevProgress(r.ln);
                      return (
                        <TaskRow key={i} done={!!done[key]} color={r.postponed ? C.orange : C.yellow}
                          onToggle={() => toggleDone(key)}
                          label={getLecName(r.ln)}
                          sublabel={`${r.ivLabel} revision · Day ${r.fromDay}${r.postponed ? " · ⏭ postponed" : ""}${getLecTag(r.ln) ? ` · 🏷 ${getLecTag(r.ln)}` : ""}`}
                          onRename={() => setEditingName(r.ln)}
                          onPostpone={() => postponeRevision(r.originalKey, sched.todayRow!.day)}
                          note={lectureNotes[r.ln]}
                          onNoteChange={n => setLectureNotes(prev => ({ ...prev, [r.ln]: n }))}
                          progress={prog.total > 0 ? prog : undefined}
                        />
                      );
                    })}
                  </Section>
                )}

                {sched.todayRow.lecs.length === 0 && sched.todayRow.revisions.length === 0 && (
                  <Callout color={C.muted}>Nothing scheduled for Day {startDay}.</Callout>
                )}
              </div>
            )}

            <WeekAhead allDays={sched.allDays} fromDay={startDay + 1} planEnd={sched.planEnd} startDate={startDate} getLecName={getLecName} onJump={d => setStartDay(d)} />

            {/* Rename modal */}
            {editingName !== null && (
              <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: 320 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Rename Lecture {editingName}</div>
                  <input autoFocus defaultValue={lectureNames[editingName] || ""}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") { setLectureNames(prev => ({ ...prev, [editingName!]: (e.target as HTMLInputElement).value })); setEditingName(null); showToast("Name saved"); }
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    placeholder={`e.g. "Chapter 3 — Thermodynamics"`}
                    style={{ width: "100%", ...inputStyle, marginBottom: 12, boxSizing: "border-box" }} />
                  <div style={{ fontSize: 12, color: C.muted }}>Press Enter to save, Esc to cancel</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LOG LECTURES ── */}
        {view === "input" && (
          <div>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Total study days</div>
                <input type="number" min={1} max={365} value={totalDays}
                  onChange={e => setTotalDays(Math.max(1, Math.min(365, +e.target.value || 1)))}
                  style={{ width: 80, ...inputStyle }} />
              </div>
              <button onClick={() => { updatePlan({ inputs: {} }); showToast("Reset to 2 lectures/day"); }} style={btnStyle(C.surface)}>Reset all to 2</button>
              <button onClick={() => { const o: Record<number,number> = {}; for (let d = 1; d <= totalDays; d++) o[d] = 1; updatePlan({ inputs: o }); showToast("Set all to 1"); }} style={btnStyle(C.surface)}>Set all to 1</button>
              <button onClick={() => { const o: Record<number,number> = {}; for (let d = 1; d <= totalDays; d++) o[d] = 0; updatePlan({ inputs: o }); showToast("Set all to holiday"); }} style={btnStyle(C.redDim)}>Set all to holiday</button>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>
              Type lectures per day. <b style={{ color: C.text }}>0 = holiday · 1, 2, 3… = lectures that day.</b>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
              <span style={{ color: C.muted }}>Lectures assigned: </span>
              <span style={{ color: C.accent, fontWeight: 700 }}>L1 → L{sched.totalLectures}</span>
              <span style={{ color: C.muted }}> across {totalDays} days</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                const raw = inputs[day] ?? "2";
                const num = parseInt(String(raw)) || 0;
                const isHoliday = num === 0;
                const color = isHoliday ? C.red : num === 1 ? C.yellow : num >= 3 ? C.green : C.accent;
                const bg = isHoliday ? C.redDim : num === 1 ? C.yellowDim : num >= 3 ? C.greenDim : C.accentDim;
                const dayData = sched.studyDays[day - 1];
                const lecRange = dayData?.lecs.length ? `L${dayData.lecs[0]}${dayData.lecs.length > 1 ? `–L${dayData.lecs[dayData.lecs.length - 1]}` : ""}` : "";
                return (
                  <div key={day} style={{ background: bg + "88", border: `1.5px solid ${color}44`, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>Day {day}</div>
                    <input type="number" min={0} max={10} value={raw}
                      onChange={e => setInputs(prev => ({ ...prev, [day]: e.target.value }))}
                      style={{ width: 52, padding: "5px 4px", background: C.bg, border: `1px solid ${color}`, borderRadius: 6, color, fontSize: 18, fontWeight: 700, textAlign: "center" }} />
                    <div style={{ fontSize: 9, color, marginTop: 3 }}>{isHoliday ? "holiday" : `${num} lec${num !== 1 ? "s" : ""}`}</div>
                    {lecRange && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{lecRange}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FULL SCHEDULE ── */}
        {view === "schedule" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Search lecture…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ flex: 1, minWidth: 160, ...inputStyle }} />
              {allTags.length > 0 && (
                <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                  style={{ ...inputStyle, minWidth: 120 }}>
                  <option value="">All tags</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([["New", C.green], ["Revision", C.yellow], ["Holiday", C.red], ["Rev-only", C.muted]] as [string, string][]).map(([l, c]) => (
                  <span key={l} style={{ fontSize: 10, color: c, background: C.surface, padding: "3px 7px", borderRadius: 5, border: `1px solid ${c}33` }}>{l}</span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
              Showing {Math.min(schedPage * PAGE_SIZE, filteredDays.length)} of {filteredDays.length} days
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {filteredDays.slice(0, schedPage * PAGE_SIZE).map(row => {
                const isHoliday = row.isStudy && row.count === 0;
                const isToday = row.day === startDay;
                const borderCol = isToday ? C.accent : isHoliday ? C.red : row.lecs.length > 0 ? C.blueDim : C.border;
                const bgCol = isToday ? C.accentDim + "55" : isHoliday ? C.redDim : row.isStudy ? C.surface : C.card;
                const labels = intervalsToLabels(customIntervals);
                const revGroups = customIntervals.map((iv, idx) => ({ label: labels[idx], items: row.revisions.filter(r => r.iv === iv) })).filter(g => g.items.length > 0);

                return (
                  <div key={row.day} style={{ background: bgCol, border: `1px solid ${borderCol}`, borderRadius: 10, padding: "9px 14px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ minWidth: 80, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted }}>DAY</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: isToday ? C.accent : isHoliday ? C.red : row.isStudy ? C.blue : C.muted }}>{row.day}</div>
                      {startDate && <div style={{ fontSize: 9, color: isToday ? C.accent : C.muted, marginTop: 1, lineHeight: 1.3 }}>{formatDateShort(dateForDay(startDate, row.day))}</div>}
                      {isToday && <div style={{ fontSize: 8, color: C.accent, fontWeight: 700 }}>TODAY</div>}
                    </div>
                    <div style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>NEW</div>
                      {isHoliday ? <Tag color={C.red}>Holiday</Tag>
                        : row.lecs.length > 0 ? row.lecs.map(n => <Tag key={n} color={C.green}>{getLecName(n)}{getLecTag(n) ? ` 🏷${getLecTag(n)}` : ""}</Tag>)
                        : <span style={{ color: C.muted, fontSize: 11 }}>—</span>}
                    </div>
                    <div style={{ flex: 1, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {revGroups.map(({ label, items }) => (
                        <div key={label} style={{ background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 6, padding: "3px 9px", fontSize: 11 }}>
                          <span style={{ color: C.yellow, fontWeight: 600 }}>{label}: </span>
                          <span style={{ color: C.text }}>{items.map(r => getLecName(r.ln)).join(", ")}</span>
                        </div>
                      ))}
                      {revGroups.length === 0 && !isHoliday && row.lecs.length === 0 && <span style={{ color: C.faint, fontSize: 11 }}>No tasks</span>}
                    </div>
                    {row.revisions.length > 0 && (
                      <div style={{ textAlign: "center", minWidth: 30 }}>
                        <div style={{ fontSize: 9, color: C.muted }}>revs</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.yellow }}>{row.revisions.length}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {schedPage * PAGE_SIZE < filteredDays.length && (
              <button onClick={() => setSchedPage(p => p + 1)} style={{ ...btnStyle(C.accent, true), marginTop: 12, width: "100%" }}>
                Load more ({filteredDays.length - schedPage * PAGE_SIZE} remaining)
              </button>
            )}
          </div>
        )}

        {/* ── HEATMAP ── */}
        {view === "heatmap" && (
          <HeatmapView allDays={sched.allDays} startDay={startDay} startDate={startDate} done={done} onJump={day => { setStartDay(day); setView("today"); }} />
        )}

        {/* ── CALENDAR ── */}
        {view === "calendar" && (
          <MonthlyCalendar allDays={sched.allDays} startDate={startDate} startDay={startDay} done={done} onJump={day => { setStartDay(day); setView("today"); }} />
        )}

        {/* ── REPORTS ── */}
        {view === "reports" && (
          <Reports schedule={sched} done={done} startDay={realTodayDay} getLecName={getLecName} />
        )}

        {/* ── TIMER ── */}
        {view === "timer" && <StudyTimer />}

        {/* ── SETTINGS ── */}
        {view === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Settings</div>

            <SettingCard title="Start Date" desc="Set the real calendar date when Day 1 began.">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
                <button onClick={() => { setStartDate(todayYMD()); showToast("Start date set to today"); }} style={btnStyle(C.accent, true)}>Set to Today</button>
              </div>
              {startDate && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                  Day 1 = <b style={{ color: C.text }}>{formatDate(new Date(startDate))}</b><br />
                  Today = <b style={{ color: C.accent }}>Day {currentDayNum(startDate)}</b> · Plan ends <b style={{ color: C.text }}>{formatDate(dateForDay(startDate, sched.planEnd))}</b>
                </div>
              )}
            </SettingCard>

            <SettingCard title="Daily Reminder" desc="Get a notification with today's revision list.">
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input type="time" value={notifTime} onChange={e => setNotifTime(e.target.value)} style={{ ...inputStyle, width: 110 }} />
                {notifEnabled
                  ? <button onClick={() => { setNotifEnabled(false); showToast("Reminders off"); }} style={btnStyle(C.redDim)}>Turn Off</button>
                  : <button onClick={requestNotif} style={btnStyle(C.accent, true)}>Enable Reminder</button>}
                {notifEnabled && <span style={{ fontSize: 12, color: C.green }}>Active</span>}
              </div>
            </SettingCard>

            <SettingCard title="Custom Revision Intervals" desc="Set your own spaced repetition schedule (days after learning).">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customIntervals.map((iv, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 70 }}>Session {idx + 1}</span>
                    <input type="number" min={0} max={365} value={iv}
                      onChange={e => {
                        const next = [...customIntervals];
                        next[idx] = Math.max(0, parseInt(e.target.value) || 0);
                        setCustomIntervals(next);
                      }}
                      style={{ width: 70, ...inputStyle, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 11, color: C.muted }}>days after learning</span>
                    {customIntervals.length > 1 && (
                      <button onClick={() => setCustomIntervals(customIntervals.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>✕</button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setCustomIntervals([...customIntervals, customIntervals[customIntervals.length - 1] + 7])} style={btnStyle(C.surface)}>+ Add Session</button>
                  <button onClick={() => { setCustomIntervals([...DEFAULT_INTERVALS]); showToast("Reset to defaults"); }} style={btnStyle(C.surface)}>Reset to Default</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                Default: 0, 1, 3, 7, 15, 30, 60, 90 days. Changes take effect immediately.
              </div>
            </SettingCard>

            <SettingCard title="Name Your Lectures" desc="Give each lecture a meaningful name and optional tag.">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {Array.from({ length: sched.totalLectures }, (_, i) => i + 1).map(ln => (
                  <div key={ln} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.muted, minWidth: 24 }}>L{ln}</span>
                    <input placeholder={`Lecture ${ln}`} value={lectureNames[ln] || ""}
                      onChange={e => setLectureNames(prev => ({ ...prev, [ln]: e.target.value }))}
                      style={{ flex: 2, ...inputStyle, fontSize: 12, padding: "5px 8px" }} />
                    <input placeholder="Tag" value={lectureTags[ln] || ""}
                      onChange={e => setLectureTags(prev => ({ ...prev, [ln]: e.target.value }))}
                      style={{ flex: 1, ...inputStyle, fontSize: 12, padding: "5px 8px" }} />
                  </div>
                ))}
              </div>
              <button onClick={() => showToast("Names saved")} style={{ ...btnStyle(C.accent, true), marginTop: 8 }}>Save Names</button>
            </SettingCard>

            <SettingCard title="Bulk Import Lecture Names" desc="Paste all lecture names at once — one name per line.">
              <textarea rows={5} placeholder={"Introduction to Physics\nNewton's Laws\nThermodynamics\n…"}
                value={bulkImport} onChange={e => setBulkImport(e.target.value)}
                style={{ width: "100%", ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 12, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => {
                  const lines = bulkImport.split("\n").map(l => l.trim()).filter(Boolean);
                  if (!lines.length) { showToast("Nothing to import", C.red); return; }
                  const names: Record<number, string> = {};
                  lines.forEach((name, i) => { names[i + 1] = name; });
                  setLectureNames(prev => ({ ...prev, ...names }));
                  setBulkImport("");
                  showToast(`Imported ${lines.length} lecture names ✓`);
                }} style={btnStyle(C.accent, true)}>Import</button>
                <button onClick={() => setBulkImport("")} style={btnStyle(C.surface)}>Clear</button>
              </div>
            </SettingCard>

            <SettingCard title="Backup & Restore" desc="Export all your data to a file, or restore from a backup.">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={exportBackup} style={btnStyle(C.accent, true)}>⬇ Download Backup</button>
                <label style={{ ...btnStyle(C.surface), cursor: "pointer" }}>
                  ⬆ Restore Backup
                  <input type="file" accept=".json" onChange={importBackup} style={{ display: "none" }} />
                </label>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Backup includes all plans, names, progress, and settings.</div>
            </SettingCard>

            <SettingCard title="Reset Data" desc="Clear all progress for the current plan.">
              <button onClick={() => {
                if (confirm("Reset everything in this plan?")) {
                  updatePlan({ inputs: {}, done: {}, lectureNames: {}, lectureNotes: {}, lectureTags: {}, totalDays: 20, startDay: 1, postponed: {}, customIntervals: [...DEFAULT_INTERVALS] });
                  showToast("Plan reset", C.red);
                }
              }} style={btnStyle(C.redDim)}>Reset Current Plan</button>
            </SettingCard>
          </div>
        )}

      </div>
    </div>
  );
}
