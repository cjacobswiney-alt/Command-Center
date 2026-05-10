import { NextResponse } from "next/server";
import { generateDailyBrief } from "@/lib/briefing";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await generateDailyBrief(1);
  if (!result.ok) {
    console.error("[cron/daily-brief] failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, date: result.data.date });
}
