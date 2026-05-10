"use client";

import { useState, useEffect, useCallback } from "react";
import { Workout, WorkoutDetail, SESSION_TEMPLATES } from "@/lib/types";
import { today } from "@/lib/utils";

interface WorkoutSet {
  set_num: number;
  reps: number | null;
  weight_lb: number | null;
  rpe: number | null;
  notes: string;
}

interface ExerciseEntry {
  name: string;
  sets: WorkoutSet[];
}

export default function TrainingTab() {
  const [view, setView] = useState<"start" | "logging" | "history">("start");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [prs, setPrs] = useState<{ exercise: string; weight_lb: number; reps: number; date: string }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<WorkoutDetail | null>(null);

  // Active session state
  const [sessName, setSessName] = useState("");
  const [sessDate, setSessDate] = useState(today());
  const [sessDuration, setSessDuration] = useState("");
  const [sessRpe, setSessRpe] = useState(7);
  const [sessNotes, setSessNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [addExName, setAddExName] = useState("");
  const [previousPerf, setPreviousPerf] = useState<Record<string, { weight_lb: number; reps: number }[]>>({});

  const fetchWorkouts = useCallback(async () => {
    const res = await fetch("/api/workout?limit=20");
    if (res.ok) setWorkouts(await res.json());
  }, []);

  const fetchPrs = useCallback(async () => {
    const res = await fetch("/api/health/dashboard");
    if (res.ok) {
      const data = await res.json();
      setPrs(data.prs || []);
    }
  }, []);

  useEffect(() => { fetchWorkouts(); fetchPrs(); }, [fetchWorkouts, fetchPrs]);

  const getPrevPerf = async (name: string) => {
    if (previousPerf[name]) return previousPerf[name];
    try {
      const res = await fetch(`/api/workout/previous/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviousPerf(prev => ({ ...prev, [name]: data }));
        return data;
      }
    } catch {}
    return [];
  };

  const startSession = async (template: string) => {
    setSessName(template);
    setSessDate(today());
    setSessDuration("");
    setSessRpe(7);
    setSessNotes("");
    const exNames = SESSION_TEMPLATES[template] || [];
    const exs: ExerciseEntry[] = [];
    for (const name of exNames) {
      const prev = await getPrevPerf(name);
      exs.push({
        name,
        sets: [{ set_num: 1, reps: prev[0]?.reps || null, weight_lb: prev[0]?.weight_lb || null, rpe: null, notes: "" }],
      });
    }
    setExercises(exs);
    setView("logging");
  };

  const addExercise = async () => {
    if (!addExName.trim()) return;
    const prev = await getPrevPerf(addExName.trim());
    setExercises([...exercises, {
      name: addExName.trim(),
      sets: [{ set_num: 1, reps: prev[0]?.reps || null, weight_lb: prev[0]?.weight_lb || null, rpe: null, notes: "" }],
    }]);
    setAddExName("");
  };

  const addSet = (exIdx: number) => {
    const ex = exercises[exIdx];
    const lastSet = ex.sets[ex.sets.length - 1];
    setExercises(exercises.map((e, i) => i === exIdx ? {
      ...e, sets: [...e.sets, { set_num: e.sets.length + 1, reps: lastSet?.reps || null, weight_lb: lastSet?.weight_lb || null, rpe: null, notes: "" }]
    } : e));
  };

  const updateSet = (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: string) => {
    setExercises(exercises.map((e, i) => i === exIdx ? {
      ...e, sets: e.sets.map((s, j) => j === setIdx ? { ...s, [field]: field === "notes" ? value : (parseFloat(value) || null) } : s)
    } : e));
  };

  const removeExercise = (exIdx: number) => {
    setExercises(exercises.filter((_, i) => i !== exIdx));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(exercises.map((e, i) => i === exIdx ? {
      ...e, sets: e.sets.filter((_, j) => j !== setIdx).map((s, j) => ({ ...s, set_num: j + 1 }))
    } : e));
  };

  const saveSession = async () => {
    const payload = {
      date: sessDate,
      session_name: sessName,
      duration_min: sessDuration ? parseInt(sessDuration) : null,
      overall_rpe: sessRpe,
      notes: sessNotes,
      exercises: exercises
        .filter(e => e.sets.some(s => s.weight_lb || s.reps))
        .map(e => ({ name: e.name, sets: e.sets.filter(s => s.weight_lb || s.reps) })),
    };
    await fetch("/api/workout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setView("start");
    setPreviousPerf({});
    fetchWorkouts();
    fetchPrs();
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const res = await fetch(`/api/workout/${id}`);
    if (res.ok) setExpandedDetail(await res.json());
  };

  const deleteWorkout = async (id: string) => {
    await fetch(`/api/workout/${id}`, { method: "DELETE" });
    setExpandedId(null);
    fetchWorkouts();
    fetchPrs();
  };

  const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${m}/${d}/${y}`; };

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-5">
        {(["start", "history"] as const).map(v => (
          <button key={v} onClick={() => setView(v === "start" && view === "logging" ? "logging" : v)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${(v === "start" && (view === "start" || view === "logging")) || v === view ? "bg-[#010205] text-white border-[#010205]" : "bg-transparent text-[#535457] border-[rgba(0,0,0,.08)] hover:border-[rgba(0,0,0,.2)]"}`}>
            {v === "start" ? "Workout" : "History"}
          </button>
        ))}
      </div>

      {/* ═══ START / TEMPLATE SELECT ═══ */}
      {view === "start" && (
        <div>
          <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-3">Start a Session</div>
          <div className="flex gap-2 flex-wrap mb-6">
            <button onClick={() => startSession("")}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#010205] text-[#010205] cursor-pointer hover:bg-[#010205] hover:text-white transition-colors">
              + Blank Session
            </button>
            {Object.keys(SESSION_TEMPLATES).map(name => (
              <button key={name} onClick={() => startSession(name)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-[rgba(0,0,0,.08)] text-[#535457] cursor-pointer hover:border-[rgba(0,0,0,.2)] transition-colors">
                {name}
              </button>
            ))}
          </div>

          {/* PRs */}
          {prs.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-3">Personal Records</div>
              <div className="grid grid-cols-3 gap-2">
                {prs.map(p => (
                  <div key={p.exercise} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3">
                    <div className="text-[11px] text-[#949598]">{p.exercise}</div>
                    <div className="text-lg font-semibold">{p.weight_lb} lb</div>
                    <div className="text-[10px] text-[#949598]">{p.reps ? `× ${p.reps}` : ""} · {fmtDate(p.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVE LOGGING SESSION ═══ */}
      {view === "logging" && (
        <div>
          {/* Session header */}
          <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-4 mb-4">
            <div className="flex gap-3 items-center flex-wrap">
              <input value={sessName} onChange={e => setSessName(e.target.value)} placeholder="Session name"
                className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:border-[#010205] w-48" />
              <input type="date" value={sessDate} onChange={e => setSessDate(e.target.value)}
                className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#010205]" />
              <input value={sessDuration} onChange={e => setSessDuration(e.target.value)} placeholder="Duration (min)" type="number"
                className="bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#010205] w-36" />
              <div className="flex-1" />
              <button onClick={() => setView("start")}
                className="text-xs text-[#949598] hover:text-[#535457] cursor-pointer px-3 py-2">Cancel</button>
              <button onClick={saveSession}
                className="text-xs bg-[#2e8b3e]/10 border border-[#2e8b3e]/20 text-[#2e8b3e] font-semibold px-4 py-2 rounded-xl cursor-pointer hover:bg-[#2e8b3e]/15">
                Save Session
              </button>
            </div>
          </div>

          {/* Exercise blocks */}
          {exercises.map((ex, exIdx) => (
            <div key={exIdx} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg mb-3 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[rgba(0,0,0,.02)] border-b border-[rgba(0,0,0,.06)]">
                <span className="text-sm font-semibold flex-1">{ex.name}</span>
                {previousPerf[ex.name]?.[0] && (
                  <span className="text-[10px] text-[#949598] italic">Last: {previousPerf[ex.name][0].weight_lb}lb × {previousPerf[ex.name][0].reps}</span>
                )}
                <button onClick={() => removeExercise(exIdx)} className="text-[#949598] hover:text-[#c0392b] cursor-pointer text-sm">×</button>
              </div>
              <div className="px-4 py-2">
                {/* Header row */}
                <div className="grid grid-cols-[30px_1fr_1fr_1fr_24px] gap-2 mb-1">
                  <div className="text-[10px] text-[#949598] text-center">Set</div>
                  <div className="text-[10px] text-[#949598] text-center">Weight (lb)</div>
                  <div className="text-[10px] text-[#949598] text-center">Reps</div>
                  <div className="text-[10px] text-[#949598] text-center">RPE</div>
                  <div />
                </div>
                {ex.sets.map((s, si) => (
                  <div key={si} className="grid grid-cols-[30px_1fr_1fr_1fr_24px] gap-2 mb-1.5">
                    <div className="text-xs text-[#949598] text-center pt-2">{s.set_num}</div>
                    <input type="number" value={s.weight_lb ?? ""} onChange={e => updateSet(exIdx, si, "weight_lb", e.target.value)}
                      placeholder={previousPerf[ex.name]?.[si]?.weight_lb?.toString() || "lb"}
                      className="bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-1.5 text-sm text-center outline-none focus:border-[#010205]" />
                    <input type="number" value={s.reps ?? ""} onChange={e => updateSet(exIdx, si, "reps", e.target.value)}
                      placeholder={previousPerf[ex.name]?.[si]?.reps?.toString() || "reps"}
                      className="bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-1.5 text-sm text-center outline-none focus:border-[#010205]" />
                    <input type="number" value={s.rpe ?? ""} onChange={e => updateSet(exIdx, si, "rpe", e.target.value)}
                      placeholder="RPE" step="0.5" min="1" max="10"
                      className="bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-1.5 text-sm text-center outline-none focus:border-[#010205]" />
                    <button onClick={() => removeSet(exIdx, si)} className="text-[#949598] hover:text-[#c0392b] cursor-pointer text-xs pt-1.5">×</button>
                  </div>
                ))}
                <button onClick={() => addSet(exIdx)}
                  className="w-full py-1.5 border border-dashed border-[rgba(0,0,0,.1)] rounded text-[10px] text-[#949598] hover:text-[#010205] hover:border-[rgba(0,0,0,.2)] cursor-pointer mt-1">
                  + Set {ex.sets.length + 1}
                </button>
              </div>
            </div>
          ))}

          {/* Add exercise */}
          <div className="flex gap-2 mb-4">
            <input value={addExName} onChange={e => setAddExName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addExercise(); }}
              placeholder="Exercise name..."
              className="flex-1 bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#010205]" />
            <button onClick={addExercise}
              className="px-4 py-2 text-xs font-semibold border border-[rgba(0,0,0,.08)] rounded-xl cursor-pointer hover:border-[rgba(0,0,0,.2)]">
              + Add Exercise
            </button>
          </div>

          {/* Session RPE + notes */}
          <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-[#949598]">Session RPE — {sessRpe}/10</span>
                <input type="range" min={1} max={10} value={sessRpe} onChange={e => setSessRpe(parseInt(e.target.value))}
                  className="mt-1 w-full accent-[#010205]" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-[#949598]">Notes</span>
                <textarea value={sessNotes} onChange={e => setSessNotes(e.target.value)} placeholder="How it felt..."
                  className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205] resize-none" rows={2} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {view === "history" && (
        <div>
          <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-3">Session History</div>
          {workouts.length === 0 && <div className="text-sm text-[#949598] py-6 text-center">No sessions logged yet.</div>}
          <div className="space-y-2">
            {workouts.map(w => (
              <div key={w.id}>
                <div onClick={() => toggleExpand(w.id)}
                  className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg px-4 py-3 cursor-pointer hover:border-[rgba(0,0,0,.15)] transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">{w.session_name || "Workout"}</span>
                    <span className="text-[10px] text-[#949598] font-mono">{fmtDate(w.date)}</span>
                  </div>
                  <div className="text-xs text-[#949598] mt-1">
                    {w.set_count} sets{w.duration_min ? ` · ${w.duration_min} min` : ""}{w.overall_rpe ? ` · RPE ${w.overall_rpe}` : ""}
                  </div>
                </div>
                {expandedId === w.id && expandedDetail && (
                  <div className="bg-white border border-[rgba(0,0,0,.06)] border-t-0 rounded-b-lg px-4 py-3 space-y-3">
                    {expandedDetail.exercises?.map((ex, i) => (
                      <div key={i}>
                        <div className="text-xs font-semibold text-[#010205] mb-1">{ex.name}</div>
                        <div className="grid grid-cols-4 gap-1 text-[10px] text-[#949598] mb-1">
                          <div>Set</div><div className="text-right">Weight</div><div className="text-right">Reps</div><div className="text-right">RPE</div>
                        </div>
                        {ex.sets.map((s, j) => (
                          <div key={j} className="grid grid-cols-4 gap-1 text-xs">
                            <div className="text-[#949598]">{s.set_num}</div>
                            <div className="text-right">{s.weight_lb || "—"} lb</div>
                            <div className="text-right">{s.reps || "—"}</div>
                            <div className="text-right">{s.rpe || "—"}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {expandedDetail.notes && <div className="text-xs text-[#949598] italic">{expandedDetail.notes}</div>}
                    <button onClick={() => deleteWorkout(w.id)} className="text-[10px] text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer">Delete session</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
