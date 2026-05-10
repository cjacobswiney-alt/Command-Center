import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/program/previous-accessories?day=1
// Returns last logged weights for accessories on a given day
export async function GET(req: NextRequest) {
  const day = parseInt(req.nextUrl.searchParams.get("day") || "1");

  // Get the most recent program_log entries for this day
  const { data: logs } = await supabase
    .from("program_log")
    .select("*")
    .eq("day_num", day)
    .order("created_at", { ascending: false })
    .limit(1);

  // Also check localStorage-persisted accessory data via a separate table
  // For now, use a simpler approach: store accessory weights in a dedicated table
  // Fallback: return empty if no data
  const lastDate = logs?.[0]?.date;

  // Get accessory weights from the acc_log table
  const { data: accData } = await supabase
    .from("accessory_log")
    .select("*")
    .eq("day_num", day)
    .order("date", { ascending: false })
    .limit(20);

  // Group by exercise name, take most recent
  const latest: Record<string, { weight: number; date: string }> = {};
  for (const a of accData || []) {
    if (!latest[a.exercise]) {
      latest[a.exercise] = { weight: a.weight_lb, date: a.date };
    }
  }

  return NextResponse.json({ last_date: lastDate || null, accessories: latest });
}
