import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Flame,
  GitCompare,
  List,
  Play,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { Button, Dialog, Field, Input, Select } from "@/components/ui";
import { api } from "@/services/api";
import type { Execution, ExecutionMetrics, Page, Project } from "@/types/models";
import { cn } from "@/utils/format";
import { CreateDefectFromResultModal } from "./CreateDefectFromResultModal";
import { ExecutionExportModal } from "./ExecutionExportModal";
import { ExecutionOverviewMetrics } from "./ExecutionOverviewMetrics";
import { ExecutionResultInspectionModal } from "./ExecutionResultInspectionModal";
import { ExecutionRunCompareModal } from "./ExecutionRunCompareModal";
import { ExecutionRunDetailView } from "./ExecutionRunDetailView";
import { ExecutionRunExplorerTable } from "./ExecutionRunExplorerTable";
import { ExecutionTimelineView } from "./ExecutionTimelineView";
import { FlakyTestExplorerModal } from "./FlakyTestExplorerModal";

interface ExecutionManagementWorkspaceProps {
  projectId: number;
  currentProject?: Project | null;
  initialRunId?: number | null;
}

export function ExecutionManagementWorkspace({
  projectId,
  initialRunId,
}: ExecutionManagementWorkspaceProps) {
  const qc = useQueryClient();

  // View state: table vs timeline
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  // Selected run state
  const [selectedRunId, setSelectedRunId] = useState<number | null>(initialRunId || null);

  // Active filter state from KPI cards
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // Modals state
  const [inspectingResultId, setInspectingResultId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);
  const [exportingRun, setExportingRun] = useState<Execution | null>(null);
  const [defectResultId, setDefectResultId] = useState<number | null>(null);
  const [isFlakyModalOpen, setIsFlakyModalOpen] = useState<boolean>(false);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState<boolean>(false);

  // 1. Query Execution Metrics (12 database metrics)
  const metricsQ = useQuery({
    queryKey: ["project-execution-metrics", projectId],
    queryFn: () => api.get<ExecutionMetrics>(`/projects/${projectId}/execution-metrics`),
    refetchInterval: 5000,
  });

  // 2. Query Project Executions
  const execsQ = useQuery({
    queryKey: ["project-executions", projectId],
    queryFn: () => api.get<Page<Execution>>("/executions", { project_id: projectId, page_size: 250 }),
    refetchInterval: (qq) =>
      qq.state.data?.items.some((e) => ["queued", "running"].includes(e.status)) ? 2000 : false,
  });

  const executions = execsQ.data?.items ?? [];

  // Parse filter from KPI click
  const filterStatus = (() => {
    if (!activeKpiFilter) return null;
    if (["passed", "failed", "blocked", "skipped"].includes(activeKpiFilter)) return activeKpiFilter;
    return null;
  })();

  const filterRunner = (() => {
    if (!activeKpiFilter) return null;
    if (activeKpiFilter.startsWith("runner_")) return activeKpiFilter.replace("runner_", "");
    return null;
  })();

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header & Trigger Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Enterprise Execution Intelligence & Results
            </h1>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-2xs font-semibold text-blue-700 border border-blue-200">
              Phase 4 Telemetry
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time execution governance, expected vs actual assertion matrices, failure diagnostics, and flaky test analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => setIsFlakyModalOpen(true)}>
            <Flame className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
            Flaky Diagnostics ({metricsQ.data?.flaky_tests_count || 0})
          </Button>

          {executions.length >= 2 && (
            <Button variant="secondary" onClick={() => setCompareRunId(selectedRunId || executions[0]?.id || null)}>
              <GitCompare className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Compare Executions
            </Button>
          )}

          <Button variant="primary" onClick={() => setIsNewRunModalOpen(true)}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Dispatch Execution
          </Button>
        </div>
      </div>

      {/* Phase 4A: Executive 12-Metric Governance Bar */}
      <ExecutionOverviewMetrics
        metrics={metricsQ.data}
        isLoading={metricsQ.isLoading}
        selectedFilter={activeKpiFilter}
        onSelectFilter={setActiveKpiFilter}
        onOpenFlakyModal={() => setIsFlakyModalOpen(true)}
      />

      {/* Main Content Area */}
      {selectedRunId ? (
        /* If a run is selected, show full execution run detail view */
        <ExecutionRunDetailView
          executionId={selectedRunId}
          onClose={() => setSelectedRunId(null)}
          onInspectResult={(resId) => setInspectingResultId(resId)}
          onOpenCompare={(runId) => setCompareRunId(runId)}
          onOpenExport={(ex) => setExportingRun(ex)}
          onCreateDefect={(resId) => setDefectResultId(resId)}
        />
      ) : (
        /* Otherwise show Explorer (Table vs Timeline) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Execution Runs Explorer</h2>
              <span className="text-xs text-slate-500 font-mono">({executions.length} runs recorded)</span>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  viewMode === "table" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <List className="h-3.5 w-3.5" />
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  viewMode === "timeline" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Timeline View
              </button>
            </div>
          </div>

          {viewMode === "table" ? (
            <ExecutionRunExplorerTable
              executions={executions}
              selectedRunId={selectedRunId}
              onSelectRun={(id) => setSelectedRunId(id)}
              onOpenCompare={(id) => setCompareRunId(id)}
              onOpenExport={(ex) => setExportingRun(ex)}
              filterStatus={filterStatus}
              filterRunner={filterRunner}
            />
          ) : (
            <ExecutionTimelineView
              executions={executions}
              selectedRunId={selectedRunId}
              onSelectRun={(id) => setSelectedRunId(id)}
            />
          )}
        </div>
      )}

      {/* Modals & Dialogs */}
      {inspectingResultId && (
        <ExecutionResultInspectionModal
          resultId={inspectingResultId}
          onClose={() => setInspectingResultId(null)}
          onCreateDefect={(resId) => {
            setInspectingResultId(null);
            setDefectResultId(resId);
          }}
        />
      )}

      {compareRunId && (
        <ExecutionRunCompareModal
          initialRunAId={compareRunId}
          runs={executions}
          onClose={() => setCompareRunId(null)}
        />
      )}

      {exportingRun && (
        <ExecutionExportModal
          execution={exportingRun}
          onClose={() => setExportingRun(null)}
        />
      )}

      {defectResultId && (
        <CreateDefectFromResultModal
          resultId={defectResultId}
          onClose={() => setDefectResultId(null)}
        />
      )}

      {isFlakyModalOpen && (
        <FlakyTestExplorerModal
          projectId={projectId}
          onClose={() => setIsFlakyModalOpen(false)}
          onInspectResult={(resId) => {
            setIsFlakyModalOpen(false);
            setInspectingResultId(resId);
          }}
        />
      )}

      {isNewRunModalOpen && (
        <NewExecutionModal
          projectId={projectId}
          onClose={() => {
            setIsNewRunModalOpen(false);
            qc.invalidateQueries({ queryKey: ["project-executions"] });
            qc.invalidateQueries({ queryKey: ["project-execution-metrics"] });
          }}
        />
      )}
    </div>
  );
}

function NewExecutionModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const toast = useToast();
  const [runType, setRunType] = useState("simulation");
  const [runName, setRunName] = useState("");

  const m = useMutation({
    mutationFn: () =>
      api.post("/executions", {
        project_id: projectId,
        execution_type: runType,
        source: "platform_run",
        log_excerpt: `Started new enterprise execution run: ${runName}`,
      }),
    onSuccess: (data: any) => {
      toast.ok(`New execution ${data.key || "run"} dispatched successfully!`);
      onClose();
    },
    onError: toast.error,
  });

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Dispatch Enterprise Test Execution"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!runName.trim()}
            loading={m.isPending}
            onClick={() => m.mutate()}
          >
            <Play className="h-4 w-4 mr-1.5" />
            Dispatch Run
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        <Field label="Run Name / Target Label" htmlFor="new-run-label">
          <Input
            id="new-run-label"
            value={runName}
            onChange={(e) => setRunName(e.target.value)}
            placeholder="e.g. Dayforce Sprint 14 Regression Suite"
          />
        </Field>

        <Field label="Execution Engine & Runner" htmlFor="new-run-engine">
          <Select id="new-run-engine" value={runType} onChange={(e) => setRunType(e.target.value)}>
            <option value="simulation">Deterministic Simulation Engine</option>
            <option value="specification_validation">Specification Validation Harness</option>
            <option value="external">External / CI Runner</option>
          </Select>
        </Field>

        <p className="text-slate-500 text-2xs leading-relaxed">
          Dispatches execution across verified test cases. Results, assertion evaluations, and duration telemetry will be persisted to the database.
        </p>
      </div>
    </Dialog>
  );
}
