import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchRecentEmails, fetchTodayCalendar, refreshToken } from "@/lib/microsoft";
import { BRIEFING_SYSTEM_PROMPT } from "@/lib/anthropic";
import { today } from "@/lib/utils";
import type { Task } from "@/lib/types";

export const maxDuration = 60;

async function getValidToken() {
  const { data } = await supabase.from("oauth_tokens").select("*").eq("id", "default").single();
  if (!data) return null;

  // Refresh if expired or expiring in next 5 minutes
  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshToken(data.refresh_token);
    if (newTokens.error) return null;
    await supabase.from("oauth_tokens").upsert({
      id: "default",
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || data.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    });
    return newTokens.access_token;
  }

  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days || 1;
    const emailCount = days <= 1 ? 20 : days <= 7 ? 50 : 100;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    // Step 1: Get valid access token
    const accessToken = await getValidToken();
    if (!accessToken) {
      return NextResponse.json({ error: "not_authenticated", loginUrl: "/api/auth/login" }, { status: 401 });
    }

    // Step 2: Fetch emails + calendar in parallel
    const [emails, calendar] = await Promise.all([
      fetchRecentEmails(accessToken, emailCount, days),
      fetchTodayCalendar(accessToken),
    ]);

    const emailSummary = emails.map((e: { direction: string; sender: string; subject: string; preview: string; date: string }) =>
      `${e.direction === "sent" ? "[SENT]" : "[RECEIVED]"} ${e.sender}\nSubject: ${e.subject}\nPreview: ${e.preview}\nDate: ${e.date}`
    ).join("\n---\n");

    const calendarSummary = calendar.length > 0
      ? calendar.map((e: { subject: string; start: string; end: string; location: string; organizer: string; isAllDay: boolean }) =>
          `${e.isAllDay ? "All day" : `${e.start.slice(11, 16)} - ${e.end.slice(11, 16)}`}: ${e.subject}${e.location ? ` (${e.location})` : ""}${e.organizer ? ` — organized by ${e.organizer}` : ""}`
        ).join("\n")
      : "No meetings today.";

    // Step 3: Get current tasks for context
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title, category, priority, status")
      .eq("status", "todo");

    const taskContext = (tasks || [])
      .map((t: Pick<Task, "category" | "priority" | "title">) => `- [${t.category}/${t.priority}] ${t.title}`)
      .join("\n");

    // Step 4: Generate briefing with Claude
    const briefingResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: BRIEFING_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Here are my 20 most recent emails:\n${emailSummary}\n\nHere is my calendar for today:\n${calendarSummary}\n\nHere are my current active tasks:\n${taskContext || "No active tasks."}\n\nGenerate my daily briefing. Factor in my meeting load when suggesting priorities — if I have back-to-back meetings, prioritize items I can handle between or after meetings.`,
        }],
      }),
    });

    const briefingData = await briefingResponse.json();
    const briefingText = (briefingData.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("");

    let briefing;
    try {
      const cleaned = briefingText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      briefing = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse briefing", raw: briefingText }, { status: 500 });
    }

    // Step 5: Save to Supabase
    const dateStr = today();
    await supabase.from("briefings").upsert({
      date: dateStr,
      summary: briefing.summary,
      items: briefing.items,
      scanned_at: new Date().toISOString(),
    });

    return NextResponse.json({ date: dateStr, ...briefing, scanned_at: new Date().toISOString() });
  } catch (err) {
    console.error("[scan-inbox] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
