"use client";

import { useState, useEffect, useCallback } from "react";

interface LiftConfig { lift: string; tm_lb: number; adj_lb: number }
interface SessionCompound {
  key: string; name: string; unit: string; sets: number;
  prescribed_weight: number; prescribed_reps: number; rir_target: number | string;
  tm: number; adj: number;
}
interface SessionData {
  day_num: number; day_name: string; week: number; phase: string; wave: string;
  intensity: number; week_type: string;
  compound: SessionCompound | null;
  accessories: { name: string; sets: number; reps: string }[];
  already_logged: boolean;
  today_log: { weight_actual: number; reps_actual: number; sets_completed: number; notes: string }[];
}
interface LogResult { adj_applied: number; adj_message: string; next_week_weight: number }
interface ProgramState {
  current_week: number; phase: string; wave: string;
  intensity: number; reps: number; rir: number | string; week_type: string;
  lifts: LiftConfig[];
}

const DAY_LABELS: Record<number, { name: string; lift: string }> = {
  1: { name: "Chest + Shoulders", lift: "Incline DB Press" },
  2: { name: "Back + Rear Delts", lift: "Lat Pulldown" },
  3: { name: "Shoulders + Arms", lift: "Standing OHP" },
  4: { name: "Legs + Pump", lift: "Rear Lunge" },
  5: { name: "Chest + Back", lift: "Bench Press" },
  6: { name: "Shoulders + Arms", lift: "Accessories" },
};

