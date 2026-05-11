"use client";

import { useState, useEffect, useRef } from "react";

interface AskSource {
  type: "email" | "wiki" | "day_log";
  id: string;
  title: string;
  date?: string;
  sender?: string;
  slug?: string;
}

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result_summary: string;
}

interface AskResponse {
  answer: string;
  tool_calls: ToolCall[];
  sources: AskSource[];
  iterations: number;
  elapsed_ms: number;
  stats: { input_tokens: number; output_tokens: number };
}

const HISTORY_KEY = "ask_history_v2";

const TOOL_LABELS: Record<string, string> = {
  search_emails: "Searched emails",
  get_email: "Read email",
  search_wiki: "Searched wiki",
  get_wiki_page: "Read wiki page",
  search_day_logs: "Searched day logs",
  get_recent_whoop: "Checked WHOOP",
  get_recent_briefings: "Reviewed past briefings",
};

const TOOL_ICONS: Record<string, string> = {
  search_emails: "✉️",
  get_email: "✉️",
  search_wiki: "📚",
  get_wiki_page: "📄",
  search_day_logs: "📝",
  get_recent_whoop: "💓",
  get_recent_briefings: "🗞️",
};

export default function AskTab() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [expandedSource, setExpandedSource] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch {}
    inputRef.current?.focus();
  }, []);

  const submit = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setLoading(true);
    setResult(null);
    setError(null);
    setExpandedSource(new Set());
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || `Request failed (${res.status})`);
        return;
      }
      const data: AskResponse = await res.json();
      setResult(data);
      const next = [text, ...history.filter((h) => h !== text)].slice(0, 10);
      setHistory(next);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (key: string) => {
    setExpandedSource((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const sourceTypeColor = (t: string) => t === "email" ? "#1a73e8" : t === "wiki" ? "#2e8b3e" : "#C9A84C";

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Ask anything across emails, wiki, day logs, WHOOP, briefings…"
          className="flex-1 min-w-0 bg-white border border-[rgba(0,0,0,.08)] rounded-lg px-3 py-2.5 text-sm text-[#010205] placeholder-[#949598] outline-none focus:border-[#010205]"
        />
        <button
          onClick={() => submit()}
          disabled={loading || !question.trim()}
          className="shrink-0 bg-[#010205] text-white text-sm font-semibold px-5 py-2.5 rounded-lg cursor-pointer hover:bg-[#28282e] disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {/* Recent questions */}
      {!loading && !result && !error && history.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Recent</div>
          <div className="flex gap-1.5 flex-wrap">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => submit(h)}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-[rgba(0,0,0,.08)] text-[#535457] hover:border-[rgba(0,0,0,.2)] hover:text-[#010205] cursor-pointer"
              >
                {h.length > 60 ? h.slice(0, 60) + "…" : h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white border border-[rgba(0,0,0,.06)] rounded-xl p-5">
          <p className="text-sm text-[#535457] animate-pulse-scan">Claude is thinking — searching your second brain…</p>
          <p className="text-[10px] text-[#949598] mt-1">Multiple tool calls + synthesis. Usually 10-25 seconds.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-semibold mb-1">Request failed</p>
          <p className="text-xs text-red-500 break-words">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Tool calls timeline */}
          {result.tool_calls.length > 0 && (
            <div className="bg-white border border-[rgba(0,0,0,.06)] rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">What Claude did</div>
              <div className="space-y-1">
                {result.tool_calls.map((tc, i) => {
                  const label = TOOL_LABELS[tc.name] ?? tc.name;
                  const icon = TOOL_ICONS[tc.name] ?? "🔧";
                  const arg = tc.input.query ?? tc.input.slug ?? tc.input.id ?? tc.input.days;
                  return (
                    <div key={i} className="text-xs text-[#535457] flex gap-2 items-baseline">
                      <span>{icon}</span>
                      <span className="font-semibold">{label}</span>
                      {arg !== undefined && <span className="text-[#949598]">— {String(arg)}</span>}
                      <span className="text-[#949598] ml-auto">{tc.result_summary}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats line */}
          <div className="text-[10px] text-[#949598] flex flex-wrap gap-x-3">
            <span>{result.iterations} round{result.iterations !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{(result.elapsed_ms / 1000).toFixed(1)}s</span>
            <span>·</span>
            <span>{result.stats.input_tokens.toLocaleString()} in / {result.stats.output_tokens.toLocaleString()} out tokens</span>
          </div>

          {/* Answer */}
          <div className="bg-white border border-[rgba(0,0,0,.06)] rounded-xl p-5">
            <div className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap break-words">{result.answer}</div>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Sources Claude consulted ({result.sources.length})</div>
              <div className="space-y-1.5">
                {result.sources.map((s) => {
                  const key = `${s.type}:${s.id}`;
                  const isOpen = expandedSource.has(key);
                  return (
                    <div
                      key={key}
                      className="bg-white border border-[rgba(0,0,0,.06)] rounded-lg p-3 cursor-pointer transition-colors hover:border-[rgba(0,0,0,.15)]"
                      onClick={() => toggleSource(key)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded text-white shrink-0 mt-0.5" style={{ backgroundColor: sourceTypeColor(s.type) }}>
                          {s.type === "day_log" ? "log" : s.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#010205] truncate">{s.title}</div>
                          <div className="text-[10px] text-[#949598] flex gap-1.5 flex-wrap mt-0.5">
                            {s.sender && <span>{s.sender}</span>}
                            {s.date && <span>{s.date.slice(0, 10)}</span>}
                            {s.slug && <span>/{s.slug}</span>}
                          </div>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="text-[10px] text-[#535457] mt-2 pt-2 border-t border-[rgba(0,0,0,.06)] font-mono break-all">
                          {s.type}:{s.id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && history.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-[#535457] mb-1">Ask anything about your data.</p>
          <p className="text-xs text-[#949598]">Claude searches emails, wiki, day logs, WHOOP, and past briefings — picking the right tools for your question.</p>
        </div>
      )}
    </div>
  );
}
