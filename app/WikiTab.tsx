"use client";

import { useState, useEffect, useCallback } from "react";

interface WikiPage {
  page_id: string;
  title: string;
  slug: string;
  page_type: string;
  tags: string[];
  summary: string;
  related_count: number;
  updated_at: string;
}

interface WikiPageFull {
  id: string;
  title: string;
  slug: string;
  content: string;
  page_type: string;
  tags: string[];
  related_pages: string[];
  source_ids: string[];
  resolved_related: { id: string; title: string; slug: string; page_type: string }[];
}

interface QueryResult {
  answer: string;
  cited_pages: string[];
  save_suggested: boolean;
  suggested_title: string | null;
}

interface LintIssue {
  type: string;
  description: string;
  affected_pages: string[];
  suggested_action: string;
}

const PAGE_TYPES = ["all", "deal", "person", "company", "market", "concept", "lesson", "tool", "synthesis"];
const PAGE_TYPE_COLORS: Record<string, string> = {
  deal: "#1B3A5C", person: "#C9A84C", company: "#7C5CBF", market: "#2c5f4a",
  concept: "#D4880F", lesson: "#c0392b", tool: "#3B82F6", synthesis: "#B85C8A",
};
const SOURCE_TYPES = ["document", "article", "transcript", "report"];

type SubView = "pages" | "detail" | "ask";

