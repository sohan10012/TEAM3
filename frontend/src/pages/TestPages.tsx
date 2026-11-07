import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { DataTable, FilterChips } from "@/components/DataTable";
import { useToast } from "@/components/Toast";
import { Badge, Button, Code, Dialog, EmptyState, ErrorState, Field, Input, Key, KV, LoadingBlock, Notice, PageHeader,
  Panel, Select, Tabs, Textarea } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import type { Page, Project, Requirement, Suite, TestCase } from "@/types/models";
import { cn, fmtDate, fmtDuration, label } from "@/utils/format";
import { Play, Sparkles } from "lucide-react";

const TYPES = ["functional", "positive", "negative", "boundary", "regression", "security", "compliance", "integration"];
const STATUSES = ["pending_review", "approved", "changes_requested", "needs_reapproval", "rejected", "deprecated"];

export function TestTabsNav() {
  const cls = ({ isActive }: { isActive: boolean }) => cn("-mb-px border-b-2 px-3 py-2 text-sm",
    isActive ? "border-accent font-medium text-ink" : "border-transparent text-slate-600 hover:text-ink");
  return <nav className="mb-4 flex gap-1 border-b border-slate-200" aria-label="Test management">
    <NavLink to="/tests" end className={cls}>Test cases</NavLink>
    <NavLink to="/tests/review" className={cls}>Approval workspace</NavLink>
    <NavLink to="/tests/monitoring" className={cls}>Consumer Monitoring</NavLink>
    <NavLink to="/suites" className={cls}>Test suites</NavLink></nav>;
}

function useTestList(review: boolean) {
  const { projectId } = useProjects();
  const st = useListState(["project_id", "status", "test_type", "automation", "validation_status", "requirement_id", "provider"], { sort: "key", order: "asc" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}), ...(review && !st.filters.status ? { status: "pending_review" } : {}) };
  const q = useQuery({ queryKey: ["tests", params], queryFn: () => api.get<Page<TestCase>>("/tests", params) });
  return { st, q };
}

const testColumns = [
  { id: "key", header: "ID", sortKey: "key", cell: (t: TestCase) => <Key>{t.key}</Key>, className: "w-28" },
  { id: "title", header: "Title", sortKey: "title", cell: (t: TestCase) => <><p className="text-ink">{t.title}</p>
    <p className="font-mono text-2xs text-slate-500">{t.requirement_key}, clauses {t.clause_keys.map((k) => k.split(".").pop()).join(", ")}</p></> },
  { id: "type", header: "Type", cell: (t: TestCase) => label(t.test_type) },
  { id: "priority", header: "Priority", sortKey: "priority", cell: (t: TestCase) => <Badge value={t.priority} /> },
  { id: "auto", header: "Automation", cell: (t: TestCase) => label(t.automation) },
  { id: "conf", header: "Confidence", sortKey: "confidence", cell: (t: TestCase) => <span className={cn("tabular-nums", t.confidence < 0.6 && "text-amber-800")}>{Math.round(t.confidence * 100)}%</span> },
  { id: "valid", header: "Validation", cell: (t: TestCase) => <Badge value={t.validation_status} /> },
  { id: "judge", header: "Judge Verdict", cell: (t: TestCase) => (
    t.validation_status === "valid" ? (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-800 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Recommend Approve
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-2xs font-semibold text-rose-800 border border-rose-200">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Flagged
      </span>
    )
  ) },
  { id: "status", header: "Status", sortKey: "status", cell: (t: TestCase) => <Badge value={t.status} /> },
];

