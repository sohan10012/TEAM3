import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, Field, Input, ResponsiveDetailDrawer, Select, Textarea } from "@/components/ui";
import { api } from "@/services/api";
import type { Execution, Page, Project, TestCase } from "@/types/models";
import { cn, label } from "@/utils/format";

export const TEST_CATEGORY_INFO: Record<string, { label: string; description: string; icon: string }> = {
  positive: {
    label: "Nominal / Positive",
    description: "Valid inputs, happy paths, and baseline functional compliance under standard operating conditions.",
    icon: "✓",
  },
  negative: {
    label: "Negative",
    description: "Malformed inputs, invalid formats, and prohibited states verifying robust boundary rejections.",
    icon: "✕",
  },
  boundary_value: {
    label: "Boundary Value",
    description: "Exact upper/lower thresholds, off-by-one transitions, and boundary limits to prevent truncation.",
    icon: "↔",
  },
  edge_case: {
    label: "Edge Case",
    description: "Extremes, null values, special characters, and non-standard data types.",
    icon: "⚡",
  },
  input_validation: {
    label: "Input Validation",
    description: "Schema validation, type safety, field lengths, required values, and formatting integrity.",
    icon: "⌕",
  },
  business_rule: {
    label: "Business Rule",
    description: "Statutory formulas, domain business invariants, and enterprise calculation logic.",
    icon: "⚖",
  },
  permission_role: {
    label: "Role / Permission",
    description: "Role-based access control (RBAC), unauthorized actor rejection, and privilege boundaries.",
    icon: "🛡",
  },
  security: {
    label: "Security",
    description: "Defenses against unauthorized bypass, payload injection, privilege escalation, and session leakage.",
    icon: "🔒",
  },
  error_handling: {
    label: "Error Handling",
    description: "Standardized error response payloads, HTTP status codes, and graceful fault recovery paths.",
    icon: "⚠",
  },
  integration: {
    label: "Integration",
    description: "Cross-system API contracts, schemas, webhooks, and third-party interface reliability.",
    icon: "⇄",
  },
};

interface TestCasesManagementViewProps {
  projectId: number;
  current: Project | null;
}

