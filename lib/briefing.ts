import { supabase } from "@/lib/supabase";
import { fetchRecentEmails, fetchTodayCalendar, refreshToken } from "@/lib/microsoft";
import { BRIEFING_SYSTEM_PROMPT } from "@/lib/anthropic";
import { today } from "@/lib/utils";
import type { Task } from "@/lib/types";

async function getWhoopContext(): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [recovery, sleep, cycles, workouts] = await Promise.all([
    supabase.from("whoop_recovery").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(10),
    supabase.from("whoop_sleep").select("*").gte("start_at", sevenDaysAgo).eq("nap", false).order("start_at", { ascending: false }).limit(10),
    supabase.from("whoop_cycles").select("*").gte("start_at", sevenDaysAgo).order("start_at", { ascending: false }).limit(10),
    supabase.from("whoop_workouts").select("*").gte("start_at", sevenDaysAgo).order("start_at", { ascending: false }).limit(10),
  ]);

  if (!recovery.data?.length && !sleep.data?.length && !cycles.data?.length) {
    return "No recent WHOOP data available.";
  }

  const fmtDate = (s: string) => new Date(s).toISOString().slice(0, 10);
  const ms2hm = (ms: number | null) => {
    if (!ms) return "?";
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `${h}h${m.toString().padStart(2, "0")}m`;
  };

  const lines: string[] = [];

  if (recovery.data?.length) {
    lines.push("Recovery (last 7 days, newest first):");
    for (const r of recovery.data) {
      if (r.recovery_score == null) continue;
      lines.push(`  ${fmtDate(r.created_at)}: ${r.recovery_score}% (HRV ${Math.round(r.hrv_rmssd_milli ?? 0)}ms, RHR ${r.resting_heart_rate ?? "?"})`);
    }
  }

  if (sleep.data?.length) {
    lines.push("Sleep (nights, newest first):");
    for (const s of sleep.data) {
      const inBed = s.total_in_bed_milli;
      const awake = s.total_awake_milli ?? 0;
      const asleep = inBed ? inBed - awake : null;
      lines.push(`  ${fmtDate(s.start_at)}: ${ms2hm(asleep)} asleep, perf ${s.sleep_performance_pct ?? "?"}%, eff ${s.sleep_efficiency_pct ?? "?"}%`);
    }
  }

  if (cycles.data?.length) {
    lines.push("Day strain (newest first):");
    for (const c of cycles.data) {
      if (c.strain == null) continue;
      lines.push(`  ${fmtDate(c.start_at)}: strain ${Number(c.strain).toFixed(1)}, avg HR ${c.average_heart_rate ?? "?"}`);
    }
  }

  if (workouts.data?.length) {
    lines.push("Recent workouts:");
    for (const w of workouts.data.slice(0, 5)) {
      const start = new Date(w.start_at);
      const end = new Date(w.end_at);
      const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
      lines.push(`  ${fmtDate(w.start_at)} ${start.toISOString().slice(11, 16)}: sport ${w.sport_id}, ${minutes}min, strain ${w.strain != null ? Number(w.strain).toFixed(1) : "?"}, avg HR ${w.average_heart_rate ?? "?"}`);
    }
  }

  return lines.join("\n");
}

export type BriefingResult =
  | { ok: true; data: { date: string; summary: string; items: unknown[]; scanned_at: string } }
  | { ok: false; status: number; error: string };

async function getValidToken(): Promise<string | null> {
  const { data } = await supabase.from("oauth_tokens").select("*").eq("id", "default").single();
  if (!data) return null;

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

export async function generateDailyBrief(days: number = 1): Promise<BriefingResult> {
  const emailCount = days <= 1 ? 20 : days <= 7 ? 50 : 100;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not set" };

  const accessToken = await getValidToken();
  if (!accessToken) return { ok: false, status: 401, error: "not_authenticated" };

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

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, category, priority, status")
    .eq("status", "todo");

  const taskContext = (tasks || [])
    .map((t: Pick<Task, "category" | "priority" | "title">) => `- [${t.category}/${t.priority}] ${t.title}`)
    .join("\n");

  const whoopContext = await getWhoopContext();

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
        content: `Here are my ${emailCount} most recent emails:\n${emailSummary}\n\nHere is my calendar for today:\n${calendarSummary}\n\nHere are my current active tasks:\n${taskContext || "No active tasks."}\n\nRecent WHOOP data:\n${whoopContext}\n\nGenerate my daily briefing. Factor in my meeting load when suggesting priorities — if I have back-to-back meetings, prioritize items I can handle between or after meetings. If recovery is poor or trending down, factor that into your recommendations. If recovery is strong and the calendar is open, flag it as an opportunity for focused work or hard training.`,
      }],
    }),
  });

  const briefingData = await briefingResponse.json();
  const briefingText = (briefingData.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  let parsed;
  try {
    const cleaned = briefingText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, status: 500, error: "Failed to parse briefing" };
  }

  const dateStr = today();
  const scannedAt = new Date().toISOString();
  await supabase.from("briefings").upsert({
    date: dateStr,
    summary: parsed.summary,
    items: parsed.items,
    scanned_at: scannedAt,
  });

  return { ok: true, data: { date: dateStr, summary: parsed.summary, items: parsed.items, scanned_at: scannedAt } };
}
