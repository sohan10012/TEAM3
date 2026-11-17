import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, FilterChips } from "@/components/DataTable";
import { RunProgress } from "@/components/RunProgress";
import { useToast } from "@/components/Toast";
import { CoverageExplorerView } from "@/components/traceability/CoverageExplorerView";
import { TraceabilityIntelligenceWorkspace } from "@/components/traceability/TraceabilityIntelligenceWorkspace";
import { Badge, Button, Code, EmptyState, ErrorState, Input, Key, KV, LoadingBlock, Notice, PageHeader, Panel, Select, Stat } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api, downloadUrl } from "@/services/api";
import type { AuditEntry, Page, Requirement } from "@/types/models";
import { cn, fmtDate, label, pct } from "@/utils/format";

// ---------------- traceability ----------------
export function TraceabilityPage() {
  const [sp, setSp] = useSearchParams();
  const { projectId, projects } = useProjects();
  const pid = sp.get("project_id") ?? (projectId ? String(projectId) : String(projects[0]?.id ?? ""));
  const rid = sp.get("requirement_id") ?? "";
  const reqs = useQuery({
    queryKey: ["requirements", "trace", pid],
    enabled: !!pid,
    queryFn: () =>
      api.get<Page<Requirement>>("/requirements", {
        project_id: pid,
        page_size: 200,
        sort: "key",
        order: "asc",
      }),
  });
  const q = useQuery({
    queryKey: ["trace", pid, rid],
    enabled: !!pid,
    queryFn: () =>
      api.get<any>("/traceability/matrix", {
        project_id: pid,
        requirement_id: rid || undefined,
      }),
  });

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k === "project_id") n.delete("requirement_id");
    setSp(n, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Traceability Intelligence & Coverage Explorer"
        subtitle="End-to-end verification hierarchy: Document → Requirement → Clause → Acceptance Criteria → Test Case → Execution → Defect."
        actions={
          <>
            <Select className="w-64" value={pid} onChange={(e) => set("project_id", e.target.value)} aria-label="Project">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} — {p.name}
                </option>
              ))}
            </Select>
            <Select className="w-64" value={rid} onChange={(e) => set("requirement_id", e.target.value)} aria-label="Requirement Filter">
              <option value="">All requirements ({q.data?.summary?.total_requirements ?? "..."})</option>
              {reqs.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key} {r.title}
                </option>
              ))}
            </Select>
            <a className="text-xs font-semibold text-blue-600 hover:underline px-2" href={downloadUrl("/exports/traceability.csv", { project_id: pid })}>
              Export CSV
            </a>
            {pid && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <a
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  href={`/api/v1/projects/${pid}/quality-report.html`}
                  target="_blank"
                  rel="noreferrer"
                >
                  HTML Dossier
                </a>
                <a
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  href={`/api/v1/projects/${pid}/quality-report`}
                  target="_blank"
                  rel="noreferrer"
                >
                  JSON
                </a>
              </div>
            )}
          </>
        }
      />

      {reqs.error ? (
        <Notice tone="warn">
          Could not load the requirements filter.{" "}
          <button type="button" className="font-medium underline" onClick={() => void reqs.refetch()}>
            Retry
          </button>
        </Notice>
      ) : null}

      {q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : sp.get("view") === "matrix" ? (
        q.data ? (
          <CoverageExplorerView
            data={q.data}
            projectId={pid}
            onRefresh={() => {
              q.refetch();
              reqs.refetch();
            }}
          />
        ) : (
          <LoadingBlock rows={10} />
        )
      ) : pid ? (
        <TraceabilityIntelligenceWorkspace projectId={pid} />
      ) : (
        <LoadingBlock rows={10} />
      )}
    </>
  );
}