export default function WikiTab() {
  const [subView, setSubView] = useState<SubView>("pages");
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPageFull | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [linting, setLinting] = useState(false);
  const [lintReport, setLintReport] = useState<{ issues: LintIssue[]; health_score: number; summary: string } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadType, setUploadType] = useState("document");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const fetchPages = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType !== "all") params.set("type", filterType);
    if (searchQuery) params.set("q", searchQuery);
    const res = await fetch(`/api/wiki/pages?${params}`);
    if (res.ok) setPages(await res.json());
  }, [filterType, searchQuery]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const openPage = async (slug: string) => {
    const res = await fetch(`/api/wiki/pages/${slug}`);
    if (res.ok) { setSelectedPage(await res.json()); setSubView("detail"); }
  };

  const processToday = async () => {
    setProcessing(true);
    try {
      await fetch("/api/wiki/ingest/daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      fetchPages();
    } catch {} finally { setProcessing(false); }
  };

  const uploadSource = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) return;
    setProcessing(true);
    try {
      await fetch("/api/wiki/ingest/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: uploadTitle, content: uploadContent, source_type: uploadType }),
      });
      setUploadTitle(""); setUploadContent(""); setShowUpload(false); fetchPages();
    } catch {} finally { setProcessing(false); }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setQuerying(true); setQueryResult(null);
    try {
      const res = await fetch("/api/wiki/query", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) setQueryResult(await res.json());
    } catch {} finally { setQuerying(false); }
  };

  const saveAnswer = async () => {
    if (!queryResult?.suggested_title) return;
    await fetch("/api/wiki/query/save", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: queryResult.suggested_title, content: queryResult.answer, tags: [], related_slugs: queryResult.cited_pages }),
    });
    fetchPages();
  };

  const runLint = async () => {
    setLinting(true); setLintReport(null);
    try {
      const res = await fetch("/api/wiki/lint", { method: "POST" });
      if (res.ok) setLintReport(await res.json());
    } catch {} finally { setLinting(false); }
  };

  const saveEdit = async () => {
    if (!selectedPage) return;
    await fetch(`/api/wiki/pages/update/${selectedPage.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    setEditing(false);
    openPage(selectedPage.slug);
  };

  const deletePage = async () => {
    if (!selectedPage) return;
    await fetch(`/api/wiki/pages/update/${selectedPage.id}`, { method: "DELETE" });
    setSelectedPage(null); setSubView("pages"); fetchPages();
  };

  const typeColor = (type: string) => PAGE_TYPE_COLORS[type] || "#8a8a8a";

  return (
    <div>
      {/* Action buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={processToday} disabled={processing}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${processing ? "bg-[#1B3A5C]/50 text-white" : "bg-[#1B3A5C] hover:bg-[#254d75] text-white"}`}>
          {processing ? "Processing..." : "Process Today"}
        </button>
        <button onClick={() => setShowUpload(!showUpload)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#e0ddd6] text-[#5c5c5c] hover:text-[#1a1a1a] cursor-pointer">
          Add Source
        </button>
        <button onClick={runLint} disabled={linting}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#e0ddd6] text-[#5c5c5c] hover:text-[#1a1a1a] cursor-pointer">
          {linting ? "Linting..." : "Lint Wiki"}
        </button>
        <div className="flex-1" />
        {/* Sub-view switcher */}
        <button onClick={() => { setSubView("pages"); setSelectedPage(null); }}
          className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${subView === "pages" || subView === "detail" ? "bg-[#1B3A5C] text-white" : "text-[#8a8a8a]"}`}>
          Pages
        </button>
        <button onClick={() => setSubView("ask")}
          className={`text-xs px-2.5 py-1 rounded cursor-pointer font-medium ${subView === "ask" ? "bg-[#1B3A5C] text-white" : "text-[#8a8a8a]"}`}>
          Ask
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="bg-white border border-[#e0ddd6] rounded-lg p-4 mb-4">
          <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="Source title"
            className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none mb-2" />
          <select value={uploadType} onChange={e => setUploadType(e.target.value)}
            className="bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-xs text-[#5c5c5c] outline-none mb-2">
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea value={uploadContent} onChange={e => setUploadContent(e.target.value)} placeholder="Paste content here..."
            className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#8a8a8a]/40 outline-none font-[family-name:var(--font-jetbrains)] resize-none mb-2" rows={6} />
          <div className="flex gap-2">
            <button onClick={uploadSource} disabled={!uploadTitle.trim() || !uploadContent.trim()}
              className="text-xs bg-[#1B3A5C] hover:bg-[#254d75] text-white px-4 py-1.5 rounded-lg font-medium cursor-pointer">Ingest</button>
            <button onClick={() => setShowUpload(false)} className="text-xs text-[#8a8a8a] px-2 py-1.5 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Lint report */}
      {lintReport && (
        <div className="bg-white border border-[#e0ddd6] rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-[#1a1a1a]">Wiki Health: {lintReport.health_score}/10</p>
            <button onClick={() => setLintReport(null)} className="text-[#8a8a8a] text-sm cursor-pointer">×</button>
          </div>
          <p className="text-xs text-[#5c5c5c] mb-3">{lintReport.summary}</p>
          {lintReport.issues.map((issue, i) => (
            <div key={i} className="border-t border-[#e0ddd6] pt-2 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: issue.type === "contradiction" ? "#c0392b" : "#D4880F" }}>{issue.type}</span>
              <p className="text-xs text-[#1a1a1a] mt-0.5">{issue.description}</p>
              <p className="text-[10px] text-[#8a8a8a] mt-0.5">{issue.suggested_action}</p>
            </div>
          ))}
        </div>
      )}

      {/* === PAGES LIST === */}
      {subView === "pages" && (
        <div>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search wiki..."
            className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#8a8a8a] outline-none focus:border-[#1B3A5C] mb-3" />
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {PAGE_TYPES.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`text-[10px] px-2 py-1 rounded cursor-pointer font-medium ${filterType === t ? "text-white" : "text-[#8a8a8a] hover:text-[#5c5c5c]"}`}
                style={filterType === t ? { backgroundColor: t === "all" ? "#1B3A5C" : typeColor(t) } : {}}>
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1) + "s"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {pages.map(page => (
              <div key={page.page_id} onClick={() => openPage(page.slug)}
                className="bg-white border border-[#e0ddd6] rounded-lg px-3 py-2.5 cursor-pointer hover:border-[#C9A84C]/40 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: typeColor(page.page_type) }}>
                    {page.page_type}
                  </span>
                  <span className="text-sm font-semibold text-[#1a1a1a]">{page.title}</span>
                </div>
                <p className="text-xs text-[#8a8a8a] line-clamp-1">{page.summary}</p>
                <div className="flex gap-1.5 mt-1.5">
                  {(page.tags || []).slice(0, 4).map(tag => (
                    <span key={tag} className="text-[9px] text-[#8a8a8a] bg-[#f8f7f4] px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                  {page.related_count > 0 && <span className="text-[9px] text-[#8a8a8a]">{page.related_count} links</span>}
                </div>
              </div>
            ))}
            {pages.length === 0 && <p className="text-center text-[#8a8a8a] text-sm py-8">No wiki pages yet. Hit &quot;Process Today&quot; or &quot;Add Source&quot; to get started.</p>}
          </div>
        </div>
      )}

      {/* === PAGE DETAIL === */}
      {subView === "detail" && selectedPage && (
        <div>
          <button onClick={() => { setSubView("pages"); setSelectedPage(null); }} className="text-xs text-[#C9A84C] cursor-pointer mb-3 block">&larr; Back to pages</button>
          <div className="bg-white border border-[#e0ddd6] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: typeColor(selectedPage.page_type) }}>
                {selectedPage.page_type}
              </span>
              <h2 className="text-lg font-bold text-[#1a1a1a]">{selectedPage.title}</h2>
            </div>
            <div className="flex gap-1.5 mb-4">
              {(selectedPage.tags || []).map(tag => (
                <span key={tag} className="text-[10px] text-[#5c5c5c] bg-[#f8f7f4] px-2 py-0.5 rounded">{tag}</span>
              ))}
            </div>
            {editing ? (
              <div>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                  className="w-full bg-[#f8f7f4] border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] outline-none font-[family-name:var(--font-jetbrains)] resize-none" rows={16} />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveEdit} className="text-xs bg-[#1B3A5C] text-white px-3 py-1.5 rounded-lg font-medium cursor-pointer">Save</button>
                  <button onClick={() => setEditing(false)} className="text-xs text-[#8a8a8a] px-2 py-1.5 cursor-pointer">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-[#5c5c5c] text-sm leading-relaxed whitespace-pre-wrap mb-4">{selectedPage.content}</div>
            )}
            {/* Related pages */}
            {selectedPage.resolved_related && selectedPage.resolved_related.length > 0 && (
              <div className="border-t border-[#e0ddd6] pt-3 mt-4">
                <p className="text-[10px] text-[#8a8a8a] uppercase tracking-widest font-semibold mb-2">Related Pages</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedPage.resolved_related.map(rp => (
                    <button key={rp.id} onClick={() => openPage(rp.slug)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-[#e0ddd6] text-[#1B3A5C] hover:border-[#C9A84C] cursor-pointer">
                      {rp.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Actions */}
            <div className="flex gap-2 mt-4 border-t border-[#e0ddd6] pt-3">
              <button onClick={() => { setEditing(true); setEditContent(selectedPage.content); }}
                className="text-xs text-[#1B3A5C] font-medium cursor-pointer">Edit</button>
              <button onClick={deletePage} className="text-xs text-[#c0392b]/60 hover:text-[#c0392b] font-medium cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* === ASK === */}
      {subView === "ask" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") askQuestion(); }}
              placeholder="What do you want to know?"
              className="flex-1 bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#8a8a8a] outline-none focus:border-[#1B3A5C]" />
            <button onClick={askQuestion} disabled={querying || !question.trim()}
              className={`text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors ${querying ? "bg-[#1B3A5C]/50 text-white" : "bg-[#1B3A5C] hover:bg-[#254d75] text-white"}`}>
              {querying ? "Thinking..." : "Ask"}
            </button>
          </div>
          {queryResult && (
            <div className="bg-white border border-[#e0ddd6] rounded-lg p-4">
              <div className="prose prose-sm max-w-none text-[#5c5c5c] text-sm leading-relaxed whitespace-pre-wrap mb-3">{queryResult.answer}</div>
              {queryResult.cited_pages.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <span className="text-[10px] text-[#8a8a8a] font-semibold">Cited:</span>
                  {queryResult.cited_pages.map(slug => (
                    <button key={slug} onClick={() => openPage(slug)}
                      className="text-[10px] text-[#1B3A5C] underline cursor-pointer">{slug}</button>
                  ))}
                </div>
              )}
              {queryResult.save_suggested && queryResult.suggested_title && (
                <button onClick={saveAnswer}
                  className="text-xs bg-[#C9A84C] hover:bg-[#b8963f] text-white px-3 py-1.5 rounded-lg font-medium cursor-pointer">
                  Save to Wiki: &quot;{queryResult.suggested_title}&quot;
                </button>
              )}
            </div>
          )}
          {!queryResult && !querying && (
            <p className="text-center text-[#8a8a8a] text-sm py-8">Ask a question and the wiki will synthesize an answer from its pages.</p>
          )}
        </div>
      )}
    </div>
  );
}
