import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeWhoopCode } from "@/lib/whoop";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  if (!code) return NextResponse.redirect(new URL("/?error=no_code", req.url));

  const jar = await cookies();
  const stateCookie = jar.get("whoop_oauth_state")?.value;
  jar.delete("whoop_oauth_state");
  if (!stateCookie || stateCookie !== stateParam) {
    return NextResponse.redirect(new URL("/?error=whoop_state_mismatch", req.url));
  }

  const origin = req.nextUrl.origin;
  const tokens = await exchangeWhoopCode(code, `${origin}/api/auth/whoop/callback`);

  if (tokens.error || !tokens.access_token) {
    console.error("[whoop-callback] Token error:", tokens);
    return NextResponse.redirect(new URL("/?error=whoop_auth_failed", req.url));
  }

  await supabase.from("oauth_tokens").upsert({
    id: "whoop",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || "",
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });

  return NextResponse.redirect(new URL("/?whoop=connected", req.url));
}
