import { NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop-sync";

export const maxDuration = 60;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 90);

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const result = await syncWhoopData(start.toISOString(), end.toISOString());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_authenticated" ? 401 : 500 });
  }
  return NextResponse.json({ days, ...result });
}
