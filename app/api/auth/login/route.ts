import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/microsoft";

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback`;
  const url = getAuthUrl(redirectUri);
  return NextResponse.redirect(url);
}
