import { supabase } from "./supabase";
import { nanoid } from "nanoid";

export function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateId(): string {
  return nanoid();
}

// Append update content under a dated header
export function mergeContent(existing: string, newContent: string, date: string): string {
  return `${existing}\n\n## Update — ${date}\n\n${newContent}`;
}

// Ensure bidirectional links: if A→B then B→A
export async function ensureBidirectionalLinks(pageId: string, relatedIds: string[]) {
  for (const relatedId of relatedIds) {
    const { data } = await supabase.from("wiki_pages").select("related_pages").eq("id", relatedId).single();
    if (data) {
      const existing: string[] = data.related_pages || [];
      if (!existing.includes(pageId)) {
        await supabase.from("wiki_pages").update({ related_pages: [...existing, pageId] }).eq("id", relatedId);
      }
    }
  }
}

// Remove a page ID from all other pages' related_pages
export async function cleanupRelatedLinks(pageId: string) {
  const { data: pages } = await supabase.from("wiki_pages").select("id, related_pages").contains("related_pages", [pageId]);
  if (pages) {
    for (const page of pages) {
      const updated = (page.related_pages || []).filter((id: string) => id !== pageId);
      await supabase.from("wiki_pages").update({ related_pages: updated }).eq("id", page.id);
    }
  }
}

// Resolve slugs to page IDs
export async function resolveSlugs(slugs: string[]): Promise<Record<string, string>> {
  if (slugs.length === 0) return {};
  const { data } = await supabase.from("wiki_pages").select("id, slug").in("slug", slugs);
  const map: Record<string, string> = {};
  for (const row of data || []) { map[row.slug] = row.id; }
  return map;
}

// Rebuild wiki_index rows for given page IDs
export async function rebuildIndex(pageIds: string[]) {
  if (pageIds.length === 0) return;
  const { data: pages } = await supabase.from("wiki_pages").select("*").in("id", pageIds);
  if (!pages) return;

  for (const page of pages) {
    const summary = page.content.split("\n").filter((l: string) => l.trim() && !l.startsWith("#")).slice(0, 2).join(" ").slice(0, 200);
    await supabase.from("wiki_index").upsert({
      page_id: page.id,
      title: page.title,
      slug: page.slug,
      page_type: page.page_type,
      tags: page.tags || [],
      summary: summary || page.title,
      related_count: (page.related_pages || []).length,
      updated_at: page.updated_at,
    });
  }
}

// Log a wiki operation
export async function logOperation(operation: string, summary: string, sourceIds: string[] = [], pagesCreated: string[] = [], pagesUpdated: string[] = []) {
  await supabase.from("wiki_log").insert({
    id: generateId(),
    operation,
    summary,
    source_ids: sourceIds,
    pages_created: pagesCreated,
    pages_updated: pagesUpdated,
  });
}
