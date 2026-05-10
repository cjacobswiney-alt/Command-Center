import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/supplements — all cycling trackers
export async function GET() {
  const { data, error } = await supabase
    .from("supplement_cycles")
    .select("*")
    .order("supplement_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PATCH /api/supplements — advance or reset a cycle
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action } = body; // action: "advance" | "back" | "reset"

  const { data: cycle } = await supabase
    .from("supplement_cycles")
    .select("*")
    .eq("id", id)
    .single();
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = cycle.on_days + cycle.off_days;
  let newDay = cycle.current_day;
  if (action === "advance") newDay = (newDay + 1) % total;
  else if (action === "back") newDay = (newDay - 1 + total) % total;
  else if (action === "reset") newDay = 0;

  const { error } = await supabase
    .from("supplement_cycles")
    .update({ current_day: newDay, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok", current_day: newDay });
}
