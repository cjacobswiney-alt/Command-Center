import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");

  let query = supabase.from("wiki_index").select("*").order("updated_at", { ascending: false });

  if (type) query = query.eq("page_type", type);
  if (tag) query = query.contains("tags", [tag]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let results = data || [];
  if (q) {
    const lower = q.toLowerCase();
    results = results.filter((p: { title: string; summary: string }) =>
      p.title.toLowerCase().includes(lower) || p.summary.toLowerCase().includes(lower)
    );
  }

  return NextResponse.json(results);
}
