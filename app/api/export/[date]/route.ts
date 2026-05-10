import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  const [tasksRes, logRes, briefingRes] = await Promise.all([
    supabase.from("tasks").select("*").or(`completed_date.eq.${date},created_date.eq.${date}`),
    supabase.from("day_logs").select("*").eq("date", date).single(),
    supabase.from("briefings").select("*").eq("date", date).single(),
  ]);

  const tasks = tasksRes.data || [];
  const dayLog = logRes.data;
  const briefing = briefingRes.data;

  const lines: string[] = [`# ${date}`];

  if (briefing?.summary) {
    lines.push("", "## Briefing", "", briefing.summary);
  }

  const completed = tasks.filter((t: { status: string }) => t.status === "done");
  if (completed.length > 0) {
    lines.push("", "## Completed");
    for (const t of completed) lines.push(`- [${t.category}] ${t.title}`);
  }

  const active = tasks.filter((t: { status: string }) => t.status === "todo");
  if (active.length > 0) {
    lines.push("", "## Active");
    for (const t of active) lines.push(`- [${t.category}/${t.priority}] ${t.title}`);
  }

  if (dayLog?.content) {
    lines.push("", "## Day Log", "", dayLog.content);
  }

  return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/markdown" } });
}
