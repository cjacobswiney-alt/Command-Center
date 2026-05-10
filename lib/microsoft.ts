import { supabase } from "@/lib/supabase";

const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;

const AUTH_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;
const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const SCOPES = "Mail.Read Calendars.ReadWrite User.Read offline_access";

export async function getValidMsToken(): Promise<string | null> {
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

export interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  body?: { contentType: string; content: string };
  bodyPreview?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  importance?: string;
  hasAttachments?: boolean;
}

export async function fetchEmailsForArchive(
  accessToken: string,
  sinceIso: string,
  folder: "inbox" | "sent",
): Promise<GraphMessage[]> {
  const path = folder === "inbox" ? "/me/messages" : "/me/mailFolders/sentitems/messages";
  const dateField = folder === "inbox" ? "receivedDateTime" : "sentDateTime";
  const filter = encodeURIComponent(`${dateField} ge ${sinceIso}`);
  const select = encodeURIComponent(
    "id,conversationId,from,toRecipients,ccRecipients,subject,body,bodyPreview,receivedDateTime,sentDateTime,isRead,importance,hasAttachments",
  );

  const all: GraphMessage[] = [];
  let url: string | null = `${GRAPH_URL}${path}?$top=50&$orderby=${dateField} desc&$filter=${filter}&$select=${select}`;
  let safety = 200;

  while (url && safety-- > 0) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });
    if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
    const data: { value?: GraphMessage[]; "@odata.nextLink"?: string } = await res.json();
    all.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return all;
}

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

  // Fetch inbox and sent in parallel
  const [inboxRes, sentRes] = await Promise.all([
    fetch(
      `${GRAPH_URL}/me/messages?$top=${count}&$orderby=receivedDateTime desc&$filter=${encodeURIComponent(filter)}&$select=from,toRecipients,subject,bodyPreview,receivedDateTime,isRead`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      `${GRAPH_URL}/me/mailFolders/sentitems/messages?$top=${Math.floor(count / 2)}&$orderby=sentDateTime desc&$filter=${encodeURIComponent(`sentDateTime ge ${since}`)}&$select=toRecipients,subject,bodyPreview,sentDateTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  if (!inboxRes.ok) throw new Error(`Graph API error: ${inboxRes.status}`);
  const inboxData = await inboxRes.json();
  const inbox = (inboxData.value || []).map((m: Record<string, unknown>) => ({
    direction: "received" as const,
    sender: (m.from as Record<string, Record<string, string>>)?.emailAddress?.name || (m.from as Record<string, Record<string, string>>)?.emailAddress?.address || "Unknown",
    subject: m.subject as string || "(no subject)",
    preview: m.bodyPreview as string || "",
    date: m.receivedDateTime as string,
    isRead: m.isRead as boolean,
  }));

  let sent: typeof inbox = [];
  if (sentRes.ok) {
    const sentData = await sentRes.json();
    sent = (sentData.value || []).map((m: Record<string, unknown>) => {
      const to = (m.toRecipients as Array<Record<string, Record<string, string>>>)?.[0]?.emailAddress;
      return {
        direction: "sent" as const,
        sender: `You → ${to?.name || to?.address || "Unknown"}`,
        subject: m.subject as string || "(no subject)",
        preview: m.bodyPreview as string || "",
        date: m.sentDateTime as string,
        isRead: true,
      };
    });
  }

  // Merge and sort by date descending
  return [...inbox, ...sent].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createCalendarEvent(accessToken: string, subject: string, startIso: string, endIso: string) {
  const res = await fetch(`${GRAPH_URL}/me/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject,
      start: { dateTime: startIso, timeZone: "America/Indiana/Indianapolis" },
      end: { dateTime: endIso, timeZone: "America/Indiana/Indianapolis" },
      isReminderOn: false,
      showAs: "busy",
    }),
  });
  if (!res.ok) throw new Error(`Graph create event error: ${res.status}`);
  return res.json();
}

export async function fetchTodayCalendar(accessToken: string, dateStr?: string) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

  const res = await fetch(
    `${GRAPH_URL}/me/calendarView?startDateTime=${startOfDay}&endDateTime=${endOfDay}&$orderby=start/dateTime&$select=subject,start,end,location,organizer,isAllDay,responseStatus,isCancelled,showAs`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="America/Indiana/Indianapolis"' } }
  );
  if (!res.ok) throw new Error(`Graph Calendar API error: ${res.status}`);
  const data = await res.json();
  return (data.value || []).filter((e: Record<string, unknown>) => {
    const response = (e.responseStatus as Record<string, string>)?.response || "none";
    return response !== "declined" && !(e.isCancelled as boolean);
  }).map((e: Record<string, unknown>) => {
    const response = (e.responseStatus as Record<string, string>)?.response || "none";
    return {
      subject: e.subject as string || "(no subject)",
      start: (e.start as Record<string, string>)?.dateTime || "",
      end: (e.end as Record<string, string>)?.dateTime || "",
      location: (e.location as Record<string, string>)?.displayName || "",
      organizer: (e.organizer as Record<string, Record<string, string>>)?.emailAddress?.name || "",
      isAllDay: e.isAllDay as boolean,
      responseStatus: response, // "accepted" | "declined" | "tentativelyAccepted" | "none" | "organizer" | "notResponded"
      isCancelled: e.isCancelled as boolean || false,
      showAs: e.showAs as string || "busy", // "free" | "tentative" | "busy" | "oof" | "workingElsewhere"
    };
  });
}