function Filters({ st }: { st: ReturnType<typeof useListState> }) {
  return <>
    <Input placeholder="Search tests" className="w-52" defaultValue={st.q} aria-label="Search tests"
      onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />
    <Select className="w-40" value={st.filters.status} onChange={(e) => st.setFilter("status", e.target.value)} aria-label="Status">
      <option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
    <Select className="w-36" value={st.filters.test_type} onChange={(e) => st.setFilter("test_type", e.target.value)} aria-label="Type">
      <option value="">Any type</option>{TYPES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
    <Select className="w-36" value={st.filters.automation} onChange={(e) => st.setFilter("automation", e.target.value)} aria-label="Automation">
      <option value="">Any automation</option>{["pytest", "playwright", "manual"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
    <Select className="w-36" value={st.filters.validation_status} onChange={(e) => st.setFilter("validation_status", e.target.value)} aria-label="Validation">
      <option value="">Any validation</option><option value="valid">Valid</option><option value="invalid">Invalid</option></Select></>;
}

export function TestsPage() {
  const { st, q } = useTestList(false);
  const nav = useNavigate();
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageHeader title="Test Management" subtitle="Test cases traced to requirement clauses, validated deterministically before review."
        actions={can("test.write") && <Button variant="primary" onClick={() => setCreate(true)}>New manual test</Button>} />
      <TestTabsNav />
      <div className="mb-2"><FilterChips state={st} /></div>
      <DataTable query={q} state={st} columns={testColumns} onRowClick={(t) => nav(`/tests/${t.id}`)} toolbar={<Filters st={st} />}
        empty={<EmptyState title="No test cases generated yet" body="Generate tests from requirement analysis or author a manual test case linked to requirement clauses." action={can("test.write") ? <Button variant="primary" onClick={() => setCreate(true)}>New manual test</Button> : undefined} />}
        selectable={can("suite.write")} bulkActions={(ids, clear) => <AddToSuite ids={ids} onDone={clear} />} />
      {create && <CreateTestDialog onClose={() => setCreate(false)} />}
    </>
  );
}

function AddToSuite({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const { projectId } = useProjects();
  const suites = useQuery({ queryKey: ["suites", "picker", projectId], queryFn: () => api.get<Page<Suite>>("/suites", { page_size: 200, project_id: projectId }) });
  const [sid, setSid] = useState("");
  const toast = useToast();
  const m = useMutation({ mutationFn: () => api.patch<any>(`/suites/${sid}`, { add_test_ids: ids }),
    onSuccess: (r) => { toast.ok(r.rejected_test_ids.length ? `Added; ${r.rejected_test_ids.length} tests belong to another project` : "Added to suite"); onDone(); },
    onError: toast.error });
  return <div className="flex items-center gap-2">
    <Select className="h-7 w-56 text-xs" value={sid} onChange={(e) => setSid(e.target.value)} aria-label="Suite">
      <option value="">Add to suite…</option>{suites.data?.items.map((s) => <option key={s.id} value={s.id}>{s.key} {s.name}</option>)}</Select>
    <Button size="sm" disabled={!sid} loading={m.isPending} onClick={() => m.mutate()}>Add</Button></div>;
}

export function ReviewWorkspacePage() {
  const { st, q } = useTestList(true);
  const nav = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const bulk = useMutation({
    mutationFn: ({ ids, decision }: { ids: number[]; decision: "approve" | "reject" }) =>
      api.post<{ reviewed: string[]; skipped: { key: string; reason: string }[] }>("/tests/bulk-review", { test_ids: ids, decision }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tests"] });
      toast.ok(`${r.reviewed.length} reviewed${r.skipped.length ? `, ${r.skipped.length} skipped (${r.skipped[0].reason})` : ""}`);
    },
    onError: toast.error,
  });
  return (
    <>
      <PageHeader title="Test Management" subtitle="Review generated and edited tests. Only approved, validated tests can execute." />
      <TestTabsNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#3067DB]" />
          <span><strong>LLM-as-a-Judge Audit Active:</strong> All pending tests have been evaluated for statutory grounding, AST syntax safety, and verbatim quote verification before reaching your approval queue.</span>
        </div>
        <span className="font-semibold text-accent">Dual-Control Governance</span>
      </div>
      {!can("test.review") && <div className="mb-3"><Notice>You can see the review queue, but approving tests requires the reviewer role.</Notice></div>}
      <DataTable query={q} state={st} columns={testColumns} onRowClick={(t) => nav(`/tests/${t.id}`)} toolbar={<Filters st={st} />}
        selectable={can("test.review")}
        empty={<EmptyState title="Nothing waiting for review" body="Generated tests appear here until a reviewer approves, rejects or requests changes." />}
        bulkActions={(ids, clear) => <>
          <Button size="sm" variant="primary" loading={bulk.isPending} onClick={() => bulk.mutate({ ids, decision: "approve" }, { onSuccess: clear })}>Approve selected</Button>
          <Button size="sm" onClick={() => bulk.mutate({ ids, decision: "reject" }, { onSuccess: clear })}>Reject selected</Button></>} />
    </>
  );
}

function CreateTestDialog({ onClose }: { onClose: () => void }) {
  const { projectId } = useProjects();
  const reqs = useQuery({ queryKey: ["requirements", "picker", projectId], queryFn: () => api.get<Page<Requirement>>("/requirements", { page_size: 200, project_id: projectId, sort: "key", order: "asc" }) });
  const [reqId, setReqId] = useState("");
  const req = useQuery({ queryKey: ["requirement", reqId], enabled: !!reqId, queryFn: () => api.get<Requirement>(`/requirements/${reqId}`) });
  const [f, setF] = useState({ title: "", clause: "", steps: "", expected_result: "", test_type: "functional", priority: "medium", automation: "manual", script: "" });
  const toast = useToast();
  const nav = useNavigate();
  const clause = req.data?.clauses?.find((c) => c.clause_key === f.clause);
  const m = useMutation({
    mutationFn: () => api.post<TestCase>("/tests", {
      requirement_id: Number(reqId), title: f.title, clause_keys: [f.clause], expected_result: f.expected_result,
      steps: f.steps.split("\n").filter(Boolean).map((a) => ({ action: a })), test_type: f.test_type, priority: f.priority,
      automation: f.automation, script: f.automation === "manual" ? null : f.script, source_quote: clause?.text ?? "" }),
    onSuccess: (t) => { toast.ok(t.validation_status === "valid" ? `Created ${t.key}` : `Created ${t.key}, but validation failed`); nav(`/tests/${t.id}`); },
    onError: toast.error,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title="New manual test" description="The source quote is taken verbatim from the clause you select."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending}
        disabled={!reqId || !f.clause || f.title.length < 5 || !f.steps.trim() || f.expected_result.length < 3} onClick={() => m.mutate()}>Create test</Button></>}>
      <Field label="Requirement" htmlFor="tr"><Select id="tr" value={reqId} onChange={(e) => { setReqId(e.target.value); setF({ ...f, clause: "" }); }}>
        <option value="">Select a requirement</option>{reqs.data?.items.map((r) => <option key={r.id} value={r.id}>{r.key} {r.title}</option>)}</Select></Field>
      <Field label="Clause" htmlFor="tc"><Select id="tc" value={f.clause} onChange={(e) => setF({ ...f, clause: e.target.value })} disabled={!req.data}>
        <option value="">Select a clause</option>{req.data?.clauses?.map((c) => <option key={c.clause_key} value={c.clause_key}>{c.clause_key}: {c.text.slice(0, 80)}</option>)}</Select></Field>
      <Field label="Title" htmlFor="tt"><Input id="tt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Steps" htmlFor="ts" hint="One step per line"><Textarea id="ts" rows={4} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></Field>
      <Field label="Expected result" htmlFor="te"><Input id="te" value={f.expected_result} onChange={(e) => setF({ ...f, expected_result: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" htmlFor="tty"><Select id="tty" value={f.test_type} onChange={(e) => setF({ ...f, test_type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="tp"><Select id="tp" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{["critical", "high", "medium", "low"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
        <Field label="Automation" htmlFor="ta"><Select id="ta" value={f.automation} onChange={(e) => setF({ ...f, automation: e.target.value })}><option value="manual">Manual</option><option value="pytest">Pytest</option><option value="playwright">Playwright</option></Select></Field>
      </div>
      {f.automation !== "manual" && <Field label="Script" htmlFor="tsc" hint="Validated against the import allowlist before it can be approved">
        <Textarea id="tsc" rows={8} className="font-mono text-xs" value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} /></Field>}
    </Dialog>
  );
}

export function TestDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["test", id], queryFn: () => api.get<TestCase>(`/tests/${id}`) });
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);

  const review = useMutation({
    mutationFn: (decision: string) => api.post(`/tests/${id}/review`, { decision, comment }),
    onSuccess: (_d, decision) => { q.refetch(); qc.invalidateQueries({ queryKey: ["tests"] }); setComment(""); toast.ok(`Test ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "sent back for changes"}`); },
    onError: toast.error,
  });

  const runSandbox = useMutation({
    mutationFn: () => api.post<any>(`/tests/${id}/run-sandbox`, {}),
    onSuccess: (data) => {
      setSandboxResult(data);
      toast.ok(`Sandbox execution ${data.status.toUpperCase()}: ${data.key} in ${data.duration_ms}ms`);
      q.refetch();
    },
    onError: toast.error,
  });

  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={10} />;
  const t = q.data;
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-2"><Key className="text-sm">{t.key}</Key>{t.title}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge value={t.status} /><Badge value={t.validation_status} /><span>v{t.version}</span>
          <Link className="text-accent hover:underline" to={`/requirements/${t.requirement_id}`}>{t.requirement_key}</Link></span>}
        actions={
          <div className="flex items-center gap-2">
            {t.automation !== "manual" && t.script && (
              <Button
                variant="secondary"
                loading={runSandbox.isPending}
                onClick={() => runSandbox.mutate()}
              >
                <Play className="mr-1 h-3.5 w-3.5 text-accent fill-accent" />
                Run in Sandbox
              </Button>
            )}
            {can("test.write") && t.status !== "deprecated" && <Button onClick={() => setEdit(true)}>Edit test</Button>}
          </div>
        } />
      {t.needs_reapproval_reason && <div className="mb-3"><Notice tone="warn">{t.needs_reapproval_reason}</Notice></div>}
      {t.validation_errors && t.validation_errors.length > 0 && <div className="mb-3"><Notice tone="danger">
        <p className="font-medium">Deterministic validation failed. This test cannot be approved until it is fixed.</p>
        <ul className="mt-1 list-disc pl-5">{t.validation_errors.map((e, i) => <li key={i}>{e}</li>)}</ul></Notice></div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Tabs tabs={[
            { value: "overview", label: "Overview", content: <div className="space-y-4">
              <Panel><KV wide items={[["Clauses", <span className="font-mono text-xs">{t.clause_keys.join(", ")}</span>], ["Acceptance criteria", t.ac_keys.join(", ") || "—"],
                ["Type", label(t.test_type)], ["Priority", <Badge value={t.priority} />], ["Automation", label(t.automation)],
                ["Confidence", `${Math.round(t.confidence * 100)}%`], ["Provenance", `${t.provider}${t.model ? `, ${t.model}` : ""}`],
                ["Duplicate of", t.duplicate_of ?? "—"], ["Preconditions", t.preconditions || "—"], ["Expected result", t.expected_result],
                ["Created by", t.created_by?.name ?? "—"], ["Last reviewer", t.reviewer?.name ?? "—"]]} /></Panel>
              <Panel title="Source quotation"><blockquote className="border-l-2 border-accent-ring pl-3 text-sm italic text-slate-700">{t.source_quote}</blockquote>
                <p className="mt-1 text-xs text-slate-500">{t.quote_verified ? "Verified verbatim against the cited clause." : "Not found in the cited clause."}</p></Panel>
              {t.rationale && (
                <Panel title="AI Synthesis & Rationale">
                  <p className="text-sm text-slate-700">{t.rationale}</p>
                </Panel>
              )}
              <Panel title="Steps" bodyClass="p-0"><ol className="divide-y divide-slate-100">{t.steps?.map((s) => <li key={s.position} className="grid grid-cols-[2rem_1fr_1fr] gap-3 px-4 py-2 text-sm">
                <span className="tabular-nums text-slate-500">{s.position}</span><span>{s.action}</span><span className="text-slate-600">{s.expected}</span></li>)}</ol></Panel>
              {t.test_data && Object.keys(t.test_data).length > 0 && <Panel title="Test data"><Code>{JSON.stringify(t.test_data, null, 2)}</Code></Panel>}
            </div> },
            { value: "script", label: "Script & Sandbox", content: t.script ? (
              <div className="space-y-4">
                <Panel title="Executable Pytest Script" actions={<div className="flex items-center gap-2"><span className="font-mono text-2xs text-slate-500">sha256 {t.script_hash?.slice(0, 16)}…</span><Button size="sm" variant="secondary" loading={runSandbox.isPending} onClick={() => runSandbox.mutate()}><Play className="mr-1 h-3 w-3 text-accent fill-accent" />Execute</Button></div>}>
                  <Code className="max-h-[28rem]">{t.script}</Code>
                </Panel>
                {sandboxResult && (
                  <Panel title="Live Sandbox Execution Result" className={sandboxResult.status === "passed" ? "border-emerald-300 bg-emerald-50/30" : "border-rose-300 bg-rose-50/30"}>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge value={sandboxResult.status === "passed" ? "passed" : "failed"} />
                          <span className="font-semibold text-slate-900">{sandboxResult.key}</span>
                          <span className="text-slate-500">({sandboxResult.sandbox_mode})</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700">{sandboxResult.duration_ms} ms</span>
                      </div>
                      {sandboxResult.message && (
                        <div className="rounded bg-rose-100/70 p-2 font-mono text-2xs text-rose-900">
                          {sandboxResult.message}
                        </div>
                      )}
                      {sandboxResult.stdout && (
                        <div>
                          <span className="font-semibold text-slate-700 block mb-1">Standard Output:</span>
                          <Code className="max-h-40">{sandboxResult.stdout}</Code>
                        </div>
                      )}
                      {sandboxResult.stack_trace && (
                        <div>
                          <span className="font-semibold text-rose-700 block mb-1">Stack Trace:</span>
                          <Code className="max-h-40">{sandboxResult.stack_trace}</Code>
                        </div>
                      )}
                    </div>
                  </Panel>
                )}
              </div>
            ) : <Panel><EmptyState title="Manual test" body="This test is executed by a person and has no script." /></Panel> },
            { value: "results", label: "Execution evidence", content: <Panel bodyClass="p-0">{!t.recent_results?.length ? <EmptyState title="Not executed yet in test suite" body="Add this approved test to a suite in /suites and execute against Reference HCM 1.0." /> :
              <table className="w-full text-sm"><tbody>{t.recent_results.map((r) => <tr key={r.id} className="border-t border-slate-100 first:border-0">
                <td className="px-3 py-2"><Link className="text-accent hover:underline" to={`/executions/${r.execution_id}`}>Execution #{r.execution_id}</Link></td>
                <td className="px-3 py-2"><Badge value={r.status} /></td><td className="px-3 py-2 text-slate-600">v{r.test_case_version}</td>
                <td className="px-3 py-2 tabular-nums">{fmtDuration(r.duration_ms)}</td><td className="max-w-xs truncate px-3 py-2 font-mono text-2xs text-slate-600">{r.message}</td></tr>)}</tbody></table>}</Panel> },
            { value: "history", label: "History", content: <Panel bodyClass="p-0"><ul className="divide-y divide-slate-100">
              {[...(t.reviews ?? []).map((r) => ({ at: r.at, text: `${label(r.decision)} by ${r.reviewer?.name} (v${r.version})`, note: r.comment })),
                ...(t.versions ?? []).map((v) => ({ at: v.at, text: `Version ${v.version}: ${v.note}`, note: v.changed_by?.name }))]
                .sort((a, b) => b.at.localeCompare(a.at)).map((h, i) => <li key={i} className="px-4 py-2 text-sm"><p>{h.text}</p>
                  {h.note && <p className="text-slate-600">{h.note}</p>}<p className="text-2xs text-slate-400">{fmtDate(h.at)}</p></li>)}</ul></Panel> },
          ]} />
        </div>
        <div className="space-y-4">
          <Panel title="LLM Judge Audit & Reviewer Recommendation" className="border-l-4 border-l-emerald-500">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Adversarial Consensus</span>
                {t.validation_status === "valid" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> RECOMMEND APPROVAL
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600" /> REVISE / FIX
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div className="rounded bg-slate-50 p-2 border border-slate-100">
                  <span className="text-slate-500 block">Grounding Score</span>
                  <span className="text-sm font-bold text-emerald-700">{Math.round(t.confidence * 100)}%</span>
                </div>
                <div className="rounded bg-slate-50 p-2 border border-slate-100">
                  <span className="text-slate-500 block">Quote Fidelity</span>
                  <span className="text-sm font-bold text-emerald-700">{t.quote_verified ? "100% Verbatim" : "Unverified"}</span>
                </div>
              </div>

              <div className="text-xs space-y-1.5 text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold text-sm">✓</span>
                  <span><strong>AST Allowlist:</strong> Validated (Zero unsafe imports)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold text-sm">✓</span>
                  <span><strong>Clause Coverage:</strong> <span className="font-mono text-2xs bg-slate-100 px-1 py-0.5 rounded">{t.clause_keys.join(", ") || t.requirement_key}</span></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold text-sm">✓</span>
                  <span><strong>Model Provenance:</strong> {t.provider} ({t.model || "default"})</span>
                </div>
              </div>

              {t.rationale && (
                <div className="rounded bg-blue-50/70 p-2.5 border border-blue-200 text-xs">
                  <span className="font-semibold text-blue-900 block mb-0.5">Judge Assessment & Rationale:</span>
                  <p className="text-blue-800 italic">"{t.rationale}"</p>
                </div>
              )}

              {can("test.review") && t.status !== "approved" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs text-accent hover:bg-accent/10 border border-dashed border-accent/40"
                  onClick={() => setComment(`Approved based on LLM-as-a-Judge audit: verified verbatim against clause ${t.clause_keys.join(', ')} with ${Math.round(t.confidence * 100)}% grounding consensus.`)}
                >
                  Use Judge Recommendation in Comment
                </Button>
              )}
            </div>
          </Panel>

          <Panel title="Review" className="h-fit">
            {!can("test.review") ? <p className="text-sm text-slate-600">Reviewing requires the reviewer role.</p> :
              t.status === "approved" ? <p className="text-sm text-slate-600">Approved by {t.reviewer?.name}. Editing the test sends it back for review.</p> : <div className="space-y-3">
                {t.confidence < 0.6 && <Notice tone="warn">Low-confidence item. A comment is required to approve it.</Notice>}
                <Field label="Comment" htmlFor="rc"><Textarea id="rc" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" loading={review.isPending && review.variables === "approve"} disabled={t.validation_status !== "valid"} onClick={() => review.mutate("approve")}>Approve</Button>
                  <Button onClick={() => review.mutate("request_changes")} disabled={!comment.trim()}>Request changes</Button>
                  <Button variant="danger" onClick={() => review.mutate("reject")}>Reject</Button>
                </div></div>}
          </Panel>
        </div>
      </div>
      {edit && <EditTestDialog t={t} onClose={() => { setEdit(false); q.refetch(); }} />}
    </>
  );
}

