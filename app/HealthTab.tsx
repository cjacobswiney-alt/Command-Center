"use client";

import { useState, useEffect, useCallback } from "react";
import { DailyCheckin, HealthDashboard, MEASUREMENT_TYPES } from "@/lib/types";
import { today } from "@/lib/utils";

export default function HealthTab() {
  const [view, setView] = useState<"dashboard" | "checkin" | "history">("dashboard");
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Check-in form state
  const [ciDate, setCiDate] = useState(today());
  const [ciWeight, setCiWeight] = useState("");
  const [ciSleepHrs, setCiSleepHrs] = useState("");
  const [ciSleepQual, setCiSleepQual] = useState(5);
  const [ciEnergy, setCiEnergy] = useState(5);
  const [ciStress, setCiStress] = useState(5);
  const [ciFocus, setCiFocus] = useState(5);
  const [ciMotivation, setCiMotivation] = useState(5);
  const [ciNotes, setCiNotes] = useState("");

  // Measurement form
  const [measType, setMeasType] = useState("waist");
  const [measVal, setMeasVal] = useState("");
  const [measDate, setMeasDate] = useState(today());

  const fetchDashboard = useCallback(async () => {
    const res = await fetch("/api/health/dashboard");
    if (res.ok) setDashboard(await res.json());
  }, []);

  const fetchCheckins = useCallback(async () => {
    const res = await fetch("/api/checkins?limit=30");
    if (res.ok) setCheckins(await res.json());
  }, []);

  useEffect(() => { fetchDashboard(); fetchCheckins(); }, [fetchDashboard, fetchCheckins]);

  const submitCheckin = async () => {
    setLoading(true);
    await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: ciDate,
        weight_lb: ciWeight ? parseFloat(ciWeight) : null,
        sleep_hrs: ciSleepHrs ? parseFloat(ciSleepHrs) : null,
        sleep_qual: ciSleepQual,
        energy: ciEnergy,
        stress: ciStress,
        focus: ciFocus,
        motivation: ciMotivation,
        notes: ciNotes.trim() || null,
      }),
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchDashboard();
    fetchCheckins();
  };

  const saveMeasurement = async () => {
    if (!measVal) return;
    await fetch("/api/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: measType, value: parseFloat(measVal), date: measDate }),
    });
    setMeasVal("");
  };

  const scorePill = (val: number | null, label: string) => {
    if (!val) return null;
    const cls = val >= 8 ? "bg-[#2e8b3e]/10 text-[#2e8b3e]" : val >= 5 ? "bg-[#d4850a]/10 text-[#d4850a]" : "bg-[#c0392b]/10 text-[#c0392b]";
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{label} {val}</span>;
  };

  const fmtDate = (s: string) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${m}/${d}/${y}`;
  };

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-5">
        {(["dashboard", "checkin", "history"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${view === v ? "bg-[#010205] text-white border-[#010205]" : "bg-transparent text-[#535457] border-[rgba(0,0,0,.08)] hover:border-[rgba(0,0,0,.2)]"}`}>
            {v === "dashboard" ? "Dashboard" : v === "checkin" ? "Daily Check-In" : "History"}
          </button>
        ))}
      </div>

      {/* === DASHBOARD === */}
      {view === "dashboard" && (
        <div>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-1">Streak</div>
              <div className="text-2xl font-semibold">{dashboard?.streak ?? "—"}</div>
              <div className="text-[11px] text-[#949598] mt-1">consecutive days</div>
            </div>
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-1">Weight</div>
              <div className="text-2xl font-semibold">{dashboard?.latest_checkin?.weight_lb?.toFixed(1) ?? "—"}</div>
              <div className="text-[11px] text-[#949598] mt-1">lb</div>
            </div>
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-1">Sessions</div>
              <div className="text-2xl font-semibold text-[#2980b9]">{dashboard?.workouts_this_week ?? 0}</div>
              <div className="text-[11px] text-[#949598] mt-1">this week</div>
            </div>
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-1">Total Days</div>
              <div className="text-2xl font-semibold text-[#2e8b3e]">{dashboard?.total_days ?? 0}</div>
              <div className="text-[11px] text-[#949598] mt-1">logged</div>
            </div>
          </div>

          {/* Today's check-in prompt */}
          {dashboard && (!dashboard.latest_checkin || dashboard.latest_checkin.date !== today()) && (
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-3 mb-5 text-sm text-[#535457]">
              <strong className="text-[#010205]">No check-in today.</strong>{" "}
              <button onClick={() => setView("checkin")} className="text-[#010205] underline cursor-pointer">Log today&apos;s metrics →</button>
            </div>
          )}

          {/* Recent scores */}
          {dashboard?.recent_checkins && dashboard.recent_checkins.length > 0 && (
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4 mb-5">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-3">Last 7 Days</div>
              <div className="grid grid-cols-7 gap-2">
                {dashboard.recent_checkins.map(c => (
                  <div key={c.date} className="text-center">
                    <div className="text-[10px] text-[#949598] mb-1">{c.date.slice(5)}</div>
                    {c.weight_lb && <div className="text-xs font-semibold">{c.weight_lb}</div>}
                    <div className="flex flex-col gap-0.5 mt-1">
                      {scorePill(c.energy, "⚡")}
                      {scorePill(c.focus, "🎯")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRs */}
          {dashboard?.prs && dashboard.prs.length > 0 && (
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] uppercase tracking-widest text-[#949598]">Personal Records</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {dashboard.prs.map(p => (
                  <div key={p.exercise} className="bg-white border border-[rgba(0,0,0,.06)] rounded-lg p-3">
                    <div className="text-[11px] text-[#949598] mb-1">{p.exercise}</div>
                    <div className="text-lg font-semibold">{p.weight_lb} lb</div>
                    <div className="text-[10px] text-[#949598]">{p.reps ? `× ${p.reps}` : ""} · {fmtDate(p.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === CHECK-IN FORM === */}
      {view === "checkin" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-5">
            <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-4">Daily Check-In</div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-[#949598]">Date</span>
                <input type="date" value={ciDate} onChange={e => setCiDate(e.target.value)}
                  className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-[#949598]">Weight (lb)</span>
                <input type="number" value={ciWeight} onChange={e => setCiWeight(e.target.value)} placeholder="160" step="0.1"
                  className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-[#949598]">Sleep (hours)</span>
                <input type="number" value={ciSleepHrs} onChange={e => setCiSleepHrs(e.target.value)} placeholder="7.5" step="0.5"
                  className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]" />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wide text-[#949598]">Sleep Quality — {ciSleepQual}/10</span>
                <input type="range" min={1} max={10} value={ciSleepQual} onChange={e => setCiSleepQual(parseInt(e.target.value))}
                  className="mt-2 w-full accent-[#010205]" />
              </label>
            </div>

            {[
              { label: "Energy", val: ciEnergy, set: setCiEnergy },
              { label: "Focus", val: ciFocus, set: setCiFocus },
              { label: "Motivation", val: ciMotivation, set: setCiMotivation },
              { label: "Stress (lower = better)", val: ciStress, set: setCiStress },
            ].map(s => (
              <label key={s.label} className="block mb-3">
                <span className="text-[11px] uppercase tracking-wide text-[#949598]">{s.label} — {s.val}/10</span>
                <input type="range" min={1} max={10} value={s.val} onChange={e => s.set(parseInt(e.target.value))}
                  className="mt-1 w-full accent-[#010205]" />
              </label>
            ))}

            <label className="block mb-4">
              <span className="text-[11px] uppercase tracking-wide text-[#949598]">Notes</span>
              <textarea value={ciNotes} onChange={e => setCiNotes(e.target.value)}
                placeholder="Physique, sleep quality, diet adherence..."
                className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205] resize-y min-h-[60px]" />
            </label>

            <button onClick={submitCheckin} disabled={loading}
              className="w-full py-2.5 bg-[#2e8b3e]/10 border border-[#2e8b3e]/20 text-[#2e8b3e] rounded-xl text-sm font-semibold cursor-pointer hover:bg-[#2e8b3e]/15 transition-colors disabled:opacity-50">
              {loading ? "Saving..." : saved ? "Saved ✓" : "Save Check-In"}
            </button>
          </div>

          {/* Body measurements */}
          <div>
            <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-5">
              <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-4">Body Measurements</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-[#949598]">Type</span>
                  <select value={measType} onChange={e => setMeasType(e.target.value)}
                    className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]">
                    {MEASUREMENT_TYPES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-[#949598]">Value</span>
                  <input type="number" value={measVal} onChange={e => setMeasVal(e.target.value)} placeholder="32.0" step="0.25"
                    className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wide text-[#949598]">Date</span>
                  <input type="date" value={measDate} onChange={e => setMeasDate(e.target.value)}
                    className="mt-1 w-full bg-white border border-[rgba(0,0,0,.08)] rounded px-3 py-2 text-sm outline-none focus:border-[#010205]" />
                </label>
              </div>
              <button onClick={saveMeasurement}
                className="w-full py-2 bg-transparent border border-[rgba(0,0,0,.08)] text-[#010205] rounded-xl text-sm font-semibold cursor-pointer hover:border-[rgba(0,0,0,.2)] transition-colors">
                Save Measurement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === HISTORY === */}
      {view === "history" && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-3">Check-In History</div>
          <div className="grid grid-cols-3 gap-3">
            {checkins.map(c => (
              <div key={c.date} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.08)] rounded-lg p-3">
                <div className="text-[11px] text-[#949598] font-semibold mb-2 tracking-wide">{fmtDate(c.date)}</div>
                {c.weight_lb && <div className="text-lg font-semibold mb-1">{c.weight_lb.toFixed(1)} lb</div>}
                <div className="flex flex-wrap gap-1">
                  {scorePill(c.energy, "⚡")}
                  {scorePill(c.focus, "🎯")}
                  {scorePill(c.motivation, "🔥")}
                  {scorePill(c.stress, "😤")}
                </div>
                {c.notes && <div className="text-[11px] text-[#949598] mt-2 italic leading-relaxed">{c.notes.substring(0, 80)}{c.notes.length > 80 ? "…" : ""}</div>}
              </div>
            ))}
            {checkins.length === 0 && <div className="text-sm text-[#949598] col-span-3">No check-ins yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