// ---------------- analytics ----------------
export function AnalyticsPage() {
  const { projectId } = useProjects();
  const q = useQuery({ queryKey: ["quality", projectId], queryFn: () => api.get<any>("/analytics/quality", { project_id: projectId }) });
  const exp = (fmt: string, report = "quality") => downloadUrl(`/exports/${report}.${fmt}`, { project_id: projectId });
  return (
    <>
      <PageHeader title="Quality Analytics" subtitle="Release readiness, coverage, defect density and regressions derived from live records."
        actions={<div className="flex items-center gap-2 text-sm"><span className="text-slate-600">Download report</span>
          {["pdf", "csv", "json", "md"].map((f) => <a key={f} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50" href={exp(f)}>{f.toUpperCase()}</a>)}</div>} />
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? <LoadingBlock rows={8} /> : <>
        <Panel title="Release quality summary" bodyClass="p-0" className="mb-4"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Project", "Readiness", "Clause coverage", "Automation coverage", "Approved tests", "Open defects", "Critical open", "Defect density", "Regressions", "Impacted tests", "Last execution"].map((h) =>
            <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody>{q.data.projects.map((p: any) => <tr key={p.project} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">{p.name}</td>
            <td className="px-3 py-2"><Badge value={p.release_readiness === "ready" ? "passed" : p.release_readiness === "blocked" ? "failed" : "pending_review"}>{label(p.release_readiness)}</Badge></td>
            <td className="px-3 py-2 tabular-nums">{pct(p.requirement_coverage_pct)}</td><td className="px-3 py-2 tabular-nums">{pct(p.automation_coverage_pct)}</td>
            <td className="px-3 py-2 tabular-nums">{p.approved_tests}/{p.tests}</td><td className="px-3 py-2 tabular-nums">{p.open_defects}</td>
            <td className="px-3 py-2 tabular-nums">{p.critical_open}</td><td className="px-3 py-2 tabular-nums">{p.defect_density_per_requirement} per req.</td>
            <td className="px-3 py-2 tabular-nums">{p.regressions}</td><td className="px-3 py-2 tabular-nums">{p.impacted_tests}</td>
            <td className="px-3 py-2">{p.last_execution ? <><Badge value={p.last_execution.status} /> <span className="text-xs text-slate-500">HCM {p.last_execution.hcm_version}</span></> : "—"}</td></tr>)}</tbody></table></div></Panel>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Open defect ageing" bodyClass="h-64"><ResponsiveContainer><BarChart data={q.data.projects.map((p: any) => ({ project: p.project, ...p.defect_ageing }))} margin={{ left: -10 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip />
            {[["0-7d", "#94a3b8"], ["8-30d", "#d97706"], ["31-90d", "#ea580c"], [">90d", "#b91c1c"]].map(([k, c]) => <Bar key={k} dataKey={k} stackId="a" fill={c} name={k} />)}
          </BarChart></ResponsiveContainer></Panel>
          <Panel title="Clause coverage by project" bodyClass="h-64"><ResponsiveContainer><BarChart data={q.data.projects} margin={{ left: -10 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip />
            <Bar dataKey="requirement_coverage_pct" name="Clause coverage" fill="#1f4fbf" /><Bar dataKey="automation_coverage_pct" name="Automation coverage" fill="#93c5fd" />
          </BarChart></ResponsiveContainer></Panel>
        </div>
        <Panel title="Other exports" className="mt-4"><div className="flex flex-wrap gap-4 text-sm">
          {[["Defect register", "defects"], ["Traceability matrix", "traceability"], ["Execution history", "executions"]].map(([n, r]) =>
            <span key={r} className="flex items-center gap-2">{n}{["csv", "json", "md", "pdf"].map((f) => <a key={f} className="text-accent hover:underline" href={exp(f, r)}>{f.toUpperCase()}</a>)}</span>)}</div></Panel>
      </>}
    </>
  );
}

// ---------------- evaluations ----------------
export function EvaluationsPage() {
  const q = useQuery({ queryKey: ["evals"], queryFn: () => api.get<any>("/evaluations") });
  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.get<any>("/config") });
  const [sel, setSel] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ["eval", sel], enabled: !!sel, queryFn: () => api.get<any>(`/evaluations/${sel}`) });
  const [provider, setProvider] = useState("groq");
  const [runId, setRunId] = useState<number | null>(null);
  const { can } = useAuth();
  const toast = useToast();
  const run = useMutation({ mutationFn: () => api.post<any>("/evaluations/run", { provider }), onSuccess: (r) => { setRunId(r.run_id); setSel(r.eval_run_id); }, onError: toast.error });
  const providers = cfg.data?.llm?.providers ?? [];
  const configured = provider === "mock" || providers.find((p: any) => p.name === provider)?.configured;
  const M = [["clause_coverage", "Clause coverage", true], ["ungrounded_rate", "Ungrounded output rate", false], ["duplicate_rate", "Duplicate test rate", false],
    ["schema_pass_rate", "Schema pass rate", true], ["ambiguity_recall", "Ambiguity recall", true], ["traceability", "Traceability", true],
    ["avg_retries", "Average repair attempts", false], ["failure_classification_accuracy", "Failure classification accuracy", true]] as const;
  return (
    <>
      <PageHeader title="AI Evaluations" subtitle={`Measure AI quality against ${q.data?.scenarios.length ?? "the"} golden HCM scenarios. Scores are computed from real runs only.`}
        actions={can("eval.run") && <>
          <Select className="w-56" value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
            {providers.map((p: any) => <option key={p.name} value={p.name}>{label(p.name)} ({p.model}){p.configured ? "" : ", not configured"}</option>)}
            <option value="mock">Fixture provider (CI baseline)</option></Select>
          <Button variant="primary" disabled={!configured} loading={run.isPending} onClick={() => run.mutate()}>Run evaluation</Button></>} />
      {runId && <Panel title="Evaluation in progress" className="mb-4"><RunProgress runId={runId} onDone={() => { q.refetch(); detail.refetch(); }} /></Panel>}
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data ? <LoadingBlock /> : !q.data.runs.length ?
        <Panel><EmptyState title="No evaluations have been run" body={configured ? "Run an evaluation to measure grounding, coverage and schema compliance." :
          "Configure Groq or Gemini to evaluate a real model, or run the fixture baseline used in CI."}
          action={can("eval.run") ? <Button variant="primary" disabled={!configured} onClick={() => run.mutate()}>Run evaluation</Button> : undefined} /></Panel> :
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="History" bodyClass="p-0"><ul className="divide-y divide-slate-100">{q.data.runs.map((r: any) => (
            <li key={r.id}><button onClick={() => setSel(r.id)} className={cn("w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50", sel === r.id && "bg-accent-soft")}>
              <span className="flex items-center gap-2">#{r.id} {label(r.provider)} <Badge value={r.status} />{r.is_fixture && <Badge>Fixture</Badge>}</span>
              <span className="text-xs text-slate-500">{r.model}, {fmtDate(r.started_at)}</span></button></li>))}</ul></Panel>
          <div className="space-y-4 xl:col-span-2">{!sel ? <Panel><EmptyState title="Select an evaluation run" /></Panel> : !detail.data ? <LoadingBlock /> : <>
            {detail.data.is_fixture && <Notice>Fixture results come from the deterministic mock provider used in CI. They validate the harness, not a real model.</Notice>}
            {detail.data.error && <Notice tone="danger">{detail.data.error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{M.map(([k, n]) => { const v = detail.data.metrics?.[k];
              return <Stat key={k} label={n} value={v === null || v === undefined ? "—" : k === "avg_retries" ? v.toFixed(2) : `${(v * 100).toFixed(0)}%`} />; })}</div>
            <Panel title="Scenarios" bodyClass="p-0"><table className="w-full text-sm"><tbody>{detail.data.results.map((r: any) => (
              <tr key={r.scenario} className="border-t border-slate-100 first:border-0"><td className="px-3 py-2 font-mono text-xs">{r.scenario}</td>
                <td className="px-3 py-2"><Badge value={r.passed ? "passed" : "failed"} /></td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.metrics.error ?? `coverage ${r.metrics.clause_coverage}, ungrounded ${r.metrics.ungrounded_rate ?? "—"}, tests ${r.metrics.tests_generated}, edge cases ${r.metrics.edge_cases_found}`}
                  {r.metrics.forbidden_outputs?.length > 0 && <span className="text-red-700">, forbidden output present</span>}</td></tr>))}</tbody></table></Panel></>}
          </div>
        </div>}
    </>
  );
}

