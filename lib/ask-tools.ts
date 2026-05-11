import { supabase } from "@/lib/supabase";

// ─── Tool definitions for Claude ──────────────────────────────────────────

export const TOOLS = [
  {
    name: "search_emails",
    description:
      "Search Jacob's email archive by keyword. Returns up to N most recent matching emails with sender, subject, date, and a short snippet. Use this to find emails about a person, topic, deal, or company. The query should be 1-4 keywords (e.g., 'Cushman Aertson', 'IC package Tides').",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keywords to search for in email body, subject, and sender" },
        days: { type: "integer", description: "Only search emails from the last N days (default 365)" },
        limit: { type: "integer", description: "Maximum results to return (default 10, max 25)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_email",
    description:
      "Get the full body of a specific email by ID. Use after search_emails when you need the complete content of an email.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Email ID returned by search_emails" },
      },
      required: ["id"],
    },
  },
  {
    name: "search_wiki",
    description:
      "Search Jacob's wiki/knowledge base by keyword. Returns matching pages with title, type, and a summary. Use for questions about people, companies, deals, markets, concepts, lessons, or tools. Query should be 1-4 keywords.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keywords to search in titles, content, and tags" },
        limit: { type: "integer", description: "Maximum results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_wiki_page",
    description:
      "Get the full content of a wiki page by slug. Use after search_wiki when you need the complete page text.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: "Wiki page slug returned by search_wiki" },
      },
      required: ["slug"],
    },
  },
  {
    name: "search_day_logs",
    description:
      "Search Jacob's personal day logs (free-form notes/journal entries) by keyword. Returns matching days with snippets.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keywords to search in day log content" },
        limit: { type: "integer", description: "Maximum results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recent_whoop",
    description:
      "Get recent WHOOP recovery, sleep, day strain, and workouts. Returns a daily summary for the last N days. Use for questions about recovery trends, sleep quality, training load, or readiness.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "integer", description: "Number of recent days to fetch (default 14, max 60)" },
      },
    },
  },
  {
    name: "get_recent_briefings",
    description:
      "Get past daily briefings (what was on Jacob's plate on past days). Useful for understanding what's been ongoing across time.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "integer", description: "Number of recent days (default 14)" },
      },
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────

export interface ToolCallLog {
  name: string;
  input: Record<string, unknown>;
  result_summary: string;
}

export interface CollectedSource {
  type: "email" | "wiki" | "day_log";
  id: string;
  title: string;
  date?: string;
  sender?: string;
  slug?: string;
}

export interface ExecutionState {
  log: ToolCallLog[];
  sources: CollectedSource[];
  seenSources: Set<string>;
}

function addSource(state: ExecutionState, s: CollectedSource) {
  const key = `${s.type}:${s.id}`;
  if (state.seenSources.has(key)) return;
  state.seenSources.add(key);
  state.sources.push(s);
}

function extractKeywords(q: string): string[] {
  const STOP = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "i", "in", "is", "it", "its",
    "me", "my", "of", "on", "or", "that", "the", "to", "was", "were", "will", "with", "you", "your",
    "about", "between", "into", "before", "after", "tell", "show", "give", "find", "what", "when", "where",
    "why", "how", "do", "did", "does", "should", "could", "would", "may", "any", "all", "this", "these", "those",
  ]);
  return q
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function buildOrIlike(columns: string[], keywords: string[]): string {
  return keywords
    .flatMap((k) => columns.map((c) => `${c}.ilike.%${k}%`))
    .join(",");
}

function snip(text: string | null | undefined, max = 400): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

// ─── Individual tools ──────────────────────────────────────────────────────