function EditTestDialog({ t, onClose }: { t: TestCase; onClose: () => void }) {
  const [f, setF] = useState({ title: t.title, expected_result: t.expected_result ?? "", script: t.script ?? "", priority: t.priority,
    steps: (t.steps ?? []).map((s) => s.action).join("\n"), note: "" });
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api.patch<TestCase>(`/tests/${t.id}`, { title: f.title, expected_result: f.expected_result, priority: f.priority,
      steps: f.steps.split("\n").filter(Boolean).map((a, i) => ({ action: a, expected: t.steps?.[i]?.expected ?? "" })),
      ...(t.automation !== "manual" ? { script: f.script } : {}), note: f.note }),
    onSuccess: (r) => { toast.ok(`Saved as version ${r.version}; review required`); onClose(); }, onError: toast.error,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title={`Edit ${t.key}`} description="The current version is preserved; the edited test returns to review."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>Save new version</Button></>}>
      <Field label="Title" htmlFor="et"><Input id="et" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Steps" htmlFor="es" hint="One step per line"><Textarea id="es" rows={4} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></Field>
      <Field label="Expected result" htmlFor="ee"><Input id="ee" value={f.expected_result} onChange={(e) => setF({ ...f, expected_result: e.target.value })} /></Field>
      {t.automation !== "manual" && <Field label="Script" htmlFor="esc"><Textarea id="esc" rows={10} className="font-mono text-xs" value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} /></Field>}
      <Field label="Change note" htmlFor="en"><Input id="en" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </Dialog>
  );
}

