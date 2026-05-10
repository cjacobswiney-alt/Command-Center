import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!password || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}
