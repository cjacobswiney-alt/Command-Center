import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { today } from "@/lib/utils";

// GET /api/measurements?type=waist&limit=90
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "waist";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "90");
  const { data, error } = await supabase
    .from("measurements")
    .select("*")
    .eq("type", type)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/measurements
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { error } = await supabase.from("measurements").insert({
    id: nanoid(),
    date: body.date || today(),
    type: body.type,
    value: body.value,
    unit: body.unit || "",
    notes: body.notes || "",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok" }, { status: 201 });
}
