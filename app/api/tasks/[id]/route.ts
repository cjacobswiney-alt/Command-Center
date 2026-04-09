import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { today } from "@/lib/utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // If marking as done, set completed_date
  if (body.status === "done" && !body.completed_date) {
    body.completed_date = today();
  }
  // If marking as todo, clear completed_date
  if (body.status === "todo") {
    body.completed_date = null;
  }

  const { error } = await supabase.from("tasks").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
