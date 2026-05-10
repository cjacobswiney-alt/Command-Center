const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

export function getGoogleAuthUrl(redirectUri: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function refreshGoogleToken(refresh_token: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  return res.json();
}

export async function fetchGoogleCalendar(accessToken: string, dateStr?: string) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const timeMin = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const timeMax = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    timeZone: "America/Indiana/Indianapolis",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();

  return (data.items || []).map((e: Record<string, unknown>) => {
    const start = e.start as Record<string, string> | undefined;
    const end = e.end as Record<string, string> | undefined;
    const isAllDay = !!start?.date && !start?.dateTime;
    return {
      subject: (e.summary as string) || "(no title)",
      start: start?.dateTime || start?.date || "",
      end: end?.dateTime || end?.date || "",
      location: (e.location as string) || "",
      organizer: ((e.organizer as Record<string, string>)?.displayName) || "",
      isAllDay,
      source: "google" as const,
    };
  });
}