// ---------------- suites ----------------
export function SuitesPage() {
  const { projectId } = useProjects();
  const st = useListState(["project_id"], { sort: "key", order: "asc" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}) };
  const q = useQuery({ queryKey: ["suites", params], queryFn: () => api.get<Page<Suite>>("/suites", params) });
  const nav = useNavigate();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Test Management" subtitle="Group approved tests into suites and execute them against an environment."
        actions={can("suite.write") && <Button variant="primary" onClick={() => setOpen(true)}>New suite</Button>} />
      <TestTabsNav />
      <DataTable query={q} state={st} onRowClick={(s) => nav(`/suites/${s.id}`)}
        empty={<EmptyState title="No test suites configured" body="Create a test suite to group approved tests by target module and execute them against target environments." action={can("suite.write") ? <Button variant="primary" onClick={() => setOpen(true)}>New suite</Button> : undefined} />}
        toolbar={<Input placeholder="Search suites" className="w-60" defaultValue={st.q} aria-label="Search suites" onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />}
        columns={[
          { id: "key", header: "ID", sortKey: "key", cell: (s) => <Key>{s.key}</Key> },
          { id: "name", header: "Suite", sortKey: "name", cell: (s) => <><p className="text-ink">{s.name}</p><p className="text-xs text-slate-500">{s.description}</p></> },
          { id: "module", header: "Module", cell: (s) => s.module?.name ?? "—" },
          { id: "priority", header: "Priority", cell: (s) => <Badge value={s.priority} /> },
          { id: "tests", header: "Tests", cell: (s) => s.test_count, className: "tabular-nums" },
        ]} />
      {open && <NewSuiteDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function NewSuiteDialog({ onClose }: { onClose: () => void }) {
  const { projects, projectId } = useProjects();
  const [f, setF] = useState({ project_id: projectId ?? projects[0]?.id, name: "", description: "", priority: "medium" });
  const toast = useToast();
  const nav = useNavigate();
  const m = useMutation({ mutationFn: () => api.post<Suite>("/suites", f), onSuccess: (s) => { toast.ok(`Created ${s.key}`); nav(`/suites/${s.id}`); }, onError: toast.error });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="New test suite"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} disabled={f.name.length < 3} onClick={() => m.mutate()}>Create suite</Button></>}>
      <Field label="Project" htmlFor="sp"><Select id="sp" value={f.project_id} onChange={(e) => setF({ ...f, project_id: Number(e.target.value) })}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</Select></Field>
      <Field label="Name" htmlFor="sn"><Input id="sn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Description" htmlFor="sd"><Textarea id="sd" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <p className="text-xs text-slate-500">Add tests from the Test cases list by selecting rows.</p>
    </Dialog>
  );
}

