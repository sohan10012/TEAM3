import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  FileCode,
  FileText,
  Layers,
  ListFilter,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Split,
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

export function RequirementsManagementView({ projectId, current }: RequirementsManagementViewProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  // Queries
  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/documents`),
  });

  const reqsQ = useQuery({
    queryKey: ["requirements", { project_id: projectId, page_size: 200 }],
    queryFn: () => api.get<Page<Requirement>>("/requirements", { project_id: projectId, page_size: 200 }),
  });

  const clarsQ = useQuery({
    queryKey: ["project-clarifications", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/clarifications`),
  });

  const docs = useMemo(() => docsQ.data ?? [], [docsQ.data]);
  const reqs = useMemo(() => reqsQ.data?.items ?? [], [reqsQ.data?.items]);
  const clars = useMemo(() => clarsQ.data ?? [], [clarsQ.data]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"intake" | "extracted" | "insights" | "clarifications" | "traceability">("intake");
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [docSubTab, setDocSubTab] = useState<"overview" | "content" | "requirements" | "analysis" | "metadata">("overview");
  const [viewerTargetPage, setViewerTargetPage] = useState<number>(1);
  const [viewerTargetExcerpt, setViewerTargetExcerpt] = useState<string | null>(null);

  const parsePageNum = (p: string | number | null | undefined): number => {
    if (!p) return 1;
    const match = String(p).match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  // Filter / Search states
  const [reqSearch, setReqSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");

  // Dialog states
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [resolvingClar, setResolvingClar] = useState<any | null>(null);
  const [resolveText, setResolveText] = useState("");

  // Default selected document
  const selectedDoc = useMemo(() => {
    if (!docs.length) return null;
    if (selectedDocId) {
      const found = docs.find((d) => d.id === selectedDocId);
      if (found) return found;
    }
    // Default to PRD or first
    const prd = docs.find((d) => d.filename.toLowerCase().includes("prd"));
    return prd || docs[0];
  }, [docs, selectedDocId]);

  // Derived counts
  const requirementsTotal = reqsQ.data?.total ?? reqs.length;
  const requirementsComplete = requirementsTotal === reqs.length;
  const functionalCount = useMemo(() => requirementsComplete ? reqs.filter((r) => r.category === "functional").length : null, [reqs, requirementsComplete]);
  const nonFunctionalCount = useMemo(() => requirementsComplete ? reqs.filter((r) => r.category === "non_functional").length : null, [reqs, requirementsComplete]);
  const businessRulesCount = useMemo(() => requirementsComplete ? reqs.filter((r) => r.category === "business_rule").length : null, [reqs, requirementsComplete]);
  const ambiguitiesCount = useMemo(() => clars.filter((c) => c.type !== "contradiction").length, [clars]);
  const contradictionsCount = useMemo(() => clars.filter((c) => c.type === "contradiction").length, [clars]);

  // Document upload mutation
  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("display_name", file.name.replace(/\.[^/.]+$/, ""));
      fd.set("purpose", file.name.endsWith(".pdf") ? "prd" : file.name.endsWith(".xlsx") ? "business_rules" : "srs");
      fd.set("auto_process", "true");
      return api.upload(`/projects/${projectId}/documents/upload`, fd);
    },
    onSuccess: () => {
      toast.ok("Document uploaded and processed successfully");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    },
    onError: toast.error,
  });

  // Reprocess mutation
  const reprocessM = useMutation({
    mutationFn: async (docId: number) => {
      return api.post(`/documents/${docId}/retry`);
    },
    onSuccess: () => {
      toast.ok("Document reprocessing scheduled");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    },
    onError: toast.error,
  });

  // Process all mutation
  const processAllM = useMutation({
    mutationFn: async () => {
      const needsProcessing = docs.filter((doc) =>
        !["completed", "extracted", "queued", "processing"].includes(doc.extraction_status || doc.status)
      );
      const outcomes = await Promise.allSettled(
        needsProcessing.map((doc) => api.post(`/documents/${doc.id}/retry`))
      );
      return {
        queued: outcomes.filter((outcome) => outcome.status === "fulfilled").length,
        failed: outcomes.filter((outcome) => outcome.status === "rejected").length,
      };
    },
    onSuccess: ({ queued, failed }) => {
      if (failed) toast.error(`Could not queue ${failed} document${failed === 1 ? "" : "s"} for processing`);
      else if (queued) toast.ok(`Queued ${queued} document${queued === 1 ? "" : "s"} for processing`);
      else toast.ok("No documents need processing");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    },
    onError: toast.error,
  });

  // Resolve clarification mutation
  const resolveClarM = useMutation({
    mutationFn: async ({ id, text }: { id: number; text: string }) => {
      return api.post(`/clarifications/${id}/resolve`, { user_response: text });
    },
    onSuccess: () => {
      toast.ok("Clarification resolved and grounded into requirements");
      qc.invalidateQueries({ queryKey: ["project-clarifications", projectId] });
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
    if (doc.filename.toLowerCase().includes("prd") || doc.purpose === "prd") return "Product Requirements Document";
    if (doc.filename.toLowerCase().includes("srs") || doc.purpose === "srs") return "Software Requirements Specification";
    if (doc.filename.toLowerCase().includes("rules") || doc.purpose === "business_rules") return "Business Rules & Configurations";
    if (doc.filename.toLowerCase().includes("api")) return "API Integration Specification";
    return doc.display_name || "Requirements Document";
  };

  // Requirements extracted for selected document
  const docReqs = useMemo(() => {
    if (!selectedDoc) return [];
    return reqs.filter((r) => r.document_id === selectedDoc.id);
  }, [reqs, selectedDoc]);

  // Breakdown for selected document
  const docBreakdown = useMemo(() => {
    const fn = docReqs.filter((r) => r.category === "functional").length;
    const nf = docReqs.filter((r) => r.category === "non_functional").length;
    const br = docReqs.filter((r) => r.category === "business_rule").length;
    return { fn, nf, br, total: fn + nf + br };
  }, [docReqs]);

  // Filtered requirements for tab 2
  const filteredReqs = useMemo(() => {
    return reqs.filter((r) => {
      const matchQ = !reqSearch || r.title.toLowerCase().includes(reqSearch.toLowerCase()) || r.key.toLowerCase().includes(reqSearch.toLowerCase());
      const matchCat = selectedCategory === "all" || r.category === selectedCategory;
      const matchPrio = selectedPriority === "all" || r.priority === selectedPriority;
      return matchQ && matchCat && matchPrio;
    });
  }, [reqs, reqSearch, selectedCategory, selectedPriority]);

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
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500 mr-1" />
              <span>Process All</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddReqOpen(true)}
              className="bg-[#3067DB] hover:bg-[#2554B8] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Add Requirement</span>
            </Button>

            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              title="More options"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7 Summary Metric Cards matching Screenshot 2 */}
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
            <span className="text-2xl font-bold text-slate-900">{docs.length}</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
              {docs.filter((doc) =>
                doc.status === "completed" || ["extracted", "approved"].includes(doc.extraction_status)
              ).length} processed
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
            <span className="text-2xl font-bold text-slate-900">{functionalCount ?? "—"}</span>
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
            <span className="text-2xl font-bold text-slate-900">{nonFunctionalCount ?? "—"}</span>
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
            <span className="text-2xl font-bold text-slate-900">{businessRulesCount ?? "—"}</span>
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
            <span className="text-2xl font-bold text-red-600">{contradictionsCount}</span>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation matching Screenshot 2 */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-xs font-medium">
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
            onClick={() => nav(`/traceability?project_id=${projectId}`)}
            className="flex items-center gap-2 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
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
            {/* Upload Box */}
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:border-blue-400 transition-colors">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#3067DB] mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900">Upload Requirement Documents</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Drag & drop files here or{" "}
                <label className="text-[#3067DB] hover:underline font-medium cursor-pointer">
                  Browse Files
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadM.mutate(f);
                    }}
                  />
                </label>
              </p>
              <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Supported: PDF, DOCX, XLSX, CSV, TXT, Markdown | Max: 50 MB per file
              </p>
            </div>

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
                      <div className="flex items-start gap-3">
                        {getFileIconBadge(doc.filename, doc.file_type)}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-900">{doc.filename}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{getDocTypeLabel(doc)}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            v{doc.version} • {sizeMb} MB • Uploaded {fmtDate(doc.created_at, false)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                          {doc.extraction_status}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reprocessM.mutate(doc.id);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          title="Reprocess"
                          aria-label="Reprocess document"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
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
                  <div className="flex items-center gap-3">
                    {getFileIconBadge(selectedDoc.filename, selectedDoc.file_type)}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{selectedDoc.filename}</h3>
                      <p className="text-xs text-slate-500">{getDocTypeLabel(selectedDoc)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                      ✓ Extracted
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessM.mutate(selectedDoc.id)}
                      loading={reprocessM.isPending}
                      className="text-xs h-7 border-slate-200 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3 w-3 mr-1 text-slate-500" />
                      <span>Reprocess</span>
                    </Button>
                    <button className="p-1 text-slate-400 hover:text-slate-600 rounded" aria-label="More options" title="More options">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-tabs for Selected Document */}
                <div className="border-b border-slate-200 px-4 bg-white">
                  <div className="flex space-x-6 text-xs font-medium">
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
                    {/* Top 3-Column Document Information Section */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Stylized Document Thumbnail (3 cols) */}
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
                          <span>{selectedDoc.metadata?.pages_count ? `${selectedDoc.metadata.pages_count} pages` : "Page count unavailable"}</span>
                        </span>
                      </div>

                      {/* Document Information (5 cols) */}
                      <div className="md:col-span-5 space-y-2 text-xs">
                        <h4 className="font-semibold text-slate-900 text-xs border-b border-slate-100 pb-1.5">
                          Document Information
                        </h4>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Document Name</span>
                            <span className="font-medium text-slate-800 text-right max-w-[160px] truncate">
                              {selectedDoc.display_name || selectedDoc.filename}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Document Type</span>
                            <span className="font-medium text-slate-800 text-right">
                              {selectedDoc.purpose === "prd" ? "Product Requirements Document (PRD)" : getDocTypeLabel(selectedDoc)}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Version</span>
                            <span className="font-mono text-slate-800 font-medium">{selectedDoc.version ? `v${selectedDoc.version}` : "—"}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Owner / Source</span>
                            <span className="font-medium text-slate-800">{selectedDoc.owner || "—"}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Document Date</span>
                            <span className="font-medium text-slate-800">{selectedDoc.document_date || "—"}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span className="text-slate-500">Related Module</span>
                            <span className="font-medium text-slate-800 text-right max-w-[150px] truncate">
                              {selectedDoc.related_module || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between py-0.5 items-center">
                            <span className="text-slate-500">Priority</span>
                            <span className="inline-flex rounded bg-rose-50 px-1.5 py-0.2 text-[10px] font-semibold text-rose-700 border border-rose-200 uppercase">
                              {selectedDoc.priority || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Processing Summary (4 cols) */}
                      <div className="md:col-span-4 space-y-2 text-xs">
                        <h4 className="font-semibold text-slate-900 text-xs border-b border-slate-100 pb-1.5">
                          Processing Summary
                        </h4>
                        <div className="space-y-2 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">Upload status</span>
                            <span className="text-slate-600">{selectedDoc.upload_status || selectedDoc.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">Extraction status</span>
                            <span className="text-slate-600">{selectedDoc.extraction_status || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">Uploaded</span>
                            <span className="text-slate-500">{fmtDate(selectedDoc.created_at, false)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-700 font-medium">Last updated</span>
                            <span className="text-slate-500">{fmtDate(selectedDoc.updated_at, false)}</span>
                          </div>

                          {/* Highlight box */}
                          <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/60 p-2.5">
                            <div className="flex items-center gap-2 text-purple-900 font-semibold text-xs">
                              <Layers className="h-4 w-4 text-purple-600" />
                              <span>{docBreakdown.total} requirements extracted</span>
                            </div>
                            <p className="text-[10px] text-purple-700 mt-1">
                              {docBreakdown.fn} Functional | {docBreakdown.nf} Non-Functional | {docBreakdown.br} Rule
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Dynamic Extraction Insights */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <Sparkles className="h-4 w-4 text-[#3067DB]" />
                          <span>Extracted Domain Capabilities & Coverage</span>
                        </div>
                        <span className="text-2xs text-slate-500">
                          {docReqs.length} total requirements recorded
                        </span>
                      </div>
                      {docReqs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No requirements extracted yet. Click "Process Document" to begin automated extraction.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {Array.from(new Set(docReqs.map((r) => r.category || "functional"))).map((cat) => {
                            const count = docReqs.filter((r) => (r.category || "functional") === cat).length;
                            return (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="capitalize">{cat.replace(/_/g, " ")} ({count})</span>
                              </span>
                            );
                          })}
                          {selectedDoc?.metadata?.pages_count && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                              <span>{selectedDoc.metadata.pages_count} Pages Analyzed</span>
                            </span>
                          )}
                          {selectedDoc?.metadata?.sections?.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 border border-purple-200">
                              <span>{selectedDoc.metadata.sections.length} Sections Preserved</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Embedded Document Viewer */}
                {docSubTab === "content" && (
                  <div className="p-4">
                    <EmbeddedDocumentViewer
                      documentId={selectedDoc.id}
                      filename={selectedDoc.filename || selectedDoc.display_name}
                      fileType={selectedDoc.file_type || "pdf"}
                      initialPage={viewerTargetPage}
                      highlightExcerpt={viewerTargetExcerpt}
                      extractedTextFallback={selectedDoc.extracted_text_preview}
                      tablesFallback={selectedDoc.metadata?.tables || []}
                    />
                  </div>
                )}

                {/* Sub-tab 3: Requirements */}
                {docSubTab === "requirements" && (
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {docReqs.map((r) => (
                      <div key={r.id} className="p-3.5 hover:bg-slate-50 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Key className="text-2xs">{r.key}</Key>
                            <span className="text-xs font-semibold text-slate-900">{r.title}</span>
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
                              setDocSubTab("content");
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

                {/* Sub-tab 4: Analysis */}
                {docSubTab === "analysis" && (
                  <div className="p-5 space-y-3 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <span className="font-semibold text-slate-900 block">AI Quality Evaluation</span>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        {docBreakdown.total} requirements are linked to this document: {docBreakdown.fn} functional, {docBreakdown.nf} non-functional, and {docBreakdown.br} business rules.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sub-tab 5: Metadata */}
                {docSubTab === "metadata" && (
                  <div className="p-5 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded border border-slate-200 bg-slate-50">
                        <span className="text-slate-500 block">SHA-256 Checksum</span>
                        <span className="font-mono text-slate-800 break-all">{selectedDoc.checksum || "—"}</span>
                      </div>
                      <div className="p-2 rounded border border-slate-200 bg-slate-50">
                        <span className="text-slate-500 block">File Size</span>
                        <span className="font-mono text-slate-800">{selectedDoc.file_size_bytes} bytes</span>
                      </div>
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

      {/* Tab 2: Extracted Requirements (56) */}
      {activeTab === "extracted" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search requirements (key, title...)"
                className="pl-8 text-xs h-9"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                className="text-xs h-9 w-36"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="functional">Functional</option>
                <option value="non_functional">Non-Functional</option>
                <option value="business_rule">Business Rule</option>
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

          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-2.5 w-28">ID</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5 w-32">Category</th>
                  <th className="px-4 py-2.5 w-24">Priority</th>
                  <th className="px-4 py-2.5 w-28">Status</th>
                  <th className="px-4 py-2.5 w-24 text-right">Actions</th>
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
                              setDocSubTab("content");
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
                <span className="font-semibold text-slate-900">{functionalCount ?? "—"} ({requirementsComplete && requirementsTotal ? `${Math.round((functionalCount! / requirementsTotal) * 100)}%` : "—"})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-[#3067DB] h-2 rounded-full" style={{ width: `${requirementsComplete && requirementsTotal ? (functionalCount! / requirementsTotal) * 100 : 0}%` }} />
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Non-Functional</span>
                <span className="font-semibold text-slate-900">{nonFunctionalCount ?? "—"} ({requirementsComplete && requirementsTotal ? `${Math.round((nonFunctionalCount! / requirementsTotal) * 100)}%` : "—"})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${requirementsComplete && requirementsTotal ? (nonFunctionalCount! / requirementsTotal) * 100 : 0}%` }} />
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-600">Business Rules</span>
                <span className="font-semibold text-slate-900">{businessRulesCount ?? "—"} ({requirementsComplete && requirementsTotal ? `${Math.round((businessRulesCount! / requirementsTotal) * 100)}%` : "—"})</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${requirementsComplete && requirementsTotal ? (businessRulesCount! / requirementsTotal) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-3 md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Coverage & Auditability Summary</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Category distribution reflects {requirementsComplete ? `${requirementsTotal} loaded requirements` : `${reqs.length} loaded of ${requirementsTotal} total requirements`}. Counts and percentages are based on the records currently available from the project API.
            </p>
          </div>
        </div>
      )}

      {/* Tab 4: Clarifications (4 Ambiguities, 1 Contradiction) */}
      {activeTab === "clarifications" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Quality & Ambiguity Guardrails</span>
              <span>
                Clarifications surface vague language, missing boundaries, and cross-document contradictions before test generation.
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
            {clars.map((c) => (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        c.type === "contradiction"
                          ? "bg-red-100 text-red-700 border border-red-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      )}
                    >
                      {c.type}
                    </span>
                    <span className="text-xs font-semibold text-slate-900">{c.question}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 max-w-2xl">{c.context_excerpt}</p>
                  {c.suggested_resolution && (
                    <p className="text-[11px] text-[#3067DB] font-medium">
                      Suggestion: {c.suggested_resolution}
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
                        onClick={() => api.post(`/clarifications/${c.id}/dismiss`).then(() => qc.invalidateQueries({ queryKey: ["project-clarifications"] }))}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve Clarification Dialog */}
      {resolvingClar && (
        <Dialog
          open
          onOpenChange={(o) => !o && setResolvingClar(null)}
          title={`Resolve Clarification: ${resolvingClar.type}`}
          footer={
            <>
              <Button onClick={() => setResolvingClar(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={resolveClarM.isPending}
                onClick={() => resolveClarM.mutate({ id: resolvingClar.id, text: resolveText })}
              >
                Confirm Resolution
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-slate-800">{resolvingClar.question}</p>
            <Field label="Resolution / Decided Policy" htmlFor="res-text">
              <Textarea
                id="res-text"
                rows={4}
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                placeholder="Enter agreed specification decision..."
              />
            </Field>
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
