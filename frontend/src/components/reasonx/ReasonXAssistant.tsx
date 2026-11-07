import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  History,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

interface EvidenceItem {
  source_document?: string;
  page?: number | null;
  section?: string;
  requirement_id?: string;
  quote?: string;
}

interface StructuredPayload {
  direct_answer?: string;
  explanation?: string;
  supporting_evidence?: EvidenceItem[];
  recommended_actions?: string[];
  confidence_level?: "HIGH" | "MEDIUM" | "QUALIFIED";
  simplified_summary?: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  structured_payload?: StructuredPayload | null;
  created_at: string;
}

interface ConversationItem {
  id: number;
  title: string;
  page_context?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

function getPageName(pathname: string): string {
  if (pathname === "/") return "dashboard";
  if (pathname.includes("intelligence-report")) return "intelligence_report";
  if (pathname.includes("requirements")) return "requirements";
  if (pathname.includes("simulation") || pathname.includes("validation")) return "validation";
  if (pathname.includes("tests")) return "tests";
  if (pathname.includes("executions")) return "executions";
  if (pathname.includes("defects")) return "defects";
  if (pathname.includes("traceability")) return "traceability";
  if (pathname.includes("analytics")) return "analytics";
  if (pathname.includes("settings")) return "settings";
  return "workspace";
}

function getContextBadge(page: string): string {
  switch (page) {
    case "intelligence_report":
      return "Executive Intelligence";
    case "requirements":
      return "Requirements Intake";
    case "validation":
      return "Policy Validation";
    case "tests":
      return "Test Design & BDD";
    case "executions":
      return "Test Verification";
    case "defects":
      return "Defects & RCA";
    case "traceability":
      return "Traceability Matrix";
    case "dashboard":
      return "Executive Command";
    default:
      return "Contextual Assistant";
  }
}

function getContextSubtitle(page: string, projectName?: string): string {
  const pName = projectName || "Project";
  switch (page) {
    case "intelligence_report":
      return `Executive Readiness & Compliance Audit (${pName})`;
    case "requirements":
      return `Requirements & Clause Extraction (${pName})`;
    case "validation":
      return `Policy & Scenario Validation (${pName})`;
    case "tests":
      return `Test Scenarios & Dual-Control (${pName})`;
    case "executions":
      return `Sandboxed Execution Verification (${pName})`;
    case "defects":
      return `Defect Remediation & Evidence (${pName})`;
    case "traceability":
      return `Clause-to-Test Traceability Matrix (${pName})`;
    case "dashboard":
      return `Executive Command Center (${pName})`;
    default:
      return `${pName} Quality Workspace`;
  }
}

export function ReasonXAssistant() {
  const { projectId, current } = useProjects();
  const { pathname } = useLocation();
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const activePage = getPageName(pathname);

  // Quick prompts query
  const quickPromptsQ = useQuery({
    queryKey: ["reasonx_quick_prompts", activePage],
    queryFn: () => api.get<{ prompts: { label: string; query: string }[] }>("/reasonx/quick-prompts", { page: activePage }),
    staleTime: 60_000,
  });

  // Conversations query
  const convsQ = useQuery({
    queryKey: ["reasonx_conversations", projectId],
    queryFn: () => api.get<{ conversations: ConversationItem[] }>(`/reasonx/projects/${projectId}/conversations`),
    enabled: isOpen && !!projectId,
  });

  // Messages query
  const messagesQ = useQuery({
    queryKey: ["reasonx_messages", activeConvId],
    queryFn: () => api.get<{ messages: ChatMessage[] }>(`/reasonx/conversations/${activeConvId}/messages`),
    enabled: !!activeConvId,
    refetchInterval: false,
  });

  // Reset active conversation on project switch
  useEffect(() => {
    setActiveConvId(null);
  }, [projectId]);

  // Open drawer helper
  const handleOpenDrawer = () => {
    setIsOpen(true);
    setUnreadCount(0);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
  };

  // Close drawer helper with focus restoration to launcher
  const handleCloseDrawer = () => {
    setIsOpen(false);
    setShowHistory(false);
    setTimeout(() => {
      launcherRef.current?.focus();
    }, 50);
  };

  // Keyboard accessibility: Escape to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleCloseDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQ.data?.messages, isOpen]);

  // Send message mutation
  const sendM = useMutation({
    mutationFn: (text: string) =>
      api.post<any>("/reasonx/chat", {
        project_id: projectId || 11,
        query: text,
        page: activePage,
        conversation_id: activeConvId || undefined,
      }),
    onSuccess: (data) => {
      setActiveConvId(data.conversation_id);
      qc.invalidateQueries({ queryKey: ["reasonx_messages", data.conversation_id] });
      qc.invalidateQueries({ queryKey: ["reasonx_conversations", projectId] });
      setInputVal("");
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || sendM.isPending) return;
    sendM.mutate(text);
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setShowHistory(false);
    setInputVal("");
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const deleteConvM = useMutation({
    mutationFn: (id: number) => api.delete(`/reasonx/conversations/${id}`),
    onSuccess: (_, deletedId) => {
      if (activeConvId === deletedId) setActiveConvId(null);
      qc.invalidateQueries({ queryKey: ["reasonx_conversations", projectId] });
    },
  });

  const messages: ChatMessage[] = messagesQ.data?.messages ?? [];
  const quickPrompts = quickPromptsQ.data?.prompts ?? [];

  return (
    <>
      {/* ==================================================================== */}
      {/* 1. FLOATING LAUNCHER: Pure 56px Circular FAB Button                 */}
      {/* ==================================================================== */}
      {!isOpen && (
        <button
          ref={launcherRef}
          onClick={handleOpenDrawer}
          className={cn(
            "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full",
            "bg-[#1D4ED8] hover:bg-[#1E40AF] active:bg-[#1E3A8A] text-white",
            "shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95",
            "ring-2 ring-white/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
          )}
          title="Open ReasonX AI"
          aria-label="Open ReasonX AI Assistant"
        >
          <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-bounce"
              aria-label={`${unreadCount} unread message`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* ==================================================================== */}
      {/* 2. FULL-HEIGHT RESPONSIVE DRAWER & MODAL BACKDROP                   */}
      {/* ==================================================================== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="ReasonX AI Assistant">
          {/* Modal Backdrop with subtle blur */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
            onClick={handleCloseDrawer}
            aria-hidden="true"
          />

          {/* Full-Height Drawer Container: Desktop right-docked, Mobile full-screen */}
          <div
            ref={drawerRef}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl border-l border-slate-200",
              "w-full sm:w-[440px] md:w-[460px] max-w-full h-full min-h-[100dvh]",
              "animate-in slide-in-from-right duration-300 ease-out"
            )}
          >
            {/* Drawer Header matching Design System */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-[#1E293B] px-4 sm:px-5 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight text-white">reasonX AI</span>
                    <span className="rounded-full bg-blue-500/25 px-2 py-0.5 text-[10px] font-semibold text-blue-200 border border-blue-400/20">
                      {getContextBadge(activePage)}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-300 mt-0.5" title={getContextSubtitle(activePage, current?.name)}>
                    {getContextSubtitle(activePage, current?.name)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewConversation}
                  className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  title="Start New Conversation"
                  aria-label="New Conversation"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "rounded-lg p-2 transition-colors",
                    showHistory ? "bg-white/20 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  title="Conversation History"
                  aria-label="Conversation History"
                >
                  <History className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCloseDrawer}
                  className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  title="Close (Esc)"
                  aria-label="Close ReasonX Assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Slide-Over Conversation History Panel */}
            {showHistory && (
              <div className="absolute inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-slate-50 p-4 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                  <span className="text-xs font-bold text-slate-900">Conversation History</span>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                  >
                    Back to Chat
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {convsQ.isLoading ? (
                    <p className="text-xs text-slate-500 p-3">Loading history...</p>
                  ) : !convsQ.data?.conversations.length ? (
                    <p className="text-xs text-slate-500 p-4 text-center">No past conversations recorded for this project yet.</p>
                  ) : (
                    convsQ.data.conversations.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveConvId(c.id);
                          setShowHistory(false);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-xs cursor-pointer transition-colors shadow-2xs",
                          activeConvId === c.id
                            ? "border-blue-400 bg-blue-50 font-semibold text-blue-900 ring-1 ring-blue-300"
                            : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate font-semibold text-slate-900">{c.title}</p>
                          <p className="text-2xs text-slate-500 mt-1 truncate">{c.preview}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConvM.mutate(c.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                          title="Delete conversation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Quick Action Prompt Chips Bar */}
            <div className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-600 mr-1">Quick:</span>
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p.query)}
                    disabled={sendM.isPending}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#1D4ED8] shadow-2xs hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dedicated Conversation Thread Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50 overscroll-y-contain">
              {!messages.length && !sendM.isPending ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-4 space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#1D4ED8] shadow-xs">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">ReasonX Quality Intelligence</h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
                      Ask me to verify policy rules, explain root causes for variances, inspect traceability matrices, or summarize readiness audit reports.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-sm text-left pt-2">
                    {quickPrompts.slice(0, 3).map((qp, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(qp.query)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 transition-colors shadow-2xs group"
                      >
                        <span className="truncate group-hover:text-[#1D4ED8] font-medium">{qp.query}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#1D4ED8]" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col space-y-1.5",
                      m.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs",
                        m.role === "user"
                          ? "bg-[#1D4ED8] text-white rounded-br-xs max-w-[85%]"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs max-w-[92%]"
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {/* Direct Answer (Bold High-Craft Highlight) */}
                          {m.structured_payload?.direct_answer ? (
                            <div className="rounded-lg bg-blue-50/70 border-l-4 border-[#1D4ED8] p-2.5">
                              <p className="font-semibold text-slate-900 text-xs leading-snug">
                                {m.structured_payload.direct_answer}
                              </p>
                            </div>
                          ) : null}

                          {/* Detailed Explanation */}
                          <div className="text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                            {m.structured_payload?.explanation || m.content}
                          </div>

                          {/* Supporting Evidence Citation Pills */}
                          {m.structured_payload?.supporting_evidence && m.structured_payload.supporting_evidence.length > 0 && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 space-y-1.5">
                              <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                                Supporting Evidence & Statutory Grounding
                              </span>
                              {m.structured_payload.supporting_evidence.map((ev, ei) => (
                                <div key={ei} className="text-2xs text-slate-700 flex items-start gap-1.5 leading-snug">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] mt-1 shrink-0" />
                                  <span>
                                    <strong className="text-slate-900">{ev.source_document || "Source"}</strong>
                                    {ev.page ? ` (p. ${ev.page})` : ""}
                                    {ev.section ? ` · ${ev.section}` : ""}:
                                    {ev.quote ? <em className="ml-1 text-slate-800">“{ev.quote}”</em> : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actionable Recommendations Checklist */}
                          {m.structured_payload?.recommended_actions && m.structured_payload.recommended_actions.length > 0 && (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 space-y-1.5">
                              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                                Recommended Operational Actions
                              </span>
                              {m.structured_payload.recommended_actions.map((act, ai) => (
                                <div key={ai} className="text-2xs text-slate-800 flex items-start gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                                  <span>{act}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Footer Confidence & Copy */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-2xs text-slate-500">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {m.structured_payload?.confidence_level || "HIGH"} CONFIDENCE
                            </span>
                            <button
                              onClick={() => handleCopy(m.id, m.content)}
                              className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors font-medium"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  <span className="text-emerald-600 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Sending / Loading Indicator */}
              {sendM.isPending && (
                <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#1D4ED8]">
                    <Sparkles className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-3 shadow-xs">
                    <div className="flex items-center gap-2 text-xs text-slate-800 font-medium">
                      <span>ReasonX is synthesizing live project records</span>
                      <span className="flex gap-1 items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse delay-100" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse delay-200" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed Bottom Message Composer */}
            <div className="border-t border-slate-200 bg-white p-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 focus-within:border-[#1D4ED8] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner"
              >
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask ReasonX anything... (Enter to send, Shift+Enter for newline)"
                  disabled={sendM.isPending}
                  className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim() || sendM.isPending}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shadow-xs transition-colors hover:bg-[#1E40AF] disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Send query"
                  aria-label="Send query"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span>Grounded in actual project documentation</span>
                <span>Shift+Enter for newline</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