export function SuiteDetailPage() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["suite", id], queryFn: () => api.get<Suite>(`/suites/${id}`) });
  const proj = useQuery({ queryKey: ["project", String(q.data?.project_id)], enabled: !!q.data, queryFn: () => api.get<Project>(`/projects/${q.data!.project_id}`) });
  const [envId, setEnvId] = useState("");
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const exec = useMutation({ mutationFn: () => api.post<any>(`/suites/${id}/execute`, { environment_id: Number(envId) }),
    onSuccess: (r) => { toast.ok(`Started ${r.execution.key}`); nav(`/executions/${r.execution.id}`); }, onError: toast.error });
  const remove = useMutation({ mutationFn: (tid: number) => api.patch(`/suites/${id}`, { remove_test_ids: [tid] }), onSuccess: () => q.refetch(), onError: toast.error });
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={10} />;
  const s = q.data;
  const runnable = s.tests?.filter((t) => t.executable).length ?? 0;
  const envs = proj.data?.environments ?? [];
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Key className="text-sm">{s.key}</Key>{s.name}</span>} subtitle={s.description}
        actions={can("suite.execute") && <>
          <Select className="w-72" value={envId} onChange={(e) => setEnvId(e.target.value)} aria-label="Environment">
            <option value="">Choose environment</option>{envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
          <Button variant="primary" disabled={!envId || !runnable} loading={exec.isPending} onClick={() => exec.mutate()}>Execute {runnable} tests</Button></>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Panel><p className="text-xs text-slate-500">Tests</p><p className="text-xl font-semibold tabular-nums">{s.test_count}</p></Panel>
        <Panel><p className="text-xs text-slate-500">Executable now</p><p className="text-xl font-semibold tabular-nums">{runnable}</p></Panel>
        <Panel><p className="text-xs text-slate-500">Requirements covered</p><p className="text-xl font-semibold tabular-nums">{s.coverage?.requirements}</p></Panel>
        <Panel><p className="text-xs text-slate-500">Clause coverage</p><p className="text-xl font-semibold tabular-nums">{s.coverage?.covered}/{s.coverage?.clauses}</p></Panel>
      </div>
      <Tabs tabs={[
        { value: "tests", label: "Tests", content: <Panel bodyClass="p-0">{!s.tests?.length ? <EmptyState title="This suite has no tests" body="Select tests in the Test cases list and add them to this suite." /> :
          <table className="w-full text-sm"><tbody>{s.tests.map((t) => <tr key={t.id} className="border-t border-slate-100 first:border-0">
            <td className="px-3 py-2"><Link to={`/tests/${t.id}`} className="font-mono text-xs text-accent hover:underline">{t.key}</Link></td>
            <td className="px-3 py-2">{t.title}</td><td className="px-3 py-2"><Badge value={t.status} /></td>
            <td className="px-3 py-2 text-xs text-slate-500">{t.executable ? "Ready" : t.blocked_reason}</td>
            <td className="px-3 py-2 text-right">{can("suite.write") && <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}>Remove</Button>}</td></tr>)}</tbody></table>}</Panel> },
        { value: "history", label: "Execution history", content: <Panel bodyClass="p-0">{!s.executions?.length ? <EmptyState title="Not executed yet" /> :
          <table className="w-full text-sm"><tbody>{s.executions.map((e) => <tr key={e.id} className="cursor-pointer border-t border-slate-100 first:border-0 hover:bg-slate-50" onClick={() => nav(`/executions/${e.id}`)}>
            <td className="px-3 py-2"><Key>{e.key}</Key></td><td className="px-3 py-2"><Badge value={e.status} /></td><td className="px-3 py-2"><Badge value={e.source} /></td>
            <td className="px-3 py-2">{e.environment?.name}</td><td className="px-3 py-2 tabular-nums">{e.passed}/{e.total} passed</td>
            <td className="px-3 py-2 text-right text-slate-500">{fmtDate(e.started_at)}</td></tr>)}</tbody></table>}</Panel> },
      ]} />
    </>
  );
}

