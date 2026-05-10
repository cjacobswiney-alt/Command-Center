import { NextResponse } from "next/server";
import { syncEmails } from "@/lib/email-sync";

export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result = await syncEmails(since);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "not_authenticated" ? 401 : 500 });
  }
  return NextResponse.json({ days, ...result });
}