async function tool_search_emails(input: { query: string; days?: number; limit?: number }, state: ExecutionState) {
  const days = Math.min(input.days ?? 365, 730);
  const limit = Math.min(input.limit ?? 10, 25);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const keywords = extractKeywords(input.query);

  let rows: Array<{ id: string; subject: string | null; body_preview: string | null; sender_name: string | null; sender_email: string | null; date_at: string }> = [];

  if (keywords.length > 0) {
    const filter = buildOrIlike(["body_text", "subject", "sender_name", "sender_email"], keywords);
    const { data } = await supabase
      .from("emails")
      .select("id, subject, body_preview, body_text, sender_name, sender_email, date_at")
      .or(filter)
      .gte("date_at", since)
      .order("date_at", { ascending: false })
      .limit(50);

    // Score by how many keywords actually appear
    const scored = (data || []).map((r) => {
      const hay = `${r.body_text || ""} ${r.subject || ""} ${r.sender_name || ""}`.toLowerCase();
      const score = keywords.reduce((acc, k) => acc + (hay.split(k).length - 1), 0);
      return { ...r, _score: score };
    });
    scored.sort((a, b) => b._score - a._score || new Date(b.date_at).getTime() - new Date(a.date_at).getTime());
    rows = scored.slice(0, limit).map(({ _score, body_text, ...rest }) => { void _score; void body_text; return rest; });
  }

  for (const r of rows) {
    addSource(state, {
      type: "email",
      id: r.id,
      title: r.subject ?? "(no subject)",
      date: r.date_at,
      sender: r.sender_name ?? r.sender_email ?? undefined,
    });
  }

  return rows.map((r) => ({
    id: r.id,
    date: r.date_at?.slice(0, 10),
    sender: r.sender_name ?? r.sender_email ?? null,
    subject: r.subject ?? "(no subject)",
    snippet: snip(r.body_preview),
  }));
}

async function tool_get_email(input: { id: string }, state: ExecutionState) {
  const { data } = await supabase
    .from("emails")
    .select("id, subject, body_text, sender_name, sender_email, recipients, date_at, direction, conversation_id")
    .eq("id", input.id)
    .single();

  if (!data) return { error: "not_found", id: input.id };

  addSource(state, {
    type: "email",
    id: data.id,
    title: data.subject ?? "(no subject)",
    date: data.date_at,
    sender: data.sender_name ?? data.sender_email ?? undefined,
  });

  return {
    id: data.id,
    date: data.date_at,
    direction: data.direction,
    sender: data.sender_name ?? data.sender_email,
    recipients: data.recipients,
    subject: data.subject,
    body: snip(data.body_text, 4000),
  };
}

async function tool_search_wiki(input: { query: string; limit?: number }, state: ExecutionState) {
  const limit = Math.min(input.limit ?? 10, 20);
  const keywords = extractKeywords(input.query);
  let rows: Array<{ id: string; title: string; slug: string; content: string | null; page_type: string; tags: string[] | null }> = [];

  if (keywords.length > 0) {
    const filter = buildOrIlike(["title", "content"], keywords);
    const { data } = await supabase
      .from("wiki_pages")
      .select("id, title, slug, content, page_type, tags")
      .or(filter)
      .limit(50);

    const scored = (data || []).map((r) => {
      const hay = `${r.title || ""} ${r.content || ""} ${(r.tags || []).join(" ")}`.toLowerCase();
      let score = keywords.reduce((acc, k) => acc + (hay.split(k).length - 1), 0);
      // boost title matches
      const titleHay = (r.title || "").toLowerCase();
      score += keywords.reduce((acc, k) => acc + (titleHay.includes(k) ? 5 : 0), 0);
      return { ...r, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);
    rows = scored.slice(0, limit).map(({ _score, ...rest }) => { void _score; return rest; });
  }

  for (const r of rows) {
    addSource(state, { type: "wiki", id: r.id, title: r.title, slug: r.slug });
  }

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    type: r.page_type,
    tags: r.tags ?? [],
    summary: snip(r.content, 250),
  }));
}

async function tool_get_wiki_page(input: { slug: string }, state: ExecutionState) {
  const { data } = await supabase
    .from("wiki_pages")
    .select("id, title, slug, content, page_type, tags, related_pages")
    .eq("slug", input.slug)
    .single();

  if (!data) return { error: "not_found", slug: input.slug };

  addSource(state, { type: "wiki", id: data.id, title: data.title, slug: data.slug });

  return {
    slug: data.slug,
    title: data.title,
    type: data.page_type,
    tags: data.tags ?? [],
    content: snip(data.content, 6000),
  };
}

async function tool_search_day_logs(input: { query: string; limit?: number }, state: ExecutionState) {
  const limit = Math.min(input.limit ?? 10, 20);
  const keywords = extractKeywords(input.query);
  let rows: Array<{ date: string; content: string }> = [];

  if (keywords.length > 0) {
    const filter = buildOrIlike(["content"], keywords);
    const { data } = await supabase.from("day_logs").select("date, content").or(filter).order("date", { ascending: false }).limit(limit);
    rows = data || [];
  }

  for (const r of rows) {
    addSource(state, { type: "day_log", id: r.date, title: `Day log — ${r.date}`, date: r.date });
  }

  return rows.map((r) => ({ date: r.date, snippet: snip(r.content, 400) }));
}

