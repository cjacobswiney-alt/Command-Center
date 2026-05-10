import { NextResponse } from "next/server";
import { syncEmails } from "@/lib/email-sync";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const result = await syncEmails(since);
  if (!result.ok) {
    console.error("[cron/email-sync] failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
