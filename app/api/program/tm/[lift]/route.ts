import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PUT /api/program/tm/bench — update training max, reset adjustment
export async function PUT(req: NextRequest, { params }: { params: Promise<{ lift: string }> }) {
  const { lift } = await params;
  const body = await req.json();
  const tm = parseFloat(body.tm_lb) || 0;
  await supabase.from("program_config")
    .update({ tm_lb: tm, adj_lb: 0, updated_at: new Date().toISOString() })
    .eq("lift", lift);
  return NextResponse.json({ status: "ok" });
}
