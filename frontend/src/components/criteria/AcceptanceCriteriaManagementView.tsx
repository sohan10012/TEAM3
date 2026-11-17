import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Layers,
  Sparkles,
  FileCheck2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Table as TableIcon,
  LayoutGrid,
  Eye,
  X,
} from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/services/api";
import { Criterion, Requirement } from "@/types/models";
import { cn, label } from "@/utils/format";
import {
  AcceptanceCriteriaOverviewMetrics,
  CriteriaFilterKey,
} from "./AcceptanceCriteriaOverviewMetrics";
import { AcceptanceCriteriaRowExpanded } from "./AcceptanceCriteriaRowExpanded";
import { AcceptanceCriteriaDetailDrawer } from "./AcceptanceCriteriaDetailDrawer";
import { AcceptanceCriteriaGenerationModal } from "./AcceptanceCriteriaGenerationModal";

export interface AcceptanceCriteriaManagementViewProps {
  projectId: number;
}

export function AcceptanceCriteriaManagementView({
  projectId,
}: AcceptanceCriteriaManagementViewProps) {
  const qc = useQueryClient();
  const toast = useToast();

  // View state
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [metricFilter, setMetricFilter] = useState<CriteriaFilterKey>("all");
  const [selectedReqFilter, setSelectedReqFilter] = useState<string>("all");
  const [selectedReviewFilter, setSelectedReviewFilter] = useState<string>("all");
  const [selectedGroundingFilter, setSelectedGroundingFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"key" | "confidence" | "status" | "tests">("key");

  // Selection & expansion states
  const [expandedCriteriaKeys, setExpandedCriteriaKeys] = useState<Set<string>>(new Set());
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const [inspectCriterionId, setInspectCriterionId] = useState<number | null>(null);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [targetReqForGen, setTargetReqForGen] = useState<{ id: number; key: string } | null>(null);

  // Query 1: All acceptance criteria for project
  const criteriaQ = useQuery({
    queryKey: ["project_criteria", projectId],
    queryFn: () => api.get<Criterion[]>(`/projects/${projectId}/acceptance-criteria`),
  });

  // Query 2: All requirements for project (for grouping & dropdown)
  const reqsQ = useQuery({
    queryKey: ["project_requirements", projectId],
    queryFn: () => api.get<{ items: Requirement[] }>(`/requirements?project_id=${projectId}&page_size=200`),
  });

  const allCriteria = useMemo(() => criteriaQ.data || [], [criteriaQ.data]);
  const allReqs = useMemo(() => reqsQ.data?.items || [], [reqsQ.data]);
  const reqMap = useMemo(() => new Map(allReqs.map((r) => [r.id, r])), [allReqs]);

  // Metric counts
  const totalCount = allCriteria.length;
  const approvedCount = allCriteria.filter((c) => c.review_status === "approved").length;
  const pendingCount = allCriteria.filter((c) => c.review_status === "pending").length;
  const clarificationCount = allCriteria.filter(
    (c) => c.review_status === "needs_clarification" || c.review_status === "changes_requested"
  ).length;
  const groundedCount = allCriteria.filter((c) => c.quote_verified).length;
  const inferredCount = allCriteria.filter((c) => !c.quote_verified).length;
  const linkedRequirementsCount = useMemo(() => {
    return new Set(allCriteria.map((c) => c.requirement_id).filter(Boolean)).size;
  }, [allCriteria]);
  const uncoveredCount = allCriteria.filter((c) => (c.linked_test_count || 0) === 0).length;

  // Review mutation
  const reviewM = useMutation({
    mutationFn: ({ id, decision, comment }: { id: number; decision: string; comment?: string }) =>
      api.post(`/acceptance-criteria/${id}/review`, { decision, comment: comment || "" }),
    onSuccess: () => {
      toast.ok("Review recorded successfully");
      qc.invalidateQueries({ queryKey: ["project_criteria", projectId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to record review"),
  });

  // Filtered criteria list
  const filteredCriteria = useMemo(() => {
    return allCriteria.filter((c) => {
      // Metric card filter
      if (metricFilter === "approved" && c.review_status !== "approved") return false;
      if (metricFilter === "pending" && c.review_status !== "pending") return false;
      if (
        metricFilter === "needs_clarification" &&
        c.review_status !== "needs_clarification" &&
        c.review_status !== "changes_requested"
      )
        return false;
      if (metricFilter === "grounded" && !c.quote_verified) return false;
      if (metricFilter === "inferred" && c.quote_verified) return false;
      if (metricFilter === "uncovered" && (c.linked_test_count || 0) > 0) return false;

      // Dropdown filters
      if (selectedReqFilter !== "all" && String(c.requirement_id) !== selectedReqFilter) return false;
      if (selectedReviewFilter !== "all" && c.review_status !== selectedReviewFilter) return false;
      if (selectedGroundingFilter === "grounded" && !c.quote_verified) return false;
      if (selectedGroundingFilter === "inferred" && c.quote_verified) return false;
      if (selectedCategoryFilter !== "all" && c.requirement_category !== selectedCategoryFilter)
        return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = c.key?.toLowerCase().includes(q);
        const matchReqKey = c.requirement_key?.toLowerCase().includes(q);
        const matchDesc = c.description?.toLowerCase().includes(q);
        const matchActor = c.actor?.toLowerCase().includes(q);
        const matchAction = c.action?.toLowerCase().includes(q);
        const matchQuote = c.source_quote?.toLowerCase().includes(q);
        const matchClauses = Array.isArray(c.clause_keys) && c.clause_keys.some((ck) => ck.toLowerCase().includes(q));
        if (!matchKey && !matchReqKey && !matchDesc && !matchActor && !matchAction && !matchQuote && !matchClauses) {
          return false;
        }
      }

      return true;
    });
  }, [
    allCriteria,
    metricFilter,
    selectedReqFilter,
    selectedReviewFilter,
    selectedGroundingFilter,
    selectedCategoryFilter,
    searchQuery,
  ]);

  // Sorted criteria
  const sortedCriteria = useMemo(() => {
    const list = [...filteredCriteria];
    if (sortBy === "confidence") {
      list.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } else if (sortBy === "status") {
      list.sort((a, b) => (a.review_status || "").localeCompare(b.review_status || ""));
    } else if (sortBy === "tests") {
      list.sort((a, b) => (b.linked_test_count || 0) - (a.linked_test_count || 0));
    } else {
      list.sort((a, b) => (a.key || "").localeCompare(b.key || ""));
    }
    return list;
  }, [filteredCriteria, sortBy]);

  // Grouped by requirement
  const groupedByReq = useMemo(() => {
    const groups: Array<{
      requirement: Requirement | { id: number; key: string; title: string; category?: string; priority?: string };
      criteria: Criterion[];
    }> = [];

    const reqCriteriaMap = new Map<number, Criterion[]>();
    for (const c of sortedCriteria) {
      const rid = c.requirement_id || -1;
      if (!reqCriteriaMap.has(rid)) {
        reqCriteriaMap.set(rid, []);
      }
      reqCriteriaMap.get(rid)!.push(c);
    }

    reqCriteriaMap.forEach((critList, rid) => {
      const rObj = reqMap.get(rid) || {
        id: rid,
        key: critList[0]?.requirement_key || `REQ-${rid}`,
        title: critList[0]?.requirement_title || "Requirement Specification",
        category: critList[0]?.requirement_category || "functional",
        priority: critList[0]?.requirement_priority || "medium",
      };
      groups.push({ requirement: rObj as any, criteria: critList });
    });

    return groups;
  }, [sortedCriteria, reqMap]);

  const toggleExpandCriterion = (key: string) => {
    setExpandedCriteriaKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCollapseGroup = (reqKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(reqKey)) next.delete(reqKey);
      else next.add(reqKey);
      return next;
    });
  };

  const hasActiveFilters =
    metricFilter !== "all" ||
    selectedReqFilter !== "all" ||
    selectedReviewFilter !== "all" ||
    selectedGroundingFilter !== "all" ||
    selectedCategoryFilter !== "all" ||
    searchQuery.trim().length > 0;

  const clearAllFilters = () => {
    setMetricFilter("all");
    setSelectedReqFilter("all");
    setSelectedReviewFilter("all");
    setSelectedGroundingFilter("all");
    setSelectedCategoryFilter("all");
    setSearchQuery("");
  };

  // Distinct categories for filter
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    allCriteria.forEach((c) => {
      if (c.requirement_category) set.add(c.requirement_category);
    });
    return Array.from(set);
  }, [allCriteria]);

  return (
    <div className="space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Acceptance Criteria Workspace
            </h1>
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Project #{projectId}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Behavior-driven specifications, verbatim quote guardrails, and bidirectional traceability.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                viewMode === "grouped"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grouped by Requirement</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
                viewMode === "flat"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Flat Table</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setTargetReqForGen(null);
              setGenerationModalOpen(true);
            }}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate Criteria</span>
          </Button>
        </div>
      </div>

      {/* 8 Executive Metrics */}
      <AcceptanceCriteriaOverviewMetrics
        totalCount={totalCount}
        approvedCount={approvedCount}
        pendingCount={pendingCount}
        clarificationCount={clarificationCount}
        groundedCount={groundedCount}
        inferredCount={inferredCount}
        linkedRequirementsCount={linkedRequirementsCount}
        uncoveredCount={uncoveredCount}
        activeFilter={metricFilter}
        onFilterChange={setMetricFilter}
      />

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search criteria key, description, actor, action, clause citation..."
              className="pl-8.5 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Requirement Filter */}
            <Select
              value={selectedReqFilter}
              onChange={(e) => setSelectedReqFilter(e.target.value)}
              className="h-9 text-xs w-44"
            >
              <option value="all">All Requirements</option>
              {allReqs.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.key} — {r.title.slice(0, 24)}...
                </option>
              ))}
            </Select>

            {/* Review Status */}
            <Select
              value={selectedReviewFilter}
              onChange={(e) => setSelectedReviewFilter(e.target.value)}
              className="h-9 text-xs w-36"
            >
              <option value="all">All Review States</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Review</option>
              <option value="needs_clarification">Needs Clarification</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="rejected">Rejected</option>
            </Select>

            {/* Grounding Status */}
            <Select
              value={selectedGroundingFilter}
              onChange={(e) => setSelectedGroundingFilter(e.target.value)}
              className="h-9 text-xs w-36"
            >
              <option value="all">All Grounding</option>
              <option value="grounded">Document Grounded</option>
              <option value="inferred">Model Inferred</option>
            </Select>

            {/* Category */}
            {distinctCategories.length > 0 && (
              <Select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="h-9 text-xs w-32"
              >
                <option value="all">All Categories</option>
                {distinctCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {label(cat)}
                  </option>
                ))}
              </Select>
            )}

            {/* Sort */}
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 text-xs w-32 font-medium text-slate-700"
            >
              <option value="key">Sort: Key</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="status">Sort: Status</option>
              <option value="tests">Sort: Test Count</option>
            </Select>

            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAllFilters}
                className="h-9 text-xs text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Results summary pill */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredCriteria.length}</strong> of{" "}
            <strong>{totalCount}</strong> criteria
            {metricFilter !== "all" && (
              <span className="ml-1 text-blue-600 font-medium">
                (filtered by {label(metricFilter)})
              </span>
            )}
          </span>

          <span className="text-[11px] text-slate-400">
            {groupedByReq.length} distinct requirement group{groupedByReq.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {criteriaQ.isLoading ? (
        <div className="py-20 text-center text-sm text-slate-500 space-y-3">
          <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading acceptance criteria and trace matrices...</p>
        </div>
      ) : filteredCriteria.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mx-auto">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {hasActiveFilters ? "No matching acceptance criteria" : "No acceptance criteria in this project yet"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? "Try adjusting your search queries or clearing active filters."
              : "Generate Given-When-Then criteria from project requirements using the 7-stage LLM intelligence pipeline."}
          </p>
          {hasActiveFilters ? (
            <Button size="sm" variant="secondary" onClick={clearAllFilters} className="mx-auto text-xs">
              Clear All Filters
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setTargetReqForGen(null);
                setGenerationModalOpen(true);
              }}
              className="mx-auto text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Generate Criteria Now</span>
            </Button>
          )}
        </div>
      ) : viewMode === "grouped" ? (
        /* View Mode A: Grouped by Requirement */
        <div className="space-y-4">
          {groupedByReq.map((group) => {
            const req = group.requirement;
            const isGroupCollapsed = collapsedGroupKeys.has(req.key);
            const reqCriteria = group.criteria;
            const coveredInGroup = reqCriteria.filter((c) => (c.linked_test_count || 0) > 0).length;

            return (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all duration-150"
              >
                {/* Group Header */}
                <div
                  onClick={() => toggleCollapseGroup(req.key)}
                  className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-slate-600 transition-transform"
                    >
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform duration-150", isGroupCollapsed && "-rotate-90")}
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {req.key}
                        </span>
                        {req.category && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider rounded bg-slate-200/70 text-slate-700 px-1.5 py-0.5">
                            {req.category}
                          </span>
                        )}
                        {req.priority && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider rounded bg-blue-100 text-blue-800 px-1.5 py-0.5">
                            {req.priority}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-semibold text-slate-800 mt-0.5">
                        {req.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-1 font-semibold text-slate-700 shadow-2xs text-[11px]">
                      <ShieldCheck className="h-3 w-3 text-blue-600" />
                      {reqCriteria.length} Criteria
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold shadow-2xs",
                        coveredInGroup === reqCriteria.length
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : coveredInGroup > 0
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      )}
                    >
                      {coveredInGroup}/{reqCriteria.length} Covered
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetReqForGen({ id: req.id, key: req.key });
                        setGenerationModalOpen(true);
                      }}
                      className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                      title="Generate additional criteria for this requirement"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Generate</span>
                    </Button>
                  </div>
                </div>

                {/* Criteria Rows within Requirement */}
                {!isGroupCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {reqCriteria.map((c) => {
                      const isExpanded = expandedCriteriaKeys.has(c.key);
                      const confidence = Math.round((c.confidence || 0) * 100);

                      return (
                        <div key={c.id} className="transition-colors hover:bg-slate-50/50">
                          {/* Row Summary Bar */}
                          <div
                            onClick={() => toggleExpandCriterion(c.key)}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                className="text-slate-400 hover:text-slate-600 transition-transform"
                              >
                                <ChevronRight
                                  className={cn("h-4 w-4 transition-transform duration-150", isExpanded && "rotate-90 text-blue-600")}
                                />
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-900">
                                    {c.key}
                                  </span>

                                  {/* Grounding pill */}
                                  {c.quote_verified ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-teal-800">
                                      <FileCheck2 className="h-3 w-3 text-teal-600" />
                                      Grounded
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-800">
                                      <Sparkles className="h-3 w-3 text-indigo-600" />
                                      Inferred
                                    </span>
                                  )}

                                  {/* Review status badge */}
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider",
                                      c.review_status === "approved"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : c.review_status === "needs_clarification"
                                        ? "bg-purple-100 text-purple-800"
                                        : c.review_status === "rejected"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800"
                                    )}
                                  >
                                    {label(c.review_status)}
                                  </span>

                                  {/* Actor badge */}
                                  {c.actor && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                                      <span className="text-slate-400">Actor:</span>
                                      <span className="text-slate-700">{c.actor}</span>
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-700 mt-1 line-clamp-1 leading-snug">
                                  {c.description}
                                </p>
                              </div>
                            </div>

                            {/* Right side row indicators & action */}
                            <div className="flex items-center gap-3 shrink-0 text-xs">
                              {/* Test count pill */}
                              {(c.linked_test_count || 0) > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                                  <Layers className="h-3 w-3 text-indigo-600" />
                                  {c.linked_test_count} Test{(c.linked_test_count || 0) !== 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  <AlertTriangle className="h-3 w-3 text-rose-500" />
                                  0 Tests
                                </span>
                              )}

                              <span className="text-[11px] font-semibold text-slate-500">
                                {confidence}%
                              </span>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectCriterionId(c.id);
                                }}
                                className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Inspect</span>
                              </Button>
                            </div>
                          </div>

                          {/* Inline Expanded Component */}
                          {isExpanded && (
                            <AcceptanceCriteriaRowExpanded
                              criterion={c}
                              onInspect={(crit) => setInspectCriterionId(crit.id)}
                              onReview={(crit, decision, comment) =>
                                reviewM.mutate({ id: crit.id, decision, comment })
                              }
                              onEdit={() => setInspectCriterionId(c.id)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* View Mode B: Flat High-Density Data Table */
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-3">AC Key</th>
                  <th className="px-3.5 py-3">Parent Req</th>
                  <th className="px-3.5 py-3">Actor / Action Statement</th>
                  <th className="px-3.5 py-3">Grounding</th>
                  <th className="px-3.5 py-3">Review Status</th>
                  <th className="px-3.5 py-3">Coverage</th>
                  <th className="px-3.5 py-3">Confidence</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCriteria.map((c) => {
                  const isExpanded = expandedCriteriaKeys.has(c.key);
                  const confidence = Math.round((c.confidence || 0) * 100);

                  return (
                    <>
                      <tr
                        key={c.id}
                        onClick={() => toggleExpandCriterion(c.key)}
                        className={cn(
                          "cursor-pointer hover:bg-slate-50/80 transition-colors",
                          isExpanded && "bg-blue-50/30"
                        )}
                      >
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight
                              className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isExpanded && "rotate-90 text-blue-600")}
                            />
                            <span>{c.key}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {c.requirement_key || `REQ-${c.requirement_id}`}
                          </span>
                        </td>

                        <td className="px-3.5 py-3 max-w-md">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block line-clamp-1">
                              {c.actor ? `${c.actor}: ` : ""}
                              {c.action || c.description}
                            </span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                              {c.expected_behaviour}
                            </span>
                          </div>
                        </td>

                        <td className="px-3.5 py-3 whitespace-nowrap">
                          {c.quote_verified ? (
                            <span className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                              <FileCheck2 className="h-3 w-3 text-teal-600" />
                              Grounded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                              <Sparkles className="h-3 w-3 text-indigo-600" />
                              Inferred
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              c.review_status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.review_status === "needs_clarification"
                                ? "bg-purple-100 text-purple-800"
                                : c.review_status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            {label(c.review_status)}
                          </span>
                        </td>

                        <td className="px-3.5 py-3 whitespace-nowrap">
                          {(c.linked_test_count || 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                              {c.linked_test_count} Tests
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Uncovered
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-700 text-xs">
                            {confidence}%
                          </span>
                        </td>

                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectCriterionId(c.id);
                            }}
                            className="h-7 text-xs bg-white text-blue-700 border-blue-200 shadow-2xs font-medium"
                          >
                            <span>Inspect</span>
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded row in table mode */}
                      {isExpanded && (
                        <tr key={`${c.id}-expanded`}>
                          <td colSpan={8} className="p-0 border-b border-slate-200">
                            <AcceptanceCriteriaRowExpanded
                              criterion={c}
                              onInspect={(crit) => setInspectCriterionId(crit.id)}
                              onReview={(crit, decision, comment) =>
                                reviewM.mutate({ id: crit.id, decision, comment })
                              }
                              onEdit={() => setInspectCriterionId(c.id)}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contextual Right-Side Detail Drawer */}
      <AcceptanceCriteriaDetailDrawer
        criterionId={inspectCriterionId}
        open={inspectCriterionId !== null}
        onClose={() => setInspectCriterionId(null)}
        onCriterionUpdated={() => qc.invalidateQueries({ queryKey: ["project_criteria", projectId] })}
      />

      {/* Generation Modal */}
      {generationModalOpen && (
        <AcceptanceCriteriaGenerationModal
          open={generationModalOpen}
          onClose={() => setGenerationModalOpen(false)}
          projectId={projectId}
          requirementId={targetReqForGen?.id}
          requirementKey={targetReqForGen?.key}
          onGenerationComplete={() => qc.invalidateQueries({ queryKey: ["project_criteria", projectId] })}
        />
      )}
    </div>
  );
}
