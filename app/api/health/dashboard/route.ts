import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { today } from "@/lib/utils";

export async function GET() {
  const todayStr = today();
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const monday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: latestCheckin },
    { data: latestWorkout },
    { data: recentCheckins },
    { count: workoutsThisWeek },
    { data: weightHistory },
    { count: totalSessions },
    { count: totalDays },
  ] = await Promise.all([
    supabase.from("daily_checkins").select("*").order("date", { ascending: false }).limit(1).single(),
    supabase.from("workouts").select("*").order("date", { ascending: false }).limit(1).single(),
    supabase.from("daily_checkins").select("date,weight_lb,energy,focus,motivation,stress").gte("date", weekAgo).order("date"),
    supabase.from("workouts").select("*", { count: "exact", head: true }).gte("date", monday),
    supabase.from("daily_checkins").select("date,weight_lb").not("weight_lb", "is", null).order("date", { ascending: false }).limit(30),
    supabase.from("workouts").select("*", { count: "exact", head: true }),
    supabase.from("daily_checkins").select("*", { count: "exact", head: true }),
  ]);

  // PRs: get all sets, group by exercise, take max weight
  const { data: allSets } = await supabase
    .from("workout_sets")
    .select("exercise, weight_lb, reps, workout_id")
    .gt("weight_lb", 0)
    .order("weight_lb", { ascending: false });

  const prMap: Record<string, { exercise: string; weight_lb: number; reps: number; date: string }> = {};
  if (allSets?.length) {
    // Get workout dates for these sets
    const workoutIds = [...new Set(allSets.map(s => s.workout_id))];
    const { data: workoutDates } = await supabase
      .from("workouts")
      .select("id, date")
      .in("id", workoutIds);
    const dateMap: Record<string, string> = {};
    for (const w of workoutDates || []) dateMap[w.id] = w.date;

    for (const s of allSets) {
      if (!prMap[s.exercise] || s.weight_lb > prMap[s.exercise].weight_lb) {
        prMap[s.exercise] = {
          exercise: s.exercise,
          weight_lb: s.weight_lb,
          reps: s.reps || 0,
          date: dateMap[s.workout_id] || "",
        };
      }
    }
  }
  const prs = Object.values(prMap).sort((a, b) => a.exercise.localeCompare(b.exercise));

  // Calculate streak
  let streak = 0;
  if (latestCheckin) {
    const { data: dates } = await supabase
      .from("daily_checkins")
      .select("date")
      .order("date", { ascending: false })
      .limit(60);
    if (dates?.length) {
      let check = new Date(todayStr);
      if (dates[0].date < new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
        streak = 0;
      } else {
        for (const d of dates) {
          if (d.date === check.toISOString().slice(0, 10)) {
            streak++;
            check = new Date(check.getTime() - 86400000);
          } else if (d.date < check.toISOString().slice(0, 10)) break;
        }
      }
    }
  }

  return NextResponse.json({
    latest_checkin: latestCheckin,
    latest_workout: latestWorkout,
    recent_checkins: recentCheckins || [],
    workouts_this_week: workoutsThisWeek || 0,
    weight_history: (weightHistory || []).reverse(),
    prs,
    total_sessions: totalSessions || 0,
    total_days: totalDays || 0,
    streak,
  });
}
