import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Info,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/Toast";
import {
  Button,
  Dialog,
  EmptyState,
  Key,
  Notice,
  Panel,
} from "@/components/ui";
import { api } from "@/services/api";
import { cn, pct } from "@/utils/format";

export interface TraceabilitySummary {
  total_requirements: number;
  covered_requirements: number;
  partially_covered_requirements: number;
  uncovered_requirements: number;
  requirement_coverage_pct: number;
  total_clauses: number;
  covered_clauses: number;
  untested_clauses: number;
  clause_coverage_pct?: number;
  coverage_pct: number;
  total_tests: number;
  executed_tests: number;
  passed_tests: number;
  failed_tests: number;
  pending_approval_tests: number;
  needs_review_tests: number;
  approved_tests: number;
  orphan_tests: string[];
  duplicate_tests: string[];
  impacted_tests: string[];
}

export interface HealthAssessment {
  status_grade?: "good" | "warning" | "critical";
  headline: string;
  summary: string;
  biggest_problem: string;
  recommended_action: string;
}

export type Distribution = TraceabilityData["distribution"];

export interface DistributionItem {
  count: number;
  pct: number;
}

export interface RequirementClause {
  id: number;
  clause_key: string;
  position: number;
  text: string;
  covered: boolean;
  ambiguity_flags: string[];
}

export interface RequirementAC {
  id: number;
  key: string;
  description: string;
  source_quote?: string;
  review_status: string;
}

export interface RequirementTest {
  id: number;
  key: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  approval_status: string;
  duplicate_of: string | null;
  last_result: string | null;
}

export interface RequirementExecution {
  test_key: string;
  status: string;
  duration_ms: number;
  execution_id: number;
}

export interface RequirementDefect {
  id: number;
  key: string;
  title: string;
  severity: string;
  status: string;
}

export interface RequirementCoverage {
  id: number;
  key: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  review_status: string;
  coverage_status: "uncovered" | "partially_covered" | "fully_covered";
  covered_clauses_count: number;
  total_clauses_count: number;
  document: {
    id: number | null;
    filename: string | null;
    page: string;
    section: string;
    excerpt: string;
  } | null;
  clauses: RequirementClause[];
  acceptance_criteria: RequirementAC[];
  tests: RequirementTest[];
  executions: RequirementExecution[];
  defects: RequirementDefect[];
  coverage_gaps: string[];
  recommended_actions: string[];
}

export interface DuplicateTestDetail {
  id: number;
  key: string;
  title: string;
  duplicate_of: string;
  test_category: string;
  clause_keys: string[];
  reason: string;
}

export interface TraceabilityData {
  clauses: any[];
  tests: any[];
  cells: [number, number, string][];
  requirements: RequirementCoverage[];
  duplicate_test_details: DuplicateTestDetail[];
  health_assessment: HealthAssessment;
  distribution: {
    fully_covered: DistributionItem;
    partially_covered: DistributionItem;
    uncovered: DistributionItem;
    pending_review: DistributionItem;
    failed_validation: DistributionItem;
    approved_verified: DistributionItem;
  };
  summary: TraceabilitySummary;
  project_ids?: number[];
}

const CELL_CONFIG: Record<string, { cls: string; text: string; dotCls: string }> = {
  passed: { cls: "bg-emerald-600 text-white", text: "Approved, last run passed", dotCls: "bg-emerald-600" },
  approved: { cls: "bg-emerald-300 text-emerald-950", text: "Approved, not yet run", dotCls: "bg-emerald-400" },
  failed_execution: { cls: "bg-red-600 text-white", text: "Approved, last run failed", dotCls: "bg-red-600" },
  pending_approval: { cls: "bg-amber-400 text-amber-950", text: "Pending approval", dotCls: "bg-amber-400" },
  needs_review: { cls: "bg-violet-500 text-white", text: "Needs review or re-approval", dotCls: "bg-violet-500" },
  rejected: { cls: "bg-slate-300 text-slate-800", text: "Rejected", dotCls: "bg-slate-300" },
};

interface CoverageExplorerViewProps {
  data: any;
  projectId: string;
  onRefresh?: () => void;
}

