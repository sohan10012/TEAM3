import {
  Filter,
  Layers,
  Search,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  TraceabilityHierarchyReqNode,
} from "@/types/models";
import { cn } from "@/utils/format";
import { SelectedEntityData } from "./TraceabilityDetailDrawer";
import { TraceabilityEntityNode } from "./TraceabilityEntityNode";

interface RequirementCoverageHierarchyProps {
  nodes: TraceabilityHierarchyReqNode[];
  onSelectEntity: (entity: SelectedEntityData) => void;
  selectedEntityKey?: string;
}

export const RequirementCoverageHierarchy: React.FC<RequirementCoverageHierarchyProps> = ({
  nodes,
  onSelectEntity,
  selectedEntityKey,
}) => {
  const [expandedReqs, setExpandedReqs] = useState<Set<number>>(new Set());
  const [expandedAcs, setExpandedAcs] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<string>("all");

  const toggleReq = (id: number) => {
    const next = new Set(expandedReqs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedReqs(next);
  };

  const toggleAc = (id: number) => {
    const next = new Set(expandedAcs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedAcs(next);
  };

  const expandAll = () => {
    setExpandedReqs(new Set(nodes.map((n) => n.id)));
    const allAcIds = new Set<number>();
    nodes.forEach((n) => n.acceptance_criteria.forEach((a) => allAcIds.add(a.id)));
    setExpandedAcs(allAcIds);
  };

  const collapseAll = () => {
    setExpandedReqs(new Set());
    setExpandedAcs(new Set());
  };

  // Filter nodes by search and coverage filter
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesSearch =
        !searchQuery ||
        n.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        coverageFilter === "all" ||
        (coverageFilter === "with_defects" && n.defects_count > 0) ||
        n.coverage_status === coverageFilter;

      return matchesSearch && matchesFilter;
    });
  }, [nodes, searchQuery, coverageFilter]);

  return (
    <div className="space-y-4">
      {/* 1. Explorer Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requirements in hierarchy..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Coverage Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-2xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filter:
          </span>
          {[
            { id: "all", label: "All Specifications" },
            { id: "fully_covered", label: "Fully Covered" },
            { id: "partially_covered", label: "Partially Covered" },
            { id: "uncovered", label: "Untested" },
            { id: "with_defects", label: "With Defects" },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCoverageFilter(pill.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer",
                coverageFilter === pill.id
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Expand / Collapse Actions */}
        <div className="flex items-center gap-1 text-2xs shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 2. Hierarchy Tree Container */}
      <div className="space-y-2.5">
        {nodes.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            <div className="max-w-md mx-auto space-y-3">
              <Layers className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Traceability Tree Generated Yet</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                This project has no specifications or test cases yet. Upload documents in Requirements Management to construct the 7-level verification hierarchy.
              </p>
            </div>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            No requirements match your current search or coverage filter.
          </div>
        ) : (
          filteredNodes.map((req) => {
            const isReqExpanded = expandedReqs.has(req.id);
            const isSelected = selectedEntityKey === req.key;

            return (
              <div
                key={req.id}
                className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all"
              >
                {/* Level 1: Requirement Node */}
                <TraceabilityEntityNode
                  type="requirement"
                  id={req.id}
                  entityKey={req.key}
                  title={req.title}
                  category={req.category}
                  priority={req.priority}
                  status={req.status}
                  coverageStatus={req.coverage_status}
                  childCount={req.clauses.length + req.acceptance_criteria.length}
                  isExpanded={isReqExpanded}
                  onToggleExpand={() => toggleReq(req.id)}
                  onClick={() =>
                    onSelectEntity({
                      type: "requirement",
                      id: req.id,
                      key: req.key,
                      title: req.title,
                      category: req.category,
                      priority: req.priority,
                      reviewStatus: req.review_status,
                      sourceSection: req.source_section ?? undefined,
                      sourcePage: req.source_page ?? undefined,
                      coverageStatus: req.coverage_status,
                      clauses: req.clauses.map((c) => ({ id: c.id, key: c.clause_key, text: c.text })),
                      acceptanceCriteria: req.acceptance_criteria.map((a) => ({
                        id: a.id,
                        key: a.key,
                        description: a.description,
                      })),
                      defects: req.defects,
                    })
                  }
                  isSelected={isSelected}
                />

                {/* Expanded Children Container */}
                {isReqExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-3 pl-6 space-y-3">
                    {/* Level 2: Atomic Clauses */}
                    {req.clauses.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-3xs uppercase font-bold text-slate-400 tracking-wider block">
                          Clauses ({req.clauses.length})
                        </span>
                        <div className="space-y-1">
                          {req.clauses.map((clause) => (
                            <TraceabilityEntityNode
                              key={clause.id}
                              type="clause"
                              id={clause.id}
                              entityKey={clause.clause_key}
                              title={clause.text}
                              onClick={() =>
                                onSelectEntity({
                                  type: "clause",
                                  id: clause.id,
                                  key: clause.clause_key,
                                  title: `Clause ${clause.position}: ${clause.clause_key}`,
                                  description: clause.text,
                                })
                              }
                              isSelected={selectedEntityKey === clause.clause_key}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Level 3: Acceptance Criteria */}
                    {req.acceptance_criteria.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-3xs uppercase font-bold text-slate-400 tracking-wider block">
                          Acceptance Criteria & Tests ({req.acceptance_criteria.length})
                        </span>
                        <div className="space-y-2">
                          {req.acceptance_criteria.map((ac) => {
                            const isAcExpanded = expandedAcs.has(ac.id);

                            return (
                              <div
                                key={ac.id}
                                className="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-2xs"
                              >
                                <TraceabilityEntityNode
                                  type="acceptance_criteria"
                                  id={ac.id}
                                  entityKey={ac.key}
                                  title={ac.description}
                                  priority={ac.review_status}
                                  childCount={ac.tests.length}
                                  isExpanded={isAcExpanded}
                                  onToggleExpand={ac.tests.length > 0 ? () => toggleAc(ac.id) : undefined}
                                  onClick={() =>
                                    onSelectEntity({
                                      type: "acceptance_criteria",
                                      id: ac.id,
                                      key: ac.key,
                                      title: ac.key,
                                      description: ac.description,
                                      sourceQuote: ac.source_quote,
                                      confidence: ac.confidence,
                                      reviewStatus: ac.review_status,
                                      tests: ac.tests.map((t) => ({
                                        id: t.id,
                                        key: t.key,
                                        title: t.title,
                                        category: t.category,
                                        latest_result: t.latest_result,
                                      })),
                                    })
                                  }
                                  isSelected={selectedEntityKey === ac.key}
                                />

                                {/* Level 4: Child Test Cases */}
                                {isAcExpanded && ac.tests.length > 0 && (
                                  <div className="border-t border-slate-100 bg-slate-50/50 p-2 pl-6 space-y-1.5">
                                    {ac.tests.map((test) => (
                                      <div key={test.id} className="space-y-1">
                                        <TraceabilityEntityNode
                                          type="test_case"
                                          id={test.id}
                                          entityKey={test.key}
                                          title={test.title}
                                          category={test.category}
                                          priority={test.priority}
                                          latestResult={test.latest_result}
                                          onClick={() =>
                                            onSelectEntity({
                                              type: "test_case",
                                              id: test.id,
                                              key: test.key,
                                              title: test.title,
                                              category: test.category,
                                              priority: test.priority,
                                              reviewStatus: test.review_status,
                                              defects: test.defects,
                                            })
                                          }
                                          isSelected={selectedEntityKey === test.key}
                                        />

                                        {/* Level 5: Test Defects if any */}
                                        {test.defects.length > 0 && (
                                          <div className="pl-6 space-y-1">
                                            {test.defects.map((def) => (
                                              <TraceabilityEntityNode
                                                key={def.id}
                                                type="defect"
                                                id={def.id}
                                                entityKey={def.key}
                                                title={def.title}
                                                priority={def.severity}
                                                onClick={() =>
                                                  onSelectEntity({
                                                    type: "defect",
                                                    id: def.id,
                                                    key: def.key,
                                                    title: def.title,
                                                    priority: def.severity,
                                                    status: def.status,
                                                  })
                                                }
                                                isSelected={selectedEntityKey === def.key}
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
