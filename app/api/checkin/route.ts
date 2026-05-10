import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { today } from "@/lib/utils";

// GET /api/checkin — today's check-in
export async function GET() {
  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("date", today())
    .single();
  return NextResponse.json(data);
}

// POST /api/checkin — upsert daily check-in
export async function POST(req: NextRequest) {
  const body = await req.json();
  const date = body.date || today();

  // Check if exists
  const { data: existing } = await supabase
    .from("daily_checkins")
    .select("id")
    .eq("date", date)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("daily_checkins")
      .update({
        weight_lb: body.weight_lb ?? null,
        sleep_hrs: body.sleep_hrs ?? null,
        sleep_qual: body.sleep_qual ?? null,
        energy: body.energy ?? null,
        stress: body.stress ?? null,
        focus: body.focus ?? null,
        motivation: body.motivation ?? null,
        notes: body.notes ?? null,
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "updated", date });
  }

  const { error } = await supabase.from("daily_checkins").insert({
    id: nanoid(),
    date,
    weight_lb: body.weight_lb ?? null,
    sleep_hrs: body.sleep_hrs ?? null,
    sleep_qual: body.sleep_qual ?? null,
    energy: body.energy ?? null,
    stress: body.stress ?? null,
    focus: body.focus ?? null,
    motivation: body.motivation ?? null,
    notes: body.notes ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "created", date }, { status: 201 });
}
