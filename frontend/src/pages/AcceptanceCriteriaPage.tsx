import { useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AcceptanceCriteriaManagementView } from "@/components/criteria/AcceptanceCriteriaManagementView";
import { useProjects } from "@/hooks/useProjects";

export function AcceptanceCriteriaPage() {
  const { projectId } = useProjects();
  const [searchParams] = useSearchParams();

  const paramProjectId = searchParams.get("project_id");
  const effectiveProjectId = paramProjectId ? parseInt(paramProjectId, 10) : projectId;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 min-h-[100dvh]">
        {effectiveProjectId ? (
          <AcceptanceCriteriaManagementView projectId={effectiveProjectId} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">No project selected</h3>
            <p className="text-xs text-slate-500">
              Please select a project from the top navigation bar to view acceptance criteria.
            </p>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default AcceptanceCriteriaPage;
