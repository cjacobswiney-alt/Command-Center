"use client";

import { useState, useEffect, useRef } from "react";

interface AskSource {
  index: number;
  type: "email" | "wiki" | "day_log";
  id: string;
  title: string;
  snippet: string;
  date?: string;
  sender?: string;
  slug?: string;
}

interface AskResult {
  answer: string;
  sources: AskSource[];
  cited_indices: number[];
  elapsed_ms: number;
  stats: {
    emails: number;
    wiki: number;
    day_logs: number;
    total_in_db: { emails: number; wiki: number; day_logs: number };
  };
}

const HISTORY_KEY = "ask_history_v1";

export default function AskTab() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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
    setExpanded(new Set());
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
      const data: AskResult = await res.json();
      setResult(data);
      const next = [text, ...history.filter(h => h !== text)].slice(0, 10);
      setHistory(next);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const renderAnswerWithLinks = (answer: string) => {
    const parts = answer.split(/(\[src:[\d,\s]+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[src:([\d,\s]+)\]$/);
      if (!m) return <span key={i}>{part}</span>;
      const indices = m[1].split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      return (
        <span key={i} className="inline-flex gap-0.5 mx-0.5">
          {indices.map(idx => (
            <button
              key={idx}
              onClick={() => { toggleExpanded(idx); document.getElementById(`src-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
              className="text-[10px] font-semibold text-[#1a73e8] hover:underline cursor-pointer"
            >
              [{idx}]
            </button>
          ))}
        </span>
      );
    });
  };

  const sourceTypeColor = (t: string) => t === "email" ? "#1a73e8" : t === "wiki" ? "#2e8b3e" : "#C9A84C";

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="Ask anything across emails, wiki, day logs…"
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
          <p className="text-sm text-[#535457] animate-pulse-scan">Searching emails, wiki, day logs…</p>
          <p className="text-[10px] text-[#949598] mt-1">Synthesizing with Claude — usually 5-10 seconds.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-semibold mb-1">Request failed</p>
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="text-[10px] text-[#949598] flex flex-wrap gap-x-3 gap-y-1">
            <span>Searched <strong className="text-[#535457]">{result.stats.total_in_db.emails}</strong> emails · <strong className="text-[#535457]">{result.stats.total_in_db.wiki}</strong> wiki · <strong className="text-[#535457]">{result.stats.total_in_db.day_logs}</strong> day logs</span>
            <span>·</span>
            <span>Matched <strong className="text-[#535457]">{result.stats.emails}</strong> · <strong className="text-[#535457]">{result.stats.wiki}</strong> · <strong className="text-[#535457]">{result.stats.day_logs}</strong></span>
            <span>·</span>
            <span>{(result.elapsed_ms / 1000).toFixed(1)}s</span>
          </div>

          {/* Answer */}
          <div className="bg-white border border-[rgba(0,0,0,.06)] rounded-xl p-5">
            <div className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap break-words">
              {renderAnswerWithLinks(result.answer)}
            </div>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[.14em] text-[#949598] font-semibold mb-2">Sources ({result.sources.length})</div>
              <div className="space-y-1.5">
                {result.sources.map(s => {
                  const isOpen = expanded.has(s.index);
                  const isCited = result.cited_indices.includes(s.index);
                  return (
                    <div
                      key={`${s.type}-${s.index}`}
                      id={`src-${s.index}`}
                      className={`bg-white border rounded-lg p-3 cursor-pointer transition-colors ${isCited ? "border-[#1a73e8]/30" : "border-[rgba(0,0,0,.06)] hover:border-[rgba(0,0,0,.15)]"}`}
                      onClick={() => toggleExpanded(s.index)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-[#949598] mt-0.5">[{s.index}]</span>
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
                        <div className="text-xs text-[#535457] leading-relaxed mt-2 pt-2 border-t border-[rgba(0,0,0,.06)] whitespace-pre-wrap break-words">
                          {s.snippet}
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
          <p className="text-xs text-[#949598]">It searches your emails, wiki pages, and day logs in parallel and synthesizes an answer with citations.</p>
        </div>
      )}
    </div>
  );
}
