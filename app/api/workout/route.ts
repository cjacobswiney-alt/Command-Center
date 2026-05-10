import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { today } from "@/lib/utils";

// GET /api/workout?limit=20 — recent workouts with set counts
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach set counts
  const result = await Promise.all(
    (workouts || []).map(async (w) => {
      const { count } = await supabase
        .from("workout_sets")
        .select("*", { count: "exact", head: true })
        .eq("workout_id", w.id);
      return { ...w, set_count: count || 0 };
    })
  );

  return NextResponse.json(result);
}

// POST /api/workout — create workout with nested exercises/sets
export async function POST(req: NextRequest) {
  const body = await req.json();
  const workoutId = nanoid();

  const { error: wErr } = await supabase.from("workouts").insert({
    id: workoutId,
    date: body.date || today(),
    session_name: body.session_name || "",
    duration_min: body.duration_min ?? null,
    overall_rpe: body.overall_rpe ?? null,
    notes: body.notes || "",
  });
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  const sets = (body.exercises || []).flatMap(
    (ex: { name: string; sets: Array<{ set_num: number; reps: number; weight_lb: number; rpe: number; notes: string }> }) =>
      (ex.sets || []).map((s) => ({
        id: nanoid(),
        workout_id: workoutId,
        exercise: ex.name,
        set_num: s.set_num || 1,
        reps: s.reps ?? null,
        weight_lb: s.weight_lb ?? null,
        rpe: s.rpe ?? null,
        notes: s.notes || "",
      }))
  );

  if (sets.length > 0) {
    const { error: sErr } = await supabase.from("workout_sets").insert(sets);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", workout_id: workoutId }, { status: 201 });
}