export function CoverageExplorerView({
  data,
  projectId,
  onRefresh,
}: CoverageExplorerViewProps) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  // 0. Safe fallbacks and normalization for legacy endpoints / test fixtures
  const clauses = useMemo(() => (Array.isArray(data?.clauses) ? data.clauses : []), [data?.clauses]);
  const tests = useMemo(() => (Array.isArray(data?.tests) ? data.tests : []), [data?.tests]);
  const cells = useMemo(() => (Array.isArray(data?.cells) ? data.cells : []), [data?.cells]);

  const summary = useMemo<TraceabilitySummary>(() => {
    const raw = data?.summary || {};
    const totalClauses = raw.total_clauses ?? clauses.length;
    const coveredClauses = raw.covered_clauses ?? clauses.filter((c: any) => c.covered).length;
    const untestedClauses = raw.untested_clauses ?? Math.max(0, totalClauses - coveredClauses);
    const covPct = raw.clause_coverage_pct ?? raw.coverage_pct ?? (totalClauses > 0 ? (coveredClauses / totalClauses) * 100 : 0);

    return {
      total_requirements: raw.total_requirements ?? (data?.requirements?.length || (clauses.length > 0 ? 1 : 0)),
      covered_requirements: raw.covered_requirements ?? 0,
      partially_covered_requirements: raw.partially_covered_requirements ?? 0,
      uncovered_requirements: raw.uncovered_requirements ?? (raw.total_requirements || (clauses.length > 0 ? 1 : 0)),
      requirement_coverage_pct: raw.requirement_coverage_pct ?? 0,
      total_clauses: totalClauses,
      covered_clauses: coveredClauses,
      untested_clauses: untestedClauses,
      clause_coverage_pct: covPct,
      coverage_pct: covPct,
      total_tests: raw.total_tests ?? tests.length,
      approved_tests: raw.approved_tests ?? tests.filter((t: any) => t.status === "approved").length,
      pending_approval_tests: raw.pending_approval_tests ?? tests.filter((t: any) => t.status !== "approved").length,
      needs_review_tests: raw.needs_review_tests ?? 0,
      executed_tests: raw.executed_tests ?? tests.filter((t: any) => t.last_execution_id || t.last_result).length,
      passed_tests: raw.passed_tests ?? tests.filter((t: any) => t.last_result === "passed" || t.state === "passed").length,
      failed_tests: raw.failed_tests ?? tests.filter((t: any) => t.last_result === "failed" || t.state === "failed_execution").length,
      orphan_tests: raw.orphan_tests ?? [],
      duplicate_tests: raw.duplicate_tests ?? [],
      impacted_tests: raw.impacted_tests ?? [],
    };
  }, [data?.summary, clauses, tests, data?.requirements]);

  const requirements = useMemo<RequirementCoverage[]>(() => {
    if (data?.requirements && Array.isArray(data.requirements) && data.requirements.length > 0) {
      return data.requirements;
    }
    // Synthesize from clauses and tests if requirements array was not provided
    if (clauses.length > 0) {
      const groups = new Map<number, RequirementCoverage>();
      clauses.forEach((c: any) => {
        const reqId = c.requirement_id || c.id || 1;
        const reqKey = c.requirement_key || `REQ-${reqId}`;
        if (!groups.has(reqId)) {
          groups.set(reqId, {
            id: reqId,
            key: reqKey,
            title: c.requirement_title || c.title || `Requirement ${reqKey}`,
            category: c.requirement_category || "Compliance",
            priority: "high",
            status: "active",
            review_status: "approved",
            coverage_status: c.covered ? "fully_covered" : "uncovered",
            covered_clauses_count: c.covered ? 1 : 0,
            total_clauses_count: 1,
            document: null,
            clauses: [],
            acceptance_criteria: [],
            tests: tests.map((t: any) => ({
              id: t.id,
              key: t.key,
              title: t.title,
              category: t.test_type || "functional",
              priority: "high",
              status: t.status,
              approval_status: t.status,
              duplicate_of: t.duplicate_of || null,
              last_result: t.last_result || null,
            })),
            executions: [],
            defects: [],
            coverage_gaps: !c.covered
              ? [`Clause ${c.clause_key || c.key} has no tests mapped.`]
              : [],
            recommended_actions: !c.covered ? ["Generate test scenarios."] : ["Maintain test coverage."],
          });
        }
        const g = groups.get(reqId)!;
        g.clauses.push({
          id: c.id ?? c.index,
          clause_key: c.clause_key || c.key || `C${c.index}`,
          text: c.text || c.title || "",
          position: c.index ?? 0,
          covered: !!c.covered,
          ambiguity_flags: [],
        });
      });
      return Array.from(groups.values());
    }
    return [];
  }, [data?.requirements, clauses, tests]);

  const health = useMemo<HealthAssessment>(() => {
    if (data?.health_assessment) return data.health_assessment;
    const covPct = summary.clause_coverage_pct ?? summary.coverage_pct ?? 0;
    return {
      status_grade: covPct > 80 ? "good" : covPct > 40 ? "warning" : "critical",
      headline: covPct > 0 ? "Initial compliance coverage established" : "Untested requirements detected",
      summary: `${summary.covered_clauses} of ${summary.total_clauses} clauses covered (${pct(covPct)}).`,
      biggest_problem: summary.untested_clauses > 0 ? `${summary.untested_clauses} clauses untested.` : "None",
      recommended_action: "Review coverage and generate tests.",
    };
  }, [data?.health_assessment, summary]);

  const distribution = useMemo(() => {
    if (data?.distribution) return data.distribution;
    const total = Math.max(1, summary.total_requirements);
    return {
      fully_covered: { count: summary.covered_requirements, pct: (summary.covered_requirements / total) * 100 },
      partially_covered: { count: summary.partially_covered_requirements, pct: (summary.partially_covered_requirements / total) * 100 },
      uncovered: { count: summary.uncovered_requirements, pct: (summary.uncovered_requirements / total) * 100 },
      pending_review: { count: summary.pending_approval_tests, pct: 0 },
      failed_validation: { count: 0, pct: 0 },
      approved_verified: { count: summary.passed_tests, pct: 0 },
    };
  }, [data?.distribution, summary]);

  const duplicateTestDetails = useMemo(
    () => (Array.isArray(data?.duplicate_test_details) ? data.duplicate_test_details : []),
    [data?.duplicate_test_details]
  );

  // View state & sync with URL
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = (searchParams.get("view") as "explorer" | "matrix") || "explorer";
  const setViewMode = (mode: "explorer" | "matrix") => {
    const next = new URLSearchParams(searchParams);
    if (mode === "matrix") {
      next.set("view", "matrix");
    } else {
      next.delete("view");
    }
    setSearchParams(next, { replace: true });
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "uncovered" | "partially_covered" | "fully_covered" | "duplicates">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Hierarchy expand state
  const [expandedReqs, setExpandedReqs] = useState<Set<number>>(new Set());
  const [selectedReqs, setSelectedReqs] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (requirements.length > 0 && expandedReqs.size === 0) {
      setExpandedReqs(new Set([requirements[0].id]));
    }
  }, [requirements]);

  // Generation Modal state
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genTargetReq, setGenTargetReq] = useState<RequirementCoverage | null>(null);
  const [genCategories, setGenCategories] = useState<string[]>(["positive", "negative", "boundary_value", "business_rule"]);
  const [genAutoApprove, setGenAutoApprove] = useState(true);
  const [genPreviewLoading, setGenPreviewLoading] = useState(false);
  const [genPreviewResults, setGenPreviewResults] = useState<any[] | null>(null);

  // Duplicate Inspection Drawer
  const [duplicatesDrawerOpen, setDuplicatesDrawerOpen] = useState(false);

  // Matrix cell inspection drawer
  const [matrixCellDrawer, setMatrixCellDrawer] = useState<{
    clause: any;
    test: any;
    cellStatus: string;
  } | null>(null);

  // Cell map for matrix lookup
  const cellMap = useMemo(() => {
    const m = new Map<string, string>();
    cells.forEach(([c, t, s]: [number, number, string]) => m.set(`${c}:${t}`, s));
    return m;
  }, [cells]);

  // Distinct categories in requirements
  const categories = useMemo(() => {
    const s = new Set<string>();
    requirements.forEach((r) => {
      if (r.category) s.add(r.category);
    });
    return Array.from(s).sort();
  }, [requirements]);

  // Filter requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter((r) => {
      if (filterStatus === "uncovered" && r.coverage_status !== "uncovered") return false;
      if (filterStatus === "partially_covered" && r.coverage_status !== "partially_covered") return false;
      if (filterStatus === "fully_covered" && r.coverage_status !== "fully_covered") return false;
      if (filterStatus === "duplicates" && !r.tests.some((t) => t.duplicate_of)) return false;

      if (filterCategory !== "all" && r.category !== filterCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = r.key.toLowerCase().includes(q);
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchDoc = r.document?.filename?.toLowerCase().includes(q) ?? false;
        const matchClause = r.clauses.some((c) => c.text.toLowerCase().includes(q) || c.clause_key.toLowerCase().includes(q));
        if (!matchKey && !matchTitle && !matchDoc && !matchClause) return false;
      }
      return true;
    });
  }, [requirements, filterStatus, filterCategory, searchQuery]);

  // Paginated slice
  const paginatedRequirements = useMemo(() => {
    if (pageSize >= 1000) return filteredRequirements;
    const start = (page - 1) * pageSize;
    return filteredRequirements.slice(start, start + pageSize);
  }, [filteredRequirements, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequirements.length / pageSize));

  // Toggle single expand
  const toggleExpand = (id: number) => {
    setExpandedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedReqs(new Set(paginatedRequirements.map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedReqs(new Set());
  };

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPage = () => {
    if (selectedReqs.size === paginatedRequirements.length) {
      setSelectedReqs(new Set());
    } else {
      setSelectedReqs(new Set(paginatedRequirements.map((r) => r.id)));
    }
  };

  // Test Generation Mutation
  const generateMutation = useMutation({
    mutationFn: async ({
      reqIds,
      preview,
      autoApprove,
    }: {
      reqIds: number[];
      preview: boolean;
      autoApprove: boolean;
    }) => {
      return api.post<any>("/traceability/generate-coverage", {
        project_id: Number(projectId),
        requirement_ids: reqIds,
        categories: genCategories,
        preview,
        auto_approve: autoApprove,
      });
    },
    onSuccess: (res, vars) => {
      if (vars.preview) {
        setGenPreviewResults(res.previews || []);
        setGenPreviewLoading(false);
      } else {
        toast.ok(res.message || `Successfully created ${res.count} verified test cases.`);
        setGenModalOpen(false);
        setGenPreviewResults(null);
        setSelectedReqs(new Set());
        qc.invalidateQueries({ queryKey: ["trace"] });
        if (onRefresh) onRefresh();
      }
    },
    onError: (err: any) => {
      setGenPreviewLoading(false);
      toast.error(err?.message || "Failed to generate coverage scenarios.");
    },
  });

  const handleOpenGeneration = (req?: RequirementCoverage) => {
    setGenTargetReq(req || null);
    setGenPreviewResults(null);
    setGenModalOpen(true);
    // Automatically fetch preview
    const ids = req ? [req.id] : selectedReqs.size > 0 ? Array.from(selectedReqs) : [requirements[0]?.id].filter(Boolean);
    if (ids.length > 0) {
      setGenPreviewLoading(true);
      generateMutation.mutate({ reqIds: ids as number[], preview: true, autoApprove: genAutoApprove });
    }
  };

  const handleCommitGeneration = () => {
    const ids = genTargetReq
      ? [genTargetReq.id]
      : selectedReqs.size > 0
      ? Array.from(selectedReqs)
      : [requirements[0]?.id].filter(Boolean);
    generateMutation.mutate({ reqIds: ids as number[], preview: false, autoApprove: genAutoApprove });
  };

  return (
    <div className="space-y-6">
      {/* 1. EXECUTIVE COVERAGE SUMMARY CARDS */}
      <section aria-labelledby="exec-summary-heading">
        <h2 id="exec-summary-heading" className="sr-only">Executive Coverage Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {/* Total Requirements */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate" title="Total documented business requirements in project scope">
              Total Requirements
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900">{summary.total_requirements}</span>
              <span className="text-2xs font-mono text-slate-400">100%</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 leading-tight">Documented specifications</p>
          </div>

          {/* Fully Covered Requirements */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-emerald-800 block truncate" title="Requirements where all clauses have approved test cases">
              Fully Covered
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-emerald-700">{summary.covered_requirements}</span>
              <span className="text-2xs font-mono font-medium text-emerald-700">
                {pct(distribution.fully_covered.pct)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-emerald-800 leading-tight">All clauses verified</p>
          </div>

          {/* Partially Covered */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-amber-800 block truncate" title="Requirements with tests pending approval or partial clauses">
              Partially Covered
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-amber-700">{summary.partially_covered_requirements}</span>
              <span className="text-2xs font-mono font-medium text-amber-700">
                {pct(distribution.partially_covered.pct)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-amber-800 leading-tight">Pending review / gaps</p>
          </div>

          {/* Untested Requirements */}
          <div
            onClick={() => setFilterStatus("uncovered")}
            className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-xs transition-all hover:shadow-sm cursor-pointer hover:border-rose-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-rose-800 truncate" title="Requirements without any test cases">
                Untested Requirements
              </span>
              <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-rose-700">{summary.uncovered_requirements}</span>
              <span className="text-2xs font-mono font-semibold text-rose-700">
                {pct(distribution.uncovered.pct)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-rose-700 font-medium leading-tight">Immediate risk area →</p>
          </div>

          {/* Clause Coverage */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-blue-800 block truncate" title="Percentage of requirement clauses mapped to active tests">
              Clause Coverage
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-blue-700">
                {pct(summary.clause_coverage_pct ?? summary.coverage_pct ?? 0)}
              </span>
              <span className="text-2xs font-mono font-medium text-blue-700">
                {summary.covered_clauses}/{summary.total_clauses}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-blue-800 leading-tight">Clauses verified</p>
          </div>

          {/* Tests Generated */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate" title="Total test scenarios synthesized across all categories">
              Tests Generated
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900">{summary.total_tests}</span>
              <span className="text-2xs font-mono text-slate-400">Total</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 leading-tight">10 scenario categories</p>
          </div>

          {/* Tests Executed */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 block truncate" title="Tests that have completed at least one sandbox execution run">
              Tests Executed
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-blue-700">{summary.executed_tests}</span>
              <span className="text-2xs font-mono text-slate-400">
                {pct(summary.total_tests > 0 ? (summary.executed_tests / summary.total_tests) * 100 : 0)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 leading-tight">Simulation verified</p>
          </div>

          {/* Pending Approval / Duplicate Notice */}
          <div
            onClick={() => setDuplicatesDrawerOpen(true)}
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-xs transition-all hover:shadow-sm cursor-pointer hover:border-amber-300"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-800 truncate" title="Tests requiring review or duplicates">
                Duplicate Tests
              </span>
              <Info className="h-3 w-3 text-amber-600 shrink-0" aria-hidden="true" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-amber-700">{summary.duplicate_tests.length}</span>
              <span className="text-2xs font-mono text-amber-700">Review</span>
            </div>
            <p className="mt-1 text-[10px] text-amber-800 font-medium leading-tight">Inspect duplicates →</p>
          </div>
        </div>
      </section>

      {/* 2. COVERAGE HEALTH ASSESSMENT & RECOMMENDED ACTIONS BANNER */}
      <section aria-labelledby="coverage-health-heading">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/40 p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                <h3 id="coverage-health-heading" className="text-sm font-bold text-slate-900 tracking-tight">
                  {health.headline}
                </h3>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {health.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-amber-200/80 bg-white/80 p-2.5 text-xs">
                  <span className="font-semibold text-rose-900 block text-[11px] mb-0.5">Primary Coverage Risk</span>
                  <span className="text-slate-600 text-[11px]">{health.biggest_problem}</span>
                </div>
                <div className="rounded-lg border border-amber-200/80 bg-white/80 p-2.5 text-xs">
                  <span className="font-semibold text-emerald-900 block text-[11px] mb-0.5">Recommended Next Action</span>
                  <span className="text-slate-600 text-[11px]">{health.recommended_action}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => handleOpenGeneration()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors cursor-pointer"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Generate Coverage for Uncovered</span>
              </button>
              <button
                type="button"
                onClick={() => setDuplicatesDrawerOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors cursor-pointer"
              >
                <span>Review {summary.duplicate_tests.length} Duplicate Tests</span>
              </button>
            </div>
          </div>

          {/* Multi-Segment Coverage Progress Bar */}
          <div className="mt-5 pt-4 border-t border-amber-200/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 text-[11px]">Requirement Coverage Distribution</span>
              <span className="font-mono text-[11px] text-slate-500">
                {summary.covered_requirements + summary.partially_covered_requirements}/{summary.total_requirements} with tests ({pct(summary.requirement_coverage_pct)})
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${distribution.fully_covered.pct}%` }}
                title={`Fully Covered: ${distribution.fully_covered.count} (${pct(distribution.fully_covered.pct)})`}
              />
              <div
                className="bg-amber-400 h-full transition-all duration-300"
                style={{ width: `${distribution.partially_covered.pct}%` }}
                title={`Partially Covered: ${distribution.partially_covered.count} (${pct(distribution.partially_covered.pct)})`}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${distribution.uncovered.pct}%` }}
                title={`Untested: ${distribution.uncovered.count} (${pct(distribution.uncovered.pct)})`}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
                Fully Covered ({distribution.fully_covered.count})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                Partially Covered ({distribution.partially_covered.count})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                Untested ({distribution.uncovered.count})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
                Tests Awaiting Approval ({summary.pending_approval_tests})
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WORKSPACE CONTROLS & NAVIGATION BAR */}
      <section aria-labelledby="controls-heading" className="space-y-3">
        <h3 id="controls-heading" className="sr-only">Traceability Controls & Filters</h3>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 pb-3">
          {/* View Mode Toggle: Coverage Explorer (Default) vs Matrix Grid (Advanced) */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("explorer")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "explorer"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Coverage Explorer (Default)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                viewMode === "matrix"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Matrix Grid (Advanced View)</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                filterStatus === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              All ({requirements.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("uncovered")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                filterStatus === "uncovered"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
              )}
            >
              Untested ({summary.uncovered_requirements})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("partially_covered")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                filterStatus === "partially_covered"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              )}
            >
              Partial ({summary.partially_covered_requirements})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("fully_covered")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                filterStatus === "fully_covered"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              )}
            >
              Covered ({summary.covered_requirements})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("duplicates")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border",
                filterStatus === "duplicates"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              Duplicates ({summary.duplicate_tests.length})
            </button>
          </div>
        </div>

        {/* Search, Category Filter, and Bulk Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search requirements, clauses, or source documents..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by requirement category"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {viewMode === "explorer" && (
              <>
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1"
                >
                  Collapse All
                </button>
              </>
            )}

            {selectedReqs.size > 0 && (
              <button
                type="button"
                onClick={() => handleOpenGeneration()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Generate Tests ({selectedReqs.size})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. MAIN CONTENT AREA: COVERAGE EXPLORER (DEFAULT) VS MATRIX GRID */}
      {viewMode === "explorer" ? (
        <section aria-label="Requirement-Level Coverage Explorer" className="space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedReqs.size > 0 && selectedReqs.size === paginatedRequirements.length}
                onChange={selectAllPage}
                aria-label="Select all requirements on this page"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">
                Showing {paginatedRequirements.length} of {filteredRequirements.length} Requirements
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xs text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>All ({requirements.length})</option>
              </select>
            </div>
          </div>

          {filteredRequirements.length === 0 ? (
            <Panel>
              <EmptyState
                title="No matching requirements found"
                body="Adjust your search criteria or filter status to explore requirement traceability."
              />
            </Panel>
          ) : (
            <div className="space-y-3">
              {paginatedRequirements.map((req) => {
                const isExpanded = expandedReqs.has(req.id);
                const isSelected = selectedReqs.has(req.id);
                const hasDuplicateTests = req.tests.some((t) => t.duplicate_of);

                return (
                  <div
                    key={req.id}
                    className={cn(
                      "rounded-2xl border transition-all duration-200 bg-white",
                      isExpanded
                        ? "border-blue-300 shadow-md ring-1 ring-blue-100"
                        : "border-slate-200 shadow-xs hover:border-slate-300"
                    )}
                  >
                    {/* Requirement Row Header */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(req.id)}
                          aria-label={`Select requirement ${req.key}`}
                          className="mt-1 md:mt-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />

                        <button
                          type="button"
                          onClick={() => toggleExpand(req.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          aria-expanded={isExpanded}
                          aria-label={`Toggle details for ${req.key}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>

                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Key className="text-xs font-semibold">{req.key}</Key>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0",
                                req.category === "compliance"
                                  ? "bg-purple-100 text-purple-800"
                                  : req.category === "business_rule"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-800"
                              )}
                            >
                              {req.category.replace(/_/g, " ")}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase shrink-0",
                                req.priority === "critical"
                                  ? "bg-rose-100 text-rose-800"
                                  : req.priority === "high"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {req.priority}
                            </span>
                          </div>

                          <h4
                            onClick={() => toggleExpand(req.id)}
                            className="text-xs font-semibold text-slate-900 truncate hover:text-blue-600 cursor-pointer"
                            title={req.title}
                          >
                            {req.title}
                          </h4>
                        </div>
                      </div>

                      {/* Right metadata and badges */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {req.document && (
                          <span
                            className="text-2xs text-slate-500 font-mono flex items-center gap-1 max-w-[14rem] truncate"
                            title={`${req.document.filename} (${req.document.page})`}
                          >
                            <FileText className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                            <span className="truncate">{req.document.filename}</span>
                          </span>
                        )}

                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                            {req.clauses.length} {req.clauses.length === 1 ? "clause" : "clauses"}
                          </span>
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[11px] font-semibold",
                              req.tests.length > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {req.tests.length} {req.tests.length === 1 ? "test" : "tests"}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0",
                            req.coverage_status === "fully_covered"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : req.coverage_status === "partially_covered"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          )}
                        >
                          {req.coverage_status === "fully_covered"
                            ? "Fully Covered"
                            : req.coverage_status === "partially_covered"
                            ? "Partially Covered"
                            : "Untested"}
                        </span>

                        <div className="flex items-center gap-1">
                          {req.coverage_status === "uncovered" ? (
                            <button
                              type="button"
                              onClick={() => handleOpenGeneration(req)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                              <span>Generate</span>
                            </button>
                          ) : (
                            <Link
                              to={`/requirements/${req.id}`}
                              className="text-xs text-slate-500 hover:text-blue-600 font-medium px-2 py-1"
                            >
                              View Detail →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Hierarchical Detail Tree */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-5 rounded-b-2xl space-y-4">
                        {/* A. Source Document Provenance */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                              Source Document Provenance
                            </span>
                            <Link
                              to={`/requirements?doc_id=${req.document?.id || ""}`}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                            >
                              Inspect Original Document <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          </div>
                          {req.document ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Document:</span>
                                <span className="font-semibold text-slate-800">{req.document.filename}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Location:</span>
                                <span className="font-medium text-slate-700">{req.document.section} ({req.document.page})</span>
                              </div>
                              <div className="md:col-span-3 rounded-lg bg-slate-50 p-2.5 border border-slate-200/80">
                                <span className="text-slate-400 block text-[10px] mb-0.5">Exact Document Excerpt:</span>
                                <p className="text-slate-800 italic text-[11px] leading-relaxed">
                                  &ldquo;{req.document.excerpt}&rdquo;
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No primary document file attached.</p>
                          )}
                        </div>

                        {/* B. Two Column Layout: Extracted Clauses vs Mapped Tests & ACs */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Extracted Clauses */}
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                Extracted Clauses ({req.clauses.length})
                              </span>
                              <span className="text-2xs text-slate-400">
                                {req.covered_clauses_count}/{req.total_clauses_count} covered
                              </span>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {req.clauses.map((c) => (
                                <div
                                  key={c.id}
                                  className={cn(
                                    "p-3 rounded-xl border text-xs space-y-1.5 transition-colors",
                                    c.covered
                                      ? "bg-slate-50/80 border-slate-200 text-slate-800"
                                      : "bg-rose-50/40 border-rose-200 text-rose-950"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-2xs font-bold text-slate-600">{c.clause_key}</span>
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-semibold",
                                        c.covered ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                      )}
                                    >
                                      {c.covered ? "Covered" : "Untested"}
                                    </span>
                                  </div>
                                  <p className="text-slate-800 text-[11px] leading-relaxed font-normal">
                                    {c.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Mapped Test Cases & Acceptance Criteria */}
                          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                Verified Test Cases ({req.tests.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenGeneration(req)}
                                className="inline-flex items-center gap-1 text-2xs text-blue-600 hover:underline font-semibold"
                              >
                                <Plus className="h-3 w-3" aria-hidden="true" /> Add Scenario
                              </button>
                            </div>

                            {req.tests.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50/40 p-4 text-center space-y-2">
                                <p className="text-xs font-medium text-rose-800">
                                  No test cases currently validate this requirement.
                                </p>
                                <p className="text-2xs text-rose-600">
                                  Generate positive, negative, and boundary scenarios to establish coverage.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGeneration(req)}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                                >
                                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                                  <span>Synthesize Test Scenarios</span>
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {hasDuplicateTests && (
                                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-2">
                                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                                    <div>
                                      <span className="font-semibold block text-[11px]">Duplicate Test Alert</span>
                                      <p className="text-[10px] text-amber-800 leading-tight">
                                        Multiple test cases cite identical clause parameters. Review to consolidate or parameterize distinct edge cases.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {req.tests.map((t) => (
                                  <div
                                    key={t.id}
                                    onClick={() => nav(`/tests/${t.id}`)}
                                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-colors cursor-pointer text-xs space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 truncate">
                                        <Key className="text-2xs font-mono">{t.key}</Key>
                                        <span className="font-semibold text-slate-800 truncate" title={t.title}>
                                          {t.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {t.duplicate_of && (
                                          <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-semibold" title={`Duplicate of ${t.duplicate_of}`}>
                                            Dup: {t.duplicate_of}
                                          </span>
                                        )}
                                        <span
                                          className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase text-white",
                                            t.last_result === "passed"
                                              ? "bg-emerald-600"
                                              : t.last_result === "failed"
                                              ? "bg-rose-600"
                                              : "bg-slate-400"
                                          )}
                                        >
                                          {t.last_result ? t.last_result : "not run"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* C. Coverage Gaps & Recommended Actions */}
                        {req.coverage_gaps.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                              Identified Coverage Gaps & Recommended Improvements
                            </span>
                            <ul className="space-y-1 text-xs text-amber-900 list-disc list-inside">
                              {req.coverage_gaps.map((gap, i) => (
                                <li key={i} className="text-[11px]">{gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalPages} ({filteredRequirements.length} requirements total)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* 5. REDESIGNED ADVANCED MATRIX GRID */
        <section aria-label="Advanced Traceability Matrix Grid" className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">
              Bi-directional mapping: {clauses.length} requirement clauses vs {tests.length} tests. Click any cell to inspect the relation.
            </span>
            <div className="flex items-center gap-3">
              {Object.entries(CELL_CONFIG).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5 text-2xs text-slate-600">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", v.dotCls)} aria-hidden="true" />
                  {v.text}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-2xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-rose-300" aria-hidden="true" />
                Untested
              </span>
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Traceability matrix data grid"
            className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            style={{ maxHeight: "calc(100dvh - 18rem)" }}
          >
            <table aria-label="Traceability matrix" className="border-separate border-spacing-0 text-xs w-full min-w-max">
              <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-30 min-w-[24rem] border-b border-r border-slate-200 bg-slate-50 px-3.5 py-2 text-left font-semibold text-slate-700"
                  >
                    Requirement Clause
                  </th>
                  {tests.map((t: any) => (
                    <th
                      key={t.id}
                      scope="col"
                      className="h-32 w-10 border-b border-r border-slate-200 align-bottom p-1 bg-slate-50"
                    >
                      <button
                        type="button"
                        onClick={() => nav(`/tests/${t.id}`)}
                        title={`${t.key}: ${t.title}`}
                        className="mx-auto block pb-1 font-mono text-[10px] text-slate-600 hover:text-blue-600 [writing-mode:vertical-rl] rotate-180 hover:underline"
                      >
                        {t.key.replace(/^TC-/, "")}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clauses.map((c: any, i: number) => {
                  const newReq = i === 0 || clauses[i - 1].requirement_key !== c.requirement_key;
                  return (
                    <Fragment key={c.index}>
                      {newReq && (
                        <tr>
                          <td
                            colSpan={tests.length + 1}
                            className="sticky left-0 border-b border-slate-200 bg-slate-100/80 px-3.5 py-1.5 font-bold text-slate-800"
                          >
                            <Link
                              to={`/requirements/${c.requirement_id}`}
                              className="font-mono text-xs hover:text-blue-600 hover:underline"
                            >
                              {c.requirement_key}
                            </Link>
                            {c.requirement_title && (
                              <span className="font-normal text-slate-600 ml-2 text-2xs truncate">
                                — {c.requirement_title}
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                      <tr className="group hover:bg-slate-50/60">
                        <th
                          scope="row"
                          className={cn(
                            "sticky left-0 z-10 border-b border-r border-slate-100 px-3 py-2 text-left font-normal bg-white group-hover:bg-slate-50",
                            !c.covered && "bg-rose-50/40"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-500 text-2xs shrink-0">
                              {c.clause_key.split(".").pop()}
                            </span>
                            <span className="line-clamp-1 text-slate-800 text-[11px]" title={c.text}>
                              {c.text}
                            </span>
                            {!c.covered && (
                              <span className="shrink-0 rounded bg-rose-100 text-rose-800 px-1 py-0.2 text-[9px] font-semibold">
                                untested
                              </span>
                            )}
                          </div>
                        </th>

                        {tests.map((t: any, ti: number) => {
                          const state = cellMap.get(`${c.index}:${ti}`);
                          return (
                            <td
                              key={t.id}
                              className="border-b border-r border-slate-100 p-0.5 text-center group-hover:bg-slate-50"
                            >
                              {state ? (
                                <button
                                  type="button"
                                  onClick={() => setMatrixCellDrawer({ clause: c, test: t, cellStatus: state })}
                                  title={`${t.key} covers ${c.clause_key}: ${CELL_CONFIG[state]?.text || state}`}
                                  aria-label={`${t.key} covers ${c.clause_key}, ${CELL_CONFIG[state]?.text || state}`}
                                  className={cn(
                                    "mx-auto block h-4 w-4 rounded-sm transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                                    CELL_CONFIG[state]?.cls || "bg-slate-300"
                                  )}
                                />
                              ) : (
                                <span className="inline-block h-1 w-1 rounded-full bg-slate-200" aria-hidden="true" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 6. INTELLIGENT TEST COVERAGE GENERATION MODAL */}
      {genModalOpen && (
        <Dialog
          open={genModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setGenModalOpen(false);
              setGenPreviewResults(null);
            }
          }}
          title="Intelligent Test Coverage Generator"
          description="Synthesize positive, negative, boundary, and business-rule test scenarios directly from source-grounded requirement specifications."
        >
          <div className="space-y-4 text-xs">
            {/* Target requirement banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-900 block">Target Requirement</span>
              <p className="font-semibold text-slate-900 text-xs">
                {genTargetReq
                  ? `${genTargetReq.key}: ${genTargetReq.title}`
                  : `Multiple Requirements Selected (${selectedReqs.size})`}
              </p>
              {genTargetReq?.document && (
                <p className="text-2xs text-slate-500">
                  Source: {genTargetReq.document.filename} ({genTargetReq.document.page})
                </p>
              )}
            </div>

            {/* Scenario categories selection */}
            <div className="space-y-1.5">
              <span className="font-semibold text-slate-700 block">Test Scenario Categories to Synthesize:</span>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                {[
                  ["positive", "Positive (Nominal Happy Path)"],
                  ["negative", "Negative (Invalid Input Rejection)"],
                  ["boundary_value", "Boundary Value (Min/Max Thresholds)"],
                  ["business_rule", "Business Rule (Statutory Calculations)"],
                  ["security", "Security & Access Control"],
                  ["error_handling", "Error Handling & Resilience"],
                ].map(([cat, label]) => (
                  <label key={cat} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genCategories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) setGenCategories([...genCategories, cat]);
                        else setGenCategories(genCategories.filter((c) => c !== cat));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Approval option */}
            <label className="flex items-center gap-2 pt-1 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={genAutoApprove}
                onChange={(e) => setGenAutoApprove(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-xs">Pre-approve generated test cases for Four-Eyes verification</span>
            </label>

            {/* Preview Section */}
            {genPreviewLoading ? (
              <div className="p-8 text-center space-y-2 border border-slate-200 rounded-xl bg-slate-50">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
                <p className="font-semibold text-slate-700 text-xs">Synthesizing test specifications from source clauses...</p>
              </div>
            ) : genPreviewResults ? (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <span className="font-bold text-slate-800 text-xs block">
                  Preview Generated Scenarios ({genPreviewResults.length}):
                </span>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {genPreviewResults.map((p, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{p.title}</span>
                        <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-semibold">
                          {p.test_category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{p.description}</p>
                      <div className="pt-1 text-[10px] text-slate-500">
                        <span className="font-medium text-slate-700">Expected:</span> {p.expected_result}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGenModalOpen(false);
                  setGenPreviewResults(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={generateMutation.isPending || genPreviewLoading}
                onClick={handleCommitGeneration}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {generateMutation.isPending ? "Persisting Tests..." : "Approve & Persist Test Cases"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* 7. DUPLICATE TESTS REVIEW DRAWER */}
      {duplicatesDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Duplicate Test Cases Review ({duplicateTestDetails.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setDuplicatesDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              <Notice tone="info">
                TraceTest identifies duplicate tests where preconditions and parameters replicate an existing specification. In compliance with enterprise audit integrity, duplicate tests are not silently deleted. Review below to consolidate or add unique edge-case parameters.
              </Notice>

              <div className="space-y-2.5">
                {duplicateTestDetails.map((dup: DuplicateTestDetail) => (
                  <div key={dup.id} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="text-xs font-mono">{dup.key}</Key>
                        <span className="font-semibold text-slate-900">{dup.title}</span>
                      </div>
                      <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                        Duplicate
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">{dup.reason}</p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                      <span>Original Test:</span>
                      <span className="font-mono font-semibold text-blue-700">{dup.duplicate_of}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <Button size="sm" variant="outline" onClick={() => setDuplicatesDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MATRIX CELL CONTEXTUAL INSPECTION DRAWER */}
      {matrixCellDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Traceability Cell Inspection</h3>
              </div>
              <button
                type="button"
                onClick={() => setMatrixCellDrawer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Relationship Status */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Mapping Status</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-semibold text-white",
                      CELL_CONFIG[matrixCellDrawer.cellStatus]?.cls || "bg-slate-500"
                    )}
                  >
                    {CELL_CONFIG[matrixCellDrawer.cellStatus]?.text || matrixCellDrawer.cellStatus}
                  </span>
                </div>
              </div>

              {/* Requirement Clause */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Requirement Clause</span>
                <div className="flex items-center gap-2">
                  <Key className="text-xs font-mono">{matrixCellDrawer.clause.clause_key}</Key>
                  <span className="font-semibold text-slate-800">{matrixCellDrawer.clause.requirement_key}</span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed pt-1">
                  {matrixCellDrawer.clause.text}
                </p>
                <Link
                  to={`/requirements/${matrixCellDrawer.clause.requirement_id}`}
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 pt-1 font-medium"
                >
                  View Requirement Detail <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>

              {/* Test Case */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Linked Test Case</span>
                <div className="flex items-center gap-2">
                  <Key className="text-xs font-mono">{matrixCellDrawer.test.key}</Key>
                  <span className="font-semibold text-slate-800">{matrixCellDrawer.test.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                  <div>
                    <span className="text-slate-400 block">Category:</span>
                    <span className="font-semibold text-slate-700">{matrixCellDrawer.test.test_category}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Last Run Status:</span>
                    <span className="font-semibold text-emerald-700">{matrixCellDrawer.test.last_result || "Not Run"}</span>
                  </div>
                </div>
                <Link
                  to={`/tests/${matrixCellDrawer.test.id}`}
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 pt-1 font-medium"
                >
                  Open Test Specification <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <Button size="sm" variant="outline" onClick={() => setMatrixCellDrawer(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
