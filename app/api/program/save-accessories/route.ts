import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { today } from "@/lib/utils";

// POST /api/program/save-accessories
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { day_num, accessories } = body;
  const dateStr = today();

  const rows = (accessories || []).map((a: { exercise: string; weight: number }) => ({
    id: nanoid(),
    date: dateStr,
    day_num,
    exercise: a.exercise,
    weight_lb: a.weight,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("accessory_log").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", saved: rows.length });
}
