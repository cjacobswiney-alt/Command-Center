const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;

const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;
const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const SCOPES = "Mail.Read Calendars.Read User.Read offline_access";

export function getAuthUrl(redirectUri: string, state: string = "") {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: "query",
    state,
  });
  return `${AUTH_URL}/authorize?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });
  return res.json();
}

export async function refreshToken(refresh_token: string) {
  const res = await fetch(`${AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });
  return res.json();
}

export async function fetchRecentEmails(accessToken: string, count: number = 20, days: number = 1) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const filter = `receivedDateTime ge ${since}`;
  const res = await fetch(
    `${GRAPH_URL}/me/messages?$top=${count}&$orderby=receivedDateTime desc&$filter=${encodeURIComponent(filter)}&$select=from,subject,bodyPreview,receivedDateTime,isRead`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Graph API error: ${res.status}`);
  const data = await res.json();
  return (data.value || []).map((m: Record<string, unknown>) => ({
    sender: (m.from as Record<string, Record<string, string>>)?.emailAddress?.name || (m.from as Record<string, Record<string, string>>)?.emailAddress?.address || "Unknown",
    subject: m.subject as string || "(no subject)",
    preview: m.bodyPreview as string || "",
    date: m.receivedDateTime as string,
    isRead: m.isRead as boolean,
  }));
}

export async function fetchTodayCalendar(accessToken: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const res = await fetch(
    `${GRAPH_URL}/me/calendarView?startDateTime=${startOfDay}&endDateTime=${endOfDay}&$orderby=start/dateTime&$select=subject,start,end,location,organizer,isAllDay`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="America/Indiana/Indianapolis"' } }
  );
  if (!res.ok) throw new Error(`Graph Calendar API error: ${res.status}`);
  const data = await res.json();
  return (data.value || []).map((e: Record<string, unknown>) => ({
    subject: e.subject as string || "(no subject)",
    start: (e.start as Record<string, string>)?.dateTime || "",
    end: (e.end as Record<string, string>)?.dateTime || "",
    location: (e.location as Record<string, string>)?.displayName || "",
    organizer: (e.organizer as Record<string, Record<string, string>>)?.emailAddress?.name || "",
    isAllDay: e.isAllDay as boolean,
  }));
}
