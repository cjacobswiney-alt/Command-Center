"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Task, Briefing, BriefingItem, CATEGORIES, PRIORITIES } from "@/lib/types";
import { today, getGreeting } from "@/lib/utils";

type TabId = "tasks" | "briefing" | "dump" | "log";

export default function CommandCenter() {
  const [tab, setTab] = useState<TabId>("tasks");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateStr = today();

  const fetchTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  const fetchBriefing = useCallback(async () => {
    const res = await fetch(`/api/briefing/${dateStr}`);
    if (res.ok) { const data = await res.json(); if (data) setBriefing(data); }
  }, [dateStr]);

  const fetchDayLog = useCallback(async () => {
    const res = await fetch(`/api/day-log/${dateStr}`);
    if (res.ok) { const data = await res.json(); setDayLog(data.content || ""); }
  }, [dateStr]);

  useEffect(() => { fetchTasks(); fetchBriefing(); fetchDayLog(); }, [fetchTasks, fetchBriefing, fetchDayLog]);

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

  const saveEdit = async (id: string) => {
    if (!editingTitle.trim()) return;
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingTitle.trim() }),
    });
    setEditingId(null);
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
      if (res.ok) { const data = await res.json(); setBriefing(data); setTab("briefing"); }
    } catch {} finally { setScanning(false); }
  };

  const dismissBriefingItem = (index: number) => {
    if (!briefing) return;
    const updated = { ...briefing, items: briefing.items.filter((_, i) => i !== index) };
    setBriefing(updated);
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

  const activeTasks = tasks.filter(t => t.status === "todo");
  const highPriority = activeTasks.filter(t => t.priority === "high");
  const doneToday = tasks.filter(t => t.completed_date === dateStr);
  const carryover = activeTasks.filter(t => t.created_date < dateStr);
  const { greeting, hint } = getGreeting();

  const filteredTasks = tasks.filter(t => {
    if (!showCompleted && t.status === "done") return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });

  const categoryColor = (cat: string) => CATEGORIES.find(c => c.id === cat)?.color || "#8a8a8a";

  return (
    <div className="max-w-[720px] mx-auto px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div>
            <h1 className="text-xl font-bold text-[#1B3A5C] tracking-wide">{greeting}</h1>
            {carryover.length > 0 && <p className="text-xs text-[#D4880F] mt-0.5">{carryover.length} task{carryover.length > 1 ? "s" : ""} carried over</p>}
            {hint && <p className="text-xs text-[#8a8a8a] mt-0.5">{hint}</p>}
            {doneToday.length > 0 && new Date().getHours() >= 17 && <p className="text-xs text-[#2c5f4a] mt-0.5">{doneToday.length} completed today</p>}
          </div>
        </div>
        <div className="h-px bg-[#e0ddd6] mt-4" />
      </div>

      {/* Scan button */}
      <div className="flex gap-2 mb-6">
        <button onClick={scanInbox} disabled={scanning}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white text-sm tracking-wide transition-all cursor-pointer ${scanning ? "bg-[#1B3A5C]/50 animate-pulse-scan cursor-wait" : "bg-[#1B3A5C] hover:bg-[#254d75] shadow-md"}`}>
          {scanning ? "Scanning inbox..." : "Scan Inbox & Brief Me"}
        </button>
        <select value={scanRange} onChange={e => setScanRange(e.target.value)}
          className="bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-xs text-[#5c5c5c] outline-none font-semibold">
          <option value="1">Today</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active", value: activeTasks.length, color: "" },
          { label: "High Priority", value: highPriority.length, color: highPriority.length > 0 ? "text-[#c0392b]" : "" },
          { label: "Done Today", value: doneToday.length, color: doneToday.length > 0 ? "text-[#2c5f4a]" : "" },
          { label: "Carryover", value: carryover.length, color: carryover.length > 0 ? "text-[#D4880F]" : "" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-[#e0ddd6] rounded-lg p-3 text-center">
            <p className={`text-2xl font-bold font-[family-name:var(--font-jetbrains)] ${s.color || "text-[#1a1a1a]"}`}>{s.value}</p>
            <p className="text-[10px] text-[#8a8a8a] mt-1 uppercase tracking-wider font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#e0ddd6]">
        {(["tasks", "briefing", "dump", "log"] as TabId[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${tab === t ? "text-[#1B3A5C] border-b-2 border-[#C9A84C]" : "text-[#8a8a8a] hover:text-[#5c5c5c]"}`}>
            {t === "tasks" ? "Tasks" : t === "briefing" ? "Briefing" : t === "dump" ? "Brain Dump" : "Day Log"}
          </button>
        ))}
      </div>

      {/* === TASKS === */}
      {tab === "tasks" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addTask(newTaskTitle, newTaskCategory, newTaskPriority); }}
              placeholder="Add a task..."
              className="flex-1 bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#8a8a8a] outline-none focus:border-[#1B3A5C]" />
            <select value={newTaskCategory} onChange={e => setNewTaskCategory(e.target.value)}
              className="bg-white border border-[#e0ddd6] rounded-lg px-2 py-2 text-xs text-[#5c5c5c] outline-none">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
              className="bg-white border border-[#e0ddd6] rounded-lg px-2 py-2 text-xs text-[#5c5c5c] outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={() => addTask(newTaskTitle, newTaskCategory, newTaskPriority)}
              className="bg-[#1B3A5C] hover:bg-[#254d75] text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors">Add</button>
          </div>

          <div className="flex gap-2 mb-4 items-center flex-wrap">
            <button onClick={() => setFilterCategory(null)}
              className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${!filterCategory ? "bg-[#1B3A5C] text-white" : "text-[#8a8a8a] hover:text-[#5c5c5c]"}`}>All</button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setFilterCategory(c.id)}
                className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${filterCategory === c.id ? "text-white" : "text-[#8a8a8a] hover:text-[#5c5c5c]"}`}
                style={filterCategory === c.id ? { backgroundColor: c.color } : {}}>
                {c.label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setShowCompleted(!showCompleted)} className="text-xs text-[#8a8a8a] hover:text-[#5c5c5c] cursor-pointer">
              {showCompleted ? "Hide completed" : "Show completed"}
            </button>
            {tasks.some(t => t.status === "done") && (
              <button onClick={clearCompleted} className="text-xs text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer">Clear completed</button>
            )}
          </div>

          <div className="space-y-1.5">
            {filteredTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 bg-white border border-[#e0ddd6] rounded-lg px-3 py-2.5 group hover:border-[#C9A84C]/40 transition-colors">
                <button onClick={() => toggleTask(task)}
                  className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${task.status === "done" ? "bg-[#2c5f4a]/10 border-[#2c5f4a] text-[#2c5f4a]" : "border-[#e0ddd6] hover:border-[#1B3A5C]"}`}>
                  {task.status === "done" && <span className="text-xs">✓</span>}
                </button>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(task.category) }} />
                <span onClick={() => setSelectedTask(task)}
                  className={`flex-1 text-sm cursor-pointer hover:text-[#1B3A5C] ${task.status === "done" ? "line-through text-[#8a8a8a]" : "text-[#1a1a1a]"}`}>
                  {task.title}
                </span>
                {task.source === "email" && <span className="text-[10px] bg-[#1B3A5C]/10 text-[#1B3A5C] px-1.5 py-0.5 rounded font-medium">email</span>}
                {task.source === "dump" && <span className="text-[10px] bg-[#7C5CBF]/10 text-[#7C5CBF] px-1.5 py-0.5 rounded font-medium">dump</span>}
                <span className={`text-[10px] font-semibold font-[family-name:var(--font-jetbrains)] ${task.priority === "high" ? "text-[#c0392b]" : task.priority === "low" ? "text-[#8a8a8a]" : "text-[#5c5c5c]"}`}>
                  {task.priority.toUpperCase()}
                </span>
                <button onClick={() => deleteTask(task.id)} className="text-[#e0ddd6] hover:text-[#c0392b] opacity-0 group-hover:opacity-100 transition-opacity text-sm cursor-pointer">×</button>
              </div>
            ))}
            {filteredTasks.length === 0 && <p className="text-center text-[#8a8a8a] text-sm py-8">No tasks to show.</p>}
          </div>
        </div>
      )}

      {/* === BRIEFING === */}
      {tab === "briefing" && (
        <div>
          {briefing ? (
            <div>
              <div className="bg-white border border-[#e0ddd6] rounded-lg p-4 mb-4">
                <p className="text-sm text-[#5c5c5c] leading-relaxed">{briefing.summary}</p>
                <p className="text-[10px] text-[#8a8a8a] font-[family-name:var(--font-jetbrains)] mt-3">
                  Scanned {briefing.scanned_at ? new Date(briefing.scanned_at).toLocaleTimeString() : "today"}
                </p>
              </div>
              {briefing.items && briefing.items.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-[#8a8a8a] font-semibold uppercase tracking-widest mb-2">Suggested Tasks</p>
                  {briefing.items.map((item: BriefingItem, i: number) => (
                    <div key={i} className="bg-white border border-[#e0ddd6] rounded-lg p-3 flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-[#1a1a1a] font-semibold">{item.title}</p>
                        <p className="text-xs text-[#8a8a8a] mt-1">{item.reason}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: categoryColor(item.category) + "18", color: categoryColor(item.category) }}>
                            {item.category}
                          </span>
                          <span className={`text-[10px] font-[family-name:var(--font-jetbrains)] font-semibold ${item.priority === "high" ? "text-[#c0392b]" : "text-[#8a8a8a]"}`}>
                            {item.priority?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { addTask(item.title, item.category, item.priority, "email", item.reason); dismissBriefingItem(i); }}
                          className="text-xs bg-[#1B3A5C] hover:bg-[#254d75] text-white px-3 py-1.5 rounded font-medium cursor-pointer transition-colors">Add</button>
                        <button onClick={() => dismissBriefingItem(i)}
                          className="text-xs text-[#8a8a8a] hover:text-[#5c5c5c] px-2 py-1.5 cursor-pointer">Skip</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#8a8a8a] text-center py-4">All suggestions handled.</p>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#8a8a8a] text-sm">No briefing yet today.</p>
              <p className="text-[#8a8a8a]/60 text-xs mt-1">Hit &quot;Scan Inbox &amp; Brief Me&quot; to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* === BRAIN DUMP === */}
      {tab === "dump" && (
        <div>
          <p className="text-xs text-[#8a8a8a] mb-3">One task per line. Bullets and dashes stripped automatically.</p>
          <textarea value={dumpText} onChange={e => setDumpText(e.target.value)}
            placeholder={"- Follow up with broker on 123 Main St\n- Review IC package for Maple Ridge\n- Push comp tool update to prod\n- Schedule 1:1 with Alex"}
            className="w-full bg-white border border-[#e0ddd6] rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#8a8a8a]/40 outline-none focus:border-[#1B3A5C] font-[family-name:var(--font-jetbrains)] resize-none"
            rows={10} />
          <div className="flex gap-3 mt-3 items-center">
            <select value={dumpCategory} onChange={e => setDumpCategory(e.target.value)}
              className="bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-xs text-[#5c5c5c] outline-none">
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button onClick={captureDump} disabled={!dumpText.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${dumpText.trim() ? "bg-[#1B3A5C] hover:bg-[#254d75] text-white" : "bg-[#e0ddd6] text-[#8a8a8a] cursor-not-allowed"}`}>
              Capture All
            </button>
            <span className="text-xs text-[#8a8a8a] font-[family-name:var(--font-jetbrains)]">
              {dumpText.split("\n").filter(l => l.trim()).length} items
            </span>
          </div>
        </div>
      )}

      {/* === DAY LOG === */}
      {tab === "log" && (
        <div>
          <p className="text-xs text-[#8a8a8a] mb-3">Freeform notes for {dateStr}. Auto-saves as you type.</p>
          <textarea value={dayLog} onChange={e => handleLogChange(e.target.value)}
            placeholder="What happened today? Notes, observations, things to remember..."
            className="w-full bg-white border border-[#e0ddd6] rounded-lg px-4 py-3 text-sm text-[#1a1a1a] placeholder-[#8a8a8a]/40 outline-none focus:border-[#1B3A5C] font-[family-name:var(--font-jetbrains)] resize-none"
            rows={16} />
        </div>
      )}

      {/* Task Detail Panel */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white border border-[#e0ddd6] rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColor(selectedTask.category) }} />
                <span className={`text-[10px] font-semibold font-[family-name:var(--font-jetbrains)] ${selectedTask.priority === "high" ? "text-[#c0392b]" : selectedTask.priority === "low" ? "text-[#8a8a8a]" : "text-[#5c5c5c]"}`}>
                  {selectedTask.priority.toUpperCase()}
                </span>
                {selectedTask.source !== "manual" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selectedTask.source === "email" ? "bg-[#1B3A5C]/10 text-[#1B3A5C]" : "bg-[#7C5CBF]/10 text-[#7C5CBF]"}`}>
                    {selectedTask.source}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-[#8a8a8a] hover:text-[#1a1a1a] text-lg cursor-pointer">×</button>
            </div>

            {/* Title */}
            <input
              value={selectedTask.title}
              onChange={e => setSelectedTask({ ...selectedTask, title: e.target.value })}
              onBlur={() => updateTaskField(selectedTask.id, "title", selectedTask.title)}
              className="w-full text-lg font-semibold text-[#1a1a1a] bg-transparent border-b border-transparent hover:border-[#e0ddd6] focus:border-[#1B3A5C] outline-none pb-1 mb-4"
            />

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold mb-1 block">Category</label>
                <select
                  value={selectedTask.category}
                  onChange={e => { setSelectedTask({ ...selectedTask, category: e.target.value as Task["category"] }); updateTaskField(selectedTask.id, "category", e.target.value); }}
                  className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold mb-1 block">Priority</label>
                <select
                  value={selectedTask.priority}
                  onChange={e => { setSelectedTask({ ...selectedTask, priority: e.target.value as Task["priority"] }); updateTaskField(selectedTask.id, "priority", e.target.value); }}
                  className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold mb-1 block">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={e => { const newStatus = e.target.value as "todo" | "done"; setSelectedTask({ ...selectedTask, status: newStatus }); updateTaskField(selectedTask.id, "status", newStatus); }}
                  className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none">
                  <option value="todo">To Do</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold mb-1 block">Due Date</label>
                <input
                  type="date"
                  value={selectedTask.due_date || ""}
                  onChange={e => { setSelectedTask({ ...selectedTask, due_date: e.target.value || null }); updateTaskField(selectedTask.id, "due_date", e.target.value || null); }}
                  className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-[10px] text-[#8a8a8a] uppercase tracking-wider font-semibold mb-1 block">Notes</label>
              <textarea
                value={selectedTask.notes || ""}
                onChange={e => setSelectedTask({ ...selectedTask, notes: e.target.value })}
                onBlur={() => updateTaskField(selectedTask.id, "notes", selectedTask.notes)}
                placeholder="Add notes..."
                className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#8a8a8a]/40 outline-none focus:border-[#1B3A5C] font-[family-name:var(--font-jetbrains)] resize-none"
                rows={4}
              />
            </div>

            {/* Meta */}
            <div className="flex justify-between items-center text-[10px] text-[#8a8a8a] font-[family-name:var(--font-jetbrains)] border-t border-[#e0ddd6] pt-3">
              <span>Created {selectedTask.created_date}</span>
              {selectedTask.completed_date && <span>Completed {selectedTask.completed_date}</span>}
              <button onClick={() => { deleteTask(selectedTask.id); setSelectedTask(null); }}
                className="text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer font-[family-name:var(--font-montserrat)] font-medium">Delete task</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-[#e0ddd6] flex justify-between items-center">
        <span className="text-[10px] text-[#8a8a8a]">&copy; {new Date().getFullYear()} Command Center</span>
        <span className="text-[10px] text-[#8a8a8a] font-[family-name:var(--font-jetbrains)]">{dateStr}</span>
      </div>
    </div>
  );
}
