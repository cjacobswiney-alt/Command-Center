import { supabase } from "@/lib/supabase";
import { ASK_SYNTHESIS_PROMPT } from "@/lib/anthropic";

export interface AskSource {
  index: number;
  type: "email" | "wiki" | "day_log";
  id: string;
  title: string;
  snippet: string;
  date?: string;
  sender?: string;
  slug?: string;
}

export interface AskResult {
  answer: string;
  sources: AskSource[];
  cited_indices: number[];
  elapsed_ms: number;
}

const MAX_EMAIL_RESULTS = 12;
const MAX_WIKI_RESULTS = 6;
const MAX_LOG_RESULTS = 6;
const SNIPPET_CHARS = 600;

function snippet(text: string | null | undefined, max = SNIPPET_CHARS): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? cleaned.slice(0, max) + "…" : cleaned;
}

async function searchEmails(query: string): Promise<AskSource[]> {
  // websearch_to_tsquery handles natural language well; fall back to ilike if FTS fails
  const fts = await supabase
    .from("emails")
    .select("id, subject, body_preview, body_text, sender_name, sender_email, date_at")
    .textSearch("body_text", query, { type: "websearch", config: "english" })
    .order("date_at", { ascending: false })
    .limit(MAX_EMAIL_RESULTS);

  let rows = fts.data;
  if (!rows || rows.length === 0) {
    // Fallback: ILIKE on subject + sender (handles names like "Cushman" that may not tokenize well)
    const ilike = await supabase
      .from("emails")
      .select("id, subject, body_preview, body_text, sender_name, sender_email, date_at")
      .or(`subject.ilike.%${query}%,sender_name.ilike.%${query}%,sender_email.ilike.%${query}%`)
      .order("date_at", { ascending: false })
      .limit(MAX_EMAIL_RESULTS);
    rows = ilike.data;
  }

  return (rows || []).map((r) => ({
    index: 0,
    type: "email" as const,
    id: r.id,
    title: r.subject || "(no subject)",
    snippet: snippet(r.body_text || r.body_preview),
    date: r.date_at,
    sender: r.sender_name || r.sender_email || undefined,
  }));
}

async function searchWiki(query: string): Promise<AskSource[]> {
  // Try textSearch on content; fall back to ilike on title/content for partial matches
  const ts = await supabase
    .from("wiki_pages")
    .select("id, title, slug, content, page_type")
    .textSearch("content", query, { type: "websearch", config: "english" })
    .limit(MAX_WIKI_RESULTS);

  let rows = ts.data;
  if (!rows || rows.length === 0) {
    const ilike = await supabase
      .from("wiki_pages")
      .select("id, title, slug, content, page_type")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(MAX_WIKI_RESULTS);
    rows = ilike.data;
  }

  return (rows || []).map((r) => ({
    index: 0,
    type: "wiki" as const,
    id: r.id,
    title: r.title,
    snippet: snippet(r.content),
    slug: r.slug,
  }));
}

async function searchDayLogs(query: string): Promise<AskSource[]> {
  const ilike = await supabase
    .from("day_logs")
    .select("date, content")
    .ilike("content", `%${query}%`)
    .order("date", { ascending: false })
    .limit(MAX_LOG_RESULTS);

  return (ilike.data || []).map((r) => ({
    index: 0,
    type: "day_log" as const,
    id: r.date,
    title: `Day log — ${r.date}`,
    snippet: snippet(r.content),
    date: r.date,
  }));
}

export async function ask(question: string): Promise<AskResult> {
  const start = Date.now();

  const [emails, wiki, logs] = await Promise.all([
    searchEmails(question),
    searchWiki(question),
    searchDayLogs(question),
  ]);

  const all: AskSource[] = [...emails, ...wiki, ...logs].map((s, i) => ({ ...s, index: i + 1 }));

  if (all.length === 0) {
    return {
      answer: "I couldn't find anything in your emails, wiki, or day logs that matches that question. Try different keywords, or check whether the relevant data has been ingested yet.",
      sources: [],
      cited_indices: [],
      elapsed_ms: Date.now() - start,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const contextLines = all.map((s) => {
    const header = s.type === "email"
      ? `[src:${s.index}] EMAIL — ${s.date?.slice(0, 10) ?? "?"} — ${s.sender ?? "?"} — ${s.title}`
      : s.type === "wiki"
      ? `[src:${s.index}] WIKI — ${s.title} (${s.slug})`
      : `[src:${s.index}] DAY LOG — ${s.date}`;
    return `${header}\n${s.snippet}`;
  });

  const userMessage = `## Question\n${question}\n\n## Retrieved sources\n\n${contextLines.join("\n\n---\n\n")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: ASK_SYNTHESIS_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await res.json();
  const text: string = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("");

  let parsed: { answer: string; sources_used: number[] };
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      answer: text || "(empty response from model)",
      sources: all,
      cited_indices: [],
      elapsed_ms: Date.now() - start,
    };
  }

  return {
    answer: parsed.answer,
    sources: all,
    cited_indices: parsed.sources_used || [],
    elapsed_ms: Date.now() - start,
  };
}
