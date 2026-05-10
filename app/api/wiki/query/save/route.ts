import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateId, generateSlug, resolveSlugs, ensureBidirectionalLinks, rebuildIndex, logOperation } from "@/lib/wiki";

export async function POST(req: NextRequest) {
  try {
    const { title, content, tags, related_slugs } = await req.json();
    if (!title || !content) return NextResponse.json({ error: "title and content required" }, { status: 400 });

    const id = generateId();
    const slug = generateSlug(title);
    const slugMap = await resolveSlugs(related_slugs || []);
    const relatedIds = Object.values(slugMap);

    await supabase.from("wiki_pages").insert({
      id, title, slug, content, page_type: "synthesis",
      tags: tags || [], related_pages: relatedIds, source_ids: [],
      updated_at: new Date().toISOString(),
    });

    await ensureBidirectionalLinks(id, relatedIds);
    await rebuildIndex([id, ...relatedIds]);
    await logOperation("query", `Saved synthesis: ${title}`, [], [id], []);

    return NextResponse.json({ id, slug });
  } catch (err) {
    console.error("[wiki/query/save] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
