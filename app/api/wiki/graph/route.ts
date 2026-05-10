import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: pages, error } = await supabase.from("wiki_pages").select("id, title, slug, page_type, related_pages");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nodes = (pages || []).map((p: { id: string; title: string; slug: string; page_type: string }) => ({
    id: p.id, title: p.title, slug: p.slug, type: p.page_type,
  }));

  const edges: { source: string; target: string }[] = [];
  const seen = new Set<string>();
  for (const p of pages || []) {
    for (const relId of p.related_pages || []) {
      const key = [p.id, relId].sort().join("-");
      if (!seen.has(key)) { edges.push({ source: p.id, target: relId }); seen.add(key); }
    }
  }

  return NextResponse.json({ nodes, edges });
}
