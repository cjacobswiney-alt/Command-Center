import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const week = Math.max(1, Math.min(21, parseInt(body.week) || 1));
  await supabase.from("program_state").update({ current_week: week, updated_at: new Date().toISOString() }).eq("id", "default");
  return NextResponse.json({ status: "ok", week });
}
