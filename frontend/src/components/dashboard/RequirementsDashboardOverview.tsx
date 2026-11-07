import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Layers3,
  PlayCircle,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import type { Execution, RequirementsDashboardData } from "@/types/models";
import { cn, fmtDuration, label } from "@/utils/format";

type OverviewData = Pick<
  RequirementsDashboardData,
  "project" | "documents_summary" | "requirements_summary" | "test_design_summary" | "execution_summary"
>;

interface Props {
  data: OverviewData;
  recentExecutions: Execution[];
  executionsLoading: boolean;
  executionsError: Error | null;
  onRetryExecutions: () => void;
  onUpload: () => void;
  onGenerateTests: () => void;
  onRunSimulation: () => void;
  generatingTests: boolean;
  runningSimulation: boolean;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stageStatus(completed: number, total: number, failed = 0) {
  if (failed > 0) return "Needs attention";
  if (total === 0) return "Not started";
  return completed >= total ? "Complete" : "In progress";
}

function ProgressStage({
  icon: Icon,
  title,
  completed,
  total,
  failed,
  color,
  barColor,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  completed: number;
  total: number;
  failed?: number;
  color: string;
  barColor: string;
  detail: string;
}) {
  const value = percentage(completed, total);
  const status = stageStatus(completed, total, failed);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", color)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{detail}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-slate-800">{value}%</p>
          <p className={cn("text-2xs", failed ? "text-amber-700" : "text-slate-500")}>{status}</p>
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${title} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", failed ? "bg-amber-500" : barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      {failed ? <p className="text-xs text-amber-700">{failed} item{failed === 1 ? "" : "s"} need attention</p> : null}
    </div>
  );
}

