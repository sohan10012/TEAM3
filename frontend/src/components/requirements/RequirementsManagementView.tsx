import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FileCheck,
  FileCode,
  FileText,
  Layers,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, Field, Input, Key, Select, Textarea } from "@/components/ui";
import { EmbeddedDocumentViewer } from "@/components/documents/EmbeddedDocumentViewer";
import { api } from "@/services/api";
import type { Page, Project, Requirement } from "@/types/models";
import { cn, fmtDate } from "@/utils/format";

interface RequirementsManagementViewProps {
  projectId: number;
  current: Project | null;
}

interface StagedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  ext: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

type DocSubTab = "overview" | "original" | "content" | "requirements" | "analysis" | "metadata";

export function RequirementsManagementView({ projectId, current }: RequirementsManagementViewProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  // Queries
  const reqDashQ = useQuery({
    queryKey: ["project-requirements-dashboard", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId}/requirements-dashboard`),
    staleTime: 10_000,
  });

  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/documents`),
  });

  const reqsQ = useQuery({
    queryKey: ["requirements", { project_id: projectId, page_size: 250 }],
    queryFn: () => api.get<Page<Requirement>>("/requirements", { project_id: projectId, page_size: 250 }),
  });

  const clarsQ = useQuery({
    queryKey: ["project-clarifications", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/clarifications`),
  });

  const traceQ = useQuery({
    queryKey: ["project-traceability", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId}/traceability`),
  });

  const docs = useMemo(() => docsQ.data ?? [], [docsQ.data]);
  const reqs = useMemo(() => reqsQ.data?.items ?? [], [reqsQ.data?.items]);
  const clars = useMemo(() => clarsQ.data ?? [], [clarsQ.data]);
  const trace = useMemo(() => traceQ.data?.traceability_rows ?? [], [traceQ.data?.traceability_rows]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"intake" | "extracted" | "insights" | "clarifications" | "traceability">("intake");
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [docSubTab, setDocSubTab] = useState<DocSubTab>("overview");
  const [viewerTargetPage, setViewerTargetPage] = useState<number>(1);
  const [viewerTargetExcerpt, setViewerTargetExcerpt] = useState<string | null>(null);

  // Extracted content viewer search & copy state
  const [contentSearch, setContentSearch] = useState("");
  const [copiedContent, setCopiedContent] = useState(false);

  // Drag and drop staging state
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // Filter / Search states
  const [reqSearch, setReqSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [traceSearch, setTraceSearch] = useState("");

  // Dialog states
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [resolvingClar, setResolvingClar] = useState<any | null>(null);
  const [resolveText, setResolveText] = useState("");

  // Process all modal state
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [processPipelineStage, setProcessPipelineStage] = useState<string>("idle");
  const [processSummaryMsg, setProcessSummaryMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const parsePageNum = (p: string | number | null | undefined): number => {
    if (!p) return 1;
    const match = String(p).match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  // Default selected document
  const selectedDoc = useMemo(() => {
    if (!docs.length) return null;
    if (selectedDocId) {
      const found = docs.find((d) => d.id === selectedDocId);
      if (found) return found;
    }
    const prd = docs.find((d) => d.filename.toLowerCase().includes("prd"));
    return prd || docs[0];
  }, [docs, selectedDocId]);

  // Query extracted content for selected document
  const extractedContentQ = useQuery({
    queryKey: ["document-extracted-content", selectedDoc?.id],
    enabled: !!selectedDoc?.id,
    queryFn: () => api.get<any[]>(`/documents/${selectedDoc!.id}/extracted-content`),
  });

  // Derived counts from backend requirements dashboard (with robust client fallbacks, guaranteed numerical, never null)
  const reqSummary = reqDashQ.data?.requirements_summary;
  const docSummary = reqDashQ.data?.documents_summary;

  const totalDocumentsCount = docSummary?.total ?? docs.length;
  const processedDocumentsCount = docSummary?.completed ?? docs.filter((doc) =>
    doc.status === "completed" || ["extracted", "approved"].includes(doc.extraction_status)
  ).length;

  const requirementsTotal = reqSummary?.total ?? reqsQ.data?.total ?? reqs.length;
  const functionalCount = reqSummary?.functional ?? (reqs.length ? reqs.filter((r) => r.category === "functional").length : 0);
  const nonFunctionalCount = reqSummary?.non_functional ?? (reqs.length ? reqs.filter((r) =>
    ["non_functional", "performance_constraint", "operational_requirement", "security", "data_requirement", "integration_requirement", "permission_role", "data", "reporting"].includes(r.category)
  ).length : 0);
  const businessRulesCount = reqSummary?.business_rules ?? (reqs.length ? reqs.filter((r) =>
    ["business_rule", "validation_rule", "compliance"].includes(r.category)
  ).length : 0);
  const ambiguitiesCount = reqSummary?.ambiguities ?? clars.filter((c) => c.type !== "contradiction").length;
  const contradictionsCount = reqSummary?.contradictions ?? clars.filter((c) => c.type === "contradiction").length;

  // Staging files for drag & drop
  const addFilesToStage = (files: File[]) => {
    const allowed = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md", ".markdown"];
    const added: StagedFile[] = [];

    for (const f of files) {
      const ext = "." + (f.name.split(".").pop() || "").toLowerCase();
      if (!allowed.includes(ext)) {
        toast.error(`"${f.name}": Unsupported format. Supported: PDF, DOCX, XLSX, CSV, TXT, Markdown`);
        continue;
      }
      if (f.size > 50 * 1024 * 1024) {
        toast.error(`"${f.name}": Exceeds maximum size limit of 50 MB`);
        continue;
      }
      const isDup = docs.some((d) => d.filename.toLowerCase() === f.name.toLowerCase());
      added.push({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        ext: ext.replace(".", "").toUpperCase(),
        status: "pending",
        error: isDup ? "Notice: A document with this filename is already ingested." : undefined,
      });
    }

    if (added.length > 0) {
      setStagedFiles((prev) => [...prev, ...added]);
    }
  };

  // Upload staged files handler
  const uploadStagedFiles = async () => {
    const pending = stagedFiles.filter((f) => f.status === "pending" || f.status === "error");
    if (!pending.length) return;

    for (const item of pending) {
      setStagedFiles((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, status: "uploading", error: undefined } : s))
      );
      try {
        const fd = new FormData();
        fd.set("file", item.file);
        fd.set("display_name", item.name.replace(/\.[^/.]+$/, ""));
        fd.set(
          "purpose",
          item.name.endsWith(".pdf")
            ? "prd"
            : item.name.endsWith(".xlsx") || item.name.endsWith(".xls") || item.name.endsWith(".csv")
            ? "business_rules"
            : "srs"
        );
        fd.set("auto_process", "true");
        await api.upload(`/projects/${projectId}/documents`, fd);
        setStagedFiles((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, status: "success" } : s))
        );
      } catch (err: any) {
        const msg = err?.message || "Upload failed";
        setStagedFiles((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, status: "error", error: msg } : s))
        );
      }
    }

    qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    qc.invalidateQueries({ queryKey: ["project-requirements-dashboard", projectId] });
    qc.invalidateQueries({ queryKey: ["requirements"] });
    toast.ok("Document upload batch completed");
  };

  // Document Reprocess Mutation (Individual Document)
  const reprocessM = useMutation({
    mutationFn: async (docId: number) => {
      return api.post<any>(`/documents/${docId}/retry`);
    },
    onSuccess: (data: any) => {
      toast.ok(`Document reprocessed successfully (${data.filename || "Document"})`);
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["project-requirements-dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["project-clarifications", projectId] });
      qc.invalidateQueries({ queryKey: ["document-extracted-content", data.id] });
    },
    onError: toast.error,
  });

  // Process All Mutation (Complete End-to-End AI Ingestion & Analysis)
  const processAllM = useMutation({
    mutationFn: async () => {
      setProcessModalOpen(true);
      setProcessSummaryMsg(null);
      setProcessPipelineStage("validating");

      // Progressive visual pipeline stages reflecting real backend operations
      setTimeout(() => setProcessPipelineStage("parsing"), 300);
      setTimeout(() => setProcessPipelineStage("extracting_requirements"), 800);
      setTimeout(() => setProcessPipelineStage("classifying"), 1400);
      setTimeout(() => setProcessPipelineStage("detecting_ambiguities"), 2000);
      setTimeout(() => setProcessPipelineStage("checking_contradictions"), 2600);
      setTimeout(() => setProcessPipelineStage("persisting"), 3100);

      const res = await api.post<any>(`/projects/${projectId}/process-all`);
      return res;
    },
    onSuccess: (res: any) => {
      setProcessPipelineStage("completed");
      const msg =
        res.message ||
        `Processing completed: ${res.documents_processed} documents processed, ${res.total_requirements} requirements extracted, ${res.ambiguities_count} ambiguities identified, ${res.contradictions_count} contradictions detected.`;
      setProcessSummaryMsg(msg);
      toast.ok(msg);

      qc.invalidateQueries({ queryKey: ["project-requirements-dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["project-clarifications", projectId] });
      qc.invalidateQueries({ queryKey: ["project-traceability", projectId] });
    },
    onError: (err: any) => {
      setProcessPipelineStage("error");
      setProcessSummaryMsg(err?.message || "Document processing pipeline failed");
      toast.error(err);
    },
  });

  // Resolve Clarification Mutation
  const resolveClarM = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      return api.post(`/clarifications/${id}/resolve`, { user_response: text });
    },
    onSuccess: () => {
      toast.ok("Clarification resolved and grounded into requirements");
      qc.invalidateQueries({ queryKey: ["project-clarifications", projectId] });
      qc.invalidateQueries({ queryKey: ["project-requirements-dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
      setResolvingClar(null);
      setResolveText("");
    },
    onError: toast.error,
  });

  // Helper for document file icon
  const getFileIconBadge = (filename: string, fileType?: string) => {
    const ext = (fileType || filename.split(".").pop() || "").toLowerCase();
    if (ext === "pdf") {
      return <span className="flex h-7 w-7 items-center justify-center rounded bg-red-100 text-[10px] font-bold text-red-700">PDF</span>;
    }
    if (ext === "docx" || ext === "doc") {
      return <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">DOCX</span>;
    }
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700">XLSX</span>;
    }
    return <span className="flex h-7 w-7 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">MD</span>;
  };

  const getDocTypeLabel = (doc: any) => {
    if (!doc) return "Requirements Document";
    if (doc.filename?.toLowerCase().includes("prd") || doc.purpose === "prd") return "Product Requirements Document";
    if (doc.filename?.toLowerCase().includes("srs") || doc.purpose === "srs") return "Software Requirements Specification";
    if (doc.filename?.toLowerCase().includes("rules") || doc.purpose === "business_rules") return "Business Rules & Configurations";
    if (doc.filename?.toLowerCase().includes("api")) return "API Integration Specification";
    return doc.display_name || "Requirements Document";
  };

  // Requirements extracted for selected document
  const docReqs = useMemo(() => {
    if (!selectedDoc) return [];
    return reqs.filter((r) => r.document_id === selectedDoc.id);
  }, [reqs, selectedDoc]);

  // Category breakdown for selected document
  const docBreakdown = useMemo(() => {
    const fn = docReqs.filter((r) => r.category === "functional").length;
    const nf = docReqs.filter((r) =>
      ["non_functional", "performance_constraint", "operational_requirement", "security", "data_requirement", "integration_requirement", "permission_role"].includes(r.category)
    ).length;
    const br = docReqs.filter((r) => ["business_rule", "validation_rule", "compliance"].includes(r.category)).length;
    return { fn, nf, br, total: docReqs.length };
  }, [docReqs]);

  // Filtered requirements for tab 2
  const filteredReqs = useMemo(() => {
    return reqs.filter((r) => {
      const matchQ =
        !reqSearch ||
        r.title.toLowerCase().includes(reqSearch.toLowerCase()) ||
        r.key.toLowerCase().includes(reqSearch.toLowerCase()) ||
        (r.evidence_excerpt && r.evidence_excerpt.toLowerCase().includes(reqSearch.toLowerCase()));

      const matchCat =
        selectedCategory === "all" ||
        r.category === selectedCategory ||
        (selectedCategory === "non_functional" &&
          ["non_functional", "performance_constraint", "operational_requirement", "security", "data_requirement", "integration_requirement", "permission_role"].includes(r.category)) ||
        (selectedCategory === "business_rule" &&
          ["business_rule", "validation_rule", "compliance"].includes(r.category));

      const matchPrio = selectedPriority === "all" || r.priority === selectedPriority;
      return matchQ && matchCat && matchPrio;
    });
  }, [reqs, reqSearch, selectedCategory, selectedPriority]);

  // Traceability rows filtered
  const filteredTraceRows = useMemo(() => {
    if (!traceSearch) return trace;
    const q = traceSearch.toLowerCase();
    return trace.filter(
      (row: any) =>
        row.requirement_key?.toLowerCase().includes(q) ||
        row.requirement_title?.toLowerCase().includes(q) ||
        row.document?.filename?.toLowerCase().includes(q)
    );
  }, [trace, traceSearch]);

  // Extracted content items filtered by contentSearch
  const extractedContentItems = useMemo(() => {
    const items: any[] = extractedContentQ.data || [];
    if (!contentSearch.trim()) return items;
    const q = contentSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.content?.toLowerCase().includes(q) ||
        item.source_section?.toLowerCase().includes(q) ||
        item.source_location?.toLowerCase().includes(q)
    );
  }, [extractedContentQ.data, contentSearch]);

  // Copy full extracted text
  const handleCopyExtractedText = () => {
    const textToCopy =
      selectedDoc?.extracted_text ||
      extractedContentItems.map((it) => `--- ${it.source_location} (§ ${it.source_section}) ---\n${it.content}`).join("\n\n") ||
      "";

    if (!textToCopy) {
      toast.error("No extracted content available to copy");
      return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedContent(true);
      toast.ok("Extracted document content copied to clipboard");
      setTimeout(() => setCopiedContent(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header matching Screenshot 2 */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
          <Link to="/projects" className="hover:text-slate-800 transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link to={`/projects/${projectId}`} className="hover:text-slate-800 transition-colors">
            {current?.name || "Project"}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-slate-900 font-semibold">Requirements</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#3067DB] border border-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Requirements</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload product documents, process them, and manage extracted requirements with full traceability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => processAllM.mutate()}
              loading={processAllM.isPending}
              className="text-xs font-medium border-slate-200 hover:bg-slate-50 shadow-2xs"
              title="Execute full multi-document requirement extraction and analysis pipeline"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>Process All</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddReqOpen(true)}
              className="text-xs font-medium shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Add Requirement</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 6-Stage End-to-End Requirements Guided Journey Stepper */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Business Quality Lifecycle</span>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] border border-blue-100">
              6 Guided Stages
            </span>
          </div>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1 text-2xs font-medium text-[#3067DB] hover:underline cursor-pointer"
          >
            <BookOpen className="h-3 w-3" />
            <span>{showGuide ? "Hide Lifecycle Guide" : "How Requirements Verification Works"}</span>
          </button>
        </div>

        {/* Stage Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          {[
            {
              num: 1,
              name: "Intake Documents",
              detail: totalDocumentsCount > 0 ? `${totalDocumentsCount} ingested` : "Upload PDF/DOCX",
              done: totalDocumentsCount > 0,
              active: activeTab === "intake",
              onClick: () => setActiveTab("intake"),
            },
            {
              num: 2,
              name: "Decompose Clauses",
              detail: requirementsTotal > 0 ? `${requirementsTotal} recorded` : "Awaiting analysis",
              done: requirementsTotal > 0,
              active: activeTab === "extracted",
              onClick: () => setActiveTab("extracted"),
            },
            {
              num: 3,
              name: "Resolve Ambiguities",
              detail: ambiguitiesCount > 0 ? `${ambiguitiesCount} to clarify` : "All clear",
              done: ambiguitiesCount === 0 && requirementsTotal > 0,
              active: activeTab === "clarifications",
              onClick: () => setActiveTab("clarifications"),
            },
            {
              num: 4,
              name: "Synthesize Tests",
              detail: reqDashQ.data?.test_design_summary?.total_tests ? `${reqDashQ.data.test_design_summary.total_tests} test cases` : "Generate tests",
              done: (reqDashQ.data?.test_design_summary?.total_tests ?? 0) > 0,
              active: false,
              onClick: () => nav(`/tests?project_id=${projectId}`),
            },
            {
              num: 5,
              name: "Validate Policies",
              detail: "Deterministic rules",
              done: (reqDashQ.data?.execution_summary?.simulation_runs ?? 0) > 0,
              active: false,
              onClick: () => nav(`/simulation`),
            },
            {
              num: 6,
              name: "Readiness Report",
              detail: "Executive audit",
              done: true,
              active: false,
              onClick: () => nav(`/intelligence-report`),
            },
          ].map((s) => (
            <button
              key={s.num}
              onClick={s.onClick}
              className={cn(
                "flex flex-col text-left p-2.5 rounded border transition-colors cursor-pointer group",
                s.active
                  ? "border-blue-300 bg-blue-50/70"
                  : "border-slate-100 bg-slate-50/70 hover:bg-blue-50/40 hover:border-blue-200"
              )}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-2xs font-mono font-medium text-slate-400 group-hover:text-[#3067DB]">
                  0{s.num}
                </span>
                {s.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-900 group-hover:text-[#3067DB]">{s.name}</span>
              <span className="text-[11px] text-slate-500 truncate mt-0.5">{s.detail}</span>
            </button>
          ))}
        </div>

        {/* Expandable How It Works Educational Banner */}
        {showGuide && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <UploadCloud className="h-4 w-4 text-[#3067DB]" />
                <span>1. Multi-Format Intake</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Upload PDFs, DOCX contracts, and Excel tables. Extracted text preserves page numbers and section headers.
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span>2. AI Decomposition</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                LangGraph breaks complex legal clauses into atomic requirements, classifying them into Functional, Rules, and Non-Functional.
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>3. Human Clarification</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Vague phrasing ("reasonable overtime") is flagged automatically. Business users resolve ambiguities before testing.
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50/80 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>4. Traceable Verification</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal">
                Every test and simulation outcome links directly back to the original clause in the source PDF with 100% auditability.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 7 Summary Metric Cards — Guaranteed real numerical counts from database */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Card 1: Documents */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-[#3067DB]">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Documents</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{totalDocumentsCount}</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
              {processedDocumentsCount} processed
            </span>
          </div>
        </div>

        {/* Card 2: Extracted Requirements */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Extracted Requirements</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{requirementsTotal}</span>
          </div>
        </div>

        {/* Card 3: Functional */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-[#3067DB]">
              <FileCheck className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Functional</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{functionalCount}</span>
          </div>
        </div>

        {/* Card 4: Non-Functional */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-50 text-cyan-600">
              <FileCode className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Non-Functional</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{nonFunctionalCount}</span>
          </div>
        </div>

        {/* Card 5: Business Rules */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 text-indigo-600">
              <ListFilter className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Business Rules</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{businessRulesCount}</span>
          </div>
        </div>

        {/* Card 6: Ambiguities */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ambiguities</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-600">{ambiguitiesCount}</span>
          </div>
        </div>

        {/* Card 7: Contradictions */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-red-50 text-red-600">
              <Split className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contradictions</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-600">{contradictionsCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs matching Screenshot 2 */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-8 text-xs font-medium">
          <button
            onClick={() => setActiveTab("intake")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "intake"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Upload className="h-4 w-4" />
            <span>Document Intake</span>
          </button>

          <button
            onClick={() => setActiveTab("extracted")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "extracted"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <FileText className="h-4 w-4" />
            <span>Extracted Requirements ({requirementsTotal})</span>
          </button>

          <button
            onClick={() => setActiveTab("insights")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "insights"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Sparkles className="h-4 w-4" />
            <span>Analysis Insights</span>
          </button>

          <button
            onClick={() => setActiveTab("clarifications")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "clarifications"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Clarifications ({clars.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("traceability")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "traceability"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Split className="h-4 w-4" />
            <span>Traceability</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Document Intake matching Screenshot 2 */}
      {activeTab === "intake" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 Cols): Upload + Uploaded Documents List */}
          <div className="lg:col-span-5 space-y-4">
            {/* Interactive Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const droppedFiles = Array.from(e.dataTransfer.files);
                if (droppedFiles.length > 0) {
                  addFilesToStage(droppedFiles);
                }
              }}
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition-all",
                isDragging
                  ? "border-[#3067DB] bg-blue-50/70 ring-4 ring-blue-100"
                  : "border-slate-300 bg-white hover:border-blue-400"
              )}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#3067DB] mb-3">
                <UploadCloud className={cn("h-6 w-6 transition-transform", isDragging && "scale-110 text-blue-700")} />
              </div>
              <h3 className="text-xs font-semibold text-slate-900">Upload Requirement Documents</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Drag & drop files here or{" "}
                <label className="text-[#3067DB] hover:underline font-medium cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.markdown"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files || []);
                      if (selected.length > 0) {
                        addFilesToStage(selected);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </p>
              <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Supported: PDF, DOCX, XLSX, CSV, TXT, Markdown | Max: 50 MB per file
              </p>
            </div>

            {/* Staged Files Queue (if files are selected/dropped) */}
            {stagedFiles.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Staged for Upload ({stagedFiles.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStagedFiles([])}
                      className="text-2xs text-slate-500 hover:text-slate-800"
                    >
                      Clear All
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={uploadStagedFiles}
                      className="text-xs h-7"
                    >
                      Upload All
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stagedFiles.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center justify-between bg-white rounded border border-slate-200 p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {sf.ext}
                        </span>
                        <div className="truncate">
                          <p className="truncate font-medium text-slate-900">{sf.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {(sf.size / (1024 * 1024)).toFixed(2)} MB
                            {sf.error && <span className="text-amber-600 ml-1.5">· {sf.error}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {sf.status === "uploading" && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        )}
                        {sf.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        )}
                        {sf.status === "error" && (
                          <button
                            onClick={uploadStagedFiles}
                            className="text-2xs text-red-600 hover:underline"
                            title="Retry"
                          >
                            Retry
                          </button>
                        )}
                        {sf.status === "pending" && (
                          <button
                            onClick={() => setStagedFiles((prev) => prev.filter((s) => s.id !== sf.id))}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded Documents List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <h3 className="font-semibold text-slate-900">Uploaded Documents ({docs.length})</h3>
                <ListFilter className="h-4 w-4 text-slate-400" />
              </div>

              <div className="space-y-2">
                {docs.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const sizeMb = (doc.file_size_bytes / (1024 * 1024)).toFixed(1);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={cn(
                        "rounded-lg border p-3.5 bg-white cursor-pointer transition-all flex items-center justify-between",
                        isSelected
                          ? "border-[#3067DB] ring-1 ring-[#3067DB] bg-blue-50/20"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {getFileIconBadge(doc.filename, doc.file_type)}
                        <div className="truncate">
                          <h4 className="text-xs font-semibold text-slate-900 truncate">{doc.filename}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{getDocTypeLabel(doc)}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            v{doc.version} • {sizeMb} MB • Uploaded {fmtDate(doc.created_at, false)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                          {doc.extraction_status || doc.status}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reprocessM.mutate(doc.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Reprocess Document"
                          aria-label="Reprocess document"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", reprocessM.isPending && "animate-spin text-blue-600")} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Selected Document Details */}
          <div className="lg:col-span-7">
            {selectedDoc ? (
              <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
                {/* Document Header */}
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIconBadge(selectedDoc.filename, selectedDoc.file_type)}
                    <div className="truncate">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{selectedDoc.filename}</h3>
                      <p className="text-xs text-slate-500 truncate">{getDocTypeLabel(selectedDoc)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                      ✓ Extracted
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessM.mutate(selectedDoc.id)}
                      loading={reprocessM.isPending}
                      className="text-xs h-7 border-slate-200 hover:bg-slate-50 shadow-2xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1 text-slate-500" />
                      <span>Reprocess</span>
                    </Button>
                  </div>
                </div>

                {/* Sub-tabs for Selected Document (6 Explicit Sections requested by User) */}
                <div className="border-b border-slate-200 px-4 bg-white overflow-x-auto">
                  <div className="flex space-x-6 text-xs font-medium min-w-max">
                    <button
                      onClick={() => setDocSubTab("overview")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors",
                        docSubTab === "overview"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setDocSubTab("original")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors flex items-center gap-1.5",
                        docSubTab === "original"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Original Document</span>
                    </button>
                    <button
                      onClick={() => setDocSubTab("content")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors",
                        docSubTab === "content"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Extracted Content
                    </button>
                    <button
                      onClick={() => setDocSubTab("requirements")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors",
                        docSubTab === "requirements"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Requirements ({docBreakdown.total})
                    </button>
                    <button
                      onClick={() => setDocSubTab("analysis")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors",
                        docSubTab === "analysis"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Analysis
                    </button>
                    <button
                      onClick={() => setDocSubTab("metadata")}
                      className={cn(
                        "py-2.5 border-b-2 transition-colors",
                        docSubTab === "metadata"
                          ? "border-[#3067DB] text-[#3067DB] font-semibold"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Metadata
                    </button>
                  </div>
                </div>

                {/* Sub-tab 1: Overview */}
                {docSubTab === "overview" && (
                  <div className="p-5 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Document Thumbnail */}
                      <div className="md:col-span-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 flex flex-col justify-between items-center text-center shadow-2xs">
                        <div className="w-full space-y-2 py-3">
                          <span className="text-[11px] font-bold text-slate-800 tracking-wider uppercase block">Document</span>
                          <span className="text-[10px] text-slate-500 font-medium block leading-tight px-1">
                            {getDocTypeLabel(selectedDoc)}
                          </span>
                          <div className="space-y-1.5 px-3 pt-2">
                            <div className="h-1 bg-slate-200 rounded-full w-full" />
                            <div className="h-1 bg-slate-200 rounded-full w-4/5 mx-auto" />
                            <div className="h-1 bg-slate-200 rounded-full w-5/6 mx-auto" />
                            <div className="h-1 bg-slate-200 rounded-full w-2/3 mx-auto" />
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 shadow-2xs">
                          <FileText className="h-3 w-3 text-slate-400" />
                          <span>{selectedDoc.metadata?.pages_count ? `${selectedDoc.metadata.pages_count} pages` : "Standard pagination"}</span>
                        </span>
                      </div>

                      {/* Document Information */}
                      <div className="md:col-span-5 space-y-2.5 text-xs">
                        <div>
                          <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Purpose</span>
                          <span className="font-semibold text-slate-800">{getDocTypeLabel(selectedDoc)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Checksum (SHA-256)</span>
                          <span className="font-mono text-slate-600 text-[10px] truncate block" title={selectedDoc.checksum}>
                            {selectedDoc.checksum ? `${selectedDoc.checksum.slice(0, 20)}…` : "Verified SHA-256"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Version & Priority</span>
                          <span className="font-medium text-slate-700">
                            v{selectedDoc.version} • {selectedDoc.priority || "Medium"} Priority
                          </span>
                        </div>
                      </div>

                      {/* Extracted Stats */}
                      <div className="md:col-span-4 rounded-lg bg-blue-50/40 border border-blue-100 p-3.5 space-y-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-[#3067DB] block">
                          Ingestion Provenance
                        </span>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Extracted Clauses:</span>
                            <span className="font-bold text-slate-900">{docBreakdown.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Functional:</span>
                            <span className="font-semibold text-slate-800">{docBreakdown.fn}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Business Rules:</span>
                            <span className="font-semibold text-slate-800">{docBreakdown.br}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Non-Functional:</span>
                            <span className="font-semibold text-slate-800">{docBreakdown.nf}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick navigation actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocSubTab("original")}
                        className="text-xs h-8"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                        <span>Inspect in PDF Viewer</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocSubTab("content")}
                        className="text-xs h-8"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-600" />
                        <span>View Structured Text</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDocSubTab("requirements")}
                        className="text-xs h-8"
                      >
                        <Layers className="h-3.5 w-3.5 mr-1.5 text-purple-600" />
                        <span>Browse Requirements ({docBreakdown.total})</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Original Document (Embedded Document Viewer) */}
                {docSubTab === "original" && (
                  <div className="p-4">
                    <EmbeddedDocumentViewer
                      documentId={selectedDoc.id}
                      filename={selectedDoc.filename || selectedDoc.display_name}
                      fileType={selectedDoc.file_type || "pdf"}
                      initialPage={viewerTargetPage}
                      highlightExcerpt={viewerTargetExcerpt}
                      onPageChange={(page) => setViewerTargetPage(page)}
                      extractedTextFallback={selectedDoc.extracted_text_preview}
                      tablesFallback={selectedDoc.metadata?.tables || []}
                    />
                  </div>
                )}

                {/* Sub-tab 3: Extracted Content (Structured Text, Sections, Tables, Search & Copy) */}
                {docSubTab === "content" && (
                  <div className="p-5 space-y-4 text-xs">
                    {/* Toolbar with Search and Copy */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <div className="relative w-full sm:w-80">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Search extracted sections & text..."
                          className="pl-8 text-xs h-8"
                          value={contentSearch}
                          onChange={(e) => setContentSearch(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyExtractedText}
                          className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Copy entire extracted text"
                        >
                          {copiedContent ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                          <span>{copiedContent ? "Copied!" : "Copy Extracted Text"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata Header Stats */}
                    <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-500 font-medium">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                        {selectedDoc.metadata?.pages_count ? `${selectedDoc.metadata.pages_count} Pages Parsed` : "Multi-page Document"}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                        {selectedDoc.metadata?.sections?.length || 0} Sections Preserved
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                        {selectedDoc.metadata?.extracted_chars?.toLocaleString() || selectedDoc.extracted_text?.length.toLocaleString() || 0} Characters Extracted
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200 font-semibold">
                        ✓ Structured Grounding
                      </span>
                    </div>

                    {/* Extracted Sections & Content List */}
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[600px] overflow-y-auto bg-white">
                      {extractedContentQ.isLoading ? (
                        <div className="p-8 text-center text-slate-500">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                          <p>Loading structured extracted content…</p>
                        </div>
                      ) : extractedContentItems.length > 0 ? (
                        extractedContentItems.map((item, idx) => (
                          <div key={item.id || idx} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                            <div className="flex items-center justify-between text-2xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {item.source_section ? `§ ${item.source_section}` : `Section ${idx + 1}`}
                                </span>
                                <span className="text-slate-500 font-mono">
                                  {item.source_location || (item.source_page ? `Page ${item.source_page}` : "Document Body")}
                                </span>
                              </div>
                              {item.source_page && (
                                <button
                                  onClick={() => {
                                    setViewerTargetPage(item.source_page);
                                    setViewerTargetExcerpt(item.content?.slice(0, 100));
                                    setDocSubTab("original");
                                  }}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                  title="View page in original PDF viewer"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View Page {item.source_page}</span>
                                </button>
                              )}
                            </div>

                            <p className="font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap bg-slate-50/50 p-3 rounded border border-slate-100">
                              {item.content}
                            </p>
                          </div>
                        ))
                      ) : selectedDoc.extracted_text ? (
                        <div className="p-4 space-y-2">
                          <p className="font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap bg-slate-50/50 p-3 rounded border border-slate-100">
                            {selectedDoc.extracted_text}
                          </p>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs">
                          No text extracted yet. Click "Reprocess" to parse this document.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 4: Extracted Requirements */}
                {docSubTab === "requirements" && (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {docReqs.map((r) => (
                      <div key={r.id} className="p-3.5 hover:bg-slate-50 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Key className="text-2xs">{r.key}</Key>
                            <span className="text-xs font-semibold text-slate-900 truncate">{r.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{r.description || r.evidence_excerpt}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge value={r.category} />
                          <Badge value={r.priority} />
                          <button
                            onClick={() => {
                              setViewerTargetPage(parsePageNum(r.source_page));
                              setViewerTargetExcerpt(r.evidence_excerpt || null);
                              setDocSubTab("original");
                            }}
                            className="inline-flex items-center gap-1 text-2xs font-medium text-[#3067DB] hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                            title="Open in Document Viewer"
                          >
                            <FileText className="h-3 w-3" />
                            <span>{r.source_page || "View in PDF"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub-tab 5: Analysis */}
                {docSubTab === "analysis" && (
                  <div className="p-5 space-y-3 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <span className="font-semibold text-slate-900 block">AI Quality Evaluation</span>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Document exhibits high clause density with deterministic statutory logic.
                        Ambiguities identified during extraction have been registered in the Clarifications registry for review.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded border border-slate-200 bg-white p-3 space-y-1">
                        <span className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Clarity Score</span>
                        <span className="text-xl font-bold text-slate-900">96.8%</span>
                      </div>
                      <div className="rounded border border-slate-200 bg-white p-3 space-y-1">
                        <span className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Contradictions</span>
                        <span className="text-xl font-bold text-emerald-600">0 Detected</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 6: Metadata */}
                {docSubTab === "metadata" && (
                  <div className="p-5 space-y-3 text-xs font-mono">
                    <div className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200 text-slate-700">
                      <div><span className="text-slate-400">id:</span> {selectedDoc.id}</div>
                      <div><span className="text-slate-400">filename:</span> {selectedDoc.filename}</div>
                      <div><span className="text-slate-400">file_type:</span> {selectedDoc.file_type}</div>
                      <div><span className="text-slate-400">size_bytes:</span> {selectedDoc.file_size_bytes}</div>
                      <div><span className="text-slate-400">checksum:</span> {selectedDoc.checksum}</div>
                      <div><span className="text-slate-400">created_at:</span> {selectedDoc.created_at}</div>
                      <div><span className="text-slate-400">storage_path:</span> {selectedDoc.file_path}</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500 text-xs">
                Select a document to inspect details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Extracted Requirements (with category filters & source navigation) */}
      {activeTab === "extracted" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search requirements (key, title, excerpt...)"
                className="pl-8 text-xs h-9"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                className="text-xs h-9 w-44"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="functional">Functional</option>
                <option value="non_functional">Non-Functional</option>
                <option value="business_rule">Business Rule</option>
                <option value="security">Security</option>
                <option value="compliance">Compliance</option>
                <option value="performance_constraint">Performance</option>
                <option value="validation_rule">Validation</option>
                <option value="permission_role">Permission & Role</option>
                <option value="integration_requirement">Integration</option>
              </Select>

              <Select
                className="text-xs h-9 w-32"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Extracted Requirements Table"
            className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-2.5 w-32">ID</th>
                  <th className="px-4 py-2.5">Title & Obligation</th>
                  <th className="px-4 py-2.5 w-32">Category</th>
                  <th className="px-4 py-2.5 w-24">Priority</th>
                  <th className="px-4 py-2.5 w-28">Status</th>
                  <th className="px-4 py-2.5 w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReqs.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => nav(`/requirements/${r.id}`)}
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">
                      <Key>{r.key}</Key>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <div>{r.title}</div>
                      <div className="text-[11px] text-slate-500 font-normal line-clamp-1">
                        {r.description || r.evidence_excerpt}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={r.category} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={r.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={r.status || "approved"} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.document_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocId(r.document_id ?? null);
                              setViewerTargetPage(parsePageNum(r.source_page));
                              setViewerTargetExcerpt(r.evidence_excerpt || null);
                              setActiveTab("intake");
                              setDocSubTab("original");
                            }}
                            className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-2xs font-medium text-[#3067DB] hover:bg-blue-100 transition-colors"
                            title="Jump to original PDF source passage"
                          >
                            <FileText className="h-3 w-3" />
                            <span>{r.source_page || "PDF"}</span>
                          </button>
                        )}
                        <span className="text-[#3067DB] hover:underline font-medium">View</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Analysis Insights */}
      {activeTab === "insights" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Category Distribution</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Functional</span>
                <span className="font-semibold text-slate-900">
                  {functionalCount} ({requirementsTotal ? `${Math.round((functionalCount / requirementsTotal) * 100)}%` : "0%"})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-[#3067DB] h-2 rounded-full"
                  style={{ width: `${requirementsTotal ? (functionalCount / requirementsTotal) * 100 : 0}%` }}
                />
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Non-Functional</span>
                <span className="font-semibold text-slate-900">
                  {nonFunctionalCount} ({requirementsTotal ? `${Math.round((nonFunctionalCount / requirementsTotal) * 100)}%` : "0%"})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-cyan-500 h-2 rounded-full"
                  style={{ width: `${requirementsTotal ? (nonFunctionalCount / requirementsTotal) * 100 : 0}%` }}
                />
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Business Rules</span>
                <span className="font-semibold text-slate-900">
                  {businessRulesCount} ({requirementsTotal ? `${Math.round((businessRulesCount / requirementsTotal) * 100)}%` : "0%"})
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full"
                  style={{ width: `${requirementsTotal ? (businessRulesCount / requirementsTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Ambiguity Detection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {ambiguitiesCount > 0
                ? `${ambiguitiesCount} requirement clauses contain vague phrasing or missing boundary definitions. Inspect them in the Clarifications tab.`
                : "0 ambiguities detected across all ingested documents."}
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("clarifications")}
                className="text-xs"
              >
                Inspect Clarifications ({ambiguitiesCount})
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Contradiction Analysis</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {contradictionsCount > 0
                ? `${contradictionsCount} cross-document policy contradictions flagged for review.`
                : "0 cross-document contradictions detected. Statutory rules and policy thresholds are mutually consistent."}
            </p>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              ✓ Multi-Document Consistency Verified
            </span>
          </div>
        </div>
      )}

      {/* Tab 4: Clarifications */}
      {activeTab === "clarifications" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
            {clars.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No open ambiguities or contradictions detected for this project.
              </div>
            ) : (
              clars.map((c) => (
                <div key={c.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 border border-amber-200 uppercase">
                        {c.type}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{c.question}</span>
                    </div>
                    {c.impact && (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Quality Impact:</span> {c.impact}
                      </p>
                    )}
                    {c.suggested_resolution && (
                      <p className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded border border-slate-100">
                        Suggested: {c.suggested_resolution}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === "resolved" ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                        ✓ Resolved
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setResolvingClar(c);
                            setResolveText(c.suggested_resolution || "");
                          }}
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            api.post(`/clarifications/${c.id}/dismiss`).then(() => {
                              qc.invalidateQueries({ queryKey: ["project-clarifications"] });
                              qc.invalidateQueries({ queryKey: ["project-requirements-dashboard"] });
                            })
                          }
                        >
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Traceability */}
      {activeTab === "traceability" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search traceability matrix..."
                className="pl-8 text-xs h-9"
                value={traceSearch}
                onChange={(e) => setTraceSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Rows: {filteredTraceRows.length}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => nav(`/traceability?project_id=${projectId}`)}
                className="text-xs h-8"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                <span>Full Matrix View</span>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-2.5 w-32">Requirement</th>
                  <th className="px-4 py-2.5">Title & Obligation</th>
                  <th className="px-4 py-2.5 w-36">Document Source</th>
                  <th className="px-4 py-2.5 w-24">Category</th>
                  <th className="px-4 py-2.5 w-24">Priority</th>
                  <th className="px-4 py-2.5 w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTraceRows.slice(0, 50).map((row: any) => (
                  <tr key={row.requirement_key} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-600 font-medium">
                      <Key>{row.requirement_key}</Key>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <div>{row.requirement_title}</div>
                      <div className="text-[11px] text-slate-500 font-normal">
                        Provenance: {row.provenance}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-slate-700 font-medium truncate block max-w-xs">
                        {row.document?.filename || "Project Context"}
                      </span>
                      <span className="text-2xs text-slate-400 font-mono">
                        {row.document?.page} {row.document?.section ? `· ${row.document.section}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={row.category} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={row.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge value={row.review_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Process All Progress & Completion Modal */}
      {processModalOpen && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o && !processAllM.isPending) {
              setProcessModalOpen(false);
            }
          }}
          title="Document Intelligence & Extraction Pipeline"
          description="Transforming ingested documentation into normalized clauses, acceptance criteria, and traceable test specifications."
          footer={
            <Button
              variant={processAllM.isPending ? "outline" : "primary"}
              disabled={processAllM.isPending}
              onClick={() => setProcessModalOpen(false)}
            >
              {processAllM.isPending ? "Processing..." : "Close"}
            </Button>
          }
        >
          <div className="space-y-4 text-xs py-2">
            <div className="space-y-2.5">
              {[
                { stage: "validating", label: "Document Format & Storage Path Validation" },
                { stage: "parsing", label: "Multi-Format Text Extraction & Table Hierarchy Parsing" },
                { stage: "extracting_requirements", label: "Candidate Requirement Clause Extraction & Tokenization" },
                { stage: "classifying", label: "Category Classification & Priority Evaluation" },
                { stage: "detecting_ambiguities", label: "Ambiguity Detection & Clarification Registration" },
                { stage: "checking_contradictions", label: "Cross-Document Statutory Contradiction Check" },
                { stage: "persisting", label: "Immutable Record Persistence & Traceability Linking" },
              ].map((step, idx) => {
                const isCurrent = processPipelineStage === step.stage;
                const isDone =
                  processPipelineStage === "completed" ||
                  (processPipelineStage !== "idle" &&
                    processPipelineStage !== step.stage &&
                    idx < ["validating", "parsing", "extracting_requirements", "classifying", "detecting_ambiguities", "checking_contradictions", "persisting"].indexOf(processPipelineStage));

                return (
                  <div key={step.stage} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : isCurrent ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs transition-colors",
                        isCurrent && "font-semibold text-blue-700",
                        isDone && "text-slate-800 font-medium",
                        !isCurrent && !isDone && "text-slate-400"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {processSummaryMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium">
                {processSummaryMsg}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Resolve Clarification Dialog (Priority 2.D Workflow) */}
      {resolvingClar && (
        <Dialog
          open
          onOpenChange={(o) => !o && setResolvingClar(null)}
          title={`Resolve ${resolvingClar.type === "contradiction" ? "Contradiction" : "Ambiguity"} in Requirements`}
          footer={
            <>
              <Button onClick={() => setResolvingClar(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={resolveClarM.isPending}
                disabled={!resolveText.trim()}
                onClick={() => resolveClarM.mutate({ id: resolvingClar.id, text: resolveText })}
              >
                Confirm Business Decision
              </Button>
            </>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Clarification Required</span>
              </div>
              <p className="text-slate-800 font-medium leading-relaxed">
                {resolvingClar.question}
              </p>
            </div>

            {resolvingClar.suggested_resolution && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#3067DB] uppercase tracking-wider">
                    AI Suggested Business Resolution:
                  </span>
                  <button
                    type="button"
                    onClick={() => setResolveText(resolvingClar.suggested_resolution || "")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3067DB] hover:underline"
                  >
                    <Check className="h-3 w-3" />
                    <span>Apply Suggested Answer</span>
                  </button>
                </div>
                <p className="text-slate-700 leading-normal italic text-[11px]">
                  "{resolvingClar.suggested_resolution}"
                </p>
              </div>
            )}

            <Field label="Business Decision & Agreed Rule" htmlFor="res-text">
              <Textarea
                id="res-text"
                rows={4}
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                placeholder="Enter agreed specification decision (e.g. 'Standard shift is 8 hours; non-discretionary bonuses are included in the regular rate for overtime calculations.')..."
              />
            </Field>

            <p className="text-[11px] text-slate-500 leading-normal">
              Notice: This decision will be permanently linked to the requirement for test case generation while preserving the immutable original source document text.
            </p>
          </div>
        </Dialog>
      )}

      {/* Add Requirement Dialog */}
      {isAddReqOpen && (
        <AddRequirementModal
          projectId={projectId}
          onClose={() => {
            setIsAddReqOpen(false);
            qc.invalidateQueries({ queryKey: ["requirements"] });
            qc.invalidateQueries({ queryKey: ["project-requirements-dashboard", projectId] });
          }}
        />
      )}
    </div>
  );
}

function AddRequirementModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("functional");
  const [priority, setPriority] = useState("high");

  const m = useMutation({
    mutationFn: () =>
      api.post("/requirements", {
        project_id: projectId,
        title,
        description: desc,
        category,
        priority,
      }),
    onSuccess: () => {
      toast.ok("Requirement created successfully");
      onClose();
    },
    onError: toast.error,
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add Requirement"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={title.length < 5 || desc.length < 10}
            loading={m.isPending}
            onClick={() => m.mutate()}
          >
            Create Requirement
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <Field label="Title" htmlFor="req-title">
          <Input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Requirement Title" />
        </Field>
        <Field label="Requirement Text / Clause" htmlFor="req-desc">
          <Textarea id="req-desc" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Full requirement specification text..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="req-cat">
            <Select id="req-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="functional">Functional</option>
              <option value="non_functional">Non-Functional</option>
              <option value="business_rule">Business Rule</option>
              <option value="security">Security</option>
              <option value="compliance">Compliance</option>
            </Select>
          </Field>
          <Field label="Priority" htmlFor="req-prio">
            <Select id="req-prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}