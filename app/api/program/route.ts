import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { PROGRAM_WEEKS } from "@/lib/program";

// GET /api/program — current state + TMs
export async function GET() {
  const { data: state } = await supabase.from("program_state").select("*").eq("id", "default").single();
  const { data: config } = await supabase.from("program_config").select("*").order("lift");

  const week = state?.current_week || 1;
  const sched = PROGRAM_WEEKS[(week - 1) % 21];

  return NextResponse.json({
    current_week: week,
    phase: sched.phase,
    wave: sched.wave,
    intensity: sched.pct,
    reps: sched.reps,
    rir: sched.rir,
    week_type: sched.wtype,
    lifts: config || [],
  });
}
