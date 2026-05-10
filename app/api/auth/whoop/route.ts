import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getWhoopAuthUrl } from "@/lib/whoop";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const state = randomBytes(16).toString("hex");

  const jar = await cookies();
  jar.set("whoop_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = getWhoopAuthUrl(`${origin}/api/auth/whoop/callback`, state);
  return NextResponse.redirect(url);
}
