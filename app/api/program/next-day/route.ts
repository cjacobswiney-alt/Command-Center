import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { today } from "@/lib/utils";

// GET /api/program/next-day — returns which day number to train next
export async function GET() {
  // Find the most recent program log entry
  const { data: lastLog } = await supabase
    .from("program_log")
    .select("day_num, date")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Also check if any sessions were logged today
  const { data: todayLogs } = await supabase
    .from("program_log")
    .select("day_num")
    .eq("date", today());

  const loggedToday = new Set((todayLogs || []).map(l => l.day_num));

  let nextDay: number;
  if (!lastLog) {
    nextDay = 1; // First ever session
  } else if (loggedToday.size > 0) {
    // Already trained today — show the next day for tomorrow
    const maxToday = Math.max(...Array.from(loggedToday));
    nextDay = maxToday >= 6 ? 1 : maxToday + 1;
  } else {
    // Haven't trained today — continue from last session
    nextDay = lastLog.day_num >= 6 ? 1 : lastLog.day_num + 1;
  }

  return NextResponse.json({ next_day: nextDay, logged_today: Array.from(loggedToday) });
}
