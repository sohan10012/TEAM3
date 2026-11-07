import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Play,
  PlayCircle,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, Field, Input, LoadingBlock, Select, Textarea } from "@/components/ui";
import { api } from "@/services/api";
import type {
  Document,
  Execution,
  Page,
  RequirementClarification,
  RequirementsDashboardData,
  TraceabilityMatrix,
} from "@/types/models";
import { cn, fmtDate, fmtDuration, label } from "@/utils/format";

interface Props {
  projectId: number;
  isDetailView?: boolean;
  isDashboard?: boolean;
  fallback?: React.ReactNode;
}

const PURPOSE_LABELS: Record<string, string> = {
  prd: "Product Requirements Document (PRD)",
  srs: "Software Requirements Specification (SRS)",
  brd: "Business Requirements Document (BRD)",
  user_story: "User Stories / Backlog",
  api_spec: "API Specification / Schema",
  acceptance_criteria: "Acceptance Criteria",
  compliance_document: "Compliance / Regulatory Standard",
  meeting_notes: "Stakeholder / Architecture Notes",
  architecture_notes: "Technical Architecture Notes",
};

export function RequirementsProjectDashboard({ projectId, fallback, isDashboard = false, isDetailView = false }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"overview" | "runs" | "documents" | "clarifications" | "traceability" | "reports" | "context">("overview");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docPreviewOpen, setDocPreviewOpen] = useState(false);
  const [resolveClarModal, setResolveClarModal] = useState<RequirementClarification | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [selectedExecutionLog, setSelectedExecutionLog] = useState<{ id: number; key: string; log: string } | null>(null);

  // Queries
  const dashQuery = useQuery({
    queryKey: ["requirements_dashboard", projectId],
    queryFn: () => api.get<RequirementsDashboardData>(`/projects/${projectId}/requirements-dashboard`),
    refetchInterval: 15_000,
  });

  const executionsQuery = useQuery({
    queryKey: ["executions", "requirements-dashboard", projectId],
    queryFn: () => api.get<Page<Execution>>("/executions", {
      project_id: projectId,
      page: 1,
      page_size: 5,
      sort: "started_at",
      order: "desc",
    }),
    enabled: isDashboard || activeTab === "runs",
    refetchInterval: isDashboard ? 15_000 : false,
  });

  const docsQuery = useQuery({
    queryKey: ["project_documents", projectId],
    queryFn: () => api.get<Document[]>(`/projects/${projectId}/documents`),
    enabled: activeTab === "documents" || activeTab === "runs" || uploadModalOpen,
  });

  const contextQuery = useQuery({
    queryKey: ["project_context", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId}/context`),
    enabled: activeTab === "context",
  });

  const rolesQuery = useQuery({
    queryKey: ["project_roles", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/roles`),
    enabled: activeTab === "context",
  });

  const scenariosQuery = useQuery({
    queryKey: ["project_scenarios", projectId],
    queryFn: () => api.get<any[]>(`/projects/${projectId}/scenarios`),
    enabled: activeTab === "context",
  });

  const retryDocMutation = useMutation({
    mutationFn: (docId: number) => api.post(`/documents/${docId}/retry`),
    onSuccess: () => {
      toast.ok("Document extraction retry queued");
      qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to retry document"),
  });

  const clarsQuery = useQuery({
    queryKey: ["project_clarifications", projectId],
    queryFn: () => api.get<RequirementClarification[]>(`/projects/${projectId}/clarifications`),
    enabled: activeTab === "clarifications" || activeTab === "runs",
  });

  const traceQuery = useQuery({
    queryKey: ["project_traceability", projectId],
    queryFn: () => api.get<TraceabilityMatrix>(`/projects/${projectId}/traceability`),
    enabled: activeTab === "traceability",
  });

  // Action Mutations
  const analyzeMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/analyze-requirements`),
    onSuccess: (data: any) => {
      toast.ok(`Extracted ${data.total_extracted} requirements (${data.clarifications_opened} clarifications opened)`);
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["project_clarifications", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to analyze requirements"),
  });

  const genAcMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/generate-acceptance-criteria`),
    onSuccess: (data: any) => {
      toast.ok(`Generated ${data.created_count} structured Given/When/Then acceptance criteria`);
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["project_traceability", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to generate acceptance criteria"),
  });

  const genTestsMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/generate-tests`),
    onSuccess: (data: any) => {
      toast.ok(`Generated ${data.created_count} test scenarios across 10 categories`);
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
      qc.invalidateQueries({ queryKey: ["project_traceability", projectId] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to generate test specifications"),
  });

  const validateSpecsMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/validate-specifications`),
    onSuccess: (data: any) => {
      toast.ok(`Specification validation ${data.key} completed (${data.status.toUpperCase()})`);
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to validate specifications"),
  });

  const runSimulationMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/run-simulation`),
    onSuccess: (data: any) => {
      toast.ok(`Behaviour simulation ${data.key} completed (${data.status.toUpperCase()})`);
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to execute behaviour simulation"),
  });

  const resolveClarMutation = useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      api.post(`/clarifications/${id}/resolve`, { user_response: response }),
    onSuccess: () => {
      toast.ok("Clarification marked as resolved");
      setResolveClarModal(null);
      setClarificationResponse("");
      qc.invalidateQueries({ queryKey: ["project_clarifications", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to resolve clarification"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => api.delete(`/documents/${docId}`),
    onSuccess: () => {
      toast.ok("Document removed");
      qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete document"),
  });

  if (dashQuery.isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#3067DB]" />
        <p className="text-sm font-medium text-slate-600">Loading requirements quality telemetry...</p>
      </div>
    );
  }

  if (!dashQuery.data) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200 shadow-xs max-w-xl mx-auto my-12 space-y-3">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Failed to load requirements dashboard</h3>
        <p className="text-xs text-slate-600">{(dashQuery.error as any)?.message || "Internal telemetry error"}</p>
        <Button variant="outline" size="sm" onClick={() => dashQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  const {
    project,
    documents_summary,
    requirements_summary,
    test_design_summary,
    execution_summary,
  } = dashQuery.data;
  const recentExecutions = executionsQuery.data?.items ?? [];

  const isBrandNew = documents_summary.total === 0 && requirements_summary.total === 0;
  const totalRuns = execution_summary.specification_validation_runs
    + execution_summary.simulation_runs
    + execution_summary.external_executions;
  const documentProgress = documents_summary.total
    ? Math.round((documents_summary.completed / documents_summary.total) * 100)
    : null;
  const requirementProgress = requirements_summary.total
    ? Math.round((requirements_summary.approved / requirements_summary.total) * 100)
    : null;
  const testProgress = test_design_summary.total_tests
    ? Math.round((test_design_summary.approved_tests / test_design_summary.total_tests) * 100)
    : null;
  const activityItems = [
    ...(documents_summary.latest_document ? [{
      id: `document-${documents_summary.latest_document.id}`,
      title: "Latest document",
      detail: documents_summary.latest_document.filename,
      timestamp: fmtDate(documents_summary.latest_document.created_at, false),
    }] : []),
    ...recentExecutions.map((run) => ({
      id: `run-${run.id}`,
      title: `${(run.execution_type ?? run.source).replace(/_/g, " ")} ${run.key}`,
      detail: `${label(run.status)} · ${run.passed} / ${run.total} tests · ${fmtDuration(run.duration_ms)}`,
      timestamp: run.started_at ? fmtDate(run.started_at, false) : "—",
    })),
  ].slice(0, 4);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. PROJECT HEADER */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            {isDetailView && (
              <Link
                to="/projects"
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors mt-0.5"
                title="Back to Projects"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
            )}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#3067DB] border border-blue-100 shadow-2xs">
              <Layers className="h-6 w-6 text-[#3067DB]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {project.key === "DAYFORCE" ? "Dayforce" : (project.name?.includes(" — ") ? project.name.split(" — ")[0] : project.name)}
                </h1>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[#3067DB] border border-blue-200/70">
                  Requirements-Based
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                {project.key === "DAYFORCE"
                  ? "Enterprise HR and workforce management platform for employee lifecycle, time, attendance and payroll."
                  : (project.description || "Product requirements quality engineering and deterministic test verification.")}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="gap-1.5 border-slate-300"
            >
              <Upload className="h-4 w-4 text-slate-600" />
              Upload Document
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
              className="gap-1.5 border-slate-300"
              title="Extract grounded requirements and detect ambiguities"
            >
              <RefreshCw className={cn("h-4 w-4 text-[#3067DB]", analyzeMutation.isPending && "animate-spin")} />
              Analyze
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={genAcMutation.isPending}
              onClick={() => genAcMutation.mutate()}
              className="gap-1.5 border-slate-300 text-slate-700"
              title="Generate structured Given/When/Then acceptance criteria"
            >
              <FileCheck className="h-4 w-4 text-blue-600" />
              Generate ACs
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={genTestsMutation.isPending}
              onClick={() => genTestsMutation.mutate()}
              className="gap-1.5 border-slate-300 text-slate-700"
              title="Generate 10-category test scenarios"
            >
              <Layers className="h-4 w-4 text-purple-600" />
              Generate Tests
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={validateSpecsMutation.isPending}
              onClick={() => validateSpecsMutation.mutate()}
              className="gap-1.5 border-slate-300 text-slate-700"
              title="Validate completeness of Given/When/Then contracts"
            >
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Validate Specs
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={runSimulationMutation.isPending}
              onClick={() => runSimulationMutation.mutate()}
              className="gap-1.5 bg-[#3067DB] hover:bg-[#2554B8]"
              title="Run deterministic behaviour simulation (SIM-*)"
            >
              <Play className="h-4 w-4 fill-white" />
              Run Simulation
            </Button>
          </div>
        </div>

        {/* Project Metadata Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Business Domain</span>
            <span className="font-medium text-slate-800">{project.business_domain || "Enterprise SaaS"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Product Type</span>
            <span className="font-medium text-slate-800">{project.product_type || "Web Application"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Primary Goal</span>
            <span className="font-medium text-slate-800 truncate" title={project.business_goal || "Validate requirements and ensure test coverage"}>
              {project.business_goal || "Validate requirements and ensure test coverage"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Owner</span>
            <span className="font-medium text-slate-800">{project.owner_name || "QA Team"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Created</span>
            <span className="font-medium text-slate-800">{project.created_at ? fmtDate(project.created_at, false) : "Nov 7, 2026"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">Last Updated</span>
            <span className="font-medium text-slate-800">{project.updated_at ? fmtDate(project.updated_at, false) : "Nov 7, 2026, 10:55 AM"}</span>
          </div>
        </div>
      </div>

      {/* Onboarding hint if project has no documents yet */}
      {isBrandNew && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900 flex items-center justify-between">
          <span>This requirements project is ready for document intake. Upload your first PRD, SRS, or policy document to begin.</span>
          <Button size="sm" variant="primary" onClick={() => setUploadModalOpen(true)}>Upload Document</Button>
        </div>
      )}

      {/* 2. OPERATIONAL WORKFLOW STEPPER */}
      <div className="bg-white rounded-lg border border-slate-200/90 shadow-xs p-4 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        {/* Step 1 */}
        <div className="flex items-center gap-2.5 min-w-[160px]">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 font-bold">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-tight">Documents</div>
            <div className="text-2xs text-slate-500">Uploaded & Processed</div>
          </div>
        </div>
        <span className="text-slate-300 font-bold">&rarr;</span>
        {/* Step 2 */}
        <Link to="/requirements" className="flex items-center gap-2.5 min-w-[160px] hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#3067DB] border border-blue-200 shrink-0 font-bold">
            2
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-tight">Requirements</div>
            <div className="text-2xs text-slate-500">Review & Approve</div>
          </div>
        </Link>
        <span className="text-slate-300 font-bold">&rarr;</span>
        {/* Step 3 */}
        <Link to="/tests" className="flex items-center gap-2.5 min-w-[160px] hover:opacity-80">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0 font-bold">
            3
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-tight">Test Design</div>
            <div className="text-2xs text-slate-500">Generate & Review</div>
          </div>
        </Link>
        <span className="text-slate-300 font-bold">&rarr;</span>
        {/* Step 4 */}
        <div className="flex items-center gap-2.5 min-w-[160px] cursor-pointer hover:opacity-80" onClick={() => validateSpecsMutation.mutate()}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0 font-bold">
            4
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-tight">Validation</div>
            <div className="text-2xs text-slate-500">Validate Specifications</div>
          </div>
        </div>
        <span className="text-slate-300 font-bold">&rarr;</span>
        {/* Step 5 */}
        <div className="flex items-center gap-2.5 min-w-[160px] cursor-pointer hover:opacity-80" onClick={() => runSimulationMutation.mutate()}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0 font-bold">
            5
          </div>
          <div>
            <div className="font-semibold text-slate-900 leading-tight">Execution</div>
            <div className="text-2xs text-slate-500">Simulate or Run</div>
          </div>
        </div>
      </div>

      {/* 3. TAB NAVIGATION */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "pb-3 border-b-2 transition-colors",
              activeTab === "overview"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={cn(
              "pb-3 border-b-2 transition-colors",
              activeTab === "documents"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Documents ({documents_summary.total})
          </button>
          <Link
            to="/requirements"
            className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors"
          >
            Requirements ({requirements_summary.total})
          </Link>
          <Link
            to="/tests"
            className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition-colors"
          >
            Test Cases ({test_design_summary.total_tests})
          </Link>
          <button
            onClick={() => setActiveTab("runs")}
            className={cn(
              "pb-3 border-b-2 transition-colors",
              activeTab === "runs"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Execution ({recentExecutions.length})
          </button>
          <button
            onClick={() => setActiveTab("traceability")}
            className={cn(
              "pb-3 border-b-2 transition-colors",
              activeTab === "traceability"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Traceability
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "pb-3 border-b-2 transition-colors",
              activeTab === "reports"
                ? "border-[#3067DB] text-[#3067DB]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Reports
          </button>
        </nav>
      </div>

      {/* 4. TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Four Metric Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Documents */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#3067DB]" />
                  Documents
                </span>
                <span className="text-2xs text-slate-400">Processed</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{documents_summary.total}</div>
              </div>
              <div className="space-y-1 text-2xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Processed</span>
                  <span className="font-semibold text-slate-700">{documents_summary.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Processing</span>
                  <span className="font-semibold text-slate-700">{documents_summary.processing}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Failed</span>
                  <span className="font-semibold text-slate-700">{documents_summary.failed}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Requirements */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-purple-600" />
                  Requirements
                </span>
                <span className="text-2xs text-slate-400">Extracted</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{requirements_summary.total}</div>
              </div>
              <div className="space-y-1 text-2xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Approved</span>
                  <span className="font-semibold text-slate-700">{requirements_summary.approved}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Under Review</span>
                  <span className="font-semibold text-slate-700">{requirements_summary.awaiting_review}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Ambiguous</span>
                  <span className="font-semibold text-slate-700">{requirements_summary.open_clarifications}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Test Design */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-amber-600" />
                  Test Design
                </span>
                <span className="text-2xs text-slate-400">Scenarios</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-bold text-slate-900 tracking-tight">{test_design_summary.total_tests}</div>
              </div>
              <div className="space-y-1 text-2xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Generated</span>
                  <span className="font-semibold text-slate-700">{test_design_summary.total_tests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Approved</span>
                  <span className="font-semibold text-slate-700">{test_design_summary.approved_tests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> No Coverage</span>
                  <span className="font-semibold text-slate-700">{test_design_summary.uncovered_requirements}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Execution */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <PlayCircle className="h-4 w-4 text-emerald-600" />
                  Execution
                </span>
                <span className="text-2xs text-slate-400">Total Runs</span>
              </div>
              <div className="my-3">
                <div className="text-3xl font-bold text-slate-900 tracking-tight">
                  {totalRuns}
                </div>
              </div>
              <div className="space-y-1 text-2xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Latest run passed</span>
                  <span className="font-semibold text-slate-700">{execution_summary.latest_run?.passed ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Latest run failed</span>
                  <span className="font-semibold text-slate-700">{execution_summary.latest_run?.failed ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Latest run total</span>
                  <span className="font-semibold text-slate-700">{execution_summary.latest_run?.total ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lower 3 Columns: Project Progress, Recent Activity, Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Project Progress (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Project Progress</h3>
              <div className="space-y-4 text-xs">
                {/* Stage 1 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-[#3067DB]" />
                      Document Processing
                    </span>
                    <span className="font-medium text-slate-900">
                      {documentProgress == null ? "—" : `${documentProgress}%`} &bull; {documents_summary.completed}/{documents_summary.total}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${documentProgress ?? 0}%` }} />
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-purple-600" />
                      Requirement Review
                    </span>
                    <span className="font-medium text-slate-900">
                      {requirementProgress == null ? "—" : `${requirementProgress}%`} &bull; {requirements_summary.approved}/{requirements_summary.total}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${requirementProgress ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <FileCheck className="h-3.5 w-3.5 text-amber-600" />
                      Test Design
                    </span>
                    <span className="font-medium text-slate-900">
                      {testProgress == null ? "—" : `${testProgress}%`} &bull; {test_design_summary.approved_tests}/{test_design_summary.total_tests}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full"
                      style={{ width: `${testProgress ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Specification Validation
                    </span>
                    <span className="font-medium text-slate-900">
                      {execution_summary.specification_validation_runs} runs
                    </span>
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-2">
                      <PlayCircle className="h-3.5 w-3.5 text-indigo-600" />
                      Execution (Simulation)
                    </span>
                    <span className="font-medium text-slate-900">
                      {execution_summary.simulation_runs} runs
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Column: Recent Activity (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
                <Link to="/executions" className="text-2xs text-[#3067DB] hover:underline font-medium">
                  View All &rarr;
                </Link>
              </div>
              <div className="space-y-3.5 text-xs">
                {activityItems.length ? activityItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-50 text-[#3067DB] flex items-center justify-center shrink-0 mt-0.5 border border-blue-200">
                      {item.id.startsWith("document-")
                        ? <FileText className="h-3.5 w-3.5" />
                        : <PlayCircle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.title}</div>
                      <div className="text-2xs text-slate-500 truncate">{item.detail} · {item.timestamp}</div>
                    </div>
                  </div>
                )) : <p className="text-slate-500">No recent project activity.</p>}
              </div>
            </div>

            {/* Right Column: Quick Actions (3 cols) */}
            <div className="lg:col-span-3 bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <span className="text-blue-600 font-bold">&#9889;</span> Quick Actions
              </h3>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full justify-start text-xs bg-[#3067DB] hover:bg-[#2554B8] gap-2 h-9"
                  onClick={() => setUploadModalOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Documents
                </Button>
                <Link
                  to="/requirements"
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                >
                  <Layers className="h-3.5 w-3.5 text-purple-600" />
                  Review Requirements
                </Link>
                <Link
                  to="/tests"
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                >
                  <FileCheck className="h-3.5 w-3.5 text-amber-600" />
                  Generate Test Cases
                </Link>
                <button
                  onClick={() => runSimulationMutation.mutate()}
                  disabled={runSimulationMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs text-left"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                  Run Simulation
                </button>
                <button
                  onClick={() => setActiveTab("traceability")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs text-left"
                >
                  <Layers className="h-3.5 w-3.5 text-blue-600" />
                  View Traceability
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENTS */}

      {/* TAB: RECENT RUNS */}
      {activeTab === "runs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Execution & Simulation History</h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Specification validations (VAL-*) and deterministic behavior simulations (SIM-*).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={validateSpecsMutation.isPending}
                  onClick={() => validateSpecsMutation.mutate()}
                >
                  Run Validation (VAL-*)
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={runSimulationMutation.isPending}
                  onClick={() => runSimulationMutation.mutate()}
                >
                  Run Simulation (SIM-*)
                </Button>
              </div>
            </div>

            {executionsQuery.isError ? (
              <div role="alert" className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>Could not load execution history.</span>
                <button type="button" className="font-medium underline underline-offset-2" onClick={() => void executionsQuery.refetch()}>Retry</button>
              </div>
            ) : executionsQuery.isPending ? (
              <div className="p-4"><LoadingBlock rows={3} /></div>
            ) : recentExecutions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <PlayCircle className="h-8 w-8 text-slate-300 mx-auto" />
                <p>No executions yet for this project.</p>
                <p className="text-2xs text-slate-400">
                  Click "Run Simulation" or "Run Validation" above to execute test specifications.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-2xs tracking-wider">
                    <th className="py-2.5 px-4">Run ID</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Result</th>
                    <th className="py-2.5 px-4">Tests</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Triggered</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentExecutions.map((r) => {
                    const executionType = r.execution_type ?? r.source;
                    const isVal = executionType === "specification_validation";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {r.key}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-2xs font-medium border",
                              isVal
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {label(executionType)}
                          </span>
                        </td>
                        <td className="py-3 px-4"><Badge value={r.status} /></td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums font-medium">{r.passed} / {r.total}</td>
                        <td className="py-3 px-4 text-slate-600 tabular-nums">{fmtDuration(r.duration_ms)}</td>
                        <td className="py-3 px-4 text-slate-500">{r.started_at ? fmtDate(r.started_at, false) : "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const ex = await api.get<any>(`/executions/${r.id}`);
                                setSelectedExecutionLog({
                                  id: ex.id,
                                  key: ex.key,
                                  log: ex.log_excerpt || "No log content recorded.",
                                });
                              } catch {
                                toast.error("Failed to load execution details");
                              }
                            }}
                            className="text-2xs h-7 px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Logs
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Ingested Requirements Documentation</h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Multi-format documentation repository for PRD, SRS, BRD, and API contracts.
                </p>
              </div>
              <Button size="sm" variant="primary" onClick={() => setUploadModalOpen(true)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload New Document
              </Button>
            </div>

            {docsQuery.isLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#3067DB] mb-2" />
                Loading documents...
              </div>
            ) : !docsQuery.data || docsQuery.data.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <FileText className="h-8 w-8 text-slate-300 mx-auto" />
                <p>No documents uploaded yet.</p>
                <Button size="sm" variant="outline" onClick={() => setUploadModalOpen(true)}>
                  Upload PDF, DOCX, XLSX, or Markdown
                </Button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-2xs tracking-wider">
                    <th className="py-2.5 px-4">Document</th>
                    <th className="py-2.5 px-4">Classification</th>
                    <th className="py-2.5 px-4">Priority</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4">Checksum / Version</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docsQuery.data.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          {doc.file_type === "pdf" && <FileText className="h-4 w-4 text-red-500 shrink-0" />}
                          {doc.file_type === "docx" && <FileText className="h-4 w-4 text-blue-500 shrink-0" />}
                          {doc.file_type === "xlsx" && <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />}
                          {doc.file_type === "csv" && <FileSpreadsheet className="h-4 w-4 text-teal-600 shrink-0" />}
                          {(doc.file_type === "md" || doc.file_type === "txt") && (
                            <FileCode className="h-4 w-4 text-slate-500 shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-slate-900 block truncate max-w-xs" title={doc.display_name || doc.filename}>
                              {doc.display_name || doc.filename}
                            </span>
                            {doc.display_name && doc.display_name !== doc.filename && (
                              <span className="font-mono text-3xs text-slate-400 block truncate max-w-xs">{doc.filename}</span>
                            )}
                          </div>
                        </div>
                        {doc.description && <p className="text-2xs text-slate-500 mt-0.5">{doc.description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {doc.document_type ? doc.document_type.toUpperCase() : (PURPOSE_LABELS[doc.purpose] ? doc.purpose.toUpperCase() : doc.purpose)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-2xs font-medium uppercase",
                            doc.priority === "critical"
                              ? "bg-red-50 text-red-700 border border-red-200 font-bold"
                              : doc.priority === "high"
                              ? "bg-orange-50 text-orange-700 border border-orange-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          )}
                        >
                          {doc.priority || "medium"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium border",
                            doc.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : doc.status === "processing"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}
                        >
                          {doc.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 tabular-nums">
                        {Math.round(doc.size_bytes / 1024)} KB
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-3xs text-slate-500">
                          v{doc.version || "1.0"}
                        </div>
                        {doc.checksum && (
                          <div className="font-mono text-3xs text-slate-400 truncate max-w-[120px]" title={doc.checksum}>
                            {doc.checksum.slice(0, 12)}...
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {doc.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={retryDocMutation.isPending}
                            onClick={() => retryDocMutation.mutate(doc.id)}
                            className="text-2xs h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setDocPreviewOpen(true);
                          }}
                          className="text-2xs h-7 px-2"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                        <a
                          href={`/api/v1/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-2xs h-7 px-2 font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded hover:bg-slate-50"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={deleteDocMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete ${doc.filename}?`)) {
                              deleteDocMutation.mutate(doc.id);
                            }
                          }}
                          className="text-2xs h-7 px-2 text-red-600 hover:bg-red-50 border-red-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB: CLARIFICATIONS */}
      {activeTab === "clarifications" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Detected Ambiguities & Clarifications</h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  AI-identified ambiguities, contradictions, and incomplete rules in specifications.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={analyzeMutation.isPending}
                onClick={() => analyzeMutation.mutate()}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-3 w-3", analyzeMutation.isPending && "animate-spin")} />
                Re-scan Ambiguities
              </Button>
            </div>

            {clarsQuery.isLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading clarifications...</div>
            ) : !clarsQuery.data || clarsQuery.data.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-medium text-slate-700">Zero open ambiguities!</p>
                <p className="text-2xs text-slate-400">All requirements have verified, unambiguous wording.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clarsQuery.data.map((c) => (
                  <div key={c.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-2xs font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          {c.issue_type.replace("_", " ")}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-2xs font-medium border",
                            c.status === "open"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                      {c.status === "open" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setResolveClarModal(c);
                            setClarificationResponse(c.suggested_resolution || "");
                          }}
                          className="h-7 text-2xs"
                        >
                          Resolve Clarification
                        </Button>
                      ) : (
                        <span className="text-2xs text-slate-400">Resolved at {fmtDate(c.resolved_at || c.created_at)}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-900">{c.question}</div>
                      <p className="text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
                        "{c.ambiguous_text}"
                      </p>
                    </div>

                    {c.user_response && (
                      <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 space-y-0.5">
                        <span className="text-2xs font-bold text-emerald-800 uppercase tracking-wide">Approved Resolution:</span>
                        <p>{c.user_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: TRACEABILITY MATRIX */}
      {activeTab === "traceability" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Bidirectional Traceability Matrix</h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  End-to-end trace: Document &rarr; Requirement &rarr; Acceptance Criteria &rarr; Test &rarr; Execution &rarr; Defect
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/v1/projects/${projectId}/traceability`, "_blank");
                  }}
                  className="gap-1 text-2xs"
                >
                  <Download className="h-3 w-3" />
                  Export JSON
                </Button>
              </div>
            </div>

            {traceQuery.isLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading traceability matrix...</div>
            ) : !traceQuery.data || traceQuery.data.traceability_rows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Layers className="h-8 w-8 text-slate-300 mx-auto" />
                <p>No traceability rows available.</p>
                <p className="text-2xs text-slate-400">Extract requirements and generate tests to populate traceability.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-2xs tracking-wider">
                      <th className="py-2.5 px-4">Req Key</th>
                      <th className="py-2.5 px-4">Source Document</th>
                      <th className="py-2.5 px-4">Requirement Title</th>
                      <th className="py-2.5 px-4">Acceptance Criteria</th>
                      <th className="py-2.5 px-4">Tests</th>
                      <th className="py-2.5 px-4">Latest Run</th>
                      <th className="py-2.5 px-4">Coverage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {traceQuery.data.traceability_rows.map((row) => (
                      <tr key={row.requirement_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{row.requirement_key}</td>
                        <td className="py-3 px-4 text-2xs text-slate-600">
                          {row.document ? (
                            <span title={row.document.filename} className="font-medium">
                              {row.document.filename}
                              {row.source_section && ` • ${row.source_section}`}
                            </span>
                          ) : (
                            <span className="text-slate-400">Project Input</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs font-medium text-slate-800">{row.title}</td>
                        <td className="py-3 px-4 text-2xs">
                          {row.acceptance_criteria.length > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                              {row.acceptance_criteria.length} ACs
                            </span>
                          ) : (
                            <span className="text-slate-400">0 ACs</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-2xs">
                          {row.tests.length > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                              {row.tests.length} Tests
                            </span>
                          ) : (
                            <span className="text-slate-400">0 Tests</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-2xs">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded font-medium",
                              row.latest_execution_status === "Passed"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.latest_execution_status === "Failed"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {row.latest_execution_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-2xs">
                          {row.covered ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Covered
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">Uncovered</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CONTEXT & ROLES */}
      {activeTab === "context" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">Project Context, Roles & Business Scenarios</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Foundational architecture, domain constraints, custom roles, and business scenarios grounding LLM intelligence.
              </p>
            </div>

            {contextQuery.isLoading ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#3067DB] mb-2" />
                Loading project context...
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Section 1: Product Overview & Problem Statement */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">Product Overview</span>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {contextQuery.data?.product_overview || project.description || "No overview recorded."}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">Problem Statement</span>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {contextQuery.data?.problem_statement || "No specific problem statement provided."}
                    </p>
                  </div>
                </div>

                {/* Section 2: Personas, Modules & Standards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                    <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">Target Personas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(contextQuery.data?.target_users && contextQuery.data.target_users.length > 0
                        ? contextQuery.data.target_users
                        : project.target_users_and_roles || []
                      ).map((u: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-2xs font-medium bg-blue-50 text-[#3067DB] border border-blue-200">
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                    <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">In-Scope Modules</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(contextQuery.data?.product_modules || []).map((m: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                    <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">Regulatory Standards</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(contextQuery.data?.regulatory_standards || []).map((std: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-2xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {std}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 3: Business Rules */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                  <span className="font-semibold text-slate-700 block uppercase text-2xs tracking-wider">
                    Core Business Rules & Invariants ({contextQuery.data?.business_rules?.length || 0})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(contextQuery.data?.business_rules || []).map((rule: string, idx: number) => (
                      <div key={idx} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 flex items-start gap-2">
                        <span className="font-mono text-2xs font-bold text-slate-400 mt-0.5">#{idx + 1}</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Roles Matrix */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                    Project Roles Matrix ({rolesQuery.data?.length || 0})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(rolesQuery.data || []).map((r: any) => (
                      <div key={r.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{r.role_name}</span>
                          <span className="text-2xs text-slate-500 font-mono">ID: {r.id}</span>
                        </div>
                        <p className="text-2xs text-slate-600">{r.description}</p>
                        {r.permissions && r.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {r.permissions.map((p: string, pIdx: number) => (
                              <span key={pIdx} className="font-mono text-3xs px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-2xs pt-1 grid grid-cols-2 gap-2 text-slate-600 border-t border-slate-200/60 mt-2">
                          <div>
                            <span className="font-semibold block text-slate-500">Responsibilities:</span>
                            {r.responsibilities || "N/A"}
                          </div>
                          <div>
                            <span className="font-semibold block text-slate-500">Restrictions:</span>
                            <span className="text-red-700">{r.restrictions || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 5: Business Scenarios */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                    Primary Business Scenarios ({scenariosQuery.data?.length || 0})
                  </h4>
                  <div className="space-y-3">
                    {(scenariosQuery.data || []).map((sc: any, idx: number) => (
                      <div key={sc.id} className="p-4 rounded-lg border border-slate-200 bg-white space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#3067DB] border border-blue-200">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{sc.title}</span>
                          </div>
                          {sc.module && (
                            <span className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {sc.module}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{sc.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-2xs">
                          <div>
                            <span className="font-semibold text-slate-500 block">Actor:</span>
                            <span className="text-slate-800">{sc.actor || "User"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500 block">Preconditions:</span>
                            <span className="text-slate-800">{sc.preconditions || "None"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500 block">Expected Outcome:</span>
                            <span className="text-slate-800">{sc.expected_outcome || "Completed"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: QUALITY REPORTS */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">19-Section Quality Engineering Report</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full enterprise quality verification dossier with traceability, gap analysis, and governance posture.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/v1/projects/${projectId}/quality-report.html`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#3067DB] text-white hover:bg-[#2554B8] transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download HTML Report
                </a>
                <a
                  href={`/api/v1/projects/${projectId}/quality-report`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export JSON
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200/80 space-y-1">
                <span className="text-2xs font-bold text-slate-500 uppercase">Section 1–5</span>
                <h4 className="font-semibold text-slate-800">Requirements & Ambiguity</h4>
                <p className="text-2xs text-slate-500">
                  Project overview, document provenance, grounded requirement inventory, and clarification audits.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200/80 space-y-1">
                <span className="text-2xs font-bold text-slate-500 uppercase">Section 6–11</span>
                <h4 className="font-semibold text-slate-800">Test Design & Simulation</h4>
                <p className="text-2xs text-slate-500">
                  Given/When/Then acceptance criteria, 10-category test matrix, and deterministic simulation results.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200/80 space-y-1">
                <span className="text-2xs font-bold text-slate-500 uppercase">Section 12–19</span>
                <h4 className="font-semibold text-slate-800">Governance & Release Readiness</h4>
                <p className="text-2xs text-slate-500">
                  Bidirectional traceability, defect analysis, compliance governance, audit log, and sign-off recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD DOCUMENT */}
      <UploadDocumentModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        projectId={projectId}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["project_documents", projectId] });
          qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
        }}
      />

      {/* MODAL: DOCUMENT PREVIEW */}
      {selectedDoc && (
        <Dialog
          open={docPreviewOpen}
          onOpenChange={setDocPreviewOpen}
          title={`Document: ${selectedDoc.filename}`}
          footer={
            <Button onClick={() => setDocPreviewOpen(false)}>Close</Button>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded border border-slate-200">
              <div>
                <span className="text-2xs text-slate-500 block uppercase font-semibold">Purpose</span>
                <span className="font-medium text-slate-800">{PURPOSE_LABELS[selectedDoc.purpose] || selectedDoc.purpose}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-500 block uppercase font-semibold">Format</span>
                <span className="font-mono text-slate-800 uppercase">{selectedDoc.file_type}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-500 block uppercase font-semibold">Sections Parsed</span>
                <span className="font-medium text-slate-800">{selectedDoc.sections?.length || 0}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-800 mb-1">Extracted Text Content</h4>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded text-2xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                {selectedDoc.extracted_text || "No text extracted."}
              </pre>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL: RESOLVE CLARIFICATION */}
      {resolveClarModal && (
        <Dialog
          open={Boolean(resolveClarModal)}
          onOpenChange={(o) => {
            if (!o) setResolveClarModal(null);
          }}
          title="Resolve Requirement Ambiguity"
          footer={
            <>
              <Button onClick={() => setResolveClarModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={resolveClarMutation.isPending}
                disabled={clarificationResponse.trim().length === 0}
                onClick={() =>
                  resolveClarMutation.mutate({
                    id: resolveClarModal.id,
                    response: clarificationResponse.trim(),
                  })
                }
              >
                Confirm Resolution
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-950 space-y-1">
              <span className="text-2xs font-bold uppercase tracking-wider text-amber-800">Ambiguous Phrase</span>
              <p className="font-mono text-2xs">"{resolveClarModal.ambiguous_text}"</p>
            </div>

            <div>
              <span className="text-2xs text-slate-500 font-semibold uppercase block mb-1">Clarification Question</span>
              <p className="font-medium text-slate-900">{resolveClarModal.question}</p>
            </div>

            <Field label="Definitive Specification / Resolution" htmlFor="clar-resp">
              <Textarea
                id="clar-resp"
                rows={3}
                value={clarificationResponse}
                onChange={(e) => setClarificationResponse(e.target.value)}
                placeholder="State the exact boundary, numerical limit, or business rule..."
              />
            </Field>
          </div>
        </Dialog>
      )}

      {/* MODAL: EXECUTION LOGS */}
      {selectedExecutionLog && (
        <Dialog
          open={Boolean(selectedExecutionLog)}
          onOpenChange={(o) => {
            if (!o) setSelectedExecutionLog(null);
          }}
          title={`Execution Log: ${selectedExecutionLog.key}`}
          footer={
            <Button onClick={() => setSelectedExecutionLog(null)}>Close</Button>
          }
        >
          <div className="space-y-2 text-xs">
            <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-2xs rounded max-h-[65vh] overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {selectedExecutionLog.log}
            </pre>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function UploadDocumentModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: number;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState("prd");
  const [description, setDescription] = useState("");
  const [autoProcess, setAutoProcess] = useState(true);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please choose a file to upload");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      if (description) fd.append("description", description);
      fd.append("auto_process", autoProcess ? "true" : "false");

      const res = await fetch(`/api/v1/projects/${projectId}/documents`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Upload failed");
      }

      toast.ok(`Uploaded ${file.name} successfully`);
      setFile(null);
      setDescription("");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Requirements Document"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={uploading} disabled={!file} onClick={handleSubmit}>
            Upload & Ingest
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-2xs font-semibold uppercase text-slate-500 mb-1.5">
            Requirements Document File
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
            className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#3067DB] hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded p-1.5"
          />
          <p className="text-2xs text-slate-400 mt-1">
            Supported formats: PDF, Microsoft Word (.docx), Excel (.xlsx), CSV, Markdown (.md), Plain Text (.txt)
          </p>
        </div>

        <Field label="Document Purpose / Specification Role" htmlFor="doc-purpose">
          <Select id="doc-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="prd">Product Requirements Document (PRD)</option>
            <option value="srs">Software Requirements Specification (SRS)</option>
            <option value="brd">Business Requirements Document (BRD)</option>
            <option value="user_story">User Stories / Feature Spec</option>
            <option value="api_spec">API Specification (OpenAPI / Swagger / Endpoints)</option>
            <option value="acceptance_criteria">Given/When/Then Acceptance Criteria</option>
            <option value="compliance_document">Regulatory / Compliance Standard (HIPAA, PCI, SOC 2)</option>
            <option value="meeting_notes">Architecture / Stakeholder Notes</option>
            <option value="architecture_notes">System Architecture & Technical Boundaries</option>
          </Select>
        </Field>

        <Field label="Description (Optional)" htmlFor="doc-desc">
          <Input
            id="doc-desc"
            placeholder="e.g. Core Checkout & Payment Engine PRD v2.4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="auto-process"
            checked={autoProcess}
            onChange={(e) => setAutoProcess(e.target.checked)}
            className="rounded border-slate-300 text-[#3067DB] focus:ring-[#3067DB]"
          />
          <label htmlFor="auto-process" className="text-xs text-slate-700 font-medium cursor-pointer">
            Automatically extract text and analyze sections upon upload
          </label>
        </div>
      </form>
    </Dialog>
  );
}
