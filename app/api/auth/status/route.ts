import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase.from("oauth_tokens").select("id").in("id", ["default", "google", "whoop"]);
  const ids = (data || []).map(t => t.id);
  return NextResponse.json({
    outlook: ids.includes("default"),
    google: ids.includes("google"),
    whoop: ids.includes("whoop"),
  });
}
