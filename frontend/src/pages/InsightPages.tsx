import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, FilterChips } from "@/components/DataTable";
import { RunProgress } from "@/components/RunProgress";
import { useToast } from "@/components/Toast";
import { Badge, Button, Code, EmptyState, ErrorState, Input, Key, KV, LoadingBlock, Notice, PageHeader, Panel, Select, Stat } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api, downloadUrl } from "@/services/api";
import type { AuditEntry, Page, Requirement } from "@/types/models";
import { cn, fmtDate, label, pct } from "@/utils/format";

// ---------------- traceability ----------------
const CELL: Record<string, { cls: string; text: string }> = {
  passed: { cls: "bg-emerald-600", text: "Approved, last run passed" },
  approved: { cls: "bg-emerald-300", text: "Approved, not yet run" },
  failed_execution: { cls: "bg-red-600", text: "Approved, last run failed" },
  pending_approval: { cls: "bg-amber-300", text: "Pending approval" },
  needs_review: { cls: "bg-violet-400", text: "Needs review or re-approval" },
  rejected: { cls: "bg-slate-300", text: "Rejected" },
};

export function TraceabilityPage() {
  const [sp, setSp] = useSearchParams();
  const { projectId, projects } = useProjects();
  const pid = sp.get("project_id") ?? (projectId ? String(projectId) : String(projects[0]?.id ?? ""));
  const rid = sp.get("requirement_id") ?? "";
  const nav = useNavigate();
  const reqs = useQuery({ queryKey: ["requirements", "trace", pid], enabled: !!pid, queryFn: () => api.get<Page<Requirement>>("/requirements", { project_id: pid, page_size: 200, sort: "key", order: "asc" }) });
  const q = useQuery({ queryKey: ["trace", pid, rid], enabled: !!pid, queryFn: () => api.get<any>("/traceability/matrix", { project_id: pid, requirement_id: rid || undefined }) });
  const [onlyGaps, setOnlyGaps] = useState(false);
  const d = q.data;
  const cellMap = useMemo(() => { const m = new Map<string, string>(); d?.cells.forEach(([c, t, s]: [number, number, string]) => m.set(`${c}:${t}`, s)); return m; }, [d]);
  const rows = (d?.clauses ?? []).filter((c: any) => !onlyGaps || !c.covered);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === "project_id") n.delete("requirement_id"); setSp(n, { replace: true }); };
  return (
    <>
      <PageHeader title="Traceability" subtitle="Requirement clauses against the tests that cite them. Select any cell, clause or test to open the record."
        actions={<>
          <Select className="w-60" value={pid} onChange={(e) => set("project_id", e.target.value)} aria-label="Project">{projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</Select>
          <Select className="w-72" value={rid} onChange={(e) => set("requirement_id", e.target.value)} aria-label="Requirement">
            <option value="">All requirements</option>{reqs.data?.items.map((r) => <option key={r.id} value={r.id}>{r.key} {r.title}</option>)}</Select>
          <a className="text-sm text-accent hover:underline" href={downloadUrl("/exports/traceability.csv", { project_id: pid })}>Export CSV</a>
          {pid && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <a
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-[#3067DB] text-white hover:bg-[#2554B8] transition-colors"
                href={`/api/v1/projects/${pid}/quality-report.html`}
                target="_blank"
                rel="noreferrer"
              >
                HTML Report
              </a>
              <a
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                href={`/api/v1/projects/${pid}/quality-report`}
                target="_blank"
                rel="noreferrer"
              >
                JSON
              </a>
            </div>
          )}
        </>} />
      {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !d ? <LoadingBlock rows={10} /> : <>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Stat label="Clauses" value={d.summary.total_clauses} />
          <Stat label="Covered" value={d.summary.covered_clauses} />
          <Stat label="Untested" value={d.summary.untested_clauses} intent={d.summary.untested_clauses ? "bad" : "good"} onClick={() => setOnlyGaps(true)} />
          <Stat label="Coverage" value={pct(d.summary.coverage_pct)} />
          <Stat label="Orphan tests" value={d.summary.orphan_tests.length} hint="Cite no current clause" />
          <Stat label="Duplicate tests" value={d.summary.duplicate_tests.length} />
          <Stat label="Impacted tests" value={d.summary.impacted_tests.length} hint="Awaiting re-approval" />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          {Object.entries(CELL).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-sm", v.cls)} aria-hidden />{v.text}</span>)}
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-dashed border-red-400" aria-hidden />Not covered</span>
          <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} />Show untested clauses only</label>
        </div>
        {!rows.length ? <Panel><EmptyState title={onlyGaps ? "Every clause is covered" : "No clauses in this workspace"} body={onlyGaps ? "All requirement clauses are mapped to approved test cases." : "Upload or create requirements to extract clauses and view bidirectional traceability."} /></Panel> :
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white" style={{ maxHeight: "calc(100dvh - 22rem)" }}>
            <table className="border-separate border-spacing-0 text-xs" aria-label="Traceability matrix">
              <thead className="sticky top-0 z-20 bg-white">
                <tr>
                  <th scope="col" className="sticky left-0 z-30 min-w-[22rem] border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-medium text-slate-600">Clause</th>
                  {d.tests.map((t: any) => (
                    <th key={t.id} scope="col" className="h-28 w-7 border-b border-slate-200 align-bottom">
                      <Link to={`/tests/${t.id}`} title={`${t.key}: ${t.title}`} className="mx-auto block w-5 pb-1 font-mono text-[10px] font-normal text-slate-500 hover:text-accent [writing-mode:vertical-rl] rotate-180">{t.key.replace(/^TC-/, "")}</Link>
                    </th>))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c: any, i: number) => {
                  const newReq = i === 0 || rows[i - 1].requirement_key !== c.requirement_key;
                  return (
                    <Fragment key={c.index}>
                      {newReq && <tr><td colSpan={d.tests.length + 1} className="sticky left-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                        <Link to={`/requirements/${c.requirement_id}`} className="font-mono text-2xs font-medium text-slate-700 hover:text-accent">{c.requirement_key}</Link></td></tr>}
                      <tr className="group">
                        <th scope="row" className={cn("sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-1.5 text-left font-normal group-hover:bg-slate-50", !c.covered && "bg-red-50/60")}>
                          <Link to={`/requirements/${c.requirement_id}`} className="flex gap-2"><span className="w-10 shrink-0 font-mono text-slate-500">{c.clause_key.split(".").pop()}</span>
                            <span className="line-clamp-1 text-slate-800" title={c.text}>{c.text}</span>
                            {!c.covered && <span className="shrink-0 text-red-700">untested</span>}</Link>
                        </th>
                        {d.tests.map((t: any, ti: number) => {
                          const s = cellMap.get(`${c.index}:${ti}`);
                          return <td key={t.id} className="border-b border-slate-100 p-0.5 text-center group-hover:bg-slate-50">
                            {s ? <button onClick={() => nav(`/tests/${t.id}`)} title={`${t.key} covers ${c.clause_key}: ${CELL[s]?.text ?? s}`}
                              aria-label={`${t.key} covers ${c.clause_key}, ${CELL[s]?.text ?? s}`}
                              className={cn("mx-auto block h-4 w-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring", CELL[s]?.cls ?? "bg-slate-300")} /> : null}
                          </td>;
                        })}
                      </tr>
                    </Fragment>);
                })}
              </tbody>
            </table>
          </div>}
        {(d.summary.orphan_tests.length > 0 || d.summary.duplicate_tests.length > 0) && <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Orphan tests">{d.summary.orphan_tests.length ? <p className="font-mono text-xs">{d.summary.orphan_tests.join(", ")}</p> : <p className="text-sm text-slate-600">None</p>}</Panel>
          <Panel title="Duplicate tests">{d.summary.duplicate_tests.length ? <p className="font-mono text-xs">{d.summary.duplicate_tests.join(", ")}</p> : <p className="text-sm text-slate-600">None</p>}</Panel></div>}
      </>}
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
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Project", "Readiness", "Requirement coverage", "Automation coverage", "Approved tests", "Open defects", "Critical open", "Defect density", "Regressions", "Impacted tests", "Last execution"].map((h) =>
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
          <Panel title="Coverage by project" bodyClass="h-64"><ResponsiveContainer><BarChart data={q.data.projects} margin={{ left: -10 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} /><XAxis dataKey="project" tick={{ fontSize: 11 }} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip />
            <Bar dataKey="requirement_coverage_pct" name="Requirement coverage" fill="#1f4fbf" /><Bar dataKey="automation_coverage_pct" name="Automation coverage" fill="#93c5fd" />
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
          "TRACETEST_CI_TOKEN is not set, so CI result ingestion is disabled. See docs/EXECUTION_ENGINE.md."}</Notice>
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
export function SettingsPage() {
  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.get<any>("/config") });
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.get<any>("/health") });
  const toast = useToast();
  const qc = useQueryClient();

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latency_ms: number; model: string; error?: string }>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const testConn = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await api.post<any>("/llm/test-connection", { provider });
      setTestResults((prev) => ({ ...prev, [provider]: res }));
      if (res.ok) {
        toast.ok(`${label(provider)} verified (${res.latency_ms} ms)`);
      } else {
        toast.error(`${label(provider)} check failed: ${res.error ?? "Unknown error"}`);
      }
      qc.invalidateQueries({ queryKey: ["config"] });
    } catch (e: any) {
      toast.error(`Probe error: ${e.message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  const backup = useMutation({
    mutationFn: () => api.post<any>("/admin/backup"),
    onSuccess: (r) => toast.ok(`Backup written: ${r.backup}`),
    onError: toast.error,
  });

  const c = cfg.data;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="AI provider configuration, multi-key rotation, execution engine sandbox, and workspace database health."
      />
      {!c ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* AI Providers Panel */}
          <Panel title="AI Providers & Key Rotation" className="space-y-4">
            {!c.llm.any_configured && (
              <Notice tone="warn">
                No AI provider is configured. Configure GROQ_API_KEY (primary) or GEMINI_API_KEY (secondary) in
                your local environment.
              </Notice>
            )}
            {c.llm.mode === "mock" && (
              <Notice>
                Fixture mode is active (TRACETEST_LLM_MODE=mock). AI responses come from deterministic test fixtures.
              </Notice>
            )}

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Role</th>
                    <th className="py-2 px-3 text-left">Provider</th>
                    <th className="py-2 px-3 text-left">Model</th>
                    <th className="py-2 px-3 text-left">Slots</th>
                    <th className="py-2 px-3 text-left">Circuit</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.llm.providers.map((p: any, i: number) => {
                    return (
                      <tr key={p.name} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-medium text-slate-500">
                          {i === 0 ? "Primary" : i === 1 ? "Secondary" : "Local"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{label(p.name)}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{p.model}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1">
                            <Badge value={p.configured ? "connected" : "not_configured"}>
                              {p.configured ? `${p.slots?.length ?? 1} Key${(p.slots?.length ?? 1) > 1 ? "s" : ""}` : "Unset"}
                            </Badge>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{p.circuit}</td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!p.configured || testingProvider === p.name}
                            loading={testingProvider === p.name}
                            onClick={() => testConn(p.name)}
                          >
                            Test Probe
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Test Probe Live Feedback */}
            {Object.keys(testResults).length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-700">Recent Connectivity Tests</p>
                <div className="grid gap-2">
                  {Object.entries(testResults).map(([pname, res]) => (
                    <div
                      key={pname}
                      className={cn(
                        "flex items-center justify-between rounded border px-3 py-2 text-xs",
                        res.ok ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", res.ok ? "bg-emerald-600" : "bg-red-600")} />
                        <span className="font-semibold">{label(pname)}:</span>
                        <span>{res.ok ? `Verified probe successful (${res.model})` : res.error}</span>
                      </div>
                      <span className="font-mono text-2xs font-medium tabular-nums">{res.latency_ms} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slot Pools Table */}
            {c.llm.providers.some((p: any) => p.slots?.length > 0) && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-700">Credential Slots & Health</p>
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/50">
                  <table className="w-full text-2xs">
                    <thead className="border-b border-slate-200 bg-slate-100/70 text-slate-500 font-medium">
                      <tr>
                        <th className="py-1.5 px-3 text-left">Provider</th>
                        <th className="py-1.5 px-3 text-left">Slot</th>
                        <th className="py-1.5 px-3 text-left">Masked Secret</th>
                        <th className="py-1.5 px-3 text-left">State</th>
                        <th className="py-1.5 px-3 text-right">Calls</th>
                        <th className="py-1.5 px-3 text-right">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {c.llm.providers.flatMap((p: any) =>
                        (p.slots || []).map((s: any) => (
                          <tr key={`${p.name}-${s.slot}`}>
                            <td className="py-1.5 px-3 font-medium text-slate-700">{label(p.name)}</td>
                            <td className="py-1.5 px-3 font-mono">#{s.slot}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600">{s.masked}</td>
                            <td className="py-1.5 px-3">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  s.state === "healthy"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : s.state === "rate_limited"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                                )}
                              >
                                {s.state}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums">{s.requests}</td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums">{s.errors}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              API secrets are stored in local environment configuration only. All generation workflows automatically
              rotate across healthy credential slots with backoff cooldown.
            </p>
          </Panel>

          {/* System & Execution Sandbox Panel */}
          <div className="space-y-6">
            <Panel title="Execution Sandbox & Environment">
              <KV
                items={[
                  ["Execution environment", c.environment],
                  ["Execution timeout", `${c.sandbox.timeout_seconds} seconds`],
                  ["Execution memory limit", `${c.sandbox.memory_mb} MB`],
                  ["Sandbox output limit", `${Math.round(c.sandbox.max_output_bytes / 1024)} KB`],
                  ["Playwright target", c.playwright_target_url ?? "Chromium Local Harness"],
                  [
                    "Reference HCM Harness",
                    "Deterministic payroll/WFM engine (v1.0 baseline & v1.1 candidate)",
                  ],
                ]}
              />
            </Panel>

            <Panel title="Database Health & Workspace Storage">
              <KV
                items={[
                  ["Database path", c.data_dir ? `${c.data_dir}/tracetest.db` : "var/tracetest.db"],
                  [
                    "Integrity verification",
                    health.data ? `${health.data.database.integrity} (PRAGMA quick_check)` : "Checking...",
                  ],
                  [
                    "Journal mode",
                    health.data ? `${health.data.database.journal_mode.toUpperCase()} journal` : "WAL",
                  ],
                  [
                    "Foreign key violations",
                    health.data ? `${health.data.database.foreign_key_violations} violations` : "0 violations",
                  ],
                  [
                    "Total workspace records",
                    `${c.counts.requirements} requirements, ${c.counts.test_cases} tests, ${c.counts.executions} executions, ${c.counts.defects} defects`,
                  ],
                ]}
              />
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Create point-in-time database snapshot:</span>
                <Button variant="secondary" size="sm" onClick={() => backup.mutate()} loading={backup.isPending}>
                  Back up SQLite Database
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
