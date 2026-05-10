import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { WIKI_LINT_PROMPT } from "@/lib/anthropic";
import { logOperation } from "@/lib/wiki";

export const maxDuration = 60;

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const { data: index } = await supabase.from("wiki_index").select("*");
    if (!index || index.length === 0) return NextResponse.json({ issues: [], health_score: 0, summary: "Wiki is empty." });

    const indexText = index.map((p: { title: string; slug: string; page_type: string; summary: string; related_count: number }) =>
      `[${p.page_type}] ${p.title} (${p.slug}) — ${p.summary} [${p.related_count} links]`
    ).join("\n");

    // Fetch page contents (all if < 100, otherwise sample)
    let pageQuery = supabase.from("wiki_pages").select("title, slug, content, page_type, related_pages, tags");
    if (index.length > 100) {
      pageQuery = pageQuery.order("updated_at", { ascending: false }).limit(70);
    }
    const { data: pages } = await pageQuery;
    const pageContents = (pages || []).map((p: { title: string; slug: string; content: string }) =>
      `=== ${p.title} (${p.slug}) ===\n${p.content.slice(0, 500)}`
    ).join("\n\n---\n\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 4096,
        system: WIKI_LINT_PROMPT,
        messages: [{ role: "user", content: `## Wiki Index\n${indexText}\n\n## Page Contents (sample)\n${pageContents}` }],
      }),
    });

    const data = await res.json();
    const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const result = JSON.parse(cleaned);

    await logOperation("lint", result.summary || "Lint completed", [], [], []);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[wiki/lint] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
