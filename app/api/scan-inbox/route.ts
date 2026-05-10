import { NextResponse } from "next/server";
import { generateDailyBrief } from "@/lib/briefing";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days || 1;

    const result = await generateDailyBrief(days);
    if (!result.ok) {
      if (result.error === "not_authenticated") {
        return NextResponse.json({ error: "not_authenticated", loginUrl: "/api/auth/login" }, { status: 401 });
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[scan-inbox] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
