import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/microsoft";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const tokenData = await exchangeCode(code, redirectUri);

  if (tokenData.error) {
    return NextResponse.json({ error: tokenData.error_description }, { status: 400 });
  }

  // Store tokens in Supabase (single user, keyed by "default")
  await supabase.from("oauth_tokens").upsert({
    id: "default",
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
  });

  // Redirect back to the app
  return NextResponse.redirect(baseUrl);
}