async function tool_get_recent_whoop(input: { days?: number }) {
  const days = Math.min(input.days ?? 14, 60);
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [recovery, sleep, cycles, workouts] = await Promise.all([
    supabase.from("whoop_recovery").select("created_at, recovery_score, hrv_rmssd_milli, resting_heart_rate").gte("created_at", since).order("created_at", { ascending: false }),
    supabase.from("whoop_sleep").select("start_at, total_in_bed_milli, total_awake_milli, sleep_performance_pct, sleep_efficiency_pct").gte("start_at", since).eq("nap", false).order("start_at", { ascending: false }),
    supabase.from("whoop_cycles").select("start_at, strain, average_heart_rate, max_heart_rate").gte("start_at", since).order("start_at", { ascending: false }),
    supabase.from("whoop_workouts").select("start_at, end_at, sport_id, strain, average_heart_rate").gte("start_at", since).order("start_at", { ascending: false }),
  ]);

  const ms2hm = (ms: number | null) => {
    if (!ms) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return `${h}h${m.toString().padStart(2, "0")}m`;
  };

  return {
    recovery: (recovery.data || []).map((r) => ({ date: r.created_at?.slice(0, 10), score: r.recovery_score, hrv: r.hrv_rmssd_milli, rhr: r.resting_heart_rate })),
    sleep: (sleep.data || []).map((s) => ({
      date: s.start_at?.slice(0, 10),
      asleep: s.total_in_bed_milli ? ms2hm(s.total_in_bed_milli - (s.total_awake_milli ?? 0)) : null,
      performance_pct: s.sleep_performance_pct,
      efficiency_pct: s.sleep_efficiency_pct,
    })),
    strain: (cycles.data || []).map((c) => ({ date: c.start_at?.slice(0, 10), strain: c.strain, avg_hr: c.average_heart_rate, max_hr: c.max_heart_rate })),
    workouts: (workouts.data || []).map((w) => ({
      date: w.start_at?.slice(0, 10),
      sport_id: w.sport_id,
      minutes: w.start_at && w.end_at ? Math.round((new Date(w.end_at).getTime() - new Date(w.start_at).getTime()) / 60000) : null,
      strain: w.strain,
      avg_hr: w.average_heart_rate,
    })),
  };
}

async function tool_get_recent_briefings(input: { days?: number }) {
  const days = Math.min(input.days ?? 14, 90);
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("briefings").select("date, summary").gte("date", since).order("date", { ascending: false });
  return (data || []).map((b) => ({ date: b.date, summary: snip(b.summary, 600) }));
}

// ─── Dispatcher ───────────────────────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, unknown>, state: ExecutionState): Promise<{ result: unknown; summary: string }> {
  try {
    switch (name) {
      case "search_emails": {
        const r = await tool_search_emails(input as { query: string; days?: number; limit?: number }, state);
        return { result: r, summary: `${r.length} emails` };
      }
      case "get_email": {
        const r = await tool_get_email(input as { id: string }, state);
        const ok = !("error" in (r as object));
        return { result: r, summary: ok ? "1 email body" : "not found" };
      }
      case "search_wiki": {
        const r = await tool_search_wiki(input as { query: string; limit?: number }, state);
        return { result: r, summary: `${r.length} wiki pages` };
      }
      case "get_wiki_page": {
        const r = await tool_get_wiki_page(input as { slug: string }, state);
        const ok = !("error" in (r as object));
        return { result: r, summary: ok ? "1 wiki page" : "not found" };
      }
      case "search_day_logs": {
        const r = await tool_search_day_logs(input as { query: string; limit?: number }, state);
        return { result: r, summary: `${r.length} day logs` };
      }
      case "get_recent_whoop": {
        const r = await tool_get_recent_whoop(input as { days?: number });
        return { result: r, summary: `${r.recovery.length}d recovery, ${r.workouts.length} workouts` };
      }
      case "get_recent_briefings": {
        const r = await tool_get_recent_briefings(input as { days?: number });
        return { result: r, summary: `${r.length} briefings` };
      }
      default:
        return { result: { error: "unknown_tool", name }, summary: "unknown tool" };
    }
  } catch (err) {
    return { result: { error: String(err) }, summary: "error" };
  }
}

export function newState(): ExecutionState {
  return { log: [], sources: [], seenSources: new Set() };
}
