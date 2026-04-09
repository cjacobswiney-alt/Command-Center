import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { today } from "@/lib/utils";

export async function GET() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("status", { ascending: true })
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sort: todo before done, then high > medium > low
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = (data || []).sort((a, b) => {
    if (a.status !== b.status) return a.status === "todo" ? -1 : 1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const task = {
    id: nanoid(),
    title: body.title,
    category: body.category || "buckingham",
    priority: body.priority || "medium",
    notes: body.notes || null,
    status: "todo",
    source: body.source || "manual",
    created_date: today(),
    due_date: body.due_date || null,
  };

  const { error } = await supabase.from("tasks").insert(task);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(task, { status: 201 });
}
