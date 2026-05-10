import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { WIKI_INGEST_PROMPT } from "@/lib/anthropic";
import { generateId, generateSlug, mergeContent, resolveSlugs, ensureBidirectionalLinks, rebuildIndex, logOperation } from "@/lib/wiki";
import { today } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceIds: string[] = body.source_ids || [];

    // Get unprocessed sources (or specific ones)
    let query = supabase.from("wiki_sources").select("*");
    if (sourceIds.length > 0) {
      query = query.in("id", sourceIds);
    } else {
      query = query.eq("ingested", false);
    }
    const { data: sources } = await query;
    if (!sources || sources.length === 0) return NextResponse.json({ message: "No sources to process" });

    // Load wiki index for context
    const { data: index } = await supabase.from("wiki_index").select("*");
    const indexContext = (index || []).map((p: { page_id: string; title: string; slug: string; page_type: string; summary: string }) =>
      `[${p.page_type}] ${p.title} (${p.slug}) — ${p.summary}`
    ).join("\n");

    // Build source content
    const sourceContent = sources.map((s: { title: string; source_type: string; content: string; date: string | null }) =>
      `=== SOURCE: ${s.title} (${s.source_type}) ===\n${s.content}`
    ).join("\n\n---\n\n");

    // Call Claude
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: WIKI_INGEST_PROMPT,
        messages: [{
          role: "user",
          content: `## Current Wiki Index\n${indexContext || "(empty wiki)"}\n\n## Raw Sources to Process\n${sourceContent}`,
        }],
      }),
    });

    const data = await res.json();
    const rawText = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const result = JSON.parse(cleaned);

    const pagesCreated: string[] = [];
    const pagesUpdated: string[] = [];
    const allAffectedIds: string[] = [];

    for (const op of result.operations || []) {
      if (op.action === "create") {
        const id = generateId();
        const slug = op.slug || generateSlug(op.title);
        const relatedSlugs: string[] = op.related_slugs || [];
        const slugMap = await resolveSlugs(relatedSlugs);
        const relatedIds = Object.values(slugMap);

        await supabase.from("wiki_pages").insert({
          id, title: op.title, slug, content: op.content || "", page_type: op.page_type || "concept",
          tags: op.tags || [], related_pages: relatedIds, source_ids: sources.map((s: { id: string }) => s.id),
          updated_at: new Date().toISOString(),
        });

        await ensureBidirectionalLinks(id, relatedIds);
        pagesCreated.push(id);
        allAffectedIds.push(id, ...relatedIds);
      } else if (op.action === "update" && op.page_id) {
        const { data: existing } = await supabase.from("wiki_pages").select("*").eq("id", op.page_id).single();
        if (existing) {
          const merged = mergeContent(existing.content, op.content || "", today());
          const newSourceIds = [...new Set([...(existing.source_ids || []), ...sources.map((s: { id: string }) => s.id)])];
          const relatedSlugs: string[] = op.related_slugs || [];
          const slugMap = await resolveSlugs(relatedSlugs);
          const newRelatedIds = [...new Set([...(existing.related_pages || []), ...Object.values(slugMap)])];

          await supabase.from("wiki_pages").update({
            content: merged, tags: [...new Set([...(existing.tags || []), ...(op.tags || [])])],
            related_pages: newRelatedIds, source_ids: newSourceIds, updated_at: new Date().toISOString(),
          }).eq("id", op.page_id);

          await ensureBidirectionalLinks(op.page_id, Object.values(slugMap));
          pagesUpdated.push(op.page_id);
          allAffectedIds.push(op.page_id, ...Object.values(slugMap));
        }
      }
    }

    // Rebuild index for all affected pages
    await rebuildIndex([...new Set(allAffectedIds)]);

    // Mark sources as ingested
    const processedIds = sources.map((s: { id: string }) => s.id);
    await supabase.from("wiki_sources").update({ ingested: true }).in("id", processedIds);

    // Log
    await logOperation("ingest", result.summary || `Processed ${sources.length} sources`, processedIds, pagesCreated, pagesUpdated);

    return NextResponse.json({ summary: result.summary, pages_created: pagesCreated.length, pages_updated: pagesUpdated.length });
  } catch (err) {
    console.error("[wiki/ingest] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
