import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchTodayCalendar, refreshToken } from "@/lib/microsoft";
import { fetchGoogleCalendar, refreshGoogleToken } from "@/lib/google";

async function getOutlookToken() {
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

async function getGoogleToken() {
  const { data } = await supabase.from("oauth_tokens").select("*").eq("id", "google").single();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const newTokens = await refreshGoogleToken(data.refresh_token);
    if (newTokens.error) return null;
    await supabase.from("oauth_tokens").upsert({
      id: "google",
      access_token: newTokens.access_token,
      refresh_token: data.refresh_token, // Google doesn't always return a new refresh token
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    });
    return newTokens.access_token;
  }
  return data.access_token;
}

// GET /api/calendar/today?date=2026-05-03
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date") || undefined;

  // Fetch from both sources in parallel
  const [outlookEvents, googleEvents] = await Promise.all([
    (async () => {
      try {
        const token = await getOutlookToken();
        if (!token) return [];
        const events = await fetchTodayCalendar(token, dateParam);
        return events.map((e: Record<string, unknown>) => ({ ...e, source: "outlook" }));
      } catch { return []; }
    })(),
    (async () => {
      try {
        const token = await getGoogleToken();
        if (!token) return [];
        return await fetchGoogleCalendar(token, dateParam);
      } catch { return []; }
    })(),
  ]);

  // Merge and sort by start time
  const all = [...outlookEvents, ...googleEvents].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return (a.start || "").localeCompare(b.start || "");
  });

  return NextResponse.json(all);
}