// ---------------- audit ----------------
export function AuditPage() {
  const { projectId } = useProjects();
  const st = useListState(["project_id", "entity_type", "source"], { sort: "created_at" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}) };
  const q = useQuery({ queryKey: ["audit", params], queryFn: () => api.get<Page<AuditEntry>>("/audit", params) });
  const [open, setOpen] = useState<AuditEntry | null>(null);
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="An append-only record of every state-changing operation, with trace IDs for investigation." />
      <div className="mb-2"><FilterChips state={st} /></div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2"><DataTable query={q} state={st} onRowClick={setOpen}
          empty={<EmptyState title="No audit entries recorded" body="State-changing operations across requirements, test generation, reviews, executions, and defects are immutably logged here." />}
          toolbar={<>
            <Input placeholder="Search action or record" className="w-60" defaultValue={st.q} aria-label="Search audit" onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />
            <Select className="w-44" value={st.filters.entity_type} onChange={(e) => st.setFilter("entity_type", e.target.value)} aria-label="Record type">
              <option value="">Any record type</option>{["requirement", "test_case", "execution", "defect", "project", "user", "integration", "eval_run"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
            <Select className="w-40" value={st.filters.source} onChange={(e) => st.setFilter("source", e.target.value)} aria-label="Source">
              <option value="">Any source</option><option value="platform">Platform</option><option value="seed_import">Historical import</option><option value="ci">CI</option></Select></>}
          columns={[
            { id: "at", header: "When", sortKey: "created_at", cell: (a) => <span className="whitespace-nowrap text-slate-600">{fmtDate(a.created_at)}</span> },
            { id: "actor", header: "Actor", cell: (a) => a.actor?.name ?? <span className="text-slate-400">System</span> },
            { id: "action", header: "Action", sortKey: "action", cell: (a) => <span className="font-mono text-xs">{a.action}</span> },
            { id: "rec", header: "Record", cell: (a) => <Key>{a.entity_key ?? `${a.entity_type} ${a.entity_id ?? ""}`}</Key> },
            { id: "src", header: "Source", cell: (a) => label(a.source === "seed_import" ? "historical_import" : a.source) },
          ]} /></div>
        <Panel title="Entry detail" className="h-fit">{!open ? <p className="text-sm text-slate-600">Select an entry.</p> : <div className="space-y-3">
          <KV items={[["Action", open.action], ["Record", `${open.entity_type} ${open.entity_key ?? open.entity_id ?? ""}`], ["Actor", open.actor?.name ?? "System"],
            ["When", fmtDate(open.created_at)], ["Trace ID", <span className="font-mono text-xs">{open.trace_id ?? "—"}</span>]]} />
          <Code>{JSON.stringify(open.details, null, 2)}</Code></div>}</Panel>
      </div>
    </>
  );
}

