const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API = "http://localhost:3333";

async function main() {
  const { data: sources } = await sb
    .from("wiki_sources")
    .select("id, title")
    .eq("ingested", false)
    .order("title");

  if (!sources || sources.length === 0) {
    console.log("No unprocessed sources.");
    return;
  }

  console.log(`${sources.length} sources to process\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    process.stdout.write(`[${i + 1}/${sources.length}] ${src.title.substring(0, 60)}... `);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

      const res = await fetch(`${API}/api/wiki/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: [src.id] }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text();
        console.log(`✗ HTTP ${res.status}`);
        failed++;
      } else {
        const data = await res.json();
        console.log(`✓ ${data.pages_created || 0} created, ${data.pages_updated || 0} updated`);
        success++;
      }

      // 3 second delay between requests
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
      // Wait longer after an error
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
