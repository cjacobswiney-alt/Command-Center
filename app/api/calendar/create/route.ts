import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createCalendarEvent, refreshToken } from "@/lib/microsoft";

async function getValidToken() {
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

// POST /api/calendar/create { subject, date, startHour, endHour }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subject, date, startHour, endHour } = body;

    const token = await getValidToken();
    if (!token) {
      return NextResponse.json({ error: "not_authenticated", loginUrl: "/api/auth/login" }, { status: 401 });
    }

    // Convert decimal hours to ISO datetime strings
    const toIso = (hour: number) => {
      const h = Math.floor(hour);
      const m = Math.round((hour - h) * 60);
      return `${date}T${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
    };

    const event = await createCalendarEvent(token, subject, toIso(startHour), toIso(endHour));
    return NextResponse.json({ status: "ok", eventId: event.id });
  } catch (err) {
    console.error("[calendar/create] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
