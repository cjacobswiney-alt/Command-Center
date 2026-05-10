import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?error=no_code", req.url));

  const origin = req.nextUrl.origin;
  const tokens = await exchangeGoogleCode(code, `${origin}/api/auth/google/callback`);

  if (tokens.error) {
    console.error("[google-callback] Token error:", tokens);
    return NextResponse.redirect(new URL("/?error=google_auth_failed", req.url));
  }

  await supabase.from("oauth_tokens").upsert({
    id: "google",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || "",
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });

  return NextResponse.redirect(new URL("/", req.url));
}
