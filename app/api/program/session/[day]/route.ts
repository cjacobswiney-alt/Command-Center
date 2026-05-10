import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { PROGRAM_WEEKS, PROGRAM_DAYS } from "@/lib/program";
import { today } from "@/lib/utils";

// GET /api/program/session/1
export async function GET(_req: NextRequest, { params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  const dayNum = parseInt(day);
  const dayInfo = PROGRAM_DAYS[dayNum];
  if (!dayInfo) return NextResponse.json({ error: "invalid day" }, { status: 404 });

  const { data: state } = await supabase.from("program_state").select("current_week").eq("id", "default").single();
  const week = state?.current_week || 1;
  const sched = PROGRAM_WEEKS[(week - 1) % 21];

  const { data: configRows } = await supabase.from("program_config").select("*");
  const cfg: Record<string, { tm_lb: number; adj_lb: number }> = {};
  for (const r of configRows || []) cfg[r.lift] = r;

  let compound = null;
  if (dayInfo.compound) {
    const liftCfg = cfg[dayInfo.compound.key] || { tm_lb: 0, adj_lb: 0 };
    const tm = liftCfg.tm_lb + liftCfg.adj_lb;
    const pWeight = Math.round((tm * sched.pct) / 5) * 5;
    compound = {
      key: dayInfo.compound.key,
      name: dayInfo.compound.name,
      unit: dayInfo.compound.unit,
      sets: dayInfo.compound.sets,
      prescribed_weight: pWeight,
      prescribed_reps: sched.reps,
      rir_target: sched.rir,
      tm: liftCfg.tm_lb,
      adj: liftCfg.adj_lb,
    };
  }

  // Check if already logged today
  const { data: todayLog } = await supabase
    .from("program_log")
    .select("*")
    .eq("date", today())
    .eq("day_num", dayNum)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    day_num: dayNum,
    day_name: dayInfo.name,
    week,
    phase: sched.phase,
    wave: sched.wave,
    intensity: sched.pct,
    week_type: sched.wtype,
    compound,
    accessories: dayInfo.accessories,
    already_logged: (todayLog?.length || 0) > 0,
    today_log: todayLog || [],
  });
}
