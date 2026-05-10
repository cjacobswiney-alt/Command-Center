import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = getGoogleAuthUrl(`${origin}/api/auth/google/callback`);
  return NextResponse.redirect(url);
}
