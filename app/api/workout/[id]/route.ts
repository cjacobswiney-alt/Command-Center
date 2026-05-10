import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/workout/[id] — single workout with exercises grouped
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: workout } = await supabase
    .from("workouts")
    .select("*")
    .eq("id", id)
    .single();
  if (!workout) return NextResponse.json(null, { status: 404 });

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("workout_id", id)
    .order("exercise")
    .order("set_num");

  const exMap: Record<string, { name: string; sets: typeof sets }> = {};
  for (const s of sets || []) {
    if (!exMap[s.exercise]) exMap[s.exercise] = { name: s.exercise, sets: [] };
    exMap[s.exercise].sets!.push(s);
  }

  return NextResponse.json({ ...workout, exercises: Object.values(exMap) });
}

// DELETE /api/workout/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