// ---------------- integrations ----------------
export function IntegrationsPage() {
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<any>("/integrations") });
  const { can } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState<Record<number, { repo: string; branch: string }>>({});
  const save = useMutation({ mutationFn: ({ pid, v }: { pid: number; v: { repo: string; branch: string } }) => api.put<any>(`/integrations/github/${pid}`, v),
    onSuccess: (r) => { q.refetch(); toast.ok(r.detail); }, onError: toast.error });
  const exportTests = useMutation({ mutationFn: (pid: number) => api.post<any>(`/integrations/github/${pid}/export-tests`), onSuccess: (r) => toast.ok(`Exported ${r.exported.length} test files`), onError: toast.error });
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={6} />;
  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect GitHub for issues and test export, and ingest CI results. Both are optional." />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Notice tone={q.data.github_token_configured ? "info" : "warn"}>{q.data.github_token_configured ? "A GitHub token is configured on the server." :
          "GITHUB_TOKEN is not set. Repository settings can be saved, but nothing is sent to GitHub. Defects can still be downloaded as Markdown or JSON."}</Notice>
        <Notice tone={q.data.ci_ingest_configured ? "info" : "warn"}>{q.data.ci_ingest_configured ? "CI result ingestion is enabled (POST /api/v1/ci/results)." :
          "TRACETEST_CI_TOKEN is not set, so CI result ingestion is disabled. See docs/ENGINEERING_OPERATIONS.md."}</Notice>
      </div>
      <Panel title="GitHub repositories" bodyClass="p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>
        {["Project", "Repository", "Branch", "Status", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
        <tbody>{q.data.projects.map(({ project, github }: any) => { const v = edit[project.id] ?? { repo: github?.config?.repo ?? "", branch: github?.config?.branch ?? "main" };
          return <tr key={project.id} className="border-t border-slate-100">
            <td className="px-3 py-2 font-medium">{project.name}</td>
            <td className="px-3 py-2"><Input className="h-8" placeholder="owner/repo" value={v.repo} disabled={!can("project.admin")} aria-label={`${project.key} repository`} onChange={(e) => setEdit({ ...edit, [project.id]: { ...v, repo: e.target.value } })} /></td>
            <td className="px-3 py-2"><Input className="h-8 w-32" value={v.branch} disabled={!can("project.admin")} aria-label={`${project.key} branch`} onChange={(e) => setEdit({ ...edit, [project.id]: { ...v, branch: e.target.value } })} /></td>
            <td className="px-3 py-2"><Badge value={github?.status ?? "not_configured"} /></td>
            <td className="px-3 py-2 text-right">{can("project.admin") && <span className="flex justify-end gap-2">
              <Button size="sm" disabled={!/^[\w.-]+\/[\w.-]+$/.test(v.repo)} onClick={() => save.mutate({ pid: project.id, v })}>Save and verify</Button>
              <Button size="sm" disabled={github?.status !== "connected"} onClick={() => exportTests.mutate(project.id)}>Export approved tests</Button></span>}</td></tr>; })}</tbody></table></Panel>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent integration events" bodyClass="p-0">{!q.data.events.length ? <EmptyState title="No integration activity yet" /> :
          <ul className="divide-y divide-slate-100">{q.data.events.map((e: any, i: number) => <li key={i} className="px-4 py-2 text-sm"><span className="flex items-center gap-2">{label(e.kind)} <Badge value={e.status === "ok" ? "passed" : e.status} /></span>
            <p className="text-xs text-slate-600">{e.request}: {e.response}</p><p className="text-2xs text-slate-400">{fmtDate(e.at)}</p></li>)}</ul>}</Panel>
        <Panel title="CI executions" bodyClass="p-0">{!q.data.ci_executions.length ? <EmptyState title="No CI results received" body="The bundled GitHub Actions workflow posts junit results here when TRACETEST_CI_TOKEN and TRACETEST_URL are set." /> :
          <ul className="divide-y divide-slate-100">{q.data.ci_executions.map((e: any) => <li key={e.id} className="px-4 py-2 text-sm"><Link className="font-mono text-xs text-accent" to={`/executions/${e.id}`}>{e.key}</Link> <Badge value={e.status} /> <span className="text-xs text-slate-500">{e.branch} {e.commit_sha?.slice(0, 7)}</span></li>)}</ul>}</Panel>
      </div>
    </>
  );
}

// ---------------- settings ----------------
export { SettingsPage } from "./SettingsPage";
