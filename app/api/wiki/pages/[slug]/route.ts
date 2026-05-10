import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: page, error } = await supabase.from("wiki_pages").select("*").eq("slug", slug).single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });

  // Resolve related pages
  let relatedPages: { id: string; title: string; slug: string; page_type: string }[] = [];
  if (page.related_pages && page.related_pages.length > 0) {
    const { data } = await supabase.from("wiki_pages").select("id, title, slug, page_type").in("id", page.related_pages);
    relatedPages = data || [];
  }

  return NextResponse.json({ ...page, resolved_related: relatedPages });
}
