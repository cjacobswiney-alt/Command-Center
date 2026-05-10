import { NextResponse } from "next/server";
import { ask } from "@/lib/ask";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    const result = await ask(question.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("[ask] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
