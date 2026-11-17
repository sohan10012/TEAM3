import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Send,
  StopCircle,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ReasonXMark } from "@/components/brand/ReasonXMark";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import { cn } from "@/utils/format";
import { ReasonXApprovalCard, type ApprovalRequestPayload } from "./ReasonXApprovalCard";
import { ReasonXCompactInput } from "./ReasonXCompactInput";
import { ReasonXConversationHistory, type ConversationSummary } from "./ReasonXConversationHistory";
import { ReasonXEvidencePanel, type EvidenceItem } from "./ReasonXEvidencePanel";
import { ReasonXLauncher } from "./ReasonXLauncher";
import { ReasonXMarkdown } from "./ReasonXMarkdown";
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

function getCsrfToken(): string {
  const m = document.cookie.match(/(?:^|; )tt_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
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

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticUserQuery, setOptimisticUserQuery] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [streamingPlan, setStreamingPlan] = useState<Array<{ step: number; title: string; tool?: string; status?: string }>>([]);
  const [streamingSteps, setStreamingSteps] = useState<TaskStepItem[]>([]);
  const [streamingApproval, setStreamingApproval] = useState<ApprovalRequestPayload | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Resize handler for desktop drawer
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

  // Query: Conversations list for active project (persisted backend records only)
  const convsQ = useQuery({
    queryKey: ["reasonx_conversations", effectiveProjectId],
    queryFn: () =>
      api.get<{ conversations: ConversationSummary[] }>(
        `/reasonx/projects/${effectiveProjectId}/conversations`
      ),
    enabled: Boolean(effectiveProjectId) && isOpen,
  });

  // Query: Messages for active conversation
  const msgsQ = useQuery({
    queryKey: ["reasonx_messages", activeConvId],
    queryFn: () =>
      api.get<{ messages: ChatMessage[] }>(
        `/reasonx/conversations/${activeConvId}/messages`
      ),
    enabled: Boolean(activeConvId),
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgsQ.data, isOpen, streamingContent, streamingStage]);

  // Mutation: Fallback non-streaming chat query
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

  // Primary: SSE Streaming Chat Handler
  const executeStreamingChat = async (queryText: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setOptimisticUserQuery(queryText);
    setStreamingContent("");
    setStreamingStage("Initializing ReasonX...");
    setStreamingPlan([]);
    setStreamingSteps([]);
    setStreamingApproval(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const csrf = getCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;

      const res = await fetch("/api/v1/reasonx/chat/stream", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          project_id: effectiveProjectId,
          query: queryText,
          page: pageContext,
          conversation_id: activeConvId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Streaming failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream available");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData += line.slice(6);
            }
          }

          if (eventData) {
            try {
              const data = JSON.parse(eventData);

              if (eventType === "thinking") {
                setStreamingStage(data.detail || data.stage);
              } else if (eventType === "task_plan") {
                setStreamingPlan(data.plan || []);
                if (!activeConvId && data.conversation_id) {
                  setActiveConvId(data.conversation_id);
                }
              } else if (eventType === "step_start") {
                setStreamingPlan((prev) =>
                  prev.map((p) =>
                    p.step === data.step_number ? { ...p, status: "running" } : p
                  )
                );
                setStreamingStage(`Executing step: ${data.title}`);
              } else if (eventType === "step_complete") {
                setStreamingPlan((prev) =>
                  prev.map((p) =>
                    p.step === data.step_number ? { ...p, status: data.status || "completed" } : p
                  )
                );
                setStreamingSteps((prev) => [
                  ...prev,
                  {
                    step_number: data.step_number,
                    title: data.title,
                    status: data.status || "completed",
                    tool: data.tool,
                    elapsed_ms: data.elapsed_ms,
                    error: data.error,
                  },
                ]);
              } else if (eventType === "token") {
                setStreamingContent((prev) => prev + (data.content || ""));
              } else if (eventType === "awaiting_approval") {
                setStreamingApproval(data);
              } else if (eventType === "done") {
                if (!activeConvId && data.conversation_id) {
                  setActiveConvId(data.conversation_id);
                }
                qc.invalidateQueries({ queryKey: ["reasonx_conversations", effectiveProjectId] });
                qc.invalidateQueries({
                  queryKey: ["reasonx_messages", data.conversation_id || activeConvId],
                });
                qc.invalidateQueries({ queryKey: ["reasonx_tasks", effectiveProjectId] });
                setIsStreaming(false);
                setOptimisticUserQuery(null);
                setStreamingContent("");
                setStreamingStage(null);
                return;
              } else if (eventType === "error") {
                throw new Error(data.error || "Streaming agent error");
              }
            } catch (err: any) {
              if (err.name === "AbortError") return;
              console.warn("SSE JSON parse error:", err);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setIsStreaming(false);
        setStreamingStage(null);
        return;
      }
      console.warn("Streaming connection dropped, falling back to standard API:", err);
      // Fallback to standard HTTP post if SSE stream encounters error
      sendM.mutate(queryText);
    } finally {
      setIsStreaming(false);
      setStreamingStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleSend = (overrideQuery?: string) => {
    const q = (overrideQuery || inputVal).trim();
    if (!q || isStreaming || sendM.isPending) return;
    setInputVal("");
    if (mode === "compact") {
      setMode("drawer");
    }
    setIsOpen(true);
    executeStreamingChat(q);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingStage(null);
    qc.invalidateQueries({ queryKey: ["reasonx_conversations", effectiveProjectId] });
    qc.invalidateQueries({ queryKey: ["reasonx_messages", activeConvId] });
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const msgs = msgsQ.data?.messages || [];
    if (msgs.length === 0) return;
    let md = `# ReasonX Quality Intelligence Report\n**Project:** ${activeProject?.name || "TraceTest"}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;
    msgs.forEach((m) => {
      md += `### ${m.role === "user" ? "Query" : "ReasonX Response"}\n\n${m.content}\n\n`;
      if (m.structured_payload?.supporting_evidence?.length) {
        md += `#### Supporting Evidence:\n`;
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
  const isAgentWorking = isStreaming || sendM.isPending;

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
        isRunning={isAgentWorking}
      />

      {/* 2. Compact Single-Input Bar Mode */}
      {isOpen && mode === "compact" && (
        <ReasonXCompactInput
          onSubmit={(q) => handleSend(q)}
          onExpand={() => setMode("drawer")}
          onDismiss={() => setIsOpen(false)}
          projectName={activeProject?.name}
          isPending={isAgentWorking}
        />
      )}

      {/* 3. Full / Resizable Agent Workspace Drawer */}
      {isOpen && mode !== "compact" && (
        <div
          role="dialog"
          aria-label="ReasonX Workspace"
          style={{
            width: mode === "fullscreen" ? "100vw" : mode === "expanded" ? "760px" : `${panelWidth}px`,
          }}
          className={cn(
            "fixed top-0 right-0 z-50 flex h-[100dvh] flex-col border-l border-slate-200 bg-white shadow-2xl transition-[width] duration-200 ease-out",
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
                "absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize hover:bg-slate-400/40 transition-colors z-20 group",
                isResizing && "bg-slate-600"
              )}
            >
              <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-8 w-1 rounded-full bg-slate-300 group-hover:bg-slate-600" />
            </div>
          )}

          {/* Redesigned Compact Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
            {/* Left: Original ReasonX Mark + Restrained Product Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <ReasonXMark size={28} />
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight select-none">
                ReasonX
              </h2>
            </div>

            {/* Right: Window & Conversation Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveConvId(null);
                  setHistoryOpen(false);
                }}
                title="New conversation"
                aria-label="New conversation"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                title="Conversation history"
                aria-label="Conversation history"
                className={cn(
                  "rounded-lg p-2 transition-colors cursor-pointer",
                  historyOpen
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <History className="h-4 w-4" />
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  title="Export conversation as Markdown"
                  aria-label="Export conversation as Markdown"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}

              {/* Mode Toggle: Drawer / Expanded */}
              <button
                type="button"
                onClick={() =>
                  setMode(mode === "drawer" ? "expanded" : mode === "expanded" ? "fullscreen" : "drawer")
                }
                title={mode === "drawer" ? "Expand drawer" : "Standard drawer"}
                aria-label={mode === "drawer" ? "Expand drawer" : "Standard drawer"}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {mode === "drawer" ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close ReasonX (Alt+R)"
                aria-label="Close ReasonX"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main Workspace Body */}
          <div className="relative flex-1 overflow-hidden flex flex-col bg-white">
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
                isLoading={convsQ.isLoading}
                isError={convsQ.isError}
                onRetry={() => convsQ.refetch()}
              />
            )}

            {/* Conversation Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 && !isStreaming ? (
                <div className="py-2">
                  <ReasonXTemplateGallery onSelect={(q) => handleSend(q)} />
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
                        "rounded-2xl p-4 text-xs leading-relaxed shadow-2xs transition-all",
                        m.role === "user"
                          ? "bg-slate-900 text-white rounded-br-xs max-w-[85%]"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs w-full max-w-full"
                      )}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {/* 1. Direct Answer Highlight */}
                          {m.structured_payload?.direct_answer && (
                            <div className="rounded-lg bg-blue-50 border-l-2 border-blue-600 p-2.5 text-slate-900 font-medium text-xs leading-snug">
                              {m.structured_payload.direct_answer}
                            </div>
                          )}

                          {/* 2. Task Timeline */}
                          {m.structured_payload?.plan && (
                            <ReasonXTaskTimeline
                              plan={m.structured_payload.plan}
                              steps={m.structured_payload.steps}
                              taskType={m.structured_payload.task_type}
                              currentStatus={m.structured_payload.status}
                            />
                          )}

                          {/* 3. Detailed Explanation with Markdown */}
                          <ReasonXMarkdown
                            content={m.structured_payload?.explanation || m.content}
                          />

                          {/* 4. Human-in-the-Loop Approval Card */}
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

                          {/* 5. Supporting Evidence Panel */}
                          {m.structured_payload?.supporting_evidence && (
                            <ReasonXEvidencePanel
                              evidence={m.structured_payload.supporting_evidence}
                              projectId={effectiveProjectId}
                            />
                          )}

                          {/* 6. Actionable Recommendations Checklist */}
                          {m.structured_payload?.recommended_actions &&
                            m.structured_payload.recommended_actions.length > 0 && (
                              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-1.5">
                                <span className="text-[10px] font-semibold text-emerald-900 uppercase tracking-wider block">
                                  Recommended Actions
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
                            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {m.structured_payload?.confidence_level || "HIGH"} Confidence
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(m.id, m.content)}
                              className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors font-medium cursor-pointer"
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

              {/* Live Streaming Message Display */}
              {isStreaming && (
                <>
                  {/* Optimistic User Query Bubble */}
                  {optimisticUserQuery && (
                    <div className="flex flex-col space-y-1.5 items-end animate-in fade-in duration-150">
                      <div className="rounded-2xl p-4 text-xs leading-relaxed shadow-2xs bg-slate-900 text-white rounded-br-xs max-w-[85%]">
                        <p className="whitespace-pre-wrap">{optimisticUserQuery}</p>
                      </div>
                    </div>
                  )}

                  {/* Active Streaming Assistant Response Card */}
                  <div className="flex flex-col space-y-1.5 items-start animate-in fade-in duration-200">
                    <div className="rounded-2xl p-4 text-xs leading-relaxed shadow-2xs bg-white border border-slate-200 text-slate-800 rounded-bl-xs w-full max-w-full space-y-3">
                      {/* Live Stage Status Progress Pill */}
                      {streamingStage && !streamingContent && (
                        <div className="flex items-center gap-2 text-xs text-slate-700 font-medium py-1">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                          <span>{streamingStage}</span>
                        </div>
                      )}

                      {/* Progressive Plan Timeline */}
                      {streamingPlan.length > 0 && (
                        <ReasonXTaskTimeline
                          plan={streamingPlan}
                          steps={streamingSteps}
                          currentStatus={streamingContent ? "completed" : "running"}
                        />
                      )}

                      {/* Live Token Stream with High-Craft Markdown Formatting */}
                      {streamingContent && (
                        <ReasonXMarkdown content={streamingContent} isStreaming={true} />
                      )}

                      {/* Progressive Approval Card */}
                      {streamingApproval && (
                        <ReasonXApprovalCard
                          request={streamingApproval}
                          onApprove={async (tId) => {
                            await approveM.mutateAsync(tId);
                          }}
                          onReject={async (tId) => {
                            await cancelM.mutateAsync({ taskId: tId });
                          }}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Fallback Non-Streaming Live Task Processing Indicator */}
              {sendM.isPending && !isStreaming && (
                <div className="flex items-start gap-2.5 animate-in fade-in duration-200">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                  </div>
                  <div className="rounded-2xl rounded-bl-xs border border-slate-200 bg-white p-3.5 shadow-2xs space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-900 font-medium">
                      <span>ReasonX is processing your request</span>
                      <span className="flex gap-1 items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse delay-100" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse delay-200" />
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500">
                      Analyzing project records, inspecting relevant evidence, and formulating response...
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
                className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/5 transition-all"
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
                  placeholder="Ask ReasonX a question..."
                  disabled={isAgentWorking}
                  className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex items-center gap-1 shrink-0">
                  {isAgentWorking ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      title="Stop generation"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      <StopCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputVal.trim() || isAgentWorking}
                      title="Send query"
                      aria-label="Send query"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs transition-colors hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-1.5 flex items-center justify-end text-[10px] text-slate-400 px-1">
                <span>Alt+R to toggle</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
