import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateId } from "@/lib/wiki";
import { today } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || today();

    // Fetch command center data for the date
    const [tasksRes, logRes, briefingRes] = await Promise.all([
      supabase.from("tasks").select("*").or(`completed_date.eq.${date},created_date.eq.${date}`),
      supabase.from("day_logs").select("*").eq("date", date).single(),
      supabase.from("briefings").select("*").eq("date", date).single(),
    ]);

    const tasks = tasksRes.data || [];
    const dayLog = logRes.data;
    const briefing = briefingRes.data;

    if (tasks.length === 0 && !dayLog?.content && !briefing?.summary) {
      return NextResponse.json({ message: "No data for this date" });
    }

    // Build markdown document
    const lines: string[] = [`# Daily Summary — ${date}`];

    if (briefing?.summary) {
      lines.push("", "## Morning Briefing", "", briefing.summary);
    }

    const completed = tasks.filter((t: { status: string }) => t.status === "done");
    const created = tasks.filter((t: { created_date: string }) => t.created_date === date);
    const active = tasks.filter((t: { status: string }) => t.status === "todo");

    if (completed.length > 0) {
      lines.push("", "## Completed Tasks");
      for (const t of completed) lines.push(`- [${t.category}] ${t.title}${t.notes ? ` — ${t.notes}` : ""}`);
    }

    if (created.length > 0) {
      lines.push("", "## New Tasks Created");
      for (const t of created) lines.push(`- [${t.category}/${t.priority}] ${t.title} (source: ${t.source})`);
    }

    if (active.length > 0) {
      lines.push("", "## Still Active");
      for (const t of active) lines.push(`- [${t.category}/${t.priority}] ${t.title}`);
    }

    if (dayLog?.content) {
      lines.push("", "## Day Log", "", dayLog.content);
    }

    const content = lines.join("\n");

    // Create source
    const sourceId = generateId();
    await supabase.from("wiki_sources").insert({
      id: sourceId,
      title: `Daily Summary — ${date}`,
      source_type: "daily",
      content,
      date,
      ingested: false,
    });

    // Trigger ingest
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const ingestRes = await fetch(`${baseUrl}/api/wiki/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_ids: [sourceId] }),
    });

    const ingestResult = await ingestRes.json();
    return NextResponse.json({ source_id: sourceId, ...ingestResult });
  } catch (err) {
    console.error("[wiki/ingest/daily] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
