import { NextResponse } from "next/server";
import { syncWhoopData } from "@/lib/whoop-sync";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 2);

  const result = await syncWhoopData(start.toISOString(), end.toISOString());
  if (!result.ok) {
    console.error("[cron/whoop-sync] failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
