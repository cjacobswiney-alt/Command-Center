"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Task, Briefing, BriefingItem, CATEGORIES, PRIORITIES, SupplementCycle } from "@/lib/types";
import { today, getGreeting } from "@/lib/utils";
import WikiTab from "./WikiTab";
import HealthTab from "./HealthTab";
import MealsTab from "./MealsTab";
import ProgramTab from "./ProgramTab";

interface CalendarEvent {
  subject: string;
  start: string;
  end: string;
  location: string;
  organizer: string;
  isAllDay: boolean;
  source?: "outlook" | "google";
  responseStatus?: string;
  isCancelled?: boolean;
  showAs?: string;
}

type TabId = "brief" | "tasks" | "dump" | "log" | "wiki" | "health" | "gym" | "meals";

export default function CommandCenter() {
  const [tab, setTab] = useState<TabId>("brief");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [multiCalendar, setMultiCalendar] = useState<Record<string, CalendarEvent[]>>({});
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [supplements, setSupplements] = useState<SupplementCycle[]>([]);
  const [nextGymDay, setNextGymDay] = useState<{ num: number; name: string } | null>(null);
  const [dayLog, setDayLog] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanRange, setScanRange] = useState<string>("1");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<string>("buckingham");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("medium");
  const [dumpText, setDumpText] = useState("");
  const [dumpCategory, setDumpCategory] = useState<string>("buckingham");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [wikiQuery, setWikiQuery] = useState("");
  const [wikiAnswer, setWikiAnswer] = useState<string | null>(null);
  const [askingWiki, setAskingWiki] = useState(false);
  const [calDate, setCalDate] = useState(today());
  const [plannedBlocks, setPlannedBlocks] = useState<{ id: string; start: number; end: number; label: string; type: string }[]>([]);
  const calRef = useRef<HTMLDivElement>(null);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calStart = 7;
  const calEnd = 21;
  const hourHeight = 52;

  // Screen size detection
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Derived: calendar for current calDate (backwards compat)
  const calendar = multiCalendar[calDate] || [];
  const dateStr = today();

  // ─── Data fetching ─────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingNeedsAuth, setBriefingNeedsAuth] = useState(false);
  const autoScanTriggered = useRef(false);

  const ensureBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingNeedsAuth(false);
    try {
      const res = await fetch(`/api/briefing/${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        if (data) { setBriefing(data); return; }
      }
      if (autoScanTriggered.current) return;
      autoScanTriggered.current = true;
      const scan = await fetch("/api/scan-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 1 }),
      });
      if (scan.status === 401) { setBriefingNeedsAuth(true); return; }
      if (scan.ok) { setBriefing(await scan.json()); }
    } catch {} finally { setBriefingLoading(false); }
  }, [dateStr]);

  const shiftDate = (base: string, days: number) => {
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const visibleDates = isDesktop
    ? [calDate, shiftDate(calDate, 1), shiftDate(calDate, 2)]
    : [calDate];

  const fetchCalendar = useCallback(async () => {
    const dates = isDesktop
      ? [calDate, shiftDate(calDate, 1), shiftDate(calDate, 2)]
      : [calDate];
    const results = await Promise.all(
      dates.map(async (d) => {
        const res = await fetch(`/api/calendar/today?date=${d}`);
        return { date: d, events: res.ok ? await res.json() : [] };
      })
    );
    const map: Record<string, CalendarEvent[]> = {};
    for (const r of results) {
      map[r.date] = r.events;
      if (r.events.some((e: CalendarEvent) => e.source === "google")) setGoogleConnected(true);
    }
    setMultiCalendar(map);
  }, [calDate, isDesktop]);

  const fetchSupplements = useCallback(async () => {
    const res = await fetch("/api/supplements");
    if (res.ok) setSupplements(await res.json());
  }, []);

  const fetchDayLog = useCallback(async () => {
    const res = await fetch(`/api/day-log/${dateStr}`);
    if (res.ok) { const data = await res.json(); setDayLog(data.content || ""); }
  }, [dateStr]);

  useEffect(() => {
    fetchTasks(); ensureBriefing(); fetchCalendar(); fetchSupplements(); fetchDayLog();
    fetch("/api/auth/status").then(r => r.json()).then(d => { if (d.google) setGoogleConnected(true); }).catch(() => {});
    fetch("/api/program/next-day").then(r => r.json()).then(d => {
      const names: Record<number, string> = { 1: "Chest + Shoulders", 2: "Back + Rear Delts", 3: "Shoulders + Arms", 4: "Legs + Pump", 5: "Chest + Back", 6: "Shoulders + Arms" };
      setNextGymDay({ num: d.next_day, name: names[d.next_day] || "Training" });
    }).catch(() => {});
  }, [fetchTasks, ensureBriefing, fetchCalendar, fetchSupplements, fetchDayLog]);

  // Load/save planned blocks from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`planned_${calDate}`);
      if (saved) setPlannedBlocks(JSON.parse(saved));
      else setPlannedBlocks([]);
    } catch { setPlannedBlocks([]); }
  }, [calDate]);

  const savePlannedBlocks = (blocks: typeof plannedBlocks) => {
    setPlannedBlocks(blocks);
    localStorage.setItem(`planned_${calDate}`, JSON.stringify(blocks));
  };

  const acceptSuggestion = (s: { start: number; end: number; label: string; type: string }, forDate?: string) => {
    const block = { id: "pb_" + Math.random().toString(36).slice(2, 8), ...s };
    const targetDate = forDate || calDate;
    if (targetDate === calDate) {
      savePlannedBlocks([...plannedBlocks, block]);
    } else {
      // Save to the specific date's localStorage
      try {
        const existing = JSON.parse(localStorage.getItem(`planned_${targetDate}`) || "[]");
        localStorage.setItem(`planned_${targetDate}`, JSON.stringify([...existing, block]));
      } catch {}
      // Force re-render by touching multiCalendar
      setMultiCalendar(prev => ({ ...prev }));
    }
  };

  const addCustomBlock = () => {
    // Place at next round hour, or now if today
    const nextHour = isCalToday ? Math.ceil(nowHour) : 9;
    const start = Math.max(calStart, Math.min(calEnd - 1, nextHour));
    const block = {
      id: "pb_" + Math.random().toString(36).slice(2, 8),
      start,
      end: start + 1,
      label: "New Block",
      type: "task",
    };
    savePlannedBlocks([...plannedBlocks, block]);
    // Auto-edit the label
    setTimeout(() => { setEditingBlockId(block.id); setEditingBlockLabel(block.label); }, 50);
  };

  const removePlannedBlock = (id: string, forDate?: string) => {
    const targetDate = forDate || calDate;
    if (targetDate === calDate) {
      savePlannedBlocks(plannedBlocks.filter(b => b.id !== id));
    } else {
      try {
        const existing = JSON.parse(localStorage.getItem(`planned_${targetDate}`) || "[]");
        localStorage.setItem(`planned_${targetDate}`, JSON.stringify(existing.filter((b: {id: string}) => b.id !== id)));
      } catch {}
      setMultiCalendar(prev => ({ ...prev }));
    }
  };

  const moveBlock = (id: string, direction: number) => {
    const updated = plannedBlocks.map(b => {
      if (b.id !== id) return b;
      const shift = direction * 0.25;
      const duration = b.end - b.start;
      const newStart = Math.max(calStart, Math.min(calEnd - duration, b.start + shift));
      return { ...b, start: newStart, end: newStart + duration };
    });
    savePlannedBlocks(updated);
  };

  // Drag state for suggestion/planned blocks
  const [dragBlock, setDragBlock] = useState<{ label: string; type: string; duration: number; currentStart: number } | null>(null);
  const dragStartY = useRef(0);
  const dragStartHour = useRef(0);

  useEffect(() => {
    if (!dragBlock) return;
    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - dragStartY.current;
      const dHours = dy / hourHeight;
      const raw = dragStartHour.current + dHours;
      const snapped = Math.round(raw * 4) / 4;
      const clamped = Math.max(calStart, Math.min(calEnd - dragBlock.duration, snapped));
      setDragBlock(prev => prev ? { ...prev, currentStart: clamped } : null);
    };
    const onUp = () => {
      if (dragBlock) {
        const block = { id: "pb_" + Math.random().toString(36).slice(2, 8), start: dragBlock.currentStart, end: dragBlock.currentStart + dragBlock.duration, label: dragBlock.label, type: dragBlock.type };
        const updated = [...plannedBlocks.filter(b => b.label !== block.label), block];
        savePlannedBlocks(updated);
      }
      setDragBlock(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
  }, [dragBlock, plannedBlocks, calStart, calEnd, hourHeight, calDate]);

  const startDragSuggestion = (s: { start: number; end: number; label: string; type: string }, e: React.PointerEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHour.current = s.start;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    setDragBlock({ label: s.label, type: s.type, duration: s.end - s.start, currentStart: s.start });
  };

  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [gymSelections, setGymSelections] = useState<Record<string, string>>({});

  const GYM_OPTIONS = [
    { value: "day1", label: "Day 1 — Chest + Shoulders" },
    { value: "day2", label: "Day 2 — Back + Rear Delts" },
    { value: "day3", label: "Day 3 — Shoulders + Arms" },
    { value: "day4", label: "Day 4 — Legs + Pump" },
    { value: "day5", label: "Day 5 — Chest + Back" },
    { value: "day6", label: "Day 6 — Shoulders + Arms" },
    { value: "tennis", label: "Tennis" },
    { value: "other", label: "Other" },
  ];

  // Load gym selections from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gym_selections");
      if (saved) setGymSelections(JSON.parse(saved));
    } catch {}
  }, []);

  const setGymForDate = (dateStr: string, value: string) => {
    const updated = { ...gymSelections, [dateStr]: value };
    setGymSelections(updated);
    localStorage.setItem("gym_selections", JSON.stringify(updated));
  };
  const [editingBlockLabel, setEditingBlockLabel] = useState("");
  const [editingSugIdx, setEditingSugIdx] = useState<number | null>(null);
  const [sugOverrides, setSugOverrides] = useState<Record<number, string>>({});

  const renameBlock = (id: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    const updated = plannedBlocks.map(b => b.id === id ? { ...b, label: newLabel.trim() } : b);
    savePlannedBlocks(updated);
    setEditingBlockId(null);
  };

  const pushToCalendar = async (b: { id: string; start: number; end: number; label: string }, forDate?: string) => {
    const targetDate = forDate || calDate;
    const res = await fetch("/api/calendar/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: b.label, date: targetDate, startHour: b.start, endHour: b.end }),
    });
    if (res.status === 401) {
      const data = await res.json();
      if (data.loginUrl) { window.location.href = data.loginUrl; return; }
    }
    if (res.ok) {
      removePlannedBlock(b.id, targetDate);
    }
  };

  const [pushing, setPushing] = useState(false);
  const pushAllToCalendar = async () => {
    setPushing(true);
    for (const vDate of visibleDates) {
      const blocks: typeof plannedBlocks = vDate === calDate
        ? plannedBlocks
        : (() => { try { return JSON.parse(localStorage.getItem(`planned_${vDate}`) || "[]"); } catch { return []; } })();
      for (const b of blocks) {
        await pushToCalendar(b, vDate);
      }
    }
    fetchCalendar();
    setPushing(false);
  };

  // Resize block duration
  const [resizing, setResizing] = useState<{ id: string; startY: number; origEnd: number; forDate: string } | null>(null);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - resizing.startY;
      const dHours = dy / hourHeight;
      const raw = resizing.origEnd + dHours;
      const snapped = Math.round(raw * 4) / 4;

      if (resizing.forDate === calDate) {
        const block = plannedBlocks.find(b => b.id === resizing.id);
        if (!block) return;
        const clamped = Math.max(block.start + 0.25, Math.min(calEnd, snapped));
        setPlannedBlocks(prev => prev.map(b => b.id === resizing.id ? { ...b, end: clamped } : b));
      } else {
        try {
          const blocks = JSON.parse(localStorage.getItem(`planned_${resizing.forDate}`) || "[]");
          const block = blocks.find((b: { id: string }) => b.id === resizing.id);
          if (!block) return;
          const clamped = Math.max(block.start + 0.25, Math.min(calEnd, snapped));
          const updated = blocks.map((b: { id: string; end: number }) => b.id === resizing.id ? { ...b, end: clamped } : b);
          localStorage.setItem(`planned_${resizing.forDate}`, JSON.stringify(updated));
          setMultiCalendar(prev => ({ ...prev })); // force re-render
        } catch {}
      }
    };
    const onUp = () => {
      if (resizing.forDate === calDate) {
        setPlannedBlocks(prev => {
          localStorage.setItem(`planned_${calDate}`, JSON.stringify(prev));
          return prev;
        });
      }
      setResizing(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
  }, [resizing, plannedBlocks, calDate, calEnd, hourHeight]);

  const startResize = (id: string, e: React.PointerEvent, forDate?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const targetDate = forDate || calDate;
    const blocks = targetDate === calDate ? plannedBlocks : (() => { try { return JSON.parse(localStorage.getItem(`planned_${targetDate}`) || "[]"); } catch { return []; } })();
    const block = blocks.find((b: { id: string }) => b.id === id);
    if (!block) return;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    setResizing({ id, startY: e.clientY, origEnd: block.end, forDate: targetDate });
  };

  const startDragPlanned = (b: { id: string; start: number; end: number; label: string; type: string }, e: React.PointerEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHour.current = b.start;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    // Remove from planned while dragging
    setPlannedBlocks(prev => prev.filter(p => p.id !== b.id));
    setDragBlock({ label: b.label, type: b.type, duration: b.end - b.start, currentStart: b.start });
  };

  // ─── Task actions ─────────────────────────────────────
  const addTask = async (title: string, category: string, priority: string, source: string = "manual", notes: string | null = null) => {
    if (!title.trim()) return;
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), category, priority, source, notes }),
    });
    if (res.ok) { setNewTaskTitle(""); fetchTasks(); }
  };

  const toggleTask = async (task: Task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "todo" ? "done" : "todo" }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const updateTaskField = async (id: string, field: string, value: string | null) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const updated = await fetch("/api/tasks");
    if (updated.ok) {
      const allTasks = await updated.json();
      setTasks(allTasks);
      const refreshed = allTasks.find((t: Task) => t.id === id);
      if (refreshed) setSelectedTask(refreshed);
    }
  };

  const clearCompleted = async () => {
    await fetch("/api/tasks/completed", { method: "DELETE" });
    fetchTasks();
  };

  const scanInbox = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan-inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: parseInt(scanRange) }) });
      if (res.status === 401) {
        const data = await res.json();
        if (data.loginUrl) { window.location.href = data.loginUrl; return; }
      }
      if (res.ok) { const data = await res.json(); setBriefing(data); fetchCalendar(); }
    } catch {} finally { setScanning(false); }
  };

  const dismissBriefingItem = (index: number) => {
    if (!briefing) return;
    setBriefing({ ...briefing, items: briefing.items.filter((_, i) => i !== index) });
  };

  const captureDump = async () => {
    const lines = dumpText.split("\n").map(l => l.replace(/^[\s\-\*•]+/, "").trim()).filter(Boolean);
    for (const line of lines) {
      await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: line, category: dumpCategory, priority: "medium", source: "dump" }),
      });
    }
    setDumpText("");
    fetchTasks();
    setTab("tasks");
  };

  const saveDayLog = useCallback((content: string) => {
    if (logTimerRef.current) clearTimeout(logTimerRef.current);
    logTimerRef.current = setTimeout(async () => {
      await fetch(`/api/day-log/${dateStr}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    }, 500);
  }, [dateStr]);

  const handleLogChange = (val: string) => { setDayLog(val); saveDayLog(val); };

  const askWiki = async () => {
    if (!wikiQuery.trim()) return;
    setAskingWiki(true);
    setWikiAnswer(null);
    try {
      const res = await fetch("/api/wiki/query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: wikiQuery }),
      });
      if (res.ok) { const data = await res.json(); setWikiAnswer(data.answer || "No answer found."); }
    } catch {} finally { setAskingWiki(false); }
  };

  // ─── Derived state ─────────────────────────────────────
  const activeTasks = tasks.filter(t => t.status === "todo");
  const highPriority = activeTasks.filter(t => t.priority === "high");
  const doneToday = tasks.filter(t => t.completed_date === dateStr);
  const carryover = activeTasks.filter(t => t.created_date < dateStr);
  const { greeting } = getGreeting();
  const categoryColor = (cat: string) => CATEGORIES.find(c => c.id === cat)?.color || "#8a8a8a";

  const filteredTasks = tasks.filter(t => {
    if (!showCompleted && t.status === "done") return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const getHourFromIso = (iso: string) => {
    if (!iso) return 8;
    const d = new Date(iso);
    return d.getHours() + d.getMinutes() / 60;
  };

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const calHours = calEnd - calStart;

  const shiftCalDate = (days: number) => {
    const d = new Date(calDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setCalDate(d.toISOString().slice(0, 10));
  };
  const isCalToday = calDate === today();
  const calDateDisplay = new Date(calDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const dateDisplay = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ─── Suggested time blocks ─────────────────────────────
  // Suggestion engine — works for any date
  // Gym day names for label generation
  const GYM_DAY_NAMES: Record<number, string> = {
    1: "Chest + Shoulders", 2: "Back + Rear Delts", 3: "Shoulders + Arms",
    4: "Legs + Pump", 5: "Chest + Back", 6: "Shoulders + Arms",
  };

  const getGymLabelForDate = (dateStr: string, dayOffset: number) => {
    const selection = gymSelections[dateStr];
    if (selection) {
      const opt = GYM_OPTIONS.find(o => o.value === selection);
      return opt ? `Gym: ${opt.label}` : "Gym Session";
    }
    // Auto-increment from base day
    const baseDay = nextGymDay?.num || 1;
    const thisGymDay = ((baseDay - 1 + dayOffset) % 6) + 1;
    return `Gym: ${GYM_OPTIONS[thisGymDay - 1].label}`;
  };

  const getGymValueForDate = (dateStr: string, dayOffset: number) => {
    if (gymSelections[dateStr]) return gymSelections[dateStr];
    const baseDay = nextGymDay?.num || 1;
    const thisGymDay = ((baseDay - 1 + dayOffset) % 6) + 1;
    return `day${thisGymDay}`;
  };

  const getSuggestions = (dateStr: string, dayEvents: CalendarEvent[], dayPlanned: typeof plannedBlocks, dayOffset: number = 0) => {
    const isToday = dateStr === today();
    const workStart = 8, workEnd = 18, gymStart = 17, gymEnd = 20;

    // Skip if a gym block is already planned for this day
    const hasPlannedGym = dayPlanned.some((b: { type: string }) => b.type === "gym");

    const timedEvents = [
      ...dayEvents.filter(e => !e.isAllDay).map(e => ({ start: getHourFromIso(e.start), end: getHourFromIso(e.end) })),
      ...dayPlanned.map(b => ({ start: b.start, end: b.end })),
    ].sort((a, b) => a.start - b.start);

    const findGaps = (from: number, to: number) => {
      const gaps: { start: number; end: number; duration: number }[] = [];
      let cursor = from;
      for (const ev of timedEvents) {
        if (ev.end <= cursor) continue;
        if (ev.start > cursor + 0.5) gaps.push({ start: cursor, end: Math.min(ev.start, to), duration: Math.min(ev.start, to) - cursor });
        cursor = Math.max(cursor, ev.end);
        if (cursor >= to) break;
      }
      if (to > cursor + 0.5) gaps.push({ start: cursor, end: to, duration: to - cursor });
      return gaps;
    };

    const suggestions: { start: number; end: number; label: string; type: string }[] = [];

    // --- ONE gym block per day, only if not already planned ---
    let gymBlock: { start: number; end: number } | null = null;
    if (!hasPlannedGym) {
      const eveningGaps = findGaps(gymStart, gymEnd);
      const gymGap = eveningGaps.find(g => g.duration >= 1);
      if (gymGap) {
        const gs = isToday ? Math.max(gymGap.start, nowHour) : gymGap.start;
        if (gymGap.end - gs >= 1) gymBlock = { start: gs, end: Math.min(gs + 1.5, gymGap.end) };
      }
    }

    // --- Deep work: each day gets unique tasks based on offset ---
    const allTasks = [...activeTasks];
    const allEmails = [...(briefing?.items || [])];
    const defaultWork = ["Underwrite Deals", "Outreach — Coffee / Networking", "Pipeline Review", "Deal Sourcing", "Market Research", "Broker Outreach"];
    const usedLabels = new Set<string>();

    // Build a combined pool: tasks first, then emails, then defaults
    const labelPool: string[] = [];
    for (const t of allTasks) labelPool.push(`Deep Work: ${t.title}`);
    for (const e of allEmails) labelPool.push(`Deep Work: ${e.title}`);
    for (const d of defaultWork) labelPool.push(d);

    // Each day takes 2 labels starting at dayOffset * 2
    const startIdx = (dayOffset * 2) % Math.max(labelPool.length, 1);

    const workGaps = findGaps(workStart, workEnd)
      .map(g => { const s = isToday ? Math.max(g.start, nowHour) : g.start; return { start: s, end: g.end, duration: g.end - s }; })
      .filter(g => g.duration >= 1.5).sort((a, b) => b.duration - a.duration);
    const morningGap = workGaps.find(g => g.start < 12);
    const afternoonGap = workGaps.find(g => g.start >= 12);
    const deepSlots = [morningGap, afternoonGap].filter(Boolean) as typeof workGaps;
    if (deepSlots.length < 2) for (const g of workGaps) { if (!deepSlots.includes(g) && deepSlots.length < 2) deepSlots.push(g); }

    let labelIdx = startIdx;
    for (const gap of deepSlots) {
      if (usedLabels.size >= 2) break;
      const label = labelPool[labelIdx % labelPool.length] || defaultWork[dayOffset % defaultWork.length];
      labelIdx++;
      if (usedLabels.has(label)) continue;
      usedLabels.add(label);
      suggestions.push({ start: gap.start, end: Math.min(gap.start + 2, gap.end), label, type: "deep" });
    }

    // --- Gym: one per day ---
    if (gymBlock) {
      suggestions.push({ start: gymBlock.start, end: gymBlock.end, label: getGymLabelForDate(dateStr, dayOffset), type: "gym" });
    }

    return suggestions.sort((a, b) => a.start - b.start);
  };

  // Current view's suggestions (for backwards compat)
  const suggestedBlocks = getSuggestions(calDate, calendar, plannedBlocks, 0);

  return (
    <div className={`mx-auto px-4 py-8 sm:px-8 ${isDesktop ? "max-w-[1280px]" : "max-w-[960px]"}`}>
      {/* ═══ HEADER ═══ */}
      <div className="mb-6">
        <p className="text-sm text-[#949598] mb-1">{dateDisplay}</p>
        <h1 className="text-2xl font-semibold text-[#010205] tracking-tight">{greeting}</h1>
        <div className="h-px bg-[rgba(0,0,0,.08)] mt-5" />
      </div>

      {/* ═══ DAILY BRIEF ═══ */}
      <div className="mb-6 bg-white border border-[rgba(0,0,0,.06)] rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Daily Brief</div>
        {briefing?.summary ? (
          <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">{briefing.summary}</p>
        ) : briefingLoading ? (
          <p className="text-sm text-[#949598] animate-pulse-scan">Generating your daily brief…</p>
        ) : briefingNeedsAuth ? (
          <p className="text-sm text-[#949598]">
            Connect your email to enable.{" "}
            <a href="/api/auth/login" className="text-[#1a73e8] hover:underline">Connect Microsoft</a>
          </p>
        ) : (
          <p className="text-sm text-[#949598]">
            No brief yet.{" "}
            <button onClick={scanInbox} className="text-[#1a73e8] hover:underline cursor-pointer">Generate now</button>
          </p>
        )}
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 mb-6 border-b border-[rgba(0,0,0,.06)] overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["brief", "tasks", "dump", "log", "wiki", "health", "gym", "meals"] as TabId[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 sm:px-4 py-2.5 text-sm transition-colors cursor-pointer ${tab === t ? "text-[#010205] border-b-2 border-[#010205] font-semibold" : "text-[#949598] hover:text-[#535457] font-normal"}`}>
            {{ brief: "Today", tasks: "Tasks", dump: "Brain Dump", log: "Day Log", wiki: "Research", health: "Health", gym: "Gym", meals: "Meals" }[t]}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
           TODAY — Daily Brief
      ═══════════════════════════════════════════════════ */}
      {tab === "brief" && (
        <div className={`grid gap-5 ${isDesktop ? "grid-cols-[1fr_260px]" : "grid-cols-1"}`}>
          {/* ═══ CALENDAR AREA ═══ */}
          <div>
            {/* Nav */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => shiftCalDate(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,.08)] text-[#535457] hover:border-[rgba(0,0,0,.2)] hover:text-[#010205] cursor-pointer transition-colors text-sm">‹</button>
                <button onClick={() => setCalDate(today())}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${isCalToday ? "bg-[#010205] text-white" : "border border-[rgba(0,0,0,.08)] text-[#535457] hover:border-[rgba(0,0,0,.2)]"}`}>
                  Today
                </button>
                <button onClick={() => shiftCalDate(1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,.08)] text-[#535457] hover:border-[rgba(0,0,0,.2)] hover:text-[#010205] cursor-pointer transition-colors text-sm">›</button>
                <span className="text-sm font-semibold text-[#010205] ml-2">{calDateDisplay}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addCustomBlock()}
                  className="text-[10px] px-2.5 py-1 rounded-lg font-semibold border border-[rgba(0,0,0,.08)] text-[#535457] hover:border-[rgba(0,0,0,.2)] cursor-pointer transition-colors">+ Block</button>
                <button onClick={pushAllToCalendar} disabled={pushing}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${pushing ? "bg-[#2e8b3e]/50 text-white animate-pulse cursor-wait" : "border border-[#2e8b3e]/30 text-[#2e8b3e] hover:bg-[#2e8b3e]/8"}`}>
                  {pushing ? "Pushing..." : "Push to Outlook"}</button>
                <button onClick={scanInbox} disabled={scanning}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${scanning ? "bg-[#010205]/50 text-white animate-pulse cursor-wait" : "bg-[#010205] text-white hover:bg-[#28282e]"}`}>
                  {scanning ? "Syncing..." : "Sync"}</button>
              </div>
            </div>

            {/* Day headers — Outlook style */}
            {isDesktop && (
              <div className="grid grid-cols-[48px_1fr_1fr_1fr] gap-0 border-b border-[rgba(0,0,0,.08)] mb-0">
                <div />
                {visibleDates.map((vDate, vi) => {
                  const isDayToday = vDate === today();
                  const d = new Date(vDate + "T12:00:00");
                  return (
                    <div key={vDate} className={`pb-3 pl-3 ${vi > 0 ? "border-l border-[rgba(0,0,0,.08)]" : ""}`}>
                      <div className={`text-2xl font-semibold leading-none ${isDayToday ? "text-[#2980b9]" : "text-[#010205]"}`}>{d.getDate()}</div>
                      <div className={`text-xs mt-0.5 ${isDayToday ? "text-[#2980b9] font-semibold" : "text-[#949598]"}`}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timeline: shared time labels + day columns */}
            <div ref={calRef} className={`relative border border-[rgba(0,0,0,.06)] rounded-lg overflow-hidden bg-white ${isDesktop ? "grid grid-cols-[48px_1fr_1fr_1fr]" : "grid grid-cols-[48px_1fr]"}`} style={{ height: calHours * hourHeight }}>
              {/* Time labels column */}
              <div className="relative">
                {Array.from({ length: calHours }, (_, i) => {
                  const hour = calStart + i;
                  const h12 = hour > 12 ? hour - 12 : hour;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  return (
                    <div key={hour} className="absolute right-0 left-0 text-[10px] font-mono text-[#949598] text-right pr-2 -mt-[6px]" style={{ top: i * hourHeight }}>
                      {`${h12} ${ampm}`}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {visibleDates.map((vDate, colIdx) => {
                const dayEvents = multiCalendar[vDate] || [];
                const dayPlanned = (() => { try { const s = localStorage.getItem(`planned_${vDate}`); return s ? JSON.parse(s) : []; } catch { return []; } })();
                const daySuggestions = getSuggestions(vDate, dayEvents, dayPlanned, colIdx);
                const isDayToday = vDate === today();
                return (
                  <div key={vDate} className={`relative ${colIdx > 0 ? "border-l border-[rgba(0,0,0,.08)]" : ""}`}>
                    {/* Hour lines */}
                    {Array.from({ length: calHours + 1 }, (_, i) => (
                      <div key={i} className="absolute left-0 right-0 border-t border-[rgba(0,0,0,.05)]" style={{ top: i * hourHeight }} />
                    ))}

                    {/* Now indicator */}
                    {isDayToday && nowHour >= calStart && nowHour <= calEnd && (
                      <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: (nowHour - calStart) * hourHeight }}>
                        <div className="w-2 h-2 rounded-full bg-[#c0392b] -ml-1" />
                        <div className="flex-1 border-t-2 border-[#c0392b]" />
                      </div>
                    )}

                    {/* Events — with overlap detection */}
                    {(() => {
                      const timed = dayEvents.filter(e => !e.isAllDay).map((e, i) => ({
                        ...e, idx: i,
                        startH: Math.max(getHourFromIso(e.start), calStart),
                        endH: Math.min(getHourFromIso(e.end), calEnd),
                      }));
                      // Assign columns: events that overlap share the row
                      const columns: number[] = new Array(timed.length).fill(0);
                      const groupWidths: number[] = new Array(timed.length).fill(1);
                      for (let i = 0; i < timed.length; i++) {
                        let col = 0;
                        for (let j = 0; j < i; j++) {
                          if (timed[j].endH > timed[i].startH && timed[j].startH < timed[i].endH) {
                            // Overlaps with j — take next column
                            if (columns[j] >= col) col = columns[j] + 1;
                          }
                        }
                        columns[i] = col;
                      }
                      // Calculate group width for each event
                      for (let i = 0; i < timed.length; i++) {
                        let maxCol = columns[i];
                        for (let j = 0; j < timed.length; j++) {
                          if (i !== j && timed[j].endH > timed[i].startH && timed[j].startH < timed[i].endH) {
                            maxCol = Math.max(maxCol, columns[j]);
                          }
                        }
                        groupWidths[i] = maxCol + 1;
                      }
                      return timed.map((e, i) => {
                        const top = (e.startH - calStart) * hourHeight;
                        const height = Math.max(e.endH - e.startH, 0.5) * hourHeight - 2;
                        const widthPct = 100 / groupWidths[i];
                        const leftPct = columns[i] * widthPct;
                        return (
                          <div key={i} className={`absolute z-10 rounded px-2 py-1.5 overflow-hidden text-[10px] border-l-[3px] ${
                            e.isCancelled || e.responseStatus === "declined"
                              ? "bg-white border border-[rgba(0,0,0,.15)] border-l-[3px] border-l-[#949598] text-[#949598] line-through"
                              : e.responseStatus === "tentativelyAccepted"
                              ? "bg-[#d4850a]/5 border border-dashed border-[#d4850a]/30 border-l-[3px] border-l-[#d4850a] text-[#010205]"
                              : e.source === "google"
                              ? "bg-[#1a73e8]/10 border-l-[#1a73e8] text-[#010205]"
                              : "bg-[#d4850a]/10 border-l-[#d4850a] text-[#010205]"
                          }`}
                            style={{ top, height: Math.max(height, 22), left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)` }}>
                            <div className="font-semibold leading-tight truncate">
                              {e.isCancelled ? "Cancelled: " : e.responseStatus === "declined" ? "Declined: " : ""}{e.subject}
                            </div>
                            {height > 30 && e.location && <div className="text-[#535457] mt-0.5 truncate">{e.location}</div>}
                            {height > 44 && e.organizer && <div className="text-[#949598] mt-0.5 truncate">{e.organizer}</div>}
                          </div>
                        );
                      });
                    })()}

                    {/* Suggestions */}
                    {daySuggestions
                      .filter(s => !dayPlanned.some((p: {label: string}) => p.label === s.label))
                      .filter(s => !dragBlock || dragBlock.label !== s.label)
                      .map((s, i) => {
                      const top = (s.start - calStart) * hourHeight;
                      const height = (s.end - s.start) * hourHeight - 2;
                      const colors = { gym: "border-[#2e8b3e] bg-[#2e8b3e]/6 text-[#2e8b3e]", deep: "border-[#2980b9] bg-[#2980b9]/6 text-[#2980b9]", task: "border-[#535457] bg-[#535457]/4 text-[#535457]" };
                      return (
                        <div key={`sug-${i}`} className={`absolute left-1 right-1 z-5 rounded-lg border-2 border-dashed px-2 py-1 overflow-hidden group/sug ${colors[s.type as keyof typeof colors] || colors.task}`}
                          style={{ top, height: Math.max(height, 22) }}>
                          <div className="flex items-center gap-1">
                            <div onPointerDown={(e) => startDragSuggestion({ ...s, label: s.type === "gym" ? getGymLabelForDate(vDate, colIdx) : (sugOverrides[i] || s.label) }, e)}
                              className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 touch-none select-none text-[10px]">⠿</div>
                            <div className="flex-1 min-w-0">
                              {s.type === "gym" ? (
                                <select value={getGymValueForDate(vDate, colIdx)}
                                  onChange={e => setGymForDate(vDate, e.target.value)}
                                  className="w-full text-[10px] font-semibold bg-transparent border-none outline-none cursor-pointer text-inherit">
                                  {GYM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              ) : editingSugIdx === i && editingBlockId === vDate ? (
                                <input autoFocus value={editingBlockLabel}
                                  onChange={e => setEditingBlockLabel(e.target.value)}
                                  onBlur={() => { setSugOverrides(prev => ({ ...prev, [i]: editingBlockLabel })); setEditingSugIdx(null); setEditingBlockId(null); }}
                                  onKeyDown={e => { if (e.key === "Enter") { setSugOverrides(prev => ({ ...prev, [i]: editingBlockLabel })); setEditingSugIdx(null); setEditingBlockId(null); } if (e.key === "Escape") { setEditingSugIdx(null); setEditingBlockId(null); } }}
                                  className="w-full text-[10px] font-semibold bg-white/90 border border-current/20 rounded px-1 py-0.5 outline-none" />
                              ) : (
                                <div className="text-[10px] font-semibold leading-tight truncate cursor-text hover:underline"
                                  onClick={() => { setEditingSugIdx(i); setEditingBlockId(vDate); setEditingBlockLabel(sugOverrides[i] || s.label); }}>
                                  {sugOverrides[i] || s.label}
                                </div>
                              )}
                            </div>
                            <button onClick={() => acceptSuggestion({ ...s, label: s.type === "gym" ? getGymLabelForDate(vDate, colIdx) : (sugOverrides[i] || s.label) }, vDate)}
                              className="opacity-0 group-hover/sug:opacity-100 w-4 h-4 flex items-center justify-center rounded border border-current cursor-pointer text-[8px] font-bold flex-shrink-0">✓</button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Drag ghost */}
                    {dragBlock && colIdx === 0 && (
                      <div className={`absolute left-1 right-1 z-30 rounded-lg border-2 px-2 py-1.5 shadow-lg pointer-events-none ${
                        dragBlock.type === "gym" ? "bg-[#2e8b3e]/20 border-[#2e8b3e] text-[#2e8b3e]" :
                        dragBlock.type === "deep" ? "bg-[#2980b9]/20 border-[#2980b9] text-[#2980b9]" :
                        "bg-[#535457]/15 border-[#535457] text-[#535457]"
                      }`}
                        style={{ top: (dragBlock.currentStart - calStart) * hourHeight, height: dragBlock.duration * hourHeight - 2 }}>
                        <div className="text-[10px] font-semibold truncate">{dragBlock.label}</div>
                        <div className="text-[9px] opacity-60 mt-0.5">
                          {(() => { const v = dragBlock.currentStart; const h = Math.floor(v); const m = Math.round((v % 1) * 60); const ampm = h >= 12 ? "PM" : "AM"; const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`; })()}
                          {" – "}
                          {(() => { const v = dragBlock.currentStart + dragBlock.duration; const h = Math.floor(v); const m = Math.round((v % 1) * 60); const ampm = h >= 12 ? "PM" : "AM"; const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`; })()}
                        </div>
                      </div>
                    )}

                    {/* Planned blocks */}
                    {(colIdx === 0 ? plannedBlocks : dayPlanned).map((b: typeof plannedBlocks[0]) => {
                      const top = (b.start - calStart) * hourHeight;
                      const height = (b.end - b.start) * hourHeight - 2;
                      const colors = { gym: "bg-[#2e8b3e]/15 border-[#2e8b3e] text-[#2e8b3e]", deep: "bg-[#2980b9]/15 border-[#2980b9] text-[#2980b9]", task: "bg-[#535457]/10 border-[#535457] text-[#535457]" };
                      return (
                        <div key={b.id} className={`absolute left-1 right-1 z-10 rounded-lg border-2 px-2 py-1 overflow-hidden group/plan ${colors[b.type as keyof typeof colors] || colors.task}`}
                          style={{ top, height: Math.max(height, 22) }}>
                          <div className="flex items-center gap-1">
                            <div onPointerDown={(e) => startDragPlanned(b, e)}
                              className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-30 hover:opacity-100 touch-none select-none text-[10px]">⠿</div>
                            <div className="flex-1 min-w-0">
                              {editingBlockId === b.id ? (
                                <input autoFocus value={editingBlockLabel}
                                  onChange={e => setEditingBlockLabel(e.target.value)}
                                  onBlur={() => renameBlock(b.id, editingBlockLabel)}
                                  onKeyDown={e => { if (e.key === "Enter") renameBlock(b.id, editingBlockLabel); if (e.key === "Escape") setEditingBlockId(null); }}
                                  className="w-full text-[10px] font-semibold bg-white/90 border border-current/20 rounded px-1 py-0.5 outline-none" />
                              ) : (
                                <div className="text-[10px] font-semibold leading-tight truncate cursor-text hover:underline"
                                  onClick={() => { setEditingBlockId(b.id); setEditingBlockLabel(b.label); }}>
                                  {b.label}
                                </div>
                              )}
                            </div>
                            <button onClick={() => removePlannedBlock(b.id, vDate)}
                              className="opacity-0 group-hover/plan:opacity-100 w-4 h-4 flex items-center justify-center rounded cursor-pointer text-[9px] flex-shrink-0">×</button>
                          </div>
                          {/* Resize handle */}
                          <div onPointerDown={(e) => startResize(b.id, e, vDate)}
                            className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize opacity-0 group-hover/plan:opacity-100 flex items-center justify-center"
                            title="Drag to resize">
                            <div className="w-8 h-1 rounded-full bg-current opacity-40" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <div className="space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Calendars</div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-[#535457]"><div className="w-2.5 h-2.5 rounded bg-[#010205]" />Outlook</div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#535457]"><div className="w-2.5 h-2.5 rounded bg-[#1a73e8]" />Google</div>
                {!googleConnected && <a href="/api/auth/google" className="text-[10px] text-[#1a73e8] hover:underline ml-auto cursor-pointer">+ Connect Google</a>}
              </div>
            </div>

            {briefing && (
              <div>
                <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Briefing</div>
                <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3">
                  <p className="text-xs text-[#535457] leading-relaxed">{briefing.summary}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold">Priorities</div>
                <span className="text-[10px] font-mono text-[#949598]">{activeTasks.length}</span>
              </div>
              <div className="space-y-1">
                {activeTasks.slice(0, 6).map(task => (
                  <div key={task.id} className="flex items-center gap-2 bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 group hover:border-[rgba(0,0,0,.15)] transition-colors">
                    <button onClick={() => toggleTask(task)} className="w-3.5 h-3.5 rounded border-[1.5px] border-[rgba(0,0,0,.15)] flex-shrink-0 cursor-pointer hover:border-[#010205] transition-colors flex items-center justify-center" />
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(task.category) }} />
                    <span onClick={() => setSelectedTask(task)} className="flex-1 text-xs text-[#010205] cursor-pointer hover:underline truncate">{task.title}</span>
                    {task.priority === "high" && <span className="text-[9px] font-bold text-[#c0392b]">!</span>}
                  </div>
                ))}
                {activeTasks.length === 0 && <div className="text-xs text-[#949598] py-3 text-center">All clear.</div>}
                {activeTasks.length > 6 && <button onClick={() => setTab("tasks")} className="text-[10px] text-[#949598] hover:text-[#010205] cursor-pointer w-full text-center py-1">+{activeTasks.length - 6} more</button>}
              </div>
            </div>

            {briefing?.items && briefing.items.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">From Email</div>
                <div className="space-y-1">
                  {briefing.items.slice(0, 4).map((item: BriefingItem, i: number) => (
                    <div key={i} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2">
                      <div className="text-xs font-semibold text-[#010205] truncate">{item.title}</div>
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => { addTask(item.title, item.category, item.priority, "email", item.reason); dismissBriefingItem(i); }} className="text-[10px] bg-[#010205] text-white px-2 py-0.5 rounded font-semibold cursor-pointer">Add</button>
                        <button onClick={() => dismissBriefingItem(i)} className="text-[10px] text-[#949598] hover:text-[#535457] px-1.5 py-0.5 cursor-pointer">Skip</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {supplements.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Supplements</div>
                <div className="space-y-1">
                  {supplements.map(s => {
                    const isOn = s.current_day < s.on_days;
                    return (
                      <div key={s.id} className={`flex items-center justify-between bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 ${!isOn ? "opacity-50" : ""}`}>
                        <span className="text-xs font-semibold text-[#010205]">{s.supplement_name}</span>
                        <span className={`text-[10px] font-mono ${isOn ? "text-[#2e8b3e]" : "text-[#949598]"}`}>{isOn ? `D${s.current_day + 1}/${s.on_days}` : "OFF"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Research</div>
              <div className="flex gap-1">
                <input value={wikiQuery} onChange={e => setWikiQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") askWiki(); }}
                  placeholder="Ask anything..." className="flex-1 bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-xs text-[#010205] placeholder-[#949598] outline-none focus:border-[#010205]" />
                <button onClick={askWiki} disabled={askingWiki || !wikiQuery.trim()} className="bg-[#010205] text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer hover:bg-[#28282e] disabled:opacity-40">{askingWiki ? "..." : "Go"}</button>
              </div>
              {wikiAnswer && <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3 mt-2"><p className="text-xs text-[#535457] leading-relaxed whitespace-pre-wrap">{wikiAnswer}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
           TASKS
      ═══════════════════════════════════════════════════ */}
      {tab === "tasks" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addTask(newTaskTitle, newTaskCategory, newTaskPriority); }}
              placeholder="Add a task..."
              className="flex-1 bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-sm text-[#010205] placeholder-[#949598] outline-none focus:border-[#010205]" />
            <select value={newTaskCategory} onChange={e => setNewTaskCategory(e.target.value)}
              className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-2 py-2 text-xs text-[#535457] outline-none">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
              className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-2 py-2 text-xs text-[#535457] outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => addTask(newTaskTitle, newTaskCategory, newTaskPriority)}
              className="bg-[#010205] hover:bg-[#28282e] text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors">Add</button>
          </div>

          <div className="flex gap-2 mb-4 items-center flex-wrap">
            <button onClick={() => setFilterCategory(null)}
              className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${!filterCategory ? "bg-[#010205] text-white" : "text-[#949598] hover:text-[#535457]"}`}>All</button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setFilterCategory(c.id)}
                className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${filterCategory === c.id ? "text-white" : "text-[#949598] hover:text-[#535457]"}`}
                style={filterCategory === c.id ? { backgroundColor: c.color } : {}}>
                {c.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setShowCompleted(!showCompleted)} className="text-xs text-[#949598] hover:text-[#535457] cursor-pointer">
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
            {tasks.some(t => t.status === "done") && (
              <button onClick={clearCompleted} className="text-xs text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer">Clear completed</button>
            )}
          </div>

          <div className="space-y-1.5">
            {filteredTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2.5 group hover:border-[rgba(0,0,0,.15)] transition-colors">
                <button onClick={() => toggleTask(task)}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${task.status === "done" ? "bg-[#2e8b3e]/10 border-[#2e8b3e] text-[#2e8b3e]" : "border-[rgba(0,0,0,.12)] hover:border-[#010205]"}`}>
                  {task.status === "done" && <span className="text-xs">✓</span>}
                </button>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(task.category) }} />
                <span onClick={() => setSelectedTask(task)}
                  className={`flex-1 text-sm cursor-pointer hover:underline ${task.status === "done" ? "line-through text-[#949598]" : "text-[#010205]"}`}>
                  {task.title}
                </span>
                {task.source !== "manual" && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${task.source === "email" ? "bg-[#010205]/8 text-[#535457]" : "bg-[#7b3fa0]/10 text-[#7b3fa0]"}`}>{task.source}</span>}
                <span className={`text-[10px] font-semibold font-mono ${task.priority === "high" ? "text-[#c0392b]" : task.priority === "low" ? "text-[#949598]" : "text-[#535457]"}`}>
                  {task.priority.toUpperCase()}
                </span>
                <button onClick={() => deleteTask(task.id)} className="text-[rgba(0,0,0,.1)] hover:text-[#c0392b] opacity-0 group-hover:opacity-100 transition-opacity text-sm cursor-pointer">×</button>
              </div>
            ))}
            {filteredTasks.length === 0 && <p className="text-center text-[#949598] text-sm py-8">No tasks to show.</p>}
          </div>
        </div>
      )}

      {/* ═══ BRAIN DUMP ═══ */}
      {tab === "dump" && (
        <div>
          <p className="text-xs text-[#949598] mb-3">One task per line. Bullets and dashes stripped automatically.</p>
          <textarea value={dumpText} onChange={e => setDumpText(e.target.value)}
            placeholder={"- Follow up with broker on 123 Main St\n- Review IC package for Maple Ridge\n- Push comp tool update to prod"}
            className="w-full bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-4 py-3 text-sm text-[#010205] placeholder-[#949598]/40 outline-none focus:border-[#010205] font-mono resize-none"
            rows={10} />
          <div className="flex gap-3 mt-3 items-center">
            <select value={dumpCategory} onChange={e => setDumpCategory(e.target.value)}
              className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-xs text-[#535457] outline-none">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={captureDump} disabled={!dumpText.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${dumpText.trim() ? "bg-[#010205] hover:bg-[#28282e] text-white" : "bg-[rgba(0,0,0,.06)] text-[#949598] cursor-not-allowed"}`}>
              Capture All
            </button>
            <span className="text-xs text-[#949598] font-mono">{dumpText.split("\n").filter(l => l.trim()).length} items</span>
          </div>
        </div>
      )}

      {/* ═══ DAY LOG ═══ */}
      {tab === "log" && (
        <div>
          <p className="text-xs text-[#949598] mb-3">Freeform notes for {dateStr}. Auto-saves as you type.</p>
          <textarea value={dayLog} onChange={e => handleLogChange(e.target.value)}
            placeholder="What happened today? Notes, observations, things to remember..."
            className="w-full bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-4 py-3 text-sm text-[#010205] placeholder-[#949598]/40 outline-none focus:border-[#010205] font-mono resize-none"
            rows={16} />
        </div>
      )}

      {/* ═══ WIKI / RESEARCH ═══ */}
      {tab === "wiki" && <WikiTab />}

      {/* ═══ HEALTH ═══ */}
      {tab === "health" && <HealthTab />}

      {/* === GYM === */}
      {tab === "gym" && <ProgramTab />}

      {/* === MEALS === */}
      {tab === "meals" && <MealsTab />}

      {/* ═══ TASK DETAIL PANEL ═══ */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white border border-[rgba(0,0,0,.08)] rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColor(selectedTask.category) }} />
                <span className={`text-[10px] font-semibold font-mono ${selectedTask.priority === "high" ? "text-[#c0392b]" : selectedTask.priority === "low" ? "text-[#949598]" : "text-[#535457]"}`}>
                  {selectedTask.priority.toUpperCase()}
                </span>
                {selectedTask.source !== "manual" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selectedTask.source === "email" ? "bg-[#010205]/8 text-[#535457]" : "bg-[#7b3fa0]/10 text-[#7b3fa0]"}`}>
                    {selectedTask.source}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-[#949598] hover:text-[#010205] text-lg cursor-pointer">×</button>
            </div>

            <input value={selectedTask.title}
              onChange={e => setSelectedTask({ ...selectedTask, title: e.target.value })}
              onBlur={() => updateTaskField(selectedTask.id, "title", selectedTask.title)}
              className="w-full text-lg font-semibold text-[#010205] bg-transparent border-b border-transparent hover:border-[rgba(0,0,0,.08)] focus:border-[#010205] outline-none pb-1 mb-4" />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-[#949598] uppercase tracking-wider font-semibold mb-1 block">Category</label>
                <select value={selectedTask.category}
                  onChange={e => { setSelectedTask({ ...selectedTask, category: e.target.value as Task["category"] }); updateTaskField(selectedTask.id, "category", e.target.value); }}
                  className="w-full bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 text-sm text-[#010205] outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#949598] uppercase tracking-wider font-semibold mb-1 block">Priority</label>
                <select value={selectedTask.priority}
                  onChange={e => { setSelectedTask({ ...selectedTask, priority: e.target.value as Task["priority"] }); updateTaskField(selectedTask.id, "priority", e.target.value); }}
                  className="w-full bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 text-sm text-[#010205] outline-none">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#949598] uppercase tracking-wider font-semibold mb-1 block">Status</label>
                <select value={selectedTask.status}
                  onChange={e => { const s = e.target.value as "todo" | "done"; setSelectedTask({ ...selectedTask, status: s }); updateTaskField(selectedTask.id, "status", s); }}
                  className="w-full bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 text-sm text-[#010205] outline-none">
                  <option value="todo">To Do</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#949598] uppercase tracking-wider font-semibold mb-1 block">Due Date</label>
                <input type="date" value={selectedTask.due_date || ""}
                  onChange={e => { setSelectedTask({ ...selectedTask, due_date: e.target.value || null }); updateTaskField(selectedTask.id, "due_date", e.target.value || null); }}
                  className="w-full bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 text-sm text-[#010205] outline-none" />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-[#949598] uppercase tracking-wider font-semibold mb-1 block">Notes</label>
              <textarea value={selectedTask.notes || ""}
                onChange={e => setSelectedTask({ ...selectedTask, notes: e.target.value })}
                onBlur={() => updateTaskField(selectedTask.id, "notes", selectedTask.notes)}
                placeholder="Add notes..."
                className="w-full bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-3 py-2 text-sm text-[#010205] placeholder-[#949598]/40 outline-none focus:border-[#010205] font-mono resize-none"
                rows={4} />
            </div>

            <div className="flex justify-between items-center text-[10px] text-[#949598] font-mono border-t border-[rgba(0,0,0,.06)] pt-3">
              <span>Created {selectedTask.created_date}</span>
              {selectedTask.completed_date && <span>Completed {selectedTask.completed_date}</span>}
              <button onClick={() => { deleteTask(selectedTask.id); setSelectedTask(null); }}
                className="text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer font-sans font-medium">Delete task</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-[rgba(0,0,0,.06)] flex justify-between items-center">
        <span className="text-[10px] text-[#949598]">&copy; {new Date().getFullYear()} Command Center</span>
        <span className="text-[10px] text-[#949598] font-mono">{dateStr}</span>
      </div>
    </div>
  );
}
