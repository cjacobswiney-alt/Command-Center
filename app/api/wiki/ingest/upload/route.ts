import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateId } from "@/lib/wiki";
import { today } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { title, content, source_type } = await req.json();
    if (!title || !content) return NextResponse.json({ error: "title and content required" }, { status: 400 });

    const sourceId = generateId();
    await supabase.from("wiki_sources").insert({
      id: sourceId,
      title,
      source_type: source_type || "document",
      content,
      date: today(),
      ingested: false,
    });

    // Trigger ingest
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const ingestRes = await fetch(`${baseUrl}/api/wiki/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_ids: [sourceId] }),
    });

    const ingestResult = await ingestRes.json();
    return NextResponse.json({ source_id: sourceId, ...ingestResult });
  } catch (err) {
    console.error("[wiki/ingest/upload] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
