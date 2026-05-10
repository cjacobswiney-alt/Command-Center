const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE = "C:/Users/jacob.swiney/OneDrive - Buckingham/Claude-Workspace/Projects/Bio-Hacking/Bio Hacking";

function genId() {
  return "src_" + Math.random().toString(36).slice(2, 12);
}

async function getAllDocx(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllDocx(full)));
    } else if (entry.name.endsWith(".docx") && !entry.name.startsWith("~")) {
      files.push(full);
    }
  }
  return files;
}

async function extractText(filepath) {
  const result = await mammoth.extractRawText({ path: filepath });
  return result.value;
}

async function main() {
  const files = await getAllDocx(BASE);
  console.log(`Found ${files.length} .docx files\n`);

  // Check what's already been uploaded
  const { data: existing } = await sb.from("wiki_sources").select("title");
  const existingTitles = new Set((existing || []).map((s) => s.title));

  let uploaded = 0;
  let skipped = 0;

  for (const filepath of files) {
    const filename = path.basename(filepath, ".docx");
    const folder = path.basename(path.dirname(filepath));
    const title = folder !== "Bio Hacking" ? `[${folder}] ${filename}` : filename;

    if (existingTitles.has(title)) {
      console.log(`  SKIP (exists): ${title}`);
      skipped++;
      continue;
    }

    try {
      const text = await extractText(filepath);
      if (!text || text.trim().length < 50) {
        console.log(`  SKIP (empty): ${title}`);
        skipped++;
        continue;
      }

      // Truncate to ~30k chars to stay within Claude context limits per source
      const content = text.slice(0, 30000);

      const { error } = await sb.from("wiki_sources").insert({
        id: genId(),
        title,
        source_type: "document",
        content,
        date: new Date().toISOString().slice(0, 10),
        ingested: false,
      });

      if (error) {
        console.log(`  ERROR: ${title} — ${error.message}`);
      } else {
        console.log(`  ✓ ${title} (${content.length} chars)`);
        uploaded++;
      }
    } catch (err) {
      console.log(`  ERROR: ${title} — ${err.message}`);
    }
  }

  // Also add the knowledge base markdown
  const kbPath = "C:/Users/jacob.swiney/OneDrive - Buckingham/Claude-Workspace/Projects/Bio-Hacking/jacob-optimization-knowledge-base.md";
  if (fs.existsSync(kbPath) && !existingTitles.has("Jacob's Optimization Knowledge Base")) {
    const kbText = fs.readFileSync(kbPath, "utf-8").slice(0, 30000);
    const { error } = await sb.from("wiki_sources").insert({
      id: genId(),
      title: "Jacob's Optimization Knowledge Base",
      source_type: "document",
      content: kbText,
      date: new Date().toISOString().slice(0, 10),
      ingested: false,
    });
    if (error) console.log(`  ERROR: KB — ${error.message}`);
    else { console.log(`  ✓ Knowledge Base (${kbText.length} chars)`); uploaded++; }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped`);
  console.log(`\nSources are loaded but NOT yet ingested.`);
  console.log(`Go to the Research tab in Command Center and click "Process" to have Claude`);
  console.log(`read each source and build wiki pages from them.`);
  console.log(`Note: ingesting all sources will use significant Claude API tokens.`);
  console.log(`Consider ingesting in batches from the Research tab.`);
}

main().catch(console.error);
