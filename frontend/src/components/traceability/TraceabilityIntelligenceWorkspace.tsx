import {
  AlertTriangle,
  FileDown,
  Grid,
  History,
  Layers,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import {
  CoverageGapsData,
  CoverageHealthData,
  CoverageRecommendation,
  TraceabilityOverviewData,
} from "@/types/models";
import { cn } from "@/utils/format";
import { AdvancedCoverageMatrix } from "./AdvancedCoverageMatrix";
import { ChangeImpactAnalysis } from "./ChangeImpactAnalysis";
import { CoverageGapsExplorer } from "./CoverageGapsExplorer";
import { CoverageHealthAssessment } from "./CoverageHealthAssessment";
import { CoverageRecommendationPanel } from "./CoverageRecommendationPanel";
import { RequirementCoverageHierarchy } from "./RequirementCoverageHierarchy";
import { SelectedEntityData, TraceabilityDetailDrawer } from "./TraceabilityDetailDrawer";
import { TraceabilityAuditLedger } from "./TraceabilityAuditLedger";
import { TraceabilityExportModal } from "./TraceabilityExportModal";
import { TraceabilityOverviewMetrics } from "./TraceabilityOverviewMetrics";

interface TraceabilityIntelligenceWorkspaceProps {
  projectId: string | number;
  initialTab?: "hierarchy" | "gaps" | "matrix" | "impact" | "recommendations" | "audit";
}

export const TraceabilityIntelligenceWorkspace: React.FC<TraceabilityIntelligenceWorkspaceProps> = ({
  projectId,
  initialTab = "hierarchy",
}) => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "hierarchy" | "gaps" | "matrix" | "impact" | "recommendations" | "audit"
  >(initialTab);

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityData | null>(null);
  const [impactReqId, setImpactReqId] = useState<number | undefined>(undefined);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [hierarchyFilter, setHierarchyFilter] = useState("all");

  // 1. Fetch Overview Metrics
  const overviewQuery = useQuery({
    queryKey: ["traceability-overview", projectId],
    queryFn: () => api.get<TraceabilityOverviewData>(`/projects/${projectId}/traceability/overview`),
  });

  // 2. Fetch Health Assessment
  const healthQuery = useQuery({
    queryKey: ["traceability-health", projectId],
    queryFn: () => api.get<CoverageHealthData>(`/projects/${projectId}/traceability/health`),
  });

  // 3. Fetch Hierarchy Nodes
  const hierarchyQuery = useQuery({
    queryKey: ["traceability-hierarchy", projectId],
    queryFn: () =>
      api.get<any>(`/projects/${projectId}/traceability/hierarchy`, {
        page: 1,
        page_size: 100,
      }),
  });

  // 4. Fetch Gaps
  const gapsQuery = useQuery({
    queryKey: ["traceability-gaps", projectId],
    queryFn: () => api.get<CoverageGapsData>(`/projects/${projectId}/traceability/gaps`),
  });

  // 5. Fetch Recommendations
  const recommendationsQuery = useQuery({
    queryKey: ["traceability-recommendations", projectId],
    queryFn: () => api.get<any>(`/projects/${projectId}/traceability/recommendations`),
  });

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["traceability-overview", projectId] });
    qc.invalidateQueries({ queryKey: ["traceability-health", projectId] });
    qc.invalidateQueries({ queryKey: ["traceability-hierarchy", projectId] });
    qc.invalidateQueries({ queryKey: ["traceability-gaps", projectId] });
    qc.invalidateQueries({ queryKey: ["traceability-recommendations", projectId] });
    qc.invalidateQueries({ queryKey: ["advanced-matrix", projectId] });
  };

  const overview = overviewQuery.data;
  const health = healthQuery.data;
  const hierarchyNodes = hierarchyQuery.data?.nodes || [];
  const gaps = gapsQuery.data;
  const recommendations: CoverageRecommendation[] = recommendationsQuery.data?.recommendations || [];

  return (
    <div className="space-y-6">
      {/* 1. Executive Health Assessment */}
      {health && (
        <CoverageHealthAssessment
          data={health}
          onOpenGaps={() => setActiveTab("gaps")}
          onOpenRecommendations={() => setActiveTab("recommendations")}
          onOpenExport={() => setExportModalOpen(true)}
        />
      )}

      {/* 2. 12-Metric Database Governance Bar */}
      {overview && (
        <TraceabilityOverviewMetrics
          data={overview}
          activeFilter={hierarchyFilter}
          onFilterChange={(f) => {
            setHierarchyFilter(f);
            setActiveTab("hierarchy");
          }}
          onOpenGapsTab={() => setActiveTab("gaps")}
        />
      )}

      {/* 3. Navigation Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "hierarchy", label: "Verification Hierarchy", icon: Layers },
            {
              id: "gaps",
              label: `Coverage Gaps (${gaps?.total_gaps ?? 0})`,
              icon: AlertTriangle,
              badgeCls: gaps?.critical_gaps ? "bg-rose-100 text-rose-800" : undefined,
            },
            { id: "matrix", label: "2D Coverage Matrix", icon: Grid },
            { id: "impact", label: "Change Impact Intelligence", icon: Sparkles },
            {
              id: "recommendations",
              label: `QA Recommendations (${recommendations.length})`,
              icon: Zap,
            },
            { id: "audit", label: "Audit Ledger", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh database telemetry"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 4. Active Tab Content Panels */}
      <div>
        {activeTab === "hierarchy" && (
          <RequirementCoverageHierarchy
            nodes={hierarchyNodes}
            onSelectEntity={(e) => setSelectedEntity(e)}
            selectedEntityKey={selectedEntity?.key}
          />
        )}

        {activeTab === "gaps" && gaps && (
          <CoverageGapsExplorer
            data={gaps}
            projectId={projectId}
            onTargetUncoveredAcs={() => setActiveTab("recommendations")}
          />
        )}

        {activeTab === "matrix" && (
          <AdvancedCoverageMatrix projectId={projectId} />
        )}

        {activeTab === "impact" && (
          <ChangeImpactAnalysis
            projectId={projectId}
            initialRequirementId={impactReqId}
            requirements={hierarchyNodes.map((n: any) => ({
              id: n.id,
              key: n.key,
              title: n.title,
            }))}
          />
        )}

        {activeTab === "recommendations" && (
          <CoverageRecommendationPanel
            recommendations={recommendations}
            projectId={projectId}
            onTargetUncoveredAcs={() => {
              // Open Test Generation
              window.location.href = `/tests?project_id=${projectId}&action=generate`;
            }}
            onOpenDefects={() => {
              window.location.href = `/defects?project_id=${projectId}`;
            }}
            onOpenFlaky={() => {
              window.location.href = `/executions?project_id=${projectId}&tab=flaky`;
            }}
          />
        )}

        {activeTab === "audit" && (
          <TraceabilityAuditLedger projectId={projectId} />
        )}
      </div>

      {/* 5. Detail Slide-over Drawer */}
      <TraceabilityDetailDrawer
        entity={selectedEntity}
        projectId={projectId}
        onClose={() => setSelectedEntity(null)}
        onOpenImpactAnalysis={(reqId) => {
          setSelectedEntity(null);
          setImpactReqId(reqId);
          setActiveTab("impact");
        }}
      />

      {/* 6. Export Modal */}
      {exportModalOpen && overview && (
        <TraceabilityExportModal
          projectId={projectId}
          projectKey={overview.project_key}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
};