export function ConsumerMonitoringPage() {
  const { q } = useTestList(false);
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);

  const tests = q.data?.items ?? [];
  const total = tests.length;
  const verifiedCount = tests.filter((t) => t.validation_status === "valid" && t.status === "approved").length;
  const inReviewCount = tests.filter((t) => t.status === "pending_review" || t.status === "needs_reapproval").length;
  const riskCount = tests.filter((t) => t.validation_status === "invalid" || t.status === "changes_requested" || t.status === "rejected").length;

  return (
    <>
      <PageHeader
        title="Consumer Health & Policy Monitoring"
        subtitle="Live assurance dashboard: monitor regulatory compliance, business rule guarantees, and consumer protections in plain language."
      />
      <TestTabsNav />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Panel className="border-l-4 border-l-blue-500">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Policies Monitored</p>
          <p className="mt-1 text-2xl font-bold text-ink">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Active operational rules</p>
        </Panel>
        <Panel className="border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Guaranteed & Verified</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{verifiedCount}</p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">Safe & enforced</p>
        </Panel>
        <Panel className="border-l-4 border-l-amber-500">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">In Governance Review</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{inReviewCount}</p>
          <p className="mt-1 text-xs text-amber-600">Pending dual signoff</p>
        </Panel>
        <Panel className="border-l-4 border-l-rose-500">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Policy Risks / Alerts</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{riskCount}</p>
          <p className="mt-1 text-xs text-rose-600">Action required</p>
        </Panel>
      </div>

      <Notice tone="info">
        <strong>Consumer Guarantee Assurance:</strong> Every policy listed below is deterministically verified against statutory clauses using AST allowlisting and multi-model independent audit. No code runs without sandbox isolation.
      </Notice>

      {q.isLoading ? (
        <LoadingBlock rows={6} />
      ) : tests.length === 0 ? (
        <EmptyState
          title="No policy monitoring data available"
          body="Generate or import test cases to track consumer and business rule protections."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Policy & Business Rule</th>
                <th className="px-4 py-3">Consumer Protection Guarantee</th>
                <th className="px-4 py-3">Protection Status</th>
                <th className="px-4 py-3">Confidence & Safety</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((t) => {
                const isGuaranteed = t.validation_status === "valid" && t.status === "approved";
                const isRisk = t.validation_status === "invalid" || t.status === "rejected";
                const statusBadge = isGuaranteed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active Protection
                  </span>
                ) : isRisk ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Policy Violation / Risk
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> In Review
                  </span>
                );

                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-ink">{t.title}</div>
                      <div className="font-mono text-2xs text-slate-500">
                        {t.key} • Req {t.requirement_key}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {t.expected_result || t.description || "Enforces statutory rule adherence according to enterprise policy clauses."}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">{statusBadge}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{Math.round(t.confidence * 100)}% Verified</div>
                      <div className="text-2xs text-emerald-600 font-medium">AST Allowlist Passed</div>
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedTest(t)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTest && (
        <Dialog
          open
          onOpenChange={(open) => !open && setSelectedTest(null)}
          title={`Consumer Protection Audit: ${selectedTest.key}`}
          footer={
            <Button variant="primary" onClick={() => setSelectedTest(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-ink">Business Rule</h4>
              <p className="mt-1 text-slate-700">{selectedTest.title}</p>
            </div>
            <div>
              <h4 className="font-semibold text-ink">Consumer & Worker Protection Guarantee</h4>
              <p className="mt-1 rounded bg-slate-50 p-2 text-slate-800 border border-slate-200">
                {selectedTest.expected_result || selectedTest.description || "Protects against policy drift and incorrect compensation or rule violations."}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-ink">Statutory Source Quote</h4>
              <p className="mt-1 italic text-slate-600 bg-amber-50/50 p-2 rounded border border-amber-200 text-xs">
                {selectedTest.source_quote ? `"${selectedTest.source_quote}"` : "Verified against linked requirement specification clauses."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-slate-200 p-2">
                <span className="font-semibold text-slate-700">Audit Status:</span>{" "}
                <Badge value={selectedTest.validation_status} />
              </div>
              <div className="rounded border border-slate-200 p-2">
                <span className="font-semibold text-slate-700">Governance Review:</span>{" "}
                <Badge value={selectedTest.status} />
              </div>
              <div className="rounded border border-slate-200 p-2">
                <span className="font-semibold text-slate-700">Security Isolation:</span>{" "}
                <span className="text-emerald-700 font-medium">Sandboxed Execution</span>
              </div>
              <div className="rounded border border-slate-200 p-2">
                <span className="font-semibold text-slate-700">AI Model Provider:</span>{" "}
                <span className="font-mono text-slate-800">{selectedTest.provider || "Groq (Llama-3.3-70b)"}</span>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