export default function ProgramTab() {
  const [state, setState] = useState<ProgramState | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [session, setSession] = useState<SessionData | null>(null);
  const [logResult, setLogResult] = useState<LogResult | null>(null);
  const [logging, setLogging] = useState(false);
  const [view, setView] = useState<"workout" | "settings">("workout");

  // Per-set logging
  const [sets, setSets] = useState<{ weight: string; reps: string; done: boolean }[]>([]);
  const [logNotes, setLogNotes] = useState("");
  const [accChecked, setAccChecked] = useState<Set<number>>(new Set());
  const [accWeights, setAccWeights] = useState<Record<number, string>>({});
  const [prevAccWeights, setPrevAccWeights] = useState<Record<string, { weight: number; date: string }>>({});

  // Settings
  const [editLift, setEditLift] = useState<string | null>(null);
  const [editTm, setEditTm] = useState("");

  const fetchState = useCallback(async () => {
    const res = await fetch("/api/program");
    if (res.ok) setState(await res.json());
  }, []);

  const loadDay = useCallback(async (dayNum: number) => {
    setActiveDay(dayNum);
    setLogResult(null);
    setAccChecked(new Set());
    setAccWeights({});
    // Fetch previous accessory weights
    fetch(`/api/program/previous-accessories?day=${dayNum}`).then(r => r.json()).then(d => setPrevAccWeights(d.accessories || {})).catch(() => {});
    const res = await fetch(`/api/program/session/${dayNum}`);
    if (res.ok) {
      const data: SessionData = await res.json();
      setSession(data);
      if (data.compound && !data.already_logged) {
        const numSets = data.compound.sets;
        setSets(Array.from({ length: numSets }, () => ({
          weight: String(data.compound!.prescribed_weight),
          reps: String(data.compound!.prescribed_reps),
          done: false,
        })));
      }
      setLogNotes("");
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetch("/api/program/next-day").then(r => r.json()).then(d => loadDay(d.next_day)).catch(() => loadDay(1));
  }, [fetchState, loadDay]);

  const toggleSet = (i: number) => {
    setSets(prev => prev.map((s, j) => j === i ? { ...s, done: !s.done } : s));
  };

  const updateSet = (i: number, field: "weight" | "reps", val: string) => {
    setSets(prev => prev.map((s, j) => j === i ? { ...s, [field]: val } : s));
  };

  const addSet = () => {
    const last = sets[sets.length - 1];
    setSets([...sets, { weight: last?.weight || "", reps: last?.reps || "", done: false }]);
  };

  const submitLog = async () => {
    if (!session?.compound) return;
    setLogging(true);
    const completedSets = sets.filter(s => s.done);
    const avgReps = completedSets.length > 0
      ? completedSets.reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0) / completedSets.length
      : 0;
    const maxWeight = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0), 0);

    const res = await fetch("/api/program/log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_num: session.day_num,
        lift: session.compound.key,
        sets_completed: completedSets.length,
        reps_actual: Math.round(avgReps * 10) / 10,
        weight_actual: maxWeight,
        sets_target: session.compound.sets,
        notes: logNotes,
      }),
    });
    if (res.ok) {
      const result = await res.json();
      setLogResult(result);
      // Save accessory weights
      const accEntries = session.accessories
        .map((a, i) => ({ exercise: a.name, weight: parseFloat(accWeights[i] || "0") }))
        .filter(e => e.weight > 0);
      if (accEntries.length > 0) {
        fetch("/api/program/save-accessories", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_num: session.day_num, accessories: accEntries }),
        }).catch(() => {});
      }
      setTimeout(() => { loadDay(session.day_num); fetchState(); }, 2000);
    }
    setLogging(false);
  };

  const saveTm = async (lift: string) => {
    if (!editTm) return;
    await fetch(`/api/program/tm/${lift}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tm_lb: parseFloat(editTm) }),
    });
    setEditLift(null);
    fetchState();
    loadDay(activeDay);
  };

  if (!state) return <div className="text-sm text-[#949598] py-8 text-center">Loading...</div>;

  return (
    <div>
      {/* Day selector — compact strip */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[1, 2, 3, 4, 5, 6].map(d => (
          <button key={d} onClick={() => loadDay(d)}
            className={`shrink-0 min-w-[112px] sm:min-w-0 sm:flex-1 py-2.5 px-2 rounded-lg text-center cursor-pointer transition-colors ${activeDay === d ? "bg-[#010205] text-white" : "bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] hover:border-[rgba(0,0,0,.15)]"}`}>
            <div className={`text-[10px] font-semibold ${activeDay === d ? "text-white/60" : "text-[#949598]"}`}>Day {d}</div>
            <div className={`text-[11px] font-semibold mt-0.5 ${activeDay === d ? "" : "text-[#010205]"}`}>{DAY_LABELS[d]?.name}</div>
          </button>
        ))}
        <button onClick={() => setView(view === "settings" ? "workout" : "settings")}
          className={`px-3 rounded-lg border cursor-pointer transition-colors flex-shrink-0 ${view === "settings" ? "bg-[#010205] text-white border-[#010205]" : "border-[rgba(0,0,0,.06)] text-[#949598] hover:border-[rgba(0,0,0,.15)]"}`}>
          <span className="text-xs">⚙</span>
        </button>
      </div>

      {/* Settings view */}
      {view === "settings" && (
        <div className="space-y-4 mb-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold">Program Settings</div>
            <div className="text-xs text-[#949598]">W{state.current_week}/21 · {state.phase} · {(state.intensity * 100).toFixed(0)}%</div>
          </div>
          <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold">Training Maxes — tap to edit</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {state.lifts.map(l => (
              <div key={l.lift} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3 text-center">
                {editLift === l.lift ? (
                  <div>
                    <input autoFocus value={editTm} onChange={e => setEditTm(e.target.value)} type="number"
                      onKeyDown={e => { if (e.key === "Enter") saveTm(l.lift); if (e.key === "Escape") setEditLift(null); }}
                      className="w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-1 text-sm text-center outline-none focus:border-[#010205]" />
                    <button onClick={() => saveTm(l.lift)} className="text-[9px] text-[#010205] font-semibold cursor-pointer mt-1">Save</button>
                  </div>
                ) : (
                  <div onClick={() => { setEditLift(l.lift); setEditTm(String(l.tm_lb)); }} className="cursor-pointer hover:underline">
                    <div className="text-[10px] text-[#949598] uppercase">{l.lift.replace(/_/g, " ")}</div>
                    <div className="text-lg font-semibold">{l.tm_lb}</div>
                    {l.adj_lb !== 0 && <div className={`text-[10px] font-semibold ${l.adj_lb > 0 ? "text-[#2e8b3e]" : "text-[#c0392b]"}`}>{l.adj_lb > 0 ? "+" : ""}{l.adj_lb}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold">Week — tap to jump</div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 21 }, (_, i) => i + 1).map(w => (
              <button key={w} onClick={async () => { await fetch("/api/program/set-week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: w }) }); fetchState(); loadDay(activeDay); }}
                className={`rounded-lg py-1.5 text-center cursor-pointer transition-colors border text-xs ${w === state.current_week ? "bg-[#010205] text-white border-[#010205]" : [7, 14, 21].includes(w) ? "bg-[#2e8b3e]/5 border-[rgba(0,0,0,.06)] text-[#2e8b3e]" : "border-[rgba(0,0,0,.06)] hover:border-[rgba(0,0,0,.15)]"}`}>
                W{w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workout view */}
      {view === "workout" && session && (
        <div>
          {/* Session title + meta */}
          <div className="mb-4">
            <div className="text-lg font-semibold">{session.day_name}</div>
            <div className="text-xs text-[#949598] mt-0.5">
              W{session.week} · {session.phase} · {(session.intensity * 100).toFixed(0)}% · {session.compound ? `${session.compound.prescribed_reps} reps @ RIR ${session.compound.rir_target}` : "Accessories only"}
            </div>
          </div>

          {/* Compound lift */}
          {session.compound && (
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">{session.compound.name}</div>
                  <div className="text-[10px] text-[#949598]">
                    TM: {session.compound.tm} lb
                    {session.compound.adj !== 0 && <span className={session.compound.adj > 0 ? " text-[#2e8b3e]" : " text-[#c0392b]"}> ({session.compound.adj > 0 ? "+" : ""}{session.compound.adj})</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold leading-none">{session.compound.prescribed_weight}</div>
                  <div className="text-[10px] text-[#949598]">{session.compound.unit}</div>
                </div>
              </div>

              {session.already_logged ? (
                <div className="text-xs text-[#2e8b3e] py-2">
                  ✓ Logged — {session.today_log[0]?.weight_actual} lb × {session.today_log[0]?.reps_actual} reps × {session.today_log[0]?.sets_completed} sets
                  {session.today_log[0]?.notes && <span className="text-[#949598] ml-2">"{session.today_log[0].notes}"</span>}
                </div>
              ) : (
                <div>
                  {/* Set-by-set logging */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[32px_1fr_1fr_40px] gap-2 text-[10px] text-[#949598] uppercase tracking-wide px-1">
                      <div>Set</div><div className="text-center">Weight</div><div className="text-center">Reps</div><div></div>
                    </div>
                    {sets.map((s, i) => (
                      <div key={i} className={`grid grid-cols-[32px_1fr_1fr_40px] gap-2 items-center ${s.done ? "opacity-50" : ""}`}>
                        <div className="text-xs text-[#949598] text-center font-semibold">{i + 1}</div>
                        <input type="number" value={s.weight} onChange={e => updateSet(i, "weight", e.target.value)} step="5"
                          className="bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-2 text-sm text-center outline-none focus:border-[#010205]" />
                        <input type="number" value={s.reps} onChange={e => updateSet(i, "reps", e.target.value)}
                          className="bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-2 text-sm text-center outline-none focus:border-[#010205]" />
                        <button onClick={() => toggleSet(i)}
                          className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-colors ${s.done ? "bg-[#2e8b3e]/10 border-[#2e8b3e] text-[#2e8b3e]" : "border-[rgba(0,0,0,.12)] hover:border-[#010205]"}`}>
                          {s.done && <span className="text-sm">✓</span>}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addSet}
                    className="w-full mt-2 py-1.5 border border-dashed border-[rgba(0,0,0,.1)] rounded-lg text-[10px] text-[#949598] hover:text-[#010205] hover:border-[rgba(0,0,0,.2)] cursor-pointer">
                    + Add Set
                  </button>
                  <div className="flex gap-2 mt-3">
                    <input value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Notes (optional)"
                      className="flex-1 bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#010205]" />
                    <button onClick={submitLog} disabled={logging || sets.filter(s => s.done).length === 0}
                      className="bg-[#010205] text-white text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer hover:bg-[#28282e] disabled:opacity-30">
                      {logging ? "Saving..." : `Log ${sets.filter(s => s.done).length} Sets`}
                    </button>
                  </div>
                </div>
              )}

              {/* Autoregulation result */}
              {logResult && (
                <div className={`mt-3 rounded-lg px-4 py-3 text-xs font-semibold ${logResult.adj_applied > 0 ? "bg-[#2e8b3e]/8 text-[#2e8b3e]" : logResult.adj_applied < 0 ? "bg-[#c0392b]/8 text-[#c0392b]" : "bg-[rgba(0,0,0,.03)] text-[#535457]"}`}>
                  {logResult.adj_applied > 0 ? "↑" : logResult.adj_applied < 0 ? "↓" : "→"} {logResult.adj_message}
                  {logResult.next_week_weight > 0 && <span className="ml-2">· Next: <strong>{logResult.next_week_weight} lb</strong></span>}
                </div>
              )}
            </div>
          )}

          {/* Accessories */}
          <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-[rgba(0,0,0,.02)] border-b border-[rgba(0,0,0,.06)]">
              <span className="text-xs font-semibold">Accessories</span>
              <span className="text-[10px] text-[#949598] ml-2">{accChecked.size}/{session.accessories.length}</span>
            </div>
            <div className="divide-y divide-[rgba(0,0,0,.04)]">
              {session.accessories.map((a, i) => {
                const prev = prevAccWeights[a.name];
                return (
                  <div key={i} className={`flex items-center gap-2 px-4 py-3 transition-colors ${accChecked.has(i) ? "opacity-40" : ""}`}>
                    <button onClick={() => setAccChecked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors ${accChecked.has(i) ? "bg-[#2e8b3e]/10 border-[#2e8b3e] text-[#2e8b3e]" : "border-[rgba(0,0,0,.12)] hover:border-[#010205]"}`}>
                      {accChecked.has(i) && <span className="text-xs">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 min-w-0 truncate ${accChecked.has(i) ? "line-through" : "font-semibold"}`}>{a.name}</span>
                    <span className="text-[10px] text-[#949598] flex-shrink-0">{a.sets}×{a.reps}</span>
                    <div className="w-14 bg-[rgba(0,0,0,.03)] rounded px-1.5 py-1.5 text-center flex-shrink-0">
                      {prev ? (
                        <div className="text-xs font-semibold text-[#949598]">{prev.weight}</div>
                      ) : (
                        <div className="text-[10px] text-[#949598]/50">—</div>
                      )}
                    </div>
                    <input type="number" value={accWeights[i] || ""} onChange={e => setAccWeights(p => ({ ...p, [i]: e.target.value }))}
                      placeholder={prev ? String(prev.weight) : "lb"} step="5"
                      className="w-16 bg-white border border-[rgba(0,0,0,.08)] rounded px-2 py-1.5 text-xs text-center outline-none focus:border-[#010205] flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
