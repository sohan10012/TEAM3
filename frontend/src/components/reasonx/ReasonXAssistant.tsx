import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  History,
  Maximize2,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  StopCircle,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";
import { ReasonXApprovalCard, type ApprovalRequestPayload } from "./ReasonXApprovalCard";
import { ReasonXCompactInput } from "./ReasonXCompactInput";
import { ReasonXConversationHistory, type ConversationSummary } from "./ReasonXConversationHistory";
import { ReasonXEvidencePanel, type EvidenceItem } from "./ReasonXEvidencePanel";
import { ReasonXLauncher } from "./ReasonXLauncher";
import { ReasonXModelIndicator } from "./ReasonXModelIndicator";
import { ReasonXTaskTimeline, type TaskStepItem } from "./ReasonXTaskTimeline";
import { ReasonXTemplateGallery } from "./ReasonXTemplateGallery";

interface StructuredPayload {
  direct_answer?: string;
  explanation?: string;
  supporting_evidence?: EvidenceItem[];
  recommended_actions?: string[];
  confidence_level?: "HIGH" | "MEDIUM" | "QUALIFIED";
  simplified_summary?: string;
  task_id?: number;
  task_type?: string;
  status?: string;
  plan?: Array<{ step: number; title: string; tool?: string; status?: string }>;
  steps?: TaskStepItem[];
  approval_request?: ApprovalRequestPayload;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  structured_payload?: StructuredPayload | null;
  created_at: string;
  model?: string;
  provider?: string;
}

function getPageName(pathname: string): string {
  if (pathname === "/") return "dashboard";
  if (pathname.includes("intelligence-report")) return "intelligence_report";
  if (pathname.includes("requirements")) return "requirements";
  if (pathname.includes("acceptance-criteria")) return "acceptance-criteria";
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
    case "acceptance-criteria":
      return "BDD & Criteria";
    case "validation":
      return "Policy Validation";
    case "tests":
      return "Test Design & BDD";
    case "executions":
      return "Execution Intelligence";
    case "defects":
      return "Defects & RCA";
    case "traceability":
      return "Traceability Matrix";
    case "dashboard":
      return "Executive Command";
    default:
      return "Autonomous Agent";
  }
}

