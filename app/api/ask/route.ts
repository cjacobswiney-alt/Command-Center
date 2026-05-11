import { NextResponse } from "next/server";
import { TOOLS, executeTool, newState, type ToolCallLog, type CollectedSource } from "@/lib/ask-tools";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are Jacob's second-brain query assistant. He runs acquisitions at Buckingham Companies (institutional multifamily, ~$3B AUM) and co-runs an independent venture with Blake (Class B/C Midwest workforce housing). He also builds AI tools for his team.

You have tools to query his command center: email archive, wiki pages, day logs, WHOOP recovery/sleep/strain/workouts, and past daily briefings.

## Source routing — pick ONLY the tool(s) that match the question type

Choose a focused set of 1-2 tools first. Do not shotgun every source.

- **Knowledge / research / health / protocols / frameworks / concepts / lessons / how-to** → search_wiki only. Skip emails entirely — they don't have research content.
- **Specific person, company, deal, broker, recent communication, "what did X say"** → search_emails first, then search_wiki for that name.
- **Recovery, sleep, HRV, strain, training load, readiness, fatigue, energy** → get_recent_whoop. Do not search emails or wiki for biometric data.
- **Workouts, gym sessions, lifting, recent training** → get_recent_whoop (it includes workouts).
- **"What was on my plate on date X" / reflection / historical context** → get_recent_briefings and/or search_day_logs.
- **Cross-domain** (e.g., "how does my recovery track with heavy meeting weeks?") → combine 2-3 tools.

When in doubt, start with the single most-likely tool. Add more only if the first search comes back empty or incomplete.

## Workflow

1. Decide which 1-2 tools fit the question. Do NOT narrate the plan.
2. Run targeted searches with short keyword queries (1-4 words).
3. If a snippet looks promising, use get_* to fetch full content.
4. Synthesize a direct, specific answer.

## Rules

- Lead with the direct answer. No "I'll search for..." preambles. No "Based on the context..." filler.
- 1-3 tool calls is typical. More than 5 is usually wasted work.
- Cite sources inline using [email:<id>], [wiki:<slug>], or [log:<date>]. Multiple: [email:abc,wiki:xyz].
- For people/companies/deals: summarize the trajectory across multiple sources, not just one.
- If you find nothing, say so plainly and suggest specific better keywords or what data might be missing.
- Markdown is fine. Bullets for lists. Concise > verbose.`;

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ClaudeResponse {
  content: ContentBlock[];
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[] | Array<{ type: "tool_result"; tool_use_id: string; content: string }>;
}

const MAX_ITERATIONS = 10;
const MODEL = "claude-sonnet-4-20250514";

async function callClaude(messages: Message[], apiKey: string): Promise<ClaudeResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const state = newState();
    const toolCalls: ToolCallLog[] = [];
    const messages: Message[] = [{ role: "user", content: question.trim() }];

    let answer = "";
    let iterations = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    for (; iterations < MAX_ITERATIONS; iterations++) {
      const response = await callClaude(messages, apiKey);
      inputTokens += response.usage?.input_tokens ?? 0;
      outputTokens += response.usage?.output_tokens ?? 0;

      // Append assistant message
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence" || response.stop_reason === "max_tokens") {
        answer = response.content
          .filter((b) => b.type === "text" && b.text)
          .map((b) => b.text)
          .join("\n")
          .trim();
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter((b) => b.type === "tool_use");
        const toolResults = [];
        for (const tu of toolUses) {
          if (!tu.id || !tu.name) continue;
          const { result, summary } = await executeTool(tu.name, tu.input || {}, state);
          toolCalls.push({ name: tu.name, input: tu.input || {}, result_summary: summary });
          toolResults.push({
            type: "tool_result" as const,
            tool_use_id: tu.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Unknown stop reason — bail
      break;
    }

    if (!answer) {
      answer = "(Claude finished without a final answer — likely hit max iterations or an unexpected stop reason.)";
    }

    const sources: CollectedSource[] = state.sources;

    return NextResponse.json({
      answer,
      tool_calls: toolCalls,
      sources,
      iterations: iterations + 1,
      elapsed_ms: Date.now() - start,
      stats: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    });
  } catch (err) {
    console.error("[ask] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
