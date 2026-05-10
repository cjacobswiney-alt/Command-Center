import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { PROGRAM_WEEKS, calculateAdjustment } from "@/lib/program";
import { today } from "@/lib/utils";

// POST /api/program/log
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data: state } = await supabase.from("program_state").select("current_week").eq("id", "default").single();
  const week = state?.current_week || 1;
  const sched = PROGRAM_WEEKS[(week - 1) % 21];

  const setsCompleted = body.sets_completed || 0;
  const repsActual = body.reps_actual || 0;
  const lift = body.lift;

  // Autoregulation
  const { adj, message } = calculateAdjustment(setsCompleted, repsActual, sched.reps);

  if (lift && adj !== 0) {
    const { data: liftCfg } = await supabase.from("program_config").select("adj_lb").eq("lift", lift).single();
    if (liftCfg) {
      await supabase.from("program_config")
        .update({ adj_lb: liftCfg.adj_lb + adj, updated_at: new Date().toISOString() })
        .eq("lift", lift);
    }
  }

  // Get prescribed weight for logging
  const { data: cfg } = await supabase.from("program_config").select("*").eq("lift", lift).single();
  const tm = cfg ? cfg.tm_lb + cfg.adj_lb : 0;
  const pWeight = Math.round((tm * sched.pct) / 5) * 5;

  await supabase.from("program_log").insert({
    id: nanoid(),
    date: body.date || today(),
    week_num: week,
    day_num: body.day_num,
    lift,
    prescribed_weight: pWeight,
    prescribed_reps: sched.reps,
    rir_target: String(sched.rir),
    sets_target: body.sets_target || 4,
    sets_completed: setsCompleted,
    reps_actual: repsActual,
    weight_actual: body.weight_actual,
    notes: body.notes || "",
    adj_applied: adj,
  });

  // Calculate next week's weight
  const { data: newCfg } = await supabase.from("program_config").select("*").eq("lift", lift).single();
  const newTm = newCfg ? newCfg.tm_lb + newCfg.adj_lb : 0;
  const nextWeek = week < 21 ? week + 1 : 1;
  const nextSched = PROGRAM_WEEKS[(nextWeek - 1) % 21];
  const nextWeight = Math.round((newTm * nextSched.pct) / 5) * 5;

  return NextResponse.json({
    status: "ok",
    adj_applied: adj,
    adj_message: message,
    next_week_weight: nextWeight,
  });
}
