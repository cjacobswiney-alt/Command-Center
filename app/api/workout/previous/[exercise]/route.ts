import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/workout/previous/Bench%20Press — last sets for this exercise
export async function GET(_req: NextRequest, { params }: { params: Promise<{ exercise: string }> }) {
  const { exercise } = await params;
  const { data } = await supabase
    .from("workout_sets")
    .select("weight_lb, reps, set_num, rpe, workout_id")
    .ilike("exercise", `%${decodeURIComponent(exercise)}%`)
    .order("workout_id", { ascending: false })
    .limit(15);

  return NextResponse.json(data || []);
}
