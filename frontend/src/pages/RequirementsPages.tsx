import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { DataTable, FilterChips } from "@/components/DataTable";
import { RunProgress } from "@/components/RunProgress";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Key, KV, LoadingBlock, Notice, PageHeader, Panel,
  Select, Tabs, Textarea } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api, ApiError } from "@/services/api";
import type { Criterion, Page, Project, Requirement, RequirementVersion, TestCase } from "@/types/models";
import { cn, fmtDate, label } from "@/utils/format";

const reqSchema = z.object({
  project_id: z.number({ invalid_type_error: "Choose a project" }),
  title: z.string().min(5, "Title needs at least 5 characters"),
  description: z.string().min(10, "Describe the requirement in at least 10 characters"),
  business_objective: z.string().max(4000), priority: z.enum(["critical", "high", "medium", "low"]),
  category: z.string(), module_id: z.number().nullable(),
});

export function RequirementsPage() {
  const { projectId } = useProjects();
  const st = useListState(["project_id", "status", "priority", "category"], { sort: "updated_at" });
  const pid = st.filters.project_id || (projectId ? String(projectId) : "");
  const params = { ...st.params, ...(pid ? { project_id: pid } : {}) };
  const q = useQuery({ queryKey: ["requirements", params], queryFn: () => api.get<Page<Requirement>>("/requirements", params) });
  const nav = useNavigate();
  const { can } = useAuth();
  const [mode, setMode] = useState<"create" | "upload" | null>(null);
  return (
    <>
      <PageHeader title="Requirements" subtitle="Business requirements, decomposed into atomic clauses that tests and acceptance criteria cite."
        actions={can("requirement.write") && <>
          <Button onClick={() => setMode("upload")}><Upload className="h-4 w-4" />Upload document</Button>
          <Button variant="primary" onClick={() => setMode("create")}>New requirement</Button></>} />
      <div className="mb-2"><FilterChips state={st} /></div>
      <DataTable query={q} state={st} onRowClick={(r) => nav(`/requirements/${r.id}`)}
        empty={<EmptyState title="No requirements ingested yet" body="Upload a business requirement specification (.pdf, .txt, .md) or author a requirement to extract atomic clauses, detect ambiguities, and generate tests." action={can("requirement.write") ? <Button variant="primary" onClick={() => setMode("upload")}><Upload className="h-4 w-4" />Upload requirement document</Button> : undefined} />}
        toolbar={<>
          <Input placeholder="Search key or title" className="w-60" defaultValue={st.q} aria-label="Search requirements"
            onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)} />
          <Select className="w-36" value={st.filters.status} onChange={(e) => st.setFilter("status", e.target.value)} aria-label="Status">
            <option value="">Any status</option>{["draft", "analysed", "changed", "approved", "deprecated"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select className="w-36" value={st.filters.priority} onChange={(e) => st.setFilter("priority", e.target.value)} aria-label="Priority">
            <option value="">Any priority</option>{["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
          <Select className="w-36" value={st.filters.category} onChange={(e) => st.setFilter("category", e.target.value)} aria-label="Category">
            <option value="">Any category</option>{["functional", "compliance", "security", "integration", "data", "reporting"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></>}
        columns={[
          { id: "key", header: "ID", sortKey: "key", cell: (r) => <Key>{r.key}</Key>, className: "w-28" },
          { id: "title", header: "Title", sortKey: "title", cell: (r) => <><p className="font-medium text-ink">{r.title}</p>
            <p className="text-xs text-slate-500">{r.module?.name}</p></> },
          {
            id: "origin",
            header: "Origin",
            cell: (r) => {
              const orig = (r as any).origin || "documented";
              const conf = (r as any).confidence;
              if (orig === "inferred") {
                return (
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-2xs font-medium text-indigo-700 border border-indigo-200">
                    Inferred · {conf ? `${Math.round(conf * 100)}%` : "AI"}
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-700 border border-slate-200">
                  Documented
                </span>
              );
            },
          },
          {
            id: "commit",
            header: "Commit",
            cell: (r) => {
              const sha = (r as any).source_commit_sha;
              return sha ? (
                <span className="font-mono text-2xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200" title={sha}>
                  {sha.slice(0, 7)}
                </span>
              ) : (
                <span className="text-slate-400 text-2xs font-mono">—</span>
              );
            },
          },
          {
            id: "clauses",
            header: "Clauses",
            cell: (r) => (
              <span className="tabular-nums font-mono text-xs text-slate-700">
                {(r as any).clauses_count ?? 0}
              </span>
            ),
            className: "text-center",
          },
          {
            id: "coverage",
            header: "Coverage",
            cell: (r) => {
              const pct = (r as any).coverage_pct ?? 0;
              return (
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cn("h-full transition-all duration-300", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-400")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="tabular-nums font-mono text-2xs font-medium text-slate-700">
                    {pct}%
                  </span>
                </div>
              );
            },
          },
          { id: "priority", header: "Priority", sortKey: "priority", cell: (r) => <Badge value={r.priority} /> },
          { id: "status", header: "Status", sortKey: "status", cell: (r) => <Badge value={r.status} /> },
          { id: "category", header: "Category", cell: (r) => label(r.category) },
          { id: "v", header: "Version", cell: (r) => `v${r.version}`, className: "tabular-nums" },
          { id: "updated", header: "Updated", sortKey: "updated_at", cell: (r) => <span className="text-slate-600">{fmtDate(r.updated_at, false)}</span> },
        ]} />
      {mode === "create" && <RequirementDialog onClose={() => setMode(null)} />}
      {mode === "upload" && <UploadDialog onClose={() => setMode(null)} />}
    </>
  );
}

function useProjectDetail(pid: number | null) {
  return useQuery({ queryKey: ["project", String(pid)], enabled: !!pid, queryFn: () => api.get<Project>(`/projects/${pid}`) });
}

function RequirementDialog({ onClose, existing }: { onClose: () => void; existing?: Requirement }) {
  const { projects, projectId } = useProjects();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({
    project_id: existing?.project_id ?? projectId ?? projects[0]?.id ?? null, title: existing?.current?.title ?? "",
    description: existing?.current?.description ?? "", business_objective: existing?.current?.business_objective ?? "",
    priority: existing?.priority ?? "medium", category: existing?.category ?? "functional", module_id: existing?.module?.id ?? null,
    change_summary: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const proj = useProjectDetail(f.project_id);
  const m = useMutation({
    mutationFn: async () => {
      const parsed = reqSchema.safeParse(f);
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("Fix the highlighted fields");
      }
      setErrors({});
      if (existing) {
        const { project_id: _p, ...rest } = parsed.data;
        void _p;
        return api.patch<any>(`/requirements/${existing.id}`, { ...rest, change_summary: f.change_summary });
      }
      return api.post<Requirement>("/requirements", parsed.data);
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["requirements"] });
      qc.invalidateQueries({ queryKey: ["requirement"] });
      if (existing) {
        toast.ok(r.new_version ? `Saved as version ${r.version}. ${r.impact?.impacted_tests?.length ?? 0} tests need re-approval.` : "Requirement updated");
      } else { toast.ok(`Created ${r.key}`); nav(`/requirements/${r.id}`); }
      onClose();
    },
    onError: (e) => { if (!(e instanceof Error && e.message === "Fix the highlighted fields")) toast.error(e); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title={existing ? `Edit ${existing.key}` : "New requirement"}
      description={existing ? "Content changes create a new immutable version and trigger change-impact analysis." :
        "Write one obligation per sentence; each sentence becomes a numbered clause."}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>
        {existing ? "Save new version" : "Create requirement"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project" htmlFor="rp" error={errors.project_id}>
          <Select id="rp" disabled={!!existing} value={f.project_id ?? ""} onChange={(e) => setF({ ...f, project_id: Number(e.target.value), module_id: null })}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</Select></Field>
        <Field label="Module" htmlFor="rm">
          <Select id="rm" value={f.module_id ?? ""} onChange={(e) => setF({ ...f, module_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">No module</option>{proj.data?.modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
      </div>
      <Field label="Title" htmlFor="rt" error={errors.title}><Input id="rt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Requirement text" htmlFor="rd" error={errors.description} hint="Uploaded and pasted text is treated as data; embedded instructions are flagged, never followed.">
        <Textarea id="rd" rows={7} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Business objective" htmlFor="ro"><Textarea id="ro" rows={2} value={f.business_objective} onChange={(e) => setF({ ...f, business_objective: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Priority" htmlFor="rpr"><Select id="rpr" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as any })}>
          {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
        <Field label="Category" htmlFor="rc"><Select id="rc" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {["functional", "compliance", "security", "integration", "data", "reporting"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></Field>
      </div>
      {existing && <Field label="Change summary" htmlFor="rcs"><Input id="rcs" value={f.change_summary} onChange={(e) => setF({ ...f, change_summary: e.target.value })} /></Field>}
    </Dialog>
  );
}

function UploadDialog({ onClose }: { onClose: () => void }) {
  const { projects, projectId } = useProjects();
  const [pid, setPid] = useState<number | null>(projectId ?? projects[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set("project_id", String(pid)); fd.set("title", title); fd.set("file", file as File);
      return api.upload<Requirement>("/requirements/upload", fd);
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["requirements"] }); toast.ok(`Imported ${r.key} with ${r.clauses?.length} clauses`); nav(`/requirements/${r.id}`); },
    onError: toast.error,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Upload requirement document" description="PDF, plain text or Markdown up to 2 MB."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={m.isPending} disabled={!file || title.length < 5 || !pid} onClick={() => m.mutate()}>Import</Button></>}>
      <Field label="Project" htmlFor="up"><Select id="up" value={pid ?? ""} onChange={(e) => setPid(Number(e.target.value))}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}</Select></Field>
      <Field label="Title" htmlFor="ut"><Input id="ut" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="File" htmlFor="uf"><input id="uf" type="file" accept=".pdf,.txt,.md,.markdown" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
    </Dialog>
  );
}

export function RequirementDetailPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const q = useQuery({ queryKey: ["requirement", id], queryFn: () => api.get<Requirement>(`/requirements/${id}`) });
  const { can } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState(false);

  const approveM = useMutation({
    mutationFn: () => api.post(`/requirements/${id}/approve`),
    onSuccess: () => { toast.ok("Requirement approved"); q.refetch(); },
    onError: toast.error,
  });
  const confirmM = useMutation({
    mutationFn: () => api.post(`/requirements/${id}/confirm`),
    onSuccess: () => { toast.ok("Inferred requirement confirmed"); q.refetch(); },
    onError: toast.error,
  });
  const rejectM = useMutation({
    mutationFn: () => api.post(`/requirements/${id}/reject`, { reason: "Rejected during human review" }),
    onSuccess: () => { toast.ok("Requirement rejected"); q.refetch(); },
    onError: toast.error,
  });

  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock rows={10} />;
  const r = q.data;
  const tab = sp.get("tab") ?? "clauses";
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-2"><Key className="text-sm">{r.key}</Key>{r.title}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge value={r.status} /><Badge value={r.priority} />
          <span>v{r.version}</span><span>{r.module?.name}</span><span>Author {r.author?.name ?? "—"}</span></span>}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={approveM.isPending}
              disabled={r.status === "approved"}
              onClick={() => approveM.mutate()}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={confirmM.isPending}
              onClick={() => confirmM.mutate()}
            >
              Confirm Inferred
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={rejectM.isPending}
              disabled={r.status === "deprecated"}
              onClick={() => rejectM.mutate()}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              Reject
            </Button>
            {can("requirement.write") && <Button onClick={() => setEdit(true)}>Edit</Button>}
          </div>
        } />
      <Tabs value={tab} onValueChange={(v) => setSp({ tab: v }, { replace: true })} tabs={[
        { value: "clauses", label: `Clauses (${r.clauses?.length ?? 0})`, content: <ClausesTab r={r} /> },
        { value: "analysis", label: "AI analysis", content: <AnalysisTab r={r} onChange={q.refetch} /> },
        { value: "criteria", label: "Acceptance criteria", content: <CriteriaTab r={r} /> },
        { value: "tests", label: `Tests (${r.test_count ?? 0})`, content: <RequirementTests r={r} /> },
        { value: "versions", label: "Versions", content: <VersionsTab r={r} /> },
        { value: "impact", label: "Change impact", content: <ImpactTab r={r} /> },
      ]} />
      {edit && <RequirementDialog existing={r} onClose={() => { setEdit(false); q.refetch(); }} />}
    </>
  );
}

function ClausesTab({ r }: { r: Requirement }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Clauses" className="lg:col-span-2" bodyClass="p-0">
        <ol className="divide-y divide-slate-100">{r.clauses?.map((c) => (
          <li key={c.id} className="flex gap-3 px-4 py-3">
            <Key className="w-36 shrink-0 pt-0.5">{c.clause_key}</Key>
            <div className="min-w-0 text-sm">
              <p className="leading-relaxed text-ink">{c.text}</p>
              {c.ambiguity_flags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{c.ambiguity_flags.map((f, i) =>
                <span key={i} title={f.reason} className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-2xs text-amber-900 ring-1 ring-amber-200">
                  <AlertTriangle className="h-3 w-3" />{f.term}: {f.reason}</span>)}</div>}
            </div>
          </li>))}</ol>
      </Panel>
      <Panel title="Details">
        <KV stacked items={[["Business objective", r.current?.business_objective || "—"], ["Category", label(r.category)],
          ["Source", label(r.source_type)], ["Project", r.project_key], ["Created", fmtDate(r.created_at)],
          ["Analysed", fmtDate(r.analysed_at)]]} />
      </Panel>
    </div>
  );
}

function AnalysisTab({ r, onChange }: { r: Requirement; onChange: () => void }) {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [runId, setRunId] = useState<number | null>(null);
  const cfg = useQuery({ queryKey: ["config"], queryFn: () => api.get<any>("/config") });
  const ready = cfg.data?.llm?.any_configured;
  const start = useMutation({
    mutationFn: (kind: "analyse" | "generate-tests") => api.post<{ run_id: number }>(`/requirements/${r.id}/${kind}`),
    onSuccess: (x) => setRunId(x.run_id),
    onError: (e) => toast.error(e),
  });
  const analysed = r.clauses?.some((c) => c.analysis && Object.keys(c.analysis).length);
  return (
    <div className="space-y-4">
      {cfg.data && !ready && <Notice tone="warn">No AI provider is configured, so analysis and test generation are unavailable.
        Deterministic clause parsing and ambiguity flags still work. <Link to="/settings" className="font-medium underline">Open Settings</Link> to see what to configure.</Notice>}
      {can("requirement.analyse") && <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!ready} loading={start.isPending && start.variables === "analyse"} onClick={() => start.mutate("analyse")}>
          <Sparkles className="h-4 w-4" />Analyse requirement</Button>
        <Button disabled={!ready} loading={start.isPending && start.variables === "generate-tests"} onClick={() => start.mutate("generate-tests")}>Generate acceptance criteria and tests</Button>
      </div>}
      {runId && <Panel title={`Workflow run #${runId}`}><RunProgress runId={runId} onDone={() => { onChange(); qc.invalidateQueries({ queryKey: ["criteria", r.id] }); qc.invalidateQueries({ queryKey: ["tests"] }); }} /></Panel>}
      {!analysed ? <Panel><EmptyState title="This requirement has not been analysed yet" body="Run the analysis to extract business rules, ambiguities, missing information and clarifying questions per clause." /></Panel> :
        <Panel title="Clause analysis" bodyClass="p-0"><div className="divide-y divide-slate-100">{r.clauses?.map((c) => {
          const a = c.analysis ?? {};
          return (
            <div key={c.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[9rem_1fr]">
              <Key>{c.clause_key}</Key>
              <div className="grid gap-3 md:grid-cols-2">
                <div><p className="text-xs font-medium text-slate-500">Source fact</p><p className="text-ink">{a.source_fact ?? c.text}</p></div>
                <div><p className="text-xs font-medium text-slate-500">AI interpretation {a.provider && <span className="font-normal">({a.provider}{a.model ? `, ${a.model}` : ""})</span>}</p>
                  <p className="text-slate-700">{a.ai_interpretation ?? (a.provider === "seed_import" ? "Imported from the historical test plan; no AI interpretation recorded." : "—")}</p></div>
                {(a.missing_information?.length || a.ai_missing_information?.length) ? <div><p className="text-xs font-medium text-slate-500">Missing information</p>
                  <ul className="list-disc pl-4 text-amber-900">{[...(a.missing_information ?? []), ...(a.ai_missing_information ?? [])].map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div> : null}
                {a.conflicts_with?.length ? <div><p className="text-xs font-medium text-slate-500">Conflicts with</p><p className="text-red-800">{a.conflicts_with.join(", ")}</p></div> : null}
                {a.clarifying_questions?.length ? <div className="md:col-span-2"><p className="text-xs font-medium text-slate-500">Clarifying questions</p>
                  <ul className="list-disc pl-4 text-slate-700">{a.clarifying_questions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div> : null}
              </div>
            </div>);
        })}</div></Panel>}
    </div>
  );
}

function CriteriaTab({ r }: { r: Requirement }) {
  const { can } = useAuth();
  const toast = useToast();
  const q = useQuery({ queryKey: ["criteria", r.id], queryFn: () => api.get<Criterion[]>(`/requirements/${r.id}/acceptance-criteria`) });
  const m = useMutation({
    mutationFn: ({ id, decision, comment }: { id: number; decision: string; comment?: string }) =>
      api.post(`/acceptance-criteria/${id}/review`, { decision, comment: comment ?? "" }),
    onSuccess: () => { q.refetch(); toast.ok("Review recorded"); }, onError: toast.error,
  });
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock />;
  if (!q.data.length) return <Panel><EmptyState title="No acceptance criteria yet" body="Analyse the requirement to generate criteria grounded in its clauses." /></Panel>;
  return (
    <div className="space-y-3">{q.data.map((a) => (
      <Panel key={a.id} title={<span className="flex items-center gap-2"><Key>{a.key}</Key><Badge value={a.review_status} /></span>}
        actions={can("test.review") && a.review_status !== "approved" && <>
          <Button size="sm" onClick={() => m.mutate({ id: a.id, decision: "approve" })}>Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => { const c = prompt("What needs to change?"); if (c) m.mutate({ id: a.id, decision: "request_changes", comment: c }); }}>Request changes</Button>
          <Button size="sm" variant="ghost" onClick={() => m.mutate({ id: a.id, decision: "reject" })}>Reject</Button></>}>
        <p className="text-sm text-ink">{a.description}</p>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div><p className="text-xs text-slate-500">Expected behaviour</p><p>{a.expected_behaviour}</p></div>
          <div><p className="text-xs text-slate-500">Cited clauses</p><p className="font-mono text-xs">{a.clause_keys.join(", ")}</p></div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium text-slate-500">Source quotation</p>
              {a.quote_verified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  (verified against clause text)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 uppercase tracking-wider">
                  Ungrounded Quote
                </span>
              )}
            </div>
            <blockquote className={cn("border-l-2 pl-3 italic text-slate-700", a.quote_verified ? "border-accent-ring" : "border-rose-400 bg-rose-50/30 py-1")}>
              {a.source_quote}
            </blockquote>
            {!a.quote_verified && (
              <p className="mt-1 text-[11px] text-rose-600 font-medium">
                Guardrail violation: Quotation does not appear verbatim in cited clauses ({a.clause_keys.join(", ")}).
              </p>
            )}
          </div>
          <div><p className="text-xs text-slate-500">Confidence</p><p className={cn(a.confidence < 0.6 && "text-amber-800")}>{Math.round(a.confidence * 100)}%{a.confidence < 0.6 && ", needs additional review"}</p></div>
          <div><p className="text-xs text-slate-500">Provenance</p><p>{a.provider}{a.model ? `, ${a.model}` : ""}</p></div>
          {a.assumptions?.length > 0 && <div className="md:col-span-2"><p className="text-xs text-slate-500">Assumptions</p>
            <ul className="list-disc pl-4">{a.assumptions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        </div>
      </Panel>))}</div>
  );
}

function RequirementTests({ r }: { r: Requirement }) {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["tests", { requirement_id: r.id }], queryFn: () => api.get<Page<TestCase>>("/tests", { requirement_id: r.id, page_size: 200 }) });
  if (!q.data) return <LoadingBlock />;
  if (!q.data.items.length) return <Panel><EmptyState title="No tests trace to this requirement" body="Generate tests from the AI analysis tab or author one manually under Test Management." /></Panel>;
  return (
    <Panel bodyClass="p-0"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>
      {["Test", "Title", "Clauses", "Type", "Status", "Validation"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
      <tbody>{q.data.items.map((t) => <tr key={t.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => nav(`/tests/${t.id}`)}>
        <td className="px-3 py-2"><Key>{t.key}</Key></td><td className="px-3 py-2">{t.title}</td>
        <td className="px-3 py-2 font-mono text-xs">{t.clause_keys.map((k) => k.split(".").pop()).join(", ")}</td>
        <td className="px-3 py-2">{label(t.test_type)}</td><td className="px-3 py-2"><Badge value={t.status} /></td><td className="px-3 py-2"><Badge value={t.validation_status} /></td></tr>)}</tbody></table></Panel>
  );
}

function VersionsTab({ r }: { r: Requirement }) {
  const q = useQuery({ queryKey: ["versions", r.id], queryFn: () => api.get<RequirementVersion[]>(`/requirements/${r.id}/versions`) });
  const [pair, setPair] = useState<[number, number] | null>(null);
  const a = pair?.[0] ?? Math.max(1, r.version - 1);
  const b = pair?.[1] ?? r.version;
  const diff = useQuery({ queryKey: ["diff", r.id, a, b], enabled: a !== b, queryFn: () => api.get<any>(`/requirements/${r.id}/diff`, { from_version: a, to_version: b }) });
  if (!q.data) return <LoadingBlock />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="History" bodyClass="p-0"><ul className="divide-y divide-slate-100">{q.data.map((v) => (
        <li key={v.id} className="px-4 py-2.5 text-sm"><p className="font-medium">Version {v.version}{v.version === r.version && <span className="ml-2 text-xs font-normal text-slate-500">current</span>}</p>
          <p className="text-slate-600">{v.change_summary}</p><p className="text-2xs text-slate-400">{v.author?.name}, {fmtDate(v.created_at)}</p></li>))}</ul></Panel>
      <Panel title="Compare versions" className="lg:col-span-2" actions={<div className="flex items-center gap-1 text-sm">
        <Select className="h-8 w-20" value={a} onChange={(e) => setPair([Number(e.target.value), b])} aria-label="From version">{q.data.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}</Select>
        <span className="text-slate-500">to</span>
        <Select className="h-8 w-20" value={b} onChange={(e) => setPair([a, Number(e.target.value)])} aria-label="To version">{q.data.map((v) => <option key={v.version} value={v.version}>v{v.version}</option>)}</Select></div>}>
        {a === b ? <EmptyState title="Choose two different versions" /> : !diff.data ? <LoadingBlock /> : (
          <div className="space-y-3 text-sm">
            {!diff.data.added.length && !diff.data.removed.length && !diff.data.modified.length &&
              <p className="text-slate-600">No clause changes{diff.data.objective_changed ? "; the business objective changed." : "."}</p>}
            {diff.data.modified.map((c: any) => <div key={c.clause_key} className="rounded border border-amber-200">
              <p className="border-b border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">Modified {c.clause_key}</p>
              <p className="px-3 py-1.5 text-red-800 line-through decoration-red-300">{c.before}</p><p className="px-3 pb-2 text-emerald-800">{c.after}</p></div>)}
            {diff.data.added.map((c: any) => <div key={c.clause_key} className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900"><span className="font-mono text-xs">{c.clause_key} added</span><p>{c.text}</p></div>)}
            {diff.data.removed.map((c: any) => <div key={c.clause_key} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900"><span className="font-mono text-xs">{c.clause_key} removed</span><p>{c.text}</p></div>)}
            {diff.data.unchanged.length > 0 && <p className="text-xs text-slate-500">Unchanged: {diff.data.unchanged.join(", ")}</p>}
          </div>)}
      </Panel>
    </div>
  );
}

function ImpactTab({ r }: { r: Requirement }) {
  const q = useQuery({ queryKey: ["impact", r.id], queryFn: () => api.get<any>(`/requirements/${r.id}/impact-analysis`) });
  if (q.error) return <ErrorState error={q.error as ApiError} onRetry={q.refetch} />;
  if (!q.data) return <LoadingBlock />;
  const d = q.data;
  if (d.message) return <Panel><EmptyState title={d.message} body="Impact analysis appears after the requirement has more than one version." /></Panel>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`Changes from v${d.from_version} to v${d.to_version}`}>
        <KV items={[["Modified clauses", d.modified.length], ["Added clauses", d.added.length], ["Removed clauses", d.removed.length],
          ["New clauses without tests", d.uncovered_new_clauses.join(", ") || "None"]]} />
      </Panel>
      <Panel title="Impacted suites" bodyClass="p-0">{!d.impacted_suites.length ? <EmptyState title="No suites affected" /> :
        <ul className="divide-y divide-slate-100">{d.impacted_suites.map((s: any) => <li key={s.key} className="px-4 py-2 text-sm"><Key>{s.key}</Key> {s.name}</li>)}</ul>}</Panel>
      <Panel title="Impacted tests" className="lg:col-span-2" bodyClass="p-0">{!d.impacted_tests.length ? <EmptyState title="No tests cite the changed clauses" /> :
        <table className="w-full text-sm"><tbody>{d.impacted_tests.map((t: any) => <tr key={t.id} className="border-t border-slate-100 first:border-0">
          <td className="px-3 py-2"><Link className="font-mono text-xs text-accent hover:underline" to={`/tests/${t.id}`}>{t.key}</Link></td>
          <td className="px-3 py-2">{t.title}</td><td className="px-3 py-2"><Badge value={t.status} /></td>
          <td className="px-3 py-2 font-mono text-xs">{t.clause_keys.join(", ")}</td></tr>)}</tbody></table>}</Panel>
    </div>
  );
}
