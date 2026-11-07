import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, GitCommit } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DataTable, FilterChips } from "@/components/DataTable";
import { TestRunsManagementView } from "@/components/executions/TestRunsManagementView";
import { RunProgress } from "@/components/RunProgress";
import { useToast } from "@/components/Toast";
import { Badge, Button, Code, Dialog, EmptyState, ErrorState, Field, Input, Key, KV, LoadingBlock, Notice, PageHeader,
  Panel, Select, Tabs, Textarea } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api, downloadUrl } from "@/services/api";
import type { Defect, Execution, ExecResult, Page, Project, User } from "@/types/models";
import { cn, fmtDate, fmtDuration, label } from "@/utils/format";

function CodeBasedExecutionsView({ projectId }: { projectId: number | null }) {
  const st = useListState(["project_id", "status", "source", "suite_id"], { sort: "started_at" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}) };
  const q = useQuery({ queryKey: ["executions", params], queryFn: () => api.get<Page<Execution>>("/executions", params),
    refetchInterval: (qq) => qq.state.data?.items.some((e) => ["queued", "running"].includes(e.status)) ? 2000 : false });
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="Test Executions" subtitle="Every run of approved tests, with the exact script hashes and environment used."
        actions={<a className="text-sm text-accent hover:underline" href={downloadUrl("/exports/executions.csv", { project_id: pid })}>Export CSV</a>} />
      <div className="mb-2"><FilterChips state={st} /></div>
      <DataTable query={q} state={st} onRowClick={(e) => nav(`/executions/${e.id}`)}
        empty={<EmptyState title="No executions recorded yet" body="Execute an approved test suite against a configured target environment to inspect sandboxed execution results, logs, and failure diagnostics." action={<Button variant="primary" onClick={() => nav("/tests")}>Browse Test Cases</Button>} />}
        toolbar={<>
          <Input placeholder="Execution ID" className="w-40" defaultValue={st.q} aria-label="Search executions" onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />
          <Select className="w-36" value={st.filters.status} onChange={(e) => st.setFilter("status", e.target.value)} aria-label="Status">
            <option value="">Any status</option>{["passed", "failed", "error", "timed_out", "cancelled", "running", "queued"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select className="w-44" value={st.filters.source} onChange={(e) => st.setFilter("source", e.target.value)} aria-label="Source">
            <option value="">Any source</option><option value="platform_run">Platform run</option><option value="historical_import">Historical import</option><option value="ci">CI</option></Select></>}
        columns={[
          { id: "key", header: "ID", sortKey: "key", cell: (e) => <Key>{e.key}</Key> },
          { id: "status", header: "Status", sortKey: "status", cell: (e) => <Badge value={e.status} /> },
          { id: "source", header: "Source", cell: (e) => <Badge value={e.source} /> },
          { id: "suite", header: "Suite", cell: (e) => e.suite?.name ?? (e.retry_of_id ? "Rerun" : "Ad hoc") },
          { id: "env", header: "Environment", cell: (e) => <div className="flex flex-col"><span className="text-slate-800 font-medium">{e.environment?.name ?? "Default"}</span><span className="text-2xs text-slate-500 font-mono">{label(e.environment?.kind || "real_code")}</span></div> },
          { id: "isolation", header: "Isolation", cell: (e) => <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">{e.isolation_level || "bwrap+rlimits"}</span> },
          { id: "res", header: "Results", cell: (e) => <ResultBar e={e} /> },
          { id: "dur", header: "Duration", sortKey: "duration_ms", cell: (e) => fmtDuration(e.duration_ms), className: "tabular-nums" },
          { id: "start", header: "Started", sortKey: "started_at", cell: (e) => <span className="text-slate-600">{fmtDate(e.started_at)}</span> },
        ]} />
    </>
  );
}

export function ExecutionsPage() {
  const { projectId, current } = useProjects();
  if (projectId && current?.project_type === "requirements_based") {
    return <TestRunsManagementView projectId={projectId} current={current} />;
  }
  return <CodeBasedExecutionsView projectId={projectId} />;
}

function ResultBar({ e }: { e: Execution }) {
  const t = Math.max(1, e.total);
  return (
    <div className="w-40">
      <div className="flex h-1.5 overflow-hidden rounded bg-slate-100" aria-hidden>
        <div className="bg-emerald-500" style={{ width: `${(e.passed / t) * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${(e.failed / t) * 100}%` }} />
        <div className="bg-amber-500" style={{ width: `${(e.errored / t) * 100}%` }} />
      </div>
      <p className="mt-0.5 text-2xs tabular-nums text-slate-600">{e.passed} passed, {e.failed} failed{e.errored ? `, ${e.errored} errors` : ""} of {e.total}</p>
    </div>
  );
}

export function ExecutionDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["execution", id], queryFn: () => api.get<Execution>(`/executions/${id}`),
    refetchInterval: (qq) => qq.state.data && ["queued", "running"].includes(qq.state.data.status) ? 1500 : false });
  const logs = useQuery({ queryKey: ["execution-logs", id, q.data?.status], enabled: !!q.data, queryFn: () => api.get<{ log: string }>(`/executions/${id}/logs`) });
  const proj = useQuery({ queryKey: ["project", String(q.data?.project_id)], enabled: !!q.data, queryFn: () => api.get<Project>(`/projects/${q.data!.project_id}`) });
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [selected, setSelected] = useState<ExecResult | null>(null);
  const [defectFor, setDefectFor] = useState<ExecResult | null>(null);
  const [runIds, setRunIds] = useState<number[]>([]);
  const [env, setEnv] = useState("");
  const [copiedSha, setCopiedSha] = useState(false);

  const copySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
    toast.ok("Commit SHA copied to clipboard");
  };

  const retry = useMutation({ mutationFn: (failedOnly: boolean) => api.post<any>(`/executions/${id}/retry`, { failed_only: failedOnly, environment_id: env ? Number(env) : null }),
    onSuccess: (r) => { toast.ok(`Started ${r.execution.key}`); nav(`/executions/${r.execution.id}`); }, onError: toast.error });
  const analyse = useMutation({ mutationFn: (resultId?: number) => api.post<{ run_ids: number[] }>(`/executions/${id}/analyse-failure`, { result_id: resultId ?? null }),
    onSuccess: (r) => { setRunIds(r.run_ids); toast.ok(`Analysing ${r.run_ids.length} failure${r.run_ids.length === 1 ? "" : "s"}`); }, onError: toast.error });
  const cancel = useMutation({ mutationFn: () => api.post(`/executions/${id}/cancel`), onSuccess: () => q.refetch(), onError: toast.error });
  useEffect(() => { setSelected(null); }, [id]);
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={10} />;
  const e = q.data;
  const failed = e.results?.filter((r) => r.status !== "passed") ?? [];
  const running = ["queued", "running"].includes(e.status);
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Key className="text-sm">{e.key}</Key>
            {e.suite?.name ?? "Ad hoc execution"}
            <Badge value={e.status} />
            <Badge value={e.source} />
            {e.environment?.kind === "real_code" ? (
              <span className="rounded bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                Real Code (SUT Primary)
              </span>
            ) : e.environment?.kind === "simulation" ? (
              <span className="rounded bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                Simulation (Baseline)
              </span>
            ) : e.environment?.kind ? (
              <span className="rounded bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                {label(e.environment.kind)}
              </span>
            ) : null}
            <span className="rounded bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 font-mono text-2xs font-semibold">
              {e.isolation_level || "bwrap+rlimits"}
            </span>
            {e.commit_sha && (
              <button
                onClick={() => copySha(e.commit_sha!)}
                className="inline-flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                title={`Commit: ${e.commit_sha} (Click to copy)`}
              >
                <GitCommit className="h-3 w-3 text-slate-500" />
                <span>{e.commit_sha.slice(0, 10)}</span>
                {copiedSha ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5 text-slate-400" />}
              </button>
            )}
          </span>
        }
        subtitle={`${e.environment?.name || "Target Environment"}. ${
          e.environment?.kind === "real_code"
            ? "Executed real repository entrypoints under moto AWS DynamoDB within bwrap+rlimits isolation."
            : e.source === "historical_import"
            ? "Imported historical record of a genuine run against the Reference HCM engine."
            : "Executed by the platform inside restricted POSIX sandbox."
        }`}
        actions={<>
          {running && can("suite.execute") && <Button variant="danger" onClick={() => cancel.mutate()}>Cancel</Button>}
          {!running && failed.length > 0 && can("execution.read") && <Button onClick={() => analyse.mutate(undefined)} loading={analyse.isPending}>Analyse failures</Button>}
          {!running && can("suite.execute") && <>
            <Select className="w-64" value={env} onChange={(x) => setEnv(x.target.value)} aria-label="Rerun environment">
              <option value="">Rerun on same environment</option>{proj.data?.environments?.map((en) => <option key={en.id} value={en.id}>Rerun on {en.name}</option>)}</Select>
            {failed.length > 0 && <Button variant="primary" loading={retry.isPending} onClick={() => retry.mutate(true)}>Rerun failed tests</Button>}
            <Button onClick={() => retry.mutate(false)}>Rerun all</Button></>}</>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        {[["Total", e.total], ["Passed", e.passed], ["Failed", e.failed], ["Errors", e.errored], ["Duration", fmtDuration(e.duration_ms)]].map(([k, v]) =>
          <Panel key={k as string}><p className="text-xs text-slate-500">{k}</p><p className={cn("text-xl font-semibold tabular-nums", k === "Failed" && e.failed && "text-red-700")}>{v}</p></Panel>)}
      </div>
      {runIds.length > 0 && <Panel title="Failure analysis in progress" className="mb-4"><div className="space-y-4">{runIds.slice(0, 3).map((r) => <RunProgress key={r} runId={r} onDone={() => q.refetch()} />)}
        {runIds.length > 3 && <p className="text-xs text-slate-500">and {runIds.length - 3} more</p>}
        <p className="text-sm text-slate-600">Defect recommendations appear in <Link to="/defects?approval_status=recommended" className="text-accent hover:underline">Defects, awaiting approval</Link>.</p></div></Panel>}
      <Tabs tabs={[
        { value: "results", label: `Results (${e.results?.length ?? 0})`, content: (
          <div className="grid gap-4 xl:grid-cols-5">
            <Panel className="min-w-0 xl:col-span-3" bodyClass="p-0"><div className="max-h-[36rem] overflow-auto"><table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600"><tr>{["Test", "Status", "Duration", "Message"].map((h) => <th key={h} className={cn("px-3 py-2 text-left font-medium", h === "Message" && "hidden lg:table-cell")}>{h}</th>)}</tr></thead>
              <tbody>{e.results?.map((r) => <tr key={r.id} onClick={() => setSelected(r)} tabIndex={0} onKeyDown={(k) => k.key === "Enter" && setSelected(r)}
                className={cn("cursor-pointer border-t border-slate-100 hover:bg-slate-50", selected?.id === r.id && "bg-accent-soft")}>
                <td className="px-3 py-2"><Key>{r.test_key}</Key><p className="text-xs text-slate-600">{r.test_title}</p></td><td className="px-3 py-2"><Badge value={r.status} /></td>
                <td className="px-3 py-2 tabular-nums">{fmtDuration(r.duration_ms)}</td><td className="hidden max-w-[16rem] truncate px-3 py-2 font-mono text-2xs text-slate-600 lg:table-cell">{r.message.split("\n")[0]}</td></tr>)}</tbody></table></div></Panel>
            <div className="min-w-0 xl:col-span-2">{selected ? (
              <ResultEvidence
                r={selected}
                onAnalyse={() => analyse.mutate(selected.id)}
                canAnalyse={selected.status !== "passed"}
                onLogDefect={() => setDefectFor(selected)}
              />
            ) : (
              <Panel><EmptyState title="Select a result" body="Choose a test to see its output, stack trace and failure analysis." /></Panel>
            )}</div>
          </div>) },
        { value: "logs", label: "Logs", content: <Panel title="Pytest output">{logs.data ? <Code className="max-h-[36rem]">{logs.data.log || "No output"}</Code> : <LoadingBlock />}</Panel> },
        { value: "artifacts", label: "Artifacts", content: <Panel bodyClass="p-0">{!e.artifacts?.length ? <EmptyState title="No artifacts stored" /> :
          <table className="w-full text-sm"><tbody>{e.artifacts.map((a) => <tr key={a.id} className="border-t border-slate-100 first:border-0">
            <td className="px-3 py-2"><a className="text-accent hover:underline" href={downloadUrl(`/executions/${e.id}/artifacts/${a.id}`)}>{a.name}</a></td>
            <td className="px-3 py-2">{label(a.kind)}</td><td className="px-3 py-2 tabular-nums">{(a.size_bytes / 1024).toFixed(1)} KB</td>
            <td className="px-3 py-2 font-mono text-2xs text-slate-500">{a.sha256.slice(0, 20)}…</td></tr>)}</tbody></table>}</Panel> },
        { value: "details", label: "Details", content: <Panel><KV items={[["Runner", e.runner], ["Reference HCM", e.hcm_version ?? "—"],
          ["Isolation", <span className="font-mono text-xs">{e.isolation_level ?? "netns+rlimits"}</span>],
          ["Triggered by", e.triggered_by?.name ?? "CI or import"], ["Branch", e.branch ?? "—"], ["Commit", <span className="font-mono text-xs">{e.commit_sha ?? "—"}</span>],
          ["Rerun of", e.retry_of_id ? <Link className="text-accent hover:underline" to={`/executions/${e.retry_of_id}`}>Execution #{e.retry_of_id}</Link> : "—"],
          ["Started", fmtDate(e.started_at)], ["Finished", fmtDate((e as any).finished_at)]]} /></Panel> },
      ]} />
      {defectFor && <CreateDefectDialog initialResult={defectFor} onClose={() => setDefectFor(null)} />}
    </>
  );
}

