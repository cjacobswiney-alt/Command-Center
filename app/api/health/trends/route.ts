import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/health/trends?days=30
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("date,weight_lb,energy,stress,focus,motivation,sleep_qual,sleep_hrs")
    .gte("date", since)
    .order("date");

  // Get all sets in window with workout dates
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, date")
    .gte("date", since);

  const strength: Record<string, { date: string; max_weight: number }[]> = {};

  if (workouts?.length) {
    const wIds = workouts.map(w => w.id);
    const dateMap: Record<string, string> = {};
    for (const w of workouts) dateMap[w.id] = w.date;

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("exercise, weight_lb, workout_id")
      .in("workout_id", wIds)
      .gt("weight_lb", 0);

    // Count sessions per exercise, take top 8
    const exCount: Record<string, number> = {};
    for (const s of sets || []) {
      exCount[s.exercise] = (exCount[s.exercise] || 0) + 1;
    }
    const topExercises = Object.entries(exCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ex]) => ex);

    // Group by exercise → date → max weight
    for (const ex of topExercises) {
      const byDate: Record<string, number> = {};
      for (const s of sets || []) {
        if (s.exercise !== ex) continue;
        const d = dateMap[s.workout_id];
        if (d) byDate[d] = Math.max(byDate[d] || 0, s.weight_lb);
      }
      strength[ex] = Object.entries(byDate)
        .map(([date, max_weight]) => ({ date, max_weight }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
  }

  return NextResponse.json({ checkins: checkins || [], strength });
}