export function TestCasesManagementView({ projectId, current }: TestCasesManagementViewProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();

  // Query test cases
  const q = useQuery({
    queryKey: ["tests", { project_id: projectId, page_size: 500 }],
    queryFn: () => api.get<Page<TestCase>>("/tests", { project_id: projectId, page_size: 500 }),
  });
  const latestExecutionQ = useQuery({
    queryKey: ["executions", "latest", projectId],
    queryFn: () => api.get<Page<Execution>>("/executions", {
      project_id: projectId,
      page: 1,
      page_size: 1,
      sort: "started_at",
      order: "desc",
    }),
  });

  const latestRunId = latestExecutionQ.data?.items[0]?.id;
  const executionDetailQ = useQuery({
    queryKey: ["execution-detail", latestRunId],
    queryFn: () => api.get<any>(`/executions/${latestRunId}`),
    enabled: !!latestRunId,
    staleTime: 30_000,
  });

  const testExecutionMap = useMemo(() => {
    const map = new Map<number, string>();
    (executionDetailQ.data?.results || []).forEach((res: any) => {
      if (res.test_case_id) {
        map.set(res.test_case_id, res.status);
      }
    });
    return map;
  }, [executionDetailQ.data?.results]);

  const tests = useMemo(() => q.data?.items ?? [], [q.data?.items]);
  const generateTestsM = useMutation({
    mutationFn: () => api.post<{ created_count: number }>(`/projects/${projectId}/generate-tests`),
    onSuccess: (result) => {
      toast.ok(`Generated ${result.created_count} test cases`);
      qc.invalidateQueries({ queryKey: ["tests"] });
      qc.invalidateQueries({ queryKey: ["requirements_dashboard", projectId] });
    },
    onError: toast.error,
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<"cases" | "by_req" | "by_category" | "coverage" | "validation" | "history">("cases");
  const [testSubTab, setTestSubTab] = useState<"spec" | "trace" | "exec">("spec");

  // Selection state
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  const tableLayoutRef = useRef<HTMLDivElement>(null);

  // Filters & search
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [executionFilter, setExecutionFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Dialog state
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);

  // Default to the first result returned by the API.
  const selectedTest = useMemo(() => {
    if (!tests.length) return null;
    if (selectedTestId) {
      const found = tests.find((t) => t.id === selectedTestId);
      if (found) return found;
    }
    return tests[0];
  }, [tests, selectedTestId]);

  // Derived counts
  const totalCount = q.data?.total ?? tests.length;
  const hasCompleteTestSet = totalCount === tests.length;
  const approvedCount = hasCompleteTestSet ? tests.filter((t) => t.status === "approved").length : null;
  const pendingCount = hasCompleteTestSet ? tests.filter((t) => t.status === "pending_review").length : null;
  const failedCount = latestExecutionQ.data?.items[0]?.failed ?? null;
  const acCount = hasCompleteTestSet ? new Set(tests.flatMap((t) => t.ac_keys)).size : null;
  const coveragePct = current?.stats?.coverage_pct;

  // Exact category counts across all 10 categories
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tests.length };
    Object.keys(TEST_CATEGORY_INFO).forEach((k) => {
      counts[k] = 0;
    });
    tests.forEach((t) => {
      const cat = (t.test_category || t.test_type || "positive").toLowerCase();
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else if (cat.includes("pos")) {
        counts.positive = (counts.positive || 0) + 1;
      } else if (cat.includes("neg")) {
        counts.negative = (counts.negative || 0) + 1;
      } else if (cat.includes("bound")) {
        counts.boundary_value = (counts.boundary_value || 0) + 1;
      } else if (cat.includes("edge")) {
        counts.edge_case = (counts.edge_case || 0) + 1;
      } else if (cat.includes("val")) {
        counts.input_validation = (counts.input_validation || 0) + 1;
      } else if (cat.includes("rule")) {
        counts.business_rule = (counts.business_rule || 0) + 1;
      } else if (cat.includes("perm") || cat.includes("role")) {
        counts.permission_role = (counts.permission_role || 0) + 1;
      } else if (cat.includes("sec")) {
        counts.security = (counts.security || 0) + 1;
      } else if (cat.includes("err")) {
        counts.error_handling = (counts.error_handling || 0) + 1;
      } else if (cat.includes("int")) {
        counts.integration = (counts.integration || 0) + 1;
      }
    });
    return counts;
  }, [tests]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchQ =
        !search ||
        t.key.toLowerCase().includes(search.toLowerCase()) ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        (t.requirement_key && t.requirement_key.toLowerCase().includes(search.toLowerCase()));

      const tCategory = (t.test_category || t.test_type || "").toLowerCase();
      let matchCategory = categoryFilter === "all";
      if (!matchCategory) {
        if (tCategory === categoryFilter.toLowerCase()) {
          matchCategory = true;
        } else if (categoryFilter === "positive" && tCategory.includes("pos")) {
          matchCategory = true;
        } else if (categoryFilter === "negative" && tCategory.includes("neg")) {
          matchCategory = true;
        } else if (categoryFilter === "boundary_value" && tCategory.includes("bound")) {
          matchCategory = true;
        } else if (categoryFilter === "edge_case" && tCategory.includes("edge")) {
          matchCategory = true;
        } else if (categoryFilter === "input_validation" && tCategory.includes("val")) {
          matchCategory = true;
        } else if (categoryFilter === "business_rule" && tCategory.includes("rule")) {
          matchCategory = true;
        } else if (categoryFilter === "permission_role" && (tCategory.includes("perm") || tCategory.includes("role"))) {
          matchCategory = true;
        } else if (categoryFilter === "security" && tCategory.includes("sec")) {
          matchCategory = true;
        } else if (categoryFilter === "error_handling" && tCategory.includes("err")) {
          matchCategory = true;
        } else if (categoryFilter === "integration" && tCategory.includes("int")) {
          matchCategory = true;
        }
      }

      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;

      const execStatus = testExecutionMap.get(t.id) || "not_executed";
      const matchExecution =
        executionFilter === "all" ||
        (executionFilter === "passed" && execStatus === "passed") ||
        (executionFilter === "failed" && execStatus === "failed") ||
        (executionFilter === "not_executed" && execStatus === "not_executed");

      return matchQ && matchCategory && matchStatus && matchPriority && matchExecution;
    });
  }, [tests, search, categoryFilter, statusFilter, priorityFilter, executionFilter, testExecutionMap]);

  // Paged tests
  const totalPages = Math.ceil(filteredTests.length / pageSize) || 1;
  const pagedTests = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTests.slice(start, start + pageSize);
  }, [filteredTests, page, pageSize]);

  // Approve / Reject mutations
  const reviewM = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: "approve" | "reject" }) => {
      return api.post(`/tests/${id}/review`, { decision, comment: `Review ${decision} from test management` });
    },
    onSuccess: () => {
      toast.ok("Test review state updated");
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
    onError: toast.error,
  });

  // Category styling across 10 categories
  const getCategoryBadge = (category: string) => {
    const c = (category || "").toLowerCase();
    if (c.includes("pos")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">✓ Positive</span>;
    }
    if (c.includes("neg")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-2xs font-semibold text-rose-700 border border-rose-200">✕ Negative</span>;
    }
    if (c.includes("bound")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-2xs font-semibold text-purple-700 border border-purple-200">↔ Boundary</span>;
    }
    if (c.includes("edge")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 border border-amber-200">⚡ Edge Case</span>;
    }
    if (c.includes("val")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-[#3067DB] border border-blue-200">⌕ Validation</span>;
    }
    if (c.includes("rule")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-2xs font-semibold text-indigo-700 border border-indigo-200">⚖ Business Rule</span>;
    }
    if (c.includes("perm") || c.includes("role") || c.includes("auth")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-2xs font-semibold text-cyan-800 border border-cyan-200">🛡 Role / Perm</span>;
    }
    if (c.includes("sec")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-2xs font-semibold text-red-700 border border-red-200">🔒 Security</span>;
    }
    if (c.includes("err")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-2xs font-semibold text-violet-700 border border-violet-200">⚠ Error Handling</span>;
    }
    if (c.includes("int")) {
      return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-700 border border-slate-300">⇄ Integration</span>;
    }
    return <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-700 border border-slate-200">{label(category)}</span>;
  };

  // Execution Status styling (Passed / Failed / Blocked / Not Executed)
  const getExecutionStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "passed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>Passed</span>
        </span>
      );
    }
    if (s === "failed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-2xs font-semibold text-rose-700 border border-rose-200">
          <XCircle className="h-3 w-3 text-rose-600" />
          <span>Failed</span>
        </span>
      );
    }
    if (s === "blocked") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 border border-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span>Blocked</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span>Not Executed</span>
      </span>
    );
  };

  // Status styling
  const getStatusBadge = (status: string) => {
    if (status === "approved") {
      return <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 border border-emerald-200">✓ Approved</span>;
    }
    if (status === "pending_review") {
      return <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-800 border border-amber-200">⊙ Under Review</span>;
    }
    if (status === "failed") {
      return <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-2xs font-medium text-rose-700 border border-rose-200">✕ Rejected</span>;
    }
    return <Badge value={status} />;
  };

  // Checkbox handling
  const toggleCheck = (id: number) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleCheckAll = () => {
    if (checkedIds.length === pagedTests.length) {
      setCheckedIds([]);
    } else {
      setCheckedIds(pagedTests.map((t) => t.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header matching Screenshot 3 */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
          <Link to="/projects" className="hover:text-slate-800 transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <Link to={`/projects/${projectId}`} className="hover:text-slate-800 transition-colors">
            {current?.name || "Project"}
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-slate-900 font-semibold">Test Cases</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Test Cases</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Test cases linked to project requirements and acceptance criteria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateTestsM.mutate()}
              loading={generateTestsM.isPending}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-600 mr-1" />
              <span>Generate Tests</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddTestOpen(true)}
              className="bg-[#3067DB] hover:bg-[#2554B8] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Add Test Case</span>
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

      {/* 6 Summary Metric Cards matching Screenshot 3 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Tests */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-[#3067DB]">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tests</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
          </div>
        </div>

        {/* Card 2: Approved */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Approved</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{approvedCount ?? "—"}</span>
          </div>
        </div>

        {/* Card 3: Acceptance Criteria */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-50 text-purple-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Acceptance Criteria</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{acCount ?? "—"}</span>
          </div>
        </div>

        {/* Card 4: Clause coverage */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-50 text-cyan-600">
              <Crosshair className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Clause coverage</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-900">{coveragePct == null ? "—" : `${coveragePct}%`}</span>
          </div>
        </div>

        {/* Card 5: Pending Review */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-50 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Review</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-600">{pendingCount ?? "—"}</span>
          </div>
        </div>

        {/* Card 6: Failed (Last Run) */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-red-50 text-red-600">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Failed (Last Run)</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-red-600">{failedCount ?? "—"}</span>
          </div>
        </div>
      </div>
      {latestExecutionQ.error && (
        <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>Could not load the latest execution summary.</span>
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => void latestExecutionQ.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Tabs Row matching Screenshot 3 */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab("cases")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "cases"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <FileText className="h-4 w-4" />
            <span>Test Cases ({totalCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("by_req")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "by_req"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Layers className="h-4 w-4" />
            <span>By Requirement</span>
          </button>

          <button
            onClick={() => setActiveTab("by_category")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "by_category"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>By Category</span>
          </button>

          <button
            onClick={() => nav(`/traceability?project_id=${projectId}`)}
            className="flex items-center gap-2 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Coverage</span>
          </button>

          <button
            onClick={() => setActiveTab("validation")}
            className={cn(
              "flex items-center gap-2 py-3 border-b-2 transition-colors",
              activeTab === "validation"
                ? "border-[#3067DB] text-[#3067DB] font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Crosshair className="h-4 w-4" />
            <span>Validation</span>
          </button>

          <button
            onClick={() => nav(`/executions?project_id=${projectId}`)}
            className="flex items-center gap-2 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Execution History</span>
          </button>
        </div>
      </div>

      {/* 10-Category Interactive Discovery & Filter Chips */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-2xs text-slate-500 font-medium">
          <span className="uppercase tracking-wider font-semibold text-slate-600 flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-[#3067DB]" />
            <span>Test Scenario Categories ({totalCount})</span>
          </span>
          {categoryFilter !== "all" && (
            <button
              onClick={() => {
                setCategoryFilter("all");
                setPage(1);
              }}
              className="inline-flex items-center gap-1 text-xs text-[#3067DB] hover:underline font-medium"
            >
              <X className="h-3 w-3" />
              <span>Show All Categories</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* All Chip */}
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all border",
              categoryFilter === "all"
                ? "bg-[#3067DB] text-white border-[#3067DB] shadow-xs font-semibold"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            <span>All Tests</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                categoryFilter === "all" ? "bg-white/20 text-white font-bold" : "bg-slate-100 text-slate-600"
              )}
            >
              {categoryCounts.all}
            </span>
          </button>

          {/* 10 Category Chips */}
          {Object.entries(TEST_CATEGORY_INFO).map(([key, info]) => {
            const count = categoryCounts[key] || 0;
            const isSelected = categoryFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategoryFilter(isSelected ? "all" : key);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all border",
                  isSelected
                    ? "bg-[#3067DB] text-white border-[#3067DB] shadow-xs font-semibold"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                )}
                title={info.description}
              >
                <span className="opacity-75 text-[11px] font-mono">{info.icon}</span>
                <span>{info.label.split(" / ")[0]}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                    isSelected ? "bg-white/20 text-white font-bold" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Category Rationale & Objective Banner */}
        {categoryFilter !== "all" && TEST_CATEGORY_INFO[categoryFilter] && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 flex items-start justify-between gap-3 text-xs text-blue-900 transition-all">
            <div className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#3067DB] font-bold text-xs mt-0.5">
                {TEST_CATEGORY_INFO[categoryFilter].icon}
              </span>
              <div>
                <div className="font-semibold text-slate-900">
                  {TEST_CATEGORY_INFO[categoryFilter].label} Testing Purpose & Rationale
                </div>
                <p className="text-slate-600 text-2xs mt-0.5 leading-relaxed">
                  {TEST_CATEGORY_INFO[categoryFilter].description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-2xs font-mono font-semibold text-[#3067DB]">
                {categoryCounts[categoryFilter] || 0} scenarios
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="relative w-full min-w-0 sm:w-auto sm:min-w-64 sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search test cases (ID, title, keyword...)"
            className="h-9 w-full pl-8 text-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Select
            className="h-9 w-40 max-w-full shrink-0 text-xs"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Category: All</option>
            <option value="positive">Nominal / Positive</option>
            <option value="negative">Negative</option>
            <option value="boundary_value">Boundary Value</option>
            <option value="edge_case">Edge Case</option>
            <option value="input_validation">Input Validation</option>
            <option value="business_rule">Business Rule</option>
            <option value="permission_role">Role / Permission</option>
            <option value="security">Security</option>
            <option value="error_handling">Error Handling</option>
            <option value="integration">Integration</option>
          </Select>

          <Select
            className="h-9 w-36 max-w-full shrink-0 text-xs"
            value={executionFilter}
            onChange={(e) => {
              setExecutionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Execution: All</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="not_executed">Not Executed</option>
          </Select>

          <Select
            className="h-9 w-32 max-w-full shrink-0 text-xs"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Review: All</option>
            <option value="approved">Approved</option>
            <option value="pending_review">Pending Review</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="failed">Rejected</option>
          </Select>

          <Select
            className="h-9 w-32 max-w-full shrink-0 text-xs"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Priority: All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          {(search || categoryFilter !== "all" || executionFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
                setExecutionFilter("all");
                setStatusFilter("all");
                setPriorityFilter("all");
                setPage(1);
              }}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              title="Reset all filters"
            >
              <X className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Master-Detail Layout matching Screenshot 3 */}
      <div ref={tableLayoutRef} className="relative grid min-w-0 grid-cols-1 items-start gap-4 2xl:grid-cols-12">
        <div className={cn("min-w-0 space-y-3", isDetailOpen ? "2xl:col-span-8" : "2xl:col-span-12")}>
          <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1100px] table-fixed text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="w-10 whitespace-nowrap px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={checkedIds.length === pagedTests.length && pagedTests.length > 0}
                      onChange={toggleCheckAll}
                    />
                  </th>
                  <th className="w-32 whitespace-nowrap px-3 py-2.5">Test ID</th>
                  <th className="w-[320px] whitespace-nowrap px-3 py-2.5">Test Title</th>
                  <th className="w-36 whitespace-nowrap px-3 py-2.5">Category</th>
                  <th className="w-24 whitespace-nowrap px-3 py-2.5">Priority</th>
                  <th className="w-36 whitespace-nowrap px-3 py-2.5">Linked Requirement</th>
                  <th className="w-32 whitespace-nowrap px-3 py-2.5 text-center">Execution Status</th>
                  <th className="w-28 whitespace-nowrap px-3 py-2.5">Review Status</th>
                  <th className="w-16 whitespace-nowrap px-2 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedTests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                      No test cases match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  pagedTests.map((t) => {
                    const isSelected = selectedTest?.id === t.id;
                    const isChecked = checkedIds.includes(t.id);
                    const cat = t.test_category || t.test_type;
                    const reqKey = t.requirement_key;
                    const execStatus = testExecutionMap.get(t.id) || "not_executed";

                    return (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelectedTestId(t.id);
                          setIsDetailOpen(true);
                        }}
                        className={cn(
                          "hover:bg-slate-50/80 cursor-pointer transition-colors",
                          isSelected ? "bg-blue-50/40 font-medium" : ""
                        )}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={isChecked}
                            onChange={() => toggleCheck(t.id)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium text-[#3067DB]">
                          {t.key}
                        </td>
                        <td className="truncate px-3 py-2.5 font-medium text-slate-900" title={t.title}>
                          {t.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {getCategoryBadge(cat)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <Badge value={t.priority} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {reqKey ? (
                            <Link
                              to={`/requirements/${t.requirement_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-xs text-[#3067DB] hover:underline inline-flex items-center gap-1 font-semibold"
                              title={`View requirement ${reqKey}`}
                            >
                              <span>{reqKey}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </Link>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-center">
                          {getExecutionStatusBadge(execStatus)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {getStatusBadge(t.status)}
                        </td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTestId(t.id);
                                setIsDetailOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="Inspect details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => nav(`/tests/${t.id}`)}
                              className="p-1 text-slate-400 hover:text-[#3067DB] rounded hover:bg-slate-100"
                              title="Open full test case page"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

            {/* Pagination footer matching Screenshot 3 */}
            <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-white">
              <span>
                Showing {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, filteredTests.length)} of {filteredTests.length} test cases
              </span>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500">Rows per page: {pageSize}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2.5 py-0.5 rounded bg-[#3067DB] text-white font-semibold text-xs">
                    {page}
                  </span>
                  {totalPages > 1 && (
                    <button
                      onClick={() => setPage(2)}
                      className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-xs"
                    >
                      2
                    </button>
                  )}
                  {totalPages > 2 && (
                    <button
                      onClick={() => setPage(3)}
                      className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-xs"
                    >
                      3
                    </button>
                  )}
                  {totalPages > 3 && <span className="text-slate-400">...</span>}
                  {totalPages > 3 && (
                    <button
                      onClick={() => setPage(totalPages)}
                      className="px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-xs"
                    >
                      {totalPages}
                    </button>
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isDetailOpen && selectedTest && (
          <ResponsiveDetailDrawer
            open={isDetailOpen}
            onOpenChange={setIsDetailOpen}
            title={`Test details: ${selectedTest.key}`}
            anchorRef={tableLayoutRef}
          >
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#3067DB]">{selectedTest.key}</span>
                  {getStatusBadge(selectedTest.status)}
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="Close details"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mt-2">{selectedTest.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedTest.description || "No description provided."}
              </p>

              {/* Badges Grid */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Category</span>
                  <div className="mt-0.5">
                    {getCategoryBadge(selectedTest.test_category || selectedTest.test_type || "Positive")}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Priority</span>
                  <div className="mt-0.5">
                    <Badge value={selectedTest.priority} />
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Linked Requirement(s)</span>
                  <span className="text-[#3067DB] font-mono text-xs font-semibold hover:underline block mt-0.5">
                    {selectedTest.requirement_key || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] block uppercase font-medium">Acceptance Criteria</span>
                  <span className="text-[#3067DB] font-mono text-xs font-semibold hover:underline block mt-0.5">
                    {selectedTest.ac_keys?.length ? selectedTest.ac_keys.join(", ") : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="border-b border-slate-200 px-4 bg-white">
              <div className="flex space-x-6 text-xs font-medium">
                <button
                  onClick={() => setTestSubTab("spec")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    testSubTab === "spec"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Test Specification
                </button>
                <button
                  onClick={() => setTestSubTab("trace")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    testSubTab === "trace"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Traceability
                </button>
                <button
                  onClick={() => setTestSubTab("exec")}
                  className={cn(
                    "py-2.5 border-b-2 transition-colors",
                    testSubTab === "exec"
                      ? "border-[#3067DB] text-[#3067DB] font-semibold"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  Execution
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Test Specification matching Screenshot 3 */}
            {testSubTab === "spec" && (
              <div className="p-4 space-y-4 text-xs">
                {/* Objective */}
                <div>
                  <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">
                    ⊙ Objective
                  </span>
                  <p className="text-slate-800 mt-1">
                    {selectedTest.description || "No objective provided."}
                  </p>
                </div>

                {/* Preconditions */}
                <div>
                  <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider">
                    ⊕ Preconditions
                  </span>
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap">
                    {selectedTest.preconditions || "No preconditions provided."}
                  </p>
                </div>

                {/* Test Steps */}
                <div>
                  <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider mb-2">
                    ⎘ Test Steps
                  </span>
                  <div className="space-y-2">
                    {(selectedTest.steps_json || selectedTest.steps || []).map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#3067DB] font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <div className="text-[11px] text-slate-800">
                          <p>{step.action}</p>
                          {step.expected && <p className="mt-0.5 text-slate-500">Expected: {step.expected}</p>}
                        </div>
                      </div>
                    ))}
                    {!selectedTest.steps_json?.length && !selectedTest.steps?.length && (
                      <p className="text-[11px] text-slate-500">No test steps provided.</p>
                    )}
                  </div>
                </div>

                {/* Test Data */}
                <div>
                  <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider mb-1">
                    ⛁ Test Data
                  </span>
                  <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-[11px] font-mono text-slate-800">
                    {selectedTest.test_data && Object.keys(selectedTest.test_data).length
                      ? JSON.stringify(selectedTest.test_data, null, 2)
                      : "No test data provided."}
                  </div>
                </div>

                {/* Expected Result */}
                <div>
                  <span className="text-slate-500 font-semibold block text-[11px] uppercase tracking-wider mb-1">
                    ✓ Expected Result
                  </span>
                  <div className="rounded border border-emerald-200 bg-emerald-50/60 p-3 text-[11px] text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      {selectedTest.expected_result || "No expected result provided."}
                    </span>
                  </div>
                </div>

                {/* Footer Review Controls */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Dual-Control Status: <strong className="text-slate-800">{selectedTest.status}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedTest.status === "pending_review" && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={reviewM.isPending}
                          onClick={() => reviewM.mutate({ id: selectedTest.id, decision: "approve" })}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={reviewM.isPending}
                          onClick={() => reviewM.mutate({ id: selectedTest.id, decision: "reject" })}
                          className="text-red-700 border-red-200 hover:bg-red-50"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {selectedTest.status === "approved" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => nav(`/executions?project_id=${projectId}`)}
                        className="bg-[#3067DB] hover:bg-[#2554B8] text-white"
                      >
                        Run Simulation
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Traceability */}
            {testSubTab === "trace" && (
              <div className="p-4 space-y-3 text-xs">
                <div className="rounded border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                  <span className="font-semibold text-slate-900 block">Grounding Provenance</span>
                  <p className="text-[11px] text-slate-600">
                    Traces to <strong>{selectedTest.requirement_key || "—"}</strong>
                    {selectedTest.clause_keys.length > 0 && ` · Clauses: ${selectedTest.clause_keys.join(", ")}`}
                    {selectedTest.quote_verified != null && ` · Source quote ${selectedTest.quote_verified ? "verified" : "not verified"}`}
                  </p>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Execution */}
            {testSubTab === "exec" && (
              <div className="p-4 space-y-3 text-xs">
                <div className="rounded border border-slate-200 p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900 block">Latest Execution Outcome</span>
                  <p className="text-[11px] text-slate-600">
                    {selectedTest.recent_results?.[0] ? (
                      <>Status: <span className="font-semibold">{selectedTest.recent_results[0].status}</span>
                        {" · "}Duration: {selectedTest.recent_results[0].duration_ms} ms</>
                    ) : "No execution result is available for this test case."}
                  </p>
                </div>
              </div>
            )}
          </div>
          </ResponsiveDetailDrawer>
        )}
      </div>

      {/* Add Test Case Modal */}
      {isAddTestOpen && (
        <AddTestCaseModal
          projectId={projectId}
          onClose={() => {
            setIsAddTestOpen(false);
            qc.invalidateQueries({ queryKey: ["tests"] });
          }}
        />
      )}
    </div>
  );
}

function AddTestCaseModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("positive");
  const [priority, setPriority] = useState("high");
  const [reqKey, setReqKey] = useState("");
  const [expected, setExpected] = useState("");

  const m = useMutation({
    mutationFn: () =>
      api.post("/tests", {
        project_id: projectId,
        title,
        test_type: category,
        priority,
        requirement_key: reqKey,
        expected_result: expected,
        status: "pending_review",
      }),
    onSuccess: () => {
      toast.ok("Test case authored and submitted for dual-control review");
      onClose();
    },
    onError: toast.error,
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add Test Case"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={title.length < 5}
            loading={m.isPending}
            onClick={() => m.mutate()}
          >
            Create Test Case
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <Field label="Title" htmlFor="tc-title">
          <Input id="tc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Verify employee can clock in successfully" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="tc-cat">
            <Select id="tc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="boundary">Boundary</option>
              <option value="permission">Permission</option>
              <option value="validation">Validation</option>
              <option value="business_rule">Business Rule</option>
            </Select>
          </Field>
          <Field label="Priority" htmlFor="tc-prio">
            <Select id="tc-prio" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </Field>
        </div>
        <Field label="Linked Requirement Key" htmlFor="tc-req">
          <Input id="tc-req" value={reqKey} onChange={(e) => setReqKey(e.target.value)} placeholder="Requirement key" />
        </Field>
        <Field label="Expected Result" htmlFor="tc-exp">
          <Textarea id="tc-exp" rows={3} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Expected outcome..." />
        </Field>
      </div>
    </Dialog>
  );
}
