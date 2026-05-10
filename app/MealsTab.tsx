"use client";

import { useState, useEffect } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = [
  { id: "morning", name: "Morning", rule: "Fruit only. Glucose+fructose, no fat, no protein." },
  { id: "preworkout", name: "Pre-Workout", rule: "High-carb, low fat (<10g). 30-15 min out: dates + honey." },
  { id: "lunch", name: "Lunch", rule: "High-carb + high-protein, moderate fat (<20g)." },
  { id: "dinner", name: "Dinner", rule: "High-protein + high-fat, low carb (<30g)." },
];

interface MealEntry {
  text: string;
  p: number;
  c: number;
  f: number;
}

type MealPlan = Record<string, MealEntry>;

export default function MealsTab() {
  const [plan, setPlan] = useState<MealPlan>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meal_plan");
      if (saved) setPlan(JSON.parse(saved));
    } catch {}
  }, []);

  const save = (updated: MealPlan) => {
    setPlan(updated);
    localStorage.setItem("meal_plan", JSON.stringify(updated));
  };

  const update = (key: string, field: keyof MealEntry, value: string) => {
    const entry = plan[key] || { text: "", p: 0, c: 0, f: 0 };
    const updated = { ...plan, [key]: { ...entry, [field]: field === "text" ? value : (parseFloat(value) || 0) } };
    save(updated);
  };

  const getDayTotal = (di: number) => {
    let p = 0, c = 0, f = 0;
    MEALS.forEach(m => {
      const e = plan[`${m.id}_${di}`];
      if (e) { p += e.p || 0; c += e.c || 0; f += e.f || 0; }
    });
    const kcal = p * 4 + c * 4 + f * 9;
    return { p, c, f, kcal };
  };

  const isRandle = (key: string) => {
    const e = plan[key];
    if (!e) return false;
    return (e.c || 0) > 80 && (e.f || 0) > 20;
  };

  const clearWeek = () => {
    if (!confirm("Clear all meal plan entries?")) return;
    save({});
  };

  return (
    <div>
      {/* Macro targets */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: "Calories", value: "2,950", range: "2,800–3,100", color: "" },
          { label: "Protein", value: "176g", range: "1.1g/lb · Min 160g", color: "text-[#c0392b]" },
          { label: "Carbs", value: "390g", range: "Fill after P+F", color: "text-[#2e8b3e]" },
          { label: "Fat", value: "72g", range: "0.45g/lb · Min 48g", color: "text-[#2980b9]" },
          { label: "Randle Rule", value: "", range: "Never mix high-fat + high-carb", color: "" },
        ].map((m, i) => (
          <div key={i} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-[#949598] mb-1">{m.label}</div>
            {m.value && <div className={`text-xl font-semibold ${m.color}`}>{m.value}</div>}
            <div className="text-[10px] text-[#949598] mt-1">{m.range}</div>
          </div>
        ))}
      </div>

      {/* Structure note */}
      <div className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] rounded-lg p-3 mb-5 text-xs text-[#535457]">
        <strong className="text-[#010205]">Structure:</strong> Morning = fruit only. Pre-workout = high-carb, low fat. Lunch = high-carb + protein. Dinner = high-protein + fat, low carb. 30–15 min pre-workout: dates + honey.
      </div>

      {/* Planner grid */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold">Weekly Meal Planner</div>
        <button onClick={clearWeek} className="text-[10px] text-[#c0392b]/60 hover:text-[#c0392b] cursor-pointer">Clear Week</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[820px]">
          <thead>
            <tr>
              <th className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] px-3 py-2 text-left text-[10px] uppercase tracking-widest text-[#949598] font-semibold w-24">Meal</th>
              {DAYS.map(d => (
                <th key={d} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] px-2 py-2 text-center text-[10px] uppercase tracking-widest text-[#949598] font-semibold">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map(meal => (
              <tr key={meal.id}>
                <td className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] px-3 py-2 align-top">
                  <div className="text-xs font-semibold text-[#010205]">{meal.name}</div>
                  <div className="text-[9px] text-[#949598] mt-0.5 leading-tight">{meal.rule}</div>
                </td>
                {DAYS.map((_, di) => {
                  const key = `${meal.id}_${di}`;
                  const entry = plan[key] || { text: "", p: 0, c: 0, f: 0 };
                  return (
                    <td key={di} className="border border-[rgba(0,0,0,.06)] p-0 align-top">
                      <div className="p-1.5 min-h-[80px]">
                        <textarea value={entry.text} onChange={e => update(key, "text", e.target.value)}
                          placeholder="Foods..."
                          className="w-full bg-transparent text-[11px] outline-none resize-none min-h-[30px] placeholder-[#949598]/30" rows={2} />
                        <div className="grid grid-cols-3 gap-1 mt-1">
                          {(["p", "c", "f"] as const).map(macro => (
                            <div key={macro}>
                              <div className="text-[8px] text-[#949598] uppercase">{macro === "p" ? "P" : macro === "c" ? "C" : "F"}</div>
                              <input type="number" value={entry[macro] || ""} onChange={e => update(key, macro, e.target.value)}
                                placeholder="0" min="0"
                                className="w-full bg-white border border-[rgba(0,0,0,.06)] rounded text-[10px] px-1 py-0.5 text-center outline-none focus:border-[#010205]" />
                            </div>
                          ))}
                        </div>
                        {isRandle(key) && <div className="text-[9px] text-[#c0392b] mt-1">⚠ Randle: high fat + carb</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Totals row */}
            <tr>
              <td className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] px-3 py-2">
                <div className="text-xs font-semibold text-[#949598]">Totals</div>
              </td>
              {DAYS.map((_, di) => {
                const t = getDayTotal(di);
                const cls = t.kcal === 0 ? "text-[#949598]" : t.kcal >= 2800 && t.kcal <= 3100 ? "text-[#2e8b3e]" : t.kcal < 2800 ? "text-[#d4850a]" : "text-[#c0392b]";
                return (
                  <td key={di} className="bg-[#f5f5f5] border border-[rgba(0,0,0,.06)] px-2 py-2 text-center">
                    <div className={`text-sm font-semibold ${cls}`}>{t.kcal ? `${Math.round(t.kcal)}` : "—"}</div>
                    {t.kcal > 0 && (
                      <div className="text-[9px] text-[#949598] mt-0.5">
                        P <span className="text-[#010205]">{Math.round(t.p)}</span> C <span className="text-[#010205]">{Math.round(t.c)}</span> F <span className="text-[#010205]">{Math.round(t.f)}</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
