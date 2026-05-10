import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rebuildIndex, cleanupRelatedLinks } from "@/lib/wiki";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.content !== undefined) update.content = body.content;
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.related_pages !== undefined) update.related_pages = body.related_pages;
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("wiki_pages").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await rebuildIndex([id]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await cleanupRelatedLinks(id);
  await supabase.from("wiki_index").delete().eq("page_id", id);
  const { error } = await supabase.from("wiki_pages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