export function ReasonXAssistant() {
  const qc = useQueryClient();
  const location = useLocation();
  const { current: activeProject, projectId } = useProjects();
  const effectiveProjectId = projectId || (activeProject ? activeProject.id : 5);
  const pageContext = getPageName(location.pathname);

  // Layout & Mode State
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"compact" | "drawer" | "expanded" | "fullscreen">("drawer");
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("tracetest.reasonx.width");
      return saved ? Math.min(Math.max(Number(saved), 380), 920) : 480;
    } catch {
      return 480;
    }
  });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 380 && newWidth <= 920) {
        setPanelWidth(newWidth);
        try {
          localStorage.setItem("tracetest.reasonx.width", String(newWidth));
        } catch {
          /* ignore */
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Query: Conversations list for active project
  const convsQ = useQuery({
    queryKey: ["reasonx_conversations", effectiveProjectId],
    queryFn: () => api.get<{ conversations: ConversationSummary[] }>(`/reasonx/projects/${effectiveProjectId}/conversations`),
    enabled: Boolean(effectiveProjectId) && isOpen,
  });

  // Query: Messages for active conversation
  const msgsQ = useQuery({
    queryKey: ["reasonx_messages", activeConvId],
    queryFn: () => api.get<{ messages: ChatMessage[] }>(`/reasonx/conversations/${activeConvId}/messages`),
    enabled: Boolean(activeConvId),
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgsQ.data, isOpen]);

  // Mutation: Send chat query
  const sendM = useMutation({
    mutationFn: (queryText: string) =>
      api.post<any>("/reasonx/chat", {
        project_id: effectiveProjectId,
        query: queryText,
        page: pageContext,
        conversation_id: activeConvId,
      }),
    onSuccess: (data) => {
      if (!activeConvId && data.conversation_id) {
        setActiveConvId(data.conversation_id);
      }
      qc.invalidateQueries({ queryKey: ["reasonx_conversations", effectiveProjectId] });
      qc.invalidateQueries({ queryKey: ["reasonx_messages", data.conversation_id || activeConvId] });
      qc.invalidateQueries({ queryKey: ["reasonx_tasks", effectiveProjectId] });
    },
  });

  // Mutation: Approve task action
  const approveM = useMutation({
    mutationFn: (taskId: number) => api.post(`/reasonx/tasks/${taskId}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reasonx_messages", activeConvId] });
      qc.invalidateQueries({ queryKey: ["reasonx_tasks", effectiveProjectId] });
      qc.invalidateQueries({ queryKey: ["defects"] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
  });

  // Mutation: Cancel task action
  const cancelM = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: number; reason?: string }) =>
      api.post(`/reasonx/tasks/${taskId}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reasonx_messages", activeConvId] });
      qc.invalidateQueries({ queryKey: ["reasonx_tasks", effectiveProjectId] });
    },
  });

  // Mutation: Delete conversation
  const deleteM = useMutation({
    mutationFn: (convId: number) => api.delete(`/reasonx/conversations/${convId}`),
    onSuccess: (_, deletedId) => {
      if (activeConvId === deletedId) {
        setActiveConvId(null);
      }
      qc.invalidateQueries({ queryKey: ["reasonx_conversations", effectiveProjectId] });
    },
  });

  const handleSend = (overrideQuery?: string) => {
    const q = (overrideQuery || inputVal).trim();
    if (!q || sendM.isPending) return;
    setInputVal("");
    if (mode === "compact") {
      setMode("drawer");
    }
    setIsOpen(true);
    sendM.mutate(q);
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const msgs = msgsQ.data?.messages || [];
    if (msgs.length === 0) return;
    let md = `# ReasonX AI Quality Intelligence Report\n**Project:** ${activeProject?.name || "TraceTest"}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;
    msgs.forEach((m) => {
      md += `### ${m.role === "user" ? "👤 User Query" : "🤖 ReasonX AI Agent"}\n\n${m.content}\n\n`;
      if (m.structured_payload?.supporting_evidence?.length) {
        md += `#### Statutory & Grounding Evidence:\n`;
        m.structured_payload.supporting_evidence.forEach((ev) => {
          md += `- **${ev.source_document || "Source"}** (p. ${ev.page || 1}): "${ev.quote || ""}"\n`;
        });
        md += `\n`;
      }
    });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ReasonX_Report_${activeProject?.key || "TRACETEST"}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const messages: ChatMessage[] = msgsQ.data?.messages || [];
  const conversations: ConversationSummary[] = convsQ.data?.conversations || [];

  return (
    <>
      {/* 1. Floating ReasonX Launcher Emblem */}
      <ReasonXLauncher
        isOpen={isOpen}
        onToggle={() => {
          if (isOpen && mode === "compact") {
            setMode("drawer");
          } else {
            setIsOpen(!isOpen);
          }
        }}
        isRunning={sendM.isPending}
      />

      {/* 2. Compact Single-Input Bar Mode */}
      {isOpen && mode === "compact" && (
        <ReasonXCompactInput
          onSubmit={(q) => handleSend(q)}
          onExpand={() => setMode("drawer")}
          onDismiss={() => setIsOpen(false)}
          projectName={activeProject?.name}
          isPending={sendM.isPending}
        />
      )}

      {/* 3. Full / Resizable Agent Workspace Panel */}
      {isOpen && mode !== "compact" && (
        <div
          role="dialog"
          aria-label="ReasonX AI Autonomous Quality Engineering Workspace"
          style={{
            width: mode === "fullscreen" ? "100vw" : mode === "expanded" ? "760px" : `${panelWidth}px`,
          }}
          className={cn(
            "fixed top-0 right-0 z-50 flex h-[100dvh] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-[width] duration-200 ease-out",
            mode === "fullscreen" && "z-[60] inset-0 border-l-0",
            isResizing && "select-none transition-none"
          )}
        >
          {/* Accessible Drag-to-Resize Handle on Left Edge (Drawer Modes) */}
          {mode !== "fullscreen" && (
            <div
              onMouseDown={handleMouseDown}
              title="Drag to resize panel width"
              className={cn(
                "absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-blue-500/40 transition-colors z-20 group",
                isResizing && "bg-blue-600"
              )}
            >
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-8 w-1 rounded-full bg-slate-300 group-hover:bg-blue-600" />
            </div>
          )}

          {/* Premium Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#2563EB] text-white shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">ReasonX AI</h2>
                  <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wide">
                    {getContextBadge(pageContext)}
                  </span>
                </div>
                <p className="truncate text-2xs text-slate-500 mt-0.5">
                  Project Scope: <strong className="text-slate-700 font-semibold">{activeProject?.name || "Global Workspace"}</strong>
                </p>
              </div>
            </div>

            {/* Header Window & Conversation Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                title="Conversation history"
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  historyOpen ? "bg-blue-50 text-[#1D4ED8]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                <History className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveConvId(null);
                  setHistoryOpen(false);
                }}
                title="New conversation"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  title="Export conversation as Markdown"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}

              {/* Mode Toggle: Drawer / Expanded / Fullscreen / Compact */}
              <button
                type="button"
                onClick={() => setMode(mode === "drawer" ? "expanded" : mode === "expanded" ? "fullscreen" : "drawer")}
                title={mode === "drawer" ? "Expand drawer" : mode === "expanded" ? "Fullscreen" : "Standard drawer"}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                {mode === "fullscreen" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setMode("compact")}
                title="Minimize to compact bar"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors text-xs font-mono"
              >
                —
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close ReasonX (Alt+R)"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Model & Security Banner */}
          <div className="flex items-center justify-between border-b border-slate-200/60 bg-white px-4 py-1.5 text-2xs text-slate-500">
            <ReasonXModelIndicator
              model="gemini-3.8-flash"
              provider="gemini"
              workflowStage={sendM.isPending ? "Autonomous Synthesis" : undefined}
            />
            <span className="text-[10px] text-slate-400 font-mono">Dual-Control Governed</span>
          </div>

          {/* Main Workspace Body */}
          <div className="relative flex-1 overflow-hidden flex flex-col">
            {/* Conversation History Popover Drawer */}
            {historyOpen && (
              <ReasonXConversationHistory
                conversations={conversations}
                activeId={activeConvId}
                onSelect={(id) => setActiveConvId(id)}
                onNew={() => {
                  setActiveConvId(null);
                  setHistoryOpen(false);
                }}
                onDelete={(id) => deleteM.mutate(id)}
                onClose={() => setHistoryOpen(false)}
              />
            )}

            {/* Conversation Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="py-6 space-y-4">
                  {/* Empty State Welcome Card */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1D4ED8]">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 tracking-tight">
                      Autonomous Quality Engineering Agent
                    </h3>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                      ReasonX can investigate test failures, formulate regression plans, identify coverage gaps, and safely draft or commit quality engineering records.
                    </p>
                  </div>

                  {/* Context-Aware Default Template Actions */}
                  <div>
                    <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                      Recommended Quality Actions for {activeProject?.name || "Workspace"}
                    </h4>
                    <ReasonXTemplateGallery onSelect={(q) => handleSend(q)} />
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
                        "rounded-2xl p-4 text-xs leading-relaxed shadow-xs transition-all",
                        m.role === "user"
                          ? "bg-[#1D4ED8] text-white rounded-br-xs max-w-[85%]"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs w-full max-w-full"
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {/* 1. Direct Answer Highlight */}
                          {m.structured_payload?.direct_answer && (
                            <div className="rounded-xl bg-blue-50/80 border-l-4 border-[#1D4ED8] p-3 text-slate-900 font-semibold text-xs leading-snug">
                              {m.structured_payload.direct_answer}
                            </div>
                          )}

                          {/* 2. Agent Task Timeline (Real Executed Plan & Tool Latencies) */}
                          {m.structured_payload?.plan && (
                            <ReasonXTaskTimeline
                              plan={m.structured_payload.plan}
                              steps={m.structured_payload.steps}
                              taskType={m.structured_payload.task_type}
                              currentStatus={m.structured_payload.status}
                            />
                          )}

                          {/* 3. Detailed Explanation with Markdown/Tables */}
                          <div className="text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                            {m.structured_payload?.explanation || m.content}
                          </div>

                          {/* 4. Interactive Human-in-the-Loop Approval Card (Level 3/4) */}
                          {m.structured_payload?.approval_request && (
                            <ReasonXApprovalCard
                              request={m.structured_payload.approval_request}
                              onApprove={async (tId) => {
                                await approveM.mutateAsync(tId);
                              }}
                              onReject={async (tId) => {
                                await cancelM.mutateAsync({ taskId: tId });
                              }}
                            />
                          )}

                          {/* 5. Supporting Evidence & Document Provenance Panel */}
                          {m.structured_payload?.supporting_evidence && (
                            <ReasonXEvidencePanel
                              evidence={m.structured_payload.supporting_evidence}
                              projectId={effectiveProjectId}
                            />
                          )}

                          {/* 6. Actionable Recommendations Checklist */}
                          {m.structured_payload?.recommended_actions && m.structured_payload.recommended_actions.length > 0 && (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-1.5">
                              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                                Recommended Operational Actions
                              </span>
                              {m.structured_payload.recommended_actions.map((act, ai) => (
                                <div key={ai} className="text-2xs text-slate-800 flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                                  <span>{act}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Footer: Confidence Level & Copy Button */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-2xs text-slate-500">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {m.structured_payload?.confidence_level || "HIGH"} CONFIDENCE
                            </span>
                            <button
                              type="button"
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

              {/* Live Task Processing Indicator */}
              {sendM.isPending && (
                <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#1D4ED8]">
                    <Sparkles className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-3.5 shadow-xs space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-900 font-semibold">
                      <span>ReasonX is executing autonomous workflow</span>
                      <span className="flex gap-1 items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse delay-100" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1D4ED8] animate-pulse delay-200" />
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500">
                      Querying authentic project records, calculating metrics, and synthesizing grounded findings...
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Message Composer */}
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
                  placeholder="Ask ReasonX to investigate, plan, or execute... (Enter to send, Shift+Enter for newline)"
                  disabled={sendM.isPending}
                  className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex items-center gap-1 shrink-0">
                  {sendM.isPending ? (
                    <button
                      type="button"
                      onClick={() => qc.cancelQueries({ queryKey: ["reasonx_chat"] })}
                      title="Stop generation"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                    >
                      <StopCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputVal.trim() || sendM.isPending}
                      title="Send query"
                      aria-label="Send query"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D4ED8] text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1">
                <span>Grounded in active project evidence</span>
                <span>Alt+R to toggle</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