export function RequirementsDashboardOverview({
  data,
  recentExecutions,
  executionsLoading,
  executionsError,
  onRetryExecutions,
  onUpload,
  onGenerateTests,
  onRunSimulation,
  generatingTests,
  runningSimulation,
}: Props) {
  const { project, documents_summary: documents, requirements_summary: requirements,
    test_design_summary: tests, execution_summary: executions } = data;
  const runCount = executions.specification_validation_runs + executions.simulation_runs + executions.external_executions;
  const latest = executions.latest_run ?? recentExecutions[0] ?? null;
  const runTotal = latest?.total ?? 0;
  const runPassed = latest?.passed ?? 0;
  const runFailed = latest?.failed ?? 0;
  const latestRunId = latest?.id;
  const latestRunKey = latest?.key;
  const activities = [
    ...(documents.latest_document
      ? [{
          id: `document-${documents.latest_document.id}`,
          kind: "document" as const,
          title: documents.latest_document.filename,
          detail: `Document ${documents.latest_document.status.replace(/_/g, " ")}`,
          timestamp: formatTimestamp(documents.latest_document.created_at),
          href: "/requirements",
          failed: documents.latest_document.status === "failed",
        }]
      : []),
    ...recentExecutions.map((run) => ({
      id: `run-${run.id}`,
      kind: "run" as const,
      title: run.key,
      detail: `${label(run.status)} · ${run.passed} / ${run.total} tests · ${fmtDuration(run.duration_ms)}`,
      timestamp: formatTimestamp(run.started_at),
      href: `/executions/${run.id}`,
      failed: ["failed", "error", "timed_out"].includes(run.status),
      status: run.status,
    })),
  ];

  const cards = [
    {
      title: "Documents Processed",
      value: documents.total,
      detail: `${documents.completed} processed${documents.processing ? ` · ${documents.processing} processing` : ""}`,
      status: documents.failed ? `${documents.failed} failed` : documents.total ? "Current" : "Not started",
      icon: FileText,
      color: "bg-blue-50 text-blue-700",
      statusColor: documents.failed ? "text-amber-700" : "text-slate-500",
    },
    {
      title: "Requirements Extracted",
      value: requirements.total,
      detail: `${requirements.approved} approved · ${requirements.awaiting_review} in review`,
      status: requirements.open_clarifications ? `${requirements.open_clarifications} clarifications` : "Current",
      icon: Layers3,
      color: "bg-violet-50 text-violet-700",
      statusColor: requirements.open_clarifications ? "text-amber-700" : "text-slate-500",
    },
    {
      title: "Test Cases Generated",
      value: tests.total_tests,
      detail: `${tests.approved_tests} approved · ${tests.uncovered_requirements} uncovered`,
      status: tests.uncovered_requirements ? "Coverage gaps" : tests.total_tests ? "Current" : "Not started",
      icon: FileCheck2,
      color: "bg-indigo-50 text-indigo-700",
      statusColor: tests.uncovered_requirements ? "text-amber-700" : "text-slate-500",
    },
    {
      title: "Test Executions",
      value: runCount,
      detail: latest
        ? `${label(latest.status)} · ${latest.passed} / ${latest.total} tests in latest run`
        : runCount
          ? "Latest run details unavailable"
          : "No runs recorded",
      status: latest?.status.replace(/_/g, " ") ?? (runCount ? "History available" : "Not started"),
      icon: PlayCircle,
      color: "bg-emerald-50 text-emerald-700",
      statusColor: latest?.status === "passed"
        ? "text-emerald-700"
        : latest ? "text-amber-700" : "text-slate-500",
    },
  ];

  const workflow = [
    { title: "Documents", completed: documents.completed, total: documents.total, failed: documents.failed, icon: FileText, color: "bg-blue-50 text-blue-700", barColor: "bg-blue-600", detail: `${documents.completed} of ${documents.total} processed` },
    { title: "Requirements", completed: requirements.approved, total: requirements.total, failed: 0, icon: Layers3, color: "bg-violet-50 text-violet-700", barColor: "bg-violet-600", detail: `${requirements.approved} of ${requirements.total} approved` },
    { title: "Test design", completed: tests.approved_tests, total: tests.total_tests, failed: 0, icon: FileCheck2, color: "bg-indigo-50 text-indigo-700", barColor: "bg-indigo-600", detail: `${tests.approved_tests} of ${tests.total_tests} approved` },
    { title: "Execution", completed: runPassed, total: runTotal, failed: runFailed, icon: PlayCircle, color: "bg-emerald-50 text-emerald-700", barColor: "bg-emerald-600", detail: latest ? `${runPassed} of ${runTotal} passed in latest run` : runCount ? `${runCount} executions recorded` : "No executions recorded" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-2xs font-medium text-slate-600">
              {project.key}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            {project.name} quality status across document processing, requirement review, test design, and execution.
          </p>
        </div>
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:self-auto"
        >
          Project details <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </header>

      <section aria-label="Quality metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, detail, status, icon: Icon, color, statusColor }) => (
          <article key={title} className="flex min-h-36 min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium text-slate-600">{title}</h2>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color)}>
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value.toLocaleString()}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <p className="text-xs text-slate-500">{detail}</p>
                <span className={cn("inline-flex items-center gap-1 text-2xs font-medium capitalize", statusColor)}>
                  {status === "passed" || status === "Current" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
                  {status}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="workflow-title" className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="workflow-title" className="text-base font-semibold text-slate-900">Workflow overview</h2>
            <p className="mt-1 text-sm text-slate-500">Progress through the project quality lifecycle.</p>
          </div>
          <span className="text-xs text-slate-500">Based on current project records</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {workflow.map(({ title, completed, total, failed, icon: Icon, color, detail }, index) => {
            const status = stageStatus(completed, total, failed);
            return (
              <div key={title} className="relative flex min-w-0 items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-2xs font-semibold text-slate-400">0{index + 1}</span>
                      <h3 className="truncate text-sm font-medium text-slate-800">{title}</h3>
                    </div>
                    {status === "Complete" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Complete" />
                    ) : failed ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Needs attention" />
                    ) : (
                      <Clock3 className="h-4 w-4 shrink-0 text-slate-400" aria-label={status} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{detail}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage(completed, total)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(220px,0.8fr)]">
        <section aria-labelledby="progress-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-5">
            <h2 id="progress-title" className="text-base font-semibold text-slate-900">Project progress</h2>
            <p className="mt-1 text-sm text-slate-500">Completion by quality workflow stage.</p>
          </div>
          <div className="space-y-5">
            {workflow.map((stage) => <ProgressStage key={stage.title} {...stage} />)}
          </div>
        </section>

        <section aria-labelledby="activity-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="activity-title" className="text-base font-semibold text-slate-900">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">Latest documents and recorded test runs.</p>
            </div>
            <Link to="/executions" className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-800">
              View runs <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {executionsError ? (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>Could not load recent execution activity.</span>
              <button type="button" className="font-medium underline underline-offset-2" onClick={onRetryExecutions}>Retry</button>
            </div>
          ) : null}
          {executionsLoading && recentExecutions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading recent executions...</p>
          ) : null}
          {activities.length ? (
            <ol className="divide-y divide-slate-100">
              {activities.map((activity) => {
                const Icon = activity.kind === "document" ? FileText : PlayCircle;
                return (
                  <li key={activity.id} className="relative py-3 first:pt-0 last:pb-0">
                    <Link to={activity.href} className="group flex min-w-0 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <span className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        activity.failed ? "bg-amber-50 text-amber-700" : activity.kind === "document" ? "bg-blue-50 text-blue-700" : activity.status === "passed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                      )}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium text-slate-800 group-hover:text-blue-700">{activity.title}</span>
                        <span className="mt-0.5 block break-words text-xs capitalize text-slate-500">{activity.detail}</span>
                        {activity.timestamp ? <time className="mt-1 block text-2xs text-slate-400">{activity.timestamp}</time> : null}
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-600" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
              <Clock3 className="h-6 w-6 text-slate-400" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-700">No recent activity</p>
              <p className="mt-1 text-xs text-slate-500">Documents and test runs will appear here when recorded.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="actions-title" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4">
            <h2 id="actions-title" className="text-base font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-500">Continue the quality workflow.</p>
          </div>
          <div className="space-y-2">
            <Button variant="primary" className="h-10 w-full justify-start rounded-lg" onClick={onUpload}>
              <Upload className="h-4 w-4" aria-hidden /> Upload documents
            </Button>
            <Link to="/requirements" className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
              <Layers3 className="h-4 w-4 text-violet-600" aria-hidden /> Review requirements
            </Link>
            <Button variant="secondary" className="h-10 w-full justify-start rounded-lg" loading={generatingTests} onClick={onGenerateTests}>
              <FileCheck2 className="h-4 w-4 text-indigo-600" aria-hidden /> Generate test cases
            </Button>
            <Button variant="secondary" className="h-10 w-full justify-start rounded-lg" loading={runningSimulation} onClick={onRunSimulation}>
              <PlayCircle className="h-4 w-4 text-emerald-600" aria-hidden /> Run simulation
            </Button>
          </div>
          {latestRunId && latestRunKey ? (
            <Link to={`/executions/${latestRunId}`} className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs hover:bg-slate-100">
              <span className="min-w-0">
                <span className="block text-slate-500">Latest execution</span>
                <span className="mt-0.5 block truncate font-mono font-medium text-slate-800">{latestRunKey}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
