import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { WIKI_QUERY_IDENTIFY_PROMPT, WIKI_QUERY_SYNTHESIZE_PROMPT } from "@/lib/anthropic";
import { logOperation, generateId } from "@/lib/wiki";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };

    // Load wiki index
    const { data: index } = await supabase.from("wiki_index").select("*");
    const indexText = (index || []).map((p: { page_id: string; title: string; slug: string; page_type: string; summary: string; tags: string[] }) =>
      `[${p.page_type}] ${p.title} (${p.slug}) — ${p.summary} [tags: ${(p.tags || []).join(", ")}]`
    ).join("\n");

    if (!indexText) {
      return NextResponse.json({ answer: "The wiki is empty. Process some sources first.", cited_pages: [], save_suggested: false, suggested_title: null });
    }

    // Call 1: Identify relevant pages
    const identifyRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 1024,
        system: WIKI_QUERY_IDENTIFY_PROMPT,
        messages: [{ role: "user", content: `## Question\n${question}\n\n## Wiki Index\n${indexText}` }],
      }),
    });

    const identifyData = await identifyRes.json();
    const identifyText = (identifyData.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const identifyCleaned = identifyText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const identified = JSON.parse(identifyCleaned);
    const slugs: string[] = identified.relevant_slugs || [];

    // Fetch full page contents
    let pageContents = "";
    if (slugs.length > 0) {
      const { data: pages } = await supabase.from("wiki_pages").select("title, slug, content").in("slug", slugs);
      pageContents = (pages || []).map((p: { title: string; slug: string; content: string }) =>
        `=== ${p.title} (${p.slug}) ===\n${p.content}`
      ).join("\n\n---\n\n");
    }

    // Call 2: Synthesize answer
    const synthRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 4096,
        system: WIKI_QUERY_SYNTHESIZE_PROMPT,
        messages: [{ role: "user", content: `## Question\n${question}\n\n## Relevant Wiki Pages\n${pageContents || "(no pages found)"}` }],
      }),
    });

    const synthData = await synthRes.json();
    const synthText = (synthData.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const synthCleaned = synthText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const result = JSON.parse(synthCleaned);

    await logOperation("query", `Question: ${question.slice(0, 100)}`, [], [], []);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[wiki/query] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
