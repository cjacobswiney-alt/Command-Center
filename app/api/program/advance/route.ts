import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const { data: state } = await supabase.from("program_state").select("current_week").eq("id", "default").single();
  const current = state?.current_week || 1;
  const next = Math.min(current + 1, 21);
  await supabase.from("program_state").update({ current_week: next, updated_at: new Date().toISOString() }).eq("id", "default");
  return NextResponse.json({ status: "ok", week: next });
}