function ResultEvidence({
  r,
  onAnalyse,
  canAnalyse,
  onLogDefect,
}: {
  r: ExecResult;
  onAnalyse: () => void;
  canAnalyse: boolean;
  onLogDefect?: () => void;
}) {
  const fa = r.failure_analysis;
  const comp: any = (r as any).comparison;

  return (
    <div className="space-y-3">
      {/* Overview & Quick Actions */}
      <Panel
        title={<span className="flex items-center gap-2"><Key>{r.test_key}</Key><Badge value={r.status} /></span>}
        actions={
          <div className="flex items-center gap-2">
            {canAnalyse && <Button size="sm" onClick={onAnalyse}>Analyse</Button>}
            {r.status !== "passed" && onLogDefect && (
              <Button size="sm" variant="danger" onClick={onLogDefect}>
                Log Defect
              </Button>
            )}
          </div>
        }
      >
        <KV items={[
          ["Test Scenario", r.test_title || "—"],
          ["Version", `v${r.test_case_version}`],
          ["Duration", fmtDuration(r.duration_ms)],
          ...((r as any).requirement_key ? ([["Requirement", <Link key="req" to={`/requirements/${(r as any).requirement_id}`} className="text-[#3067DB] hover:underline font-medium">{(r as any).requirement_key}</Link>]] as [string, React.ReactNode][]) : []),
        ]} />
        <Link to={`/tests/${r.test_case_id}`} className="mt-2.5 inline-block text-xs font-medium text-[#3067DB] hover:underline">
          Open Test Case Details →
        </Link>
      </Panel>

      {/* Expected vs Actual Comparison (Phase 4.3) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="bg-slate-50/80 px-3.5 py-2 border-b border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-between">
          <span>Expected vs. Actual Verification</span>
          <Badge value={r.status} />
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Expected Outcome (Specification)
            </span>
            <div className="font-mono text-slate-800 bg-emerald-50/40 p-2.5 rounded border border-emerald-100 text-[11px] leading-relaxed">
              {comp?.expected || "Condition strictly satisfies specification rules."}
            </div>
          </div>
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Observed Result (Execution)
            </span>
            <div
              className={cn(
                "font-mono p-2.5 rounded border text-[11px] leading-relaxed",
                r.status === "passed"
                  ? "bg-emerald-50/40 border-emerald-100 text-slate-800"
                  : "bg-red-50/60 border-red-200 text-red-900 font-semibold"
              )}
            >
              {r.message || comp?.actual || "All assertions verified successfully."}
            </div>
          </div>
        </div>

        {comp?.condition && (
          <div className="px-3.5 py-1.5 bg-slate-50/60 border-t border-slate-100 text-2xs text-slate-600 flex items-center gap-2">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">Condition:</span>
            <span className="font-mono">{comp.condition}</span>
          </div>
        )}
      </div>

      {/* Step by step verification breakdown (Phase 4.2) */}
      {comp?.steps?.length > 0 && (
        <Panel title={`Executed Steps (${comp.steps.length})`} bodyClass="p-0">
          <ol className="divide-y divide-slate-100 text-xs">
            {comp.steps.map((st: any, sIdx: number) => (
              <li key={sIdx} className="p-3 flex items-start gap-3">
                <span className="font-mono font-semibold text-slate-400 text-2xs mt-0.5">0{sIdx + 1}</span>
                <div className="flex-1">
                  <span className="font-medium text-slate-900">{st.action}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Expected: {st.expected}</div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {/* Failure Root Cause Analysis (Phase 4.4) */}
      {r.status !== "passed" && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-red-900 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Failure Reason & Recommended Action
            </span>
            {onLogDefect && (
              <Button variant="danger" size="sm" onClick={onLogDefect}>
                Log Defect from Failure
              </Button>
            )}
          </div>
          <p className="text-red-950 font-mono text-[11px] leading-relaxed">
            {r.message || "Assertion failed during test execution."}
          </p>
          {(r as any).requirement_key && (
            <div className="text-2xs text-red-800 pt-1.5 border-t border-red-200">
              Grounded Requirement:{" "}
              <Link to={`/requirements/${(r as any).requirement_id}`} className="font-semibold underline">
                {(r as any).requirement_key} · {(r as any).requirement_title}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Expandable Technical Details (Progressive Disclosure) */}
      {r.stack_trace && (
        <details className="group rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
          <summary className="px-3.5 py-2 font-medium text-slate-700 bg-slate-50 cursor-pointer hover:bg-slate-100 flex items-center justify-between select-none">
            <span>Technical Stack Trace & Sandbox Diagnostics</span>
            <span className="text-2xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
            <pre className="whitespace-pre-wrap">{r.stack_trace}</pre>
          </div>
        </details>
      )}

      {/* AI Failure Hypothesis */}
      {fa && (
        <Panel title="Failure analysis">
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Deterministic category </span><Badge value={fa.deterministic_category} /></p>
            <div><p className="text-xs font-medium text-slate-500">Observed facts</p><ul className="list-disc pl-4">{fa.observed_facts?.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
            {fa.ai?.status === "ok" ? (
              <div className="rounded border border-violet-200 bg-violet-50 p-2">
                <p className="text-xs font-medium text-violet-900">AI hypothesis ({fa.ai.provider}, {fa.ai.model}), not confirmed</p>
                <p className="mt-1">{fa.ai.probable_cause}</p>
                {fa.ai.hypotheses?.length > 0 && <ul className="mt-1 list-disc pl-4 text-violet-900">{fa.ai.hypotheses.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>}
                {fa.ai.suggested_actions?.length > 0 && (
                  <>
                    <p className="mt-1 text-xs font-medium text-violet-900">Suggested actions</p>
                    <ul className="list-disc pl-4">{fa.ai.suggested_actions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {fa.ai?.status === "not_run" ? "AI analysis was not run for this record." : "AI analysis was unavailable; only deterministic evidence is shown."}
              </p>
            )}
            {fa.related_failures?.length > 0 && <p className="text-xs text-slate-600">Related failures in this execution: {fa.related_failures.join(", ")}</p>}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------- defects ----------------
export function DefectsPage() {
  const { projectId } = useProjects();
  const st = useListState(["project_id", "status", "severity", "approval_status", "open_only", "evidence_type"], { sort: "created_at" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}), approval_status: st.filters.approval_status || "approved" };
  const q = useQuery({ queryKey: ["defects", params], queryFn: () => api.get<Page<Defect>>("/defects", params) });
  const recs = useQuery({ queryKey: ["defects", "recommended", pid], queryFn: () => api.get<Page<Defect>>("/defects", { approval_status: "recommended", project_id: pid, page_size: 1 }) });
  const nav = useNavigate();
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageHeader title="Defects" subtitle="Defects raised from recorded failures, tracked through fix verification."
        actions={<>
          <a className="text-sm text-accent hover:underline" href={downloadUrl("/exports/defects.csv", { project_id: pid })}>Export CSV</a>
          {can("defect.write") && <Button variant="primary" onClick={() => setCreate(true)}>Log defect</Button>}</>} />
      {recs.error ? (
        <Notice tone="warn">
          Could not load pending defect recommendations.{" "}
          <button type="button" className="font-medium underline" onClick={() => void recs.refetch()}>Retry</button>
        </Notice>
      ) : null}
      {(recs.data?.total ?? 0) > 0 && st.filters.approval_status !== "recommended" && <div className="mb-3"><Notice>
        {recs.data!.total} defect recommendation{recs.data!.total === 1 ? " is" : "s are"} waiting for human approval.{" "}
        <button className="font-medium underline" onClick={() => st.setFilter("approval_status", "recommended")}>Review recommendations</button></Notice></div>}
      <div className="mb-2"><FilterChips state={st} /></div>
      <DataTable query={q} state={st} onRowClick={(d) => nav(`/defects/${d.id}`)}
        empty={<EmptyState title="No defects logged or recommended" body="Defects surfaced during sandboxed test execution or logged manually will appear here for triage and fix verification." action={can("defect.write") ? <Button variant="primary" onClick={() => setCreate(true)}>Log defect</Button> : undefined} />}
        toolbar={<>
          <Input placeholder="Search defects" className="w-52" defaultValue={st.q} aria-label="Search defects" onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />
          <Select className="w-40" value={st.filters.status} onChange={(e) => st.setFilter("status", e.target.value)} aria-label="Status">
            <option value="">Any status</option>{["open", "triaged", "assigned", "in_progress", "fixed", "ready_for_retest", "verified", "closed", "reopened"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select className="w-36" value={st.filters.severity} onChange={(e) => st.setFilter("severity", e.target.value)} aria-label="Severity">
            <option value="">Any severity</option>{["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select className="w-40" value={st.filters.evidence_type} onChange={(e) => st.setFilter("evidence_type", e.target.value)} aria-label="Evidence Type">
            <option value="">Any evidence</option><option value="execution_failure">Execution Failure</option><option value="static_analysis">Static Analysis</option><option value="manual">Manual Finding</option></Select>
          <Select className="w-44" value={st.filters.approval_status} onChange={(e) => st.setFilter("approval_status", e.target.value)} aria-label="Approval">
            <option value="">Approved defects</option><option value="recommended">Awaiting approval</option><option value="dismissed">Dismissed</option><option value="all">All</option></Select>
          <label className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={st.filters.open_only === "true"} onChange={(e) => st.setFilter("open_only", e.target.checked ? "true" : "")} />Open only</label></>}
        columns={[
          { id: "key", header: "ID", sortKey: "key", cell: (d) => <Key>{d.key}</Key> },
          { id: "title", header: "Title", cell: (d) => <span className="text-ink">{d.title}</span> },
          { id: "sev", header: "Severity", sortKey: "severity", cell: (d) => <Badge value={d.severity} /> },
          { id: "pri", header: "Priority", cell: (d) => d.priority.toUpperCase() },
          { id: "evidence", header: "Evidence", cell: (d) => <span className={cn("text-2xs font-medium px-1.5 py-0.5 rounded", d.evidence_type === "execution_failure" ? "bg-red-50 text-red-700 border border-red-200" : d.evidence_type === "static_analysis" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-700")}>{label(d.evidence_type || "execution_failure")}</span> },
          { id: "status", header: "Status", sortKey: "status", cell: (d) => d.approval_status === "approved" ? <Badge value={d.status} /> : <Badge value={d.approval_status} /> },
          { id: "owner", header: "Owner", cell: (d) => d.owner?.name ?? <span className="text-slate-400">Unassigned</span> },
          { id: "created", header: "Opened", sortKey: "created_at", cell: (d) => <span className="text-slate-600">{fmtDate(d.created_at, false)}</span> },
        ]} />
      {create && <CreateDefectDialog onClose={() => setCreate(false)} />}
    </>
  );
}

function CreateDefectDialog({ onClose, initialResult }: { onClose: () => void; initialResult?: any }) {
  const { projects, projectId } = useProjects();
  const [f, setF] = useState({
    project_id: projectId ?? projects[0]?.id,
    title: initialResult
      ? `[Failure] ${initialResult.test_key || ""}: ${initialResult.test_title || "Assertion failed"}`
      : "",
    description: initialResult
      ? `Observed failure during execution run:\n${initialResult.message || initialResult.stdout || "Assertion failed"}`
      : "",
    severity: initialResult?.status === "error" ? "critical" : "high",
    priority: "p2",
    execution_result_id: initialResult ? String(initialResult.id) : "",
    reproduction_steps: initialResult?.comparison?.steps?.length
      ? initialResult.comparison.steps
          .map((s: any, idx: number) => `${idx + 1}. ${s.action} -> Expected: ${s.expected}`)
          .join("\n")
      : initialResult
      ? `Execute test scenario ${initialResult.test_key} against target environment.`
      : "",
  });
  const toast = useToast();
  const nav = useNavigate();
  const m = useMutation({ mutationFn: () => api.post<Defect>("/defects", { ...f, execution_result_id: f.execution_result_id ? Number(f.execution_result_id) : null }),
    onSuccess: (d) => { toast.ok(`Logged ${d.key}`); nav(`/defects/${d.id}`); }, onError: toast.error });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Log defect" description="Link a recorded failure to attach its evidence automatically."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} disabled={f.title.length < 5} onClick={() => m.mutate()}>Log defect</Button></>}>
      <Field label="Project" htmlFor="dp"><Select id="dp" value={f.project_id} onChange={(e) => setF({ ...f, project_id: Number(e.target.value) })}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</Select></Field>
      <Field label="Title" htmlFor="dt"><Input id="dt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Description" htmlFor="dd"><Textarea id="dd" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Severity" htmlFor="ds"><Select id="ds" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="dpr"><Select id="dpr" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{[
          { value: "p1", label: "P1 — Critical" },
          { value: "p2", label: "P2 — High" },
          { value: "p3", label: "P3 — Medium" },
          { value: "p4", label: "P4 — Low" },
        ].map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select></Field>
      </div>
      <Field label="Execution result ID" htmlFor="dr" hint="Optional. Shown on the execution's results tab."><Input id="dr" inputMode="numeric" value={f.execution_result_id} onChange={(e) => setF({ ...f, execution_result_id: e.target.value.replace(/\D/g, "") })} /></Field>
      <Field label="Reproduction steps" htmlFor="drs"><Textarea id="drs" rows={3} value={f.reproduction_steps} onChange={(e) => setF({ ...f, reproduction_steps: e.target.value })} /></Field>
    </Dialog>
  );
}

export function DefectDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["defect", id], queryFn: () => api.get<Defect>(`/defects/${id}`) });
  const proj = useQuery({ queryKey: ["project", String(q.data?.project_id)], enabled: !!q.data, queryFn: () => api.get<Project>(`/projects/${q.data!.project_id}`) });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<Page<User>>("/users", { page_size: 200 }) });
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [link, setLink] = useState("");
  const [env, setEnv] = useState("");
  const [retestRun, setRetestRun] = useState<number | null>(null);
  const [decide, setDecide] = useState<null | "approve" | "dismiss">(null);
  const refresh = () => { q.refetch(); qc.invalidateQueries({ queryKey: ["defects"] }); };
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => { refresh(); toast.ok("Defect updated"); }, onError: toast.error });
  const retest = useMutation({ mutationFn: () => api.post<any>(`/defects/${id}/retest`, { environment_id: Number(env) }),
    onSuccess: (r) => { setRetestRun(r.run_id); toast.ok(`Retest ${r.execution.key} started`); }, onError: toast.error });
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={10} />;
  const d = q.data;
  const approved = d.approval_status === "approved";
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-2"><Key className="text-sm">{d.key}</Key>{d.title}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge value={d.severity} /><span>{d.priority.toUpperCase()}</span>
          {approved ? <Badge value={d.status} /> : <Badge value={d.approval_status} />}<span>Opened {fmtDate(d.created_at)}</span></span>}
        actions={<>
          <a className="text-sm text-accent hover:underline" href={downloadUrl(`/defects/${d.id}/report.md`)}>Markdown report</a>
          <a className="text-sm text-accent hover:underline" href={downloadUrl(`/defects/${d.id}/report.json`)}>JSON</a>
          {approved && can("defect.write") && !d.github_issue_url && <Button onClick={() => act.mutate(() => api.post(`/defects/${d.id}/github-issue`))}>Create GitHub issue</Button>}
          {d.github_issue_url && <a className="text-sm text-accent hover:underline" href={d.github_issue_url} target="_blank" rel="noreferrer">GitHub #{d.github_issue_number} ({d.github_issue_state})</a>}</>} />
      {d.approval_status === "recommended" && <div className="mb-4"><Notice>
        <p className="font-medium">This defect was recommended from failure evidence and needs human approval before it enters the lifecycle.</p>
        {can("defect.approve") ? <div className="mt-2 flex gap-2"><Button variant="primary" size="sm" onClick={() => setDecide("approve")}>Approve defect</Button>
          <Button size="sm" onClick={() => setDecide("dismiss")}>Dismiss</Button></div> : <p className="mt-1">A reviewer must approve it.</p>}</Notice></div>}
      {(d.duplicate_candidates?.length ?? 0) > 0 && <div className="mb-4"><Notice tone="warn">Possible duplicates: {d.duplicate_candidates!.map((c, i) =>
        <span key={c.id}>{i > 0 && ", "}<Link className="underline" to={`/defects/${c.id}`}>{c.key}</Link></span>)}</Notice></div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Tabs tabs={[
            { value: "overview", label: "Overview", content: <div className="space-y-4">
              <Panel><p className="whitespace-pre-wrap text-sm">{d.description || "No description"}</p></Panel>
              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Expected"><p className="text-sm">{d.expected_result || "—"}</p></Panel>
                <Panel title="Actual"><Code>{d.actual_result || "—"}</Code></Panel></div>
              <Panel title="Reproduction steps"><p className="whitespace-pre-wrap text-sm">{d.reproduction_steps || "—"}</p></Panel>
            </div> },
            { value: "evidence", label: "Evidence", content: <div className="space-y-4">
              {d.ai_analysis && <Panel title="Failure analysis"><div className="space-y-2 text-sm">
                <p>Deterministic category <Badge value={d.ai_analysis.deterministic_category} />{" "}
                  {d.ai_analysis.confirmed ? <span className="text-emerald-800">confirmed by a human</span> : <span className="text-amber-800">unconfirmed hypothesis</span>}</p>
                <ul className="list-disc pl-4">{d.ai_analysis.observed_facts?.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                {d.ai_analysis.ai?.status === "ok" ? <p className="text-violet-900">AI ({d.ai_analysis.ai.provider}): {d.ai_analysis.ai.probable_cause}</p> :
                  <p className="text-xs text-slate-500">No AI analysis recorded ({d.ai_analysis.ai?.status ?? "not run"}).</p>}</div></Panel>}
              {d.stack_trace && <Panel title="Stack trace"><Code>{d.stack_trace}</Code></Panel>}
              {d.error_log && <Panel title="Captured output"><Code>{d.error_log}</Code></Panel>}
            </div> },
            { value: "activity", label: `Comments (${d.comments?.length ?? 0})`, content: <Panel>
              <ul className="space-y-3">{d.comments?.map((c) => <li key={c.id} className="text-sm"><p className="font-medium">{c.author?.name} <span className="font-normal text-slate-500">{fmtDate(c.at)}</span></p><p className="whitespace-pre-wrap">{c.body}</p></li>)}</ul>
              <div className="mt-4 space-y-2"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="New comment" placeholder="Add a comment" />
                <Button disabled={!comment.trim()} onClick={() => act.mutate(() => api.post(`/defects/${d.id}/comments`, { body: comment }).then(() => setComment("")))}>Add comment</Button></div>
            </Panel> },
          ]} />
        </div>
        <div className="space-y-4">
          <Panel title="Lifecycle">
            {!approved ? <p className="text-sm text-slate-600">Available after approval.</p> : <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">{d.allowed_transitions?.map((t) => <Button key={t} size="sm" disabled={!can("defect.transition")}
                onClick={() => act.mutate(() => api.post(`/defects/${d.id}/transition`, { status: t }))}>Move to {label(t).toLowerCase()}</Button>)}</div>
              <Field label="Owner" htmlFor="ow"><Select id="ow" value={d.owner?.id ?? ""} disabled={!can("defect.write")}
                onChange={(e) => act.mutate(() => api.patch(`/defects/${d.id}`, { owner_id: Number(e.target.value) }))}>
                <option value="">Unassigned</option>{users.data?.items.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</Select></Field>
              {d.verified_execution && <p className="text-sm">Verified by <Link className="text-accent hover:underline" to={`/executions/${d.verified_execution.id}`}>{d.verified_execution.key}</Link></p>}
            </div>}
          </Panel>
          {approved && d.test_case_id && can("suite.execute") && <Panel title="Retest">
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Rerun the linked approved test. A pass verifies the defect; a failure reopens it.</p>
              <Select value={env} onChange={(e) => setEnv(e.target.value)} aria-label="Retest environment"><option value="">Choose environment</option>
                {proj.data?.environments?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
              <Button variant="primary" disabled={!env} loading={retest.isPending} onClick={() => retest.mutate()}>Run retest</Button>
              {retestRun && <RunProgress runId={retestRun} onDone={refresh} />}
            </div></Panel>}
          <Panel title="Linked records"><KV stacked items={[
            ["Evidence type", <span className="font-mono text-xs">{d.evidence_type ?? "execution_failure"}</span>],
            ["Commit SHA", <span className="font-mono text-xs">{d.source_commit_sha ?? "—"}</span>],
            ["Requirement", d.requirement_id ? <Link className="text-accent hover:underline" to={`/requirements/${d.requirement_id}`}>{d.requirement_key}</Link> : "—"],
            ["Test case", d.test_case_id ? <Link className="text-accent hover:underline" to={`/tests/${d.test_case_id}`}>{d.test_key}</Link> : "—"],
            ["Execution", d.execution_id ? <Link className="text-accent hover:underline" to={`/executions/${d.execution_id}`}>{d.execution_key}</Link> : "—"],
            ["Reporter", d.reporter?.name ?? "—"], ["Resolved", fmtDate(d.resolved_at)]]} />
            <div className="mt-3 space-y-1">{d.links?.map((l) => <p key={l.id} className="text-sm">{label(l.type)}: <Link className="text-accent hover:underline" to={`/defects/${l.id}`}>{l.key}</Link> <Badge value={l.status} /></p>)}</div>
            {can("defect.write") && <div className="mt-3 flex gap-2"><Input placeholder="DEF-PAY-0001" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Related defect key" />
              <Button onClick={() => act.mutate(() => api.post(`/defects/${d.id}/links`, { related_key: link.trim(), link_type: "related" }).then(() => setLink("")))} disabled={!link.trim()}>Link</Button></div>}
          </Panel>
        </div>
      </div>
      {decide && <DecisionDialog d={d} mode={decide} onClose={() => { setDecide(null); refresh(); }} />}
    </>
  );
}

function DecisionDialog({ d, mode, onClose }: { d: Defect; mode: "approve" | "dismiss"; onClose: () => void }) {
  const [f, setF] = useState({ comment: "", severity: d.severity, priority: d.priority });
  const toast = useToast();
  const m = useMutation({ mutationFn: () => api.post(`/defects/${d.id}/${mode}`, mode === "approve" ? f : { comment: f.comment }),
    onSuccess: () => { toast.ok(mode === "approve" ? "Defect approved" : "Recommendation dismissed"); onClose(); }, onError: toast.error });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={mode === "approve" ? "Approve defect" : "Dismiss recommendation"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant={mode === "approve" ? "primary" : "danger"} loading={m.isPending} onClick={() => m.mutate()}>
        {mode === "approve" ? "Approve defect" : "Dismiss"}</Button></>}>
      {mode === "approve" && <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Severity" htmlFor="as"><Select id="as" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="ap"><Select id="ap" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{[
          { value: "p1", label: "P1 — Critical" },
          { value: "p2", label: "P2 — High" },
          { value: "p3", label: "P3 — Medium" },
          { value: "p4", label: "P4 — Low" },
        ].map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</Select></Field></div>}
      <Field label="Comment" htmlFor="ac"><Textarea id="ac" rows={3} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} /></Field>
    </Dialog>
  );
}
