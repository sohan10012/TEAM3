import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { PipelineStepper, type PipelineStep } from "@/components/common/PipelineStepper";
import { useToast } from "@/components/Toast";
import { Badge, Button, Dialog, ErrorState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ProductionProjectDashboard } from "@/components/dashboard/ProductionProjectDashboard";
import { RequirementsProjectDashboard } from "@/components/dashboard/RequirementsProjectDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useListState } from "@/hooks/useListState";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";
import type { Page, Project } from "@/types/models";
import { cn, pct } from "@/utils/format";
import { AlertCircle, AlertTriangle, CheckCircle2, FileCode, GitBranch, Plus, Shield } from "lucide-react";

export function ProjectsPage() {
  const st = useListState(["status"], { sort: "key", order: "asc" });
  const nav = useNavigate();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ["projects", st.params], queryFn: () => api.get<Page<Project>>("/projects", st.params) });
  const [open, setOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Requirements-Based quality engineering platforms and ingested code repositories with isolated evidence."
        actions={
          <div className="flex items-center gap-2">
            {can("project.admin") && (
              <Button variant="primary" onClick={() => setOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Requirements Project
              </Button>
            )}
            <Button variant="outline" onClick={() => setRepoOpen(true)} className="gap-1.5">
              <GitBranch className="h-4 w-4 text-slate-500" />
              Connect GitHub Repository
            </Button>
          </div>
        }
      />
      <DataTable
        query={q}
        state={st}
        onRowClick={(p) => nav(`/projects/${p.id}`)}
        toolbar={
          <>
            <Input
              placeholder="Search projects"
              className="w-60"
              defaultValue={st.q}
              onKeyDown={(e) => e.key === "Enter" && st.setQ((e.target as HTMLInputElement).value)}
            />
            <Select
              className="w-40"
              value={st.filters.status}
              onChange={(e) => st.setFilter("status", e.target.value)}
              aria-label="Status"
            >
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </>
        }
        columns={[
          { id: "key", header: "Key", sortKey: "key", cell: (p) => <span className="font-mono text-xs font-semibold">{p.key}</span> },
          {
            id: "name",
            header: "Project",
            sortKey: "name",
            cell: (p) => (
              <>
                <p className="font-medium text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500 truncate max-w-sm">{p.description}</p>
              </>
            ),
          },
          {
            id: "type",
            header: "Type",
            cell: (p) => {
              const isReq = p.project_type === "requirements_based" || !p.project_type;
              return (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-2xs font-medium border",
                    isReq
                      ? "bg-blue-50 text-[#3067DB] border-blue-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  {isReq ? "Requirements-Based" : "Code-Based"}
                </span>
              );
            },
          },
          { id: "status", header: "Status", cell: (p) => <Badge value={p.status} /> },
          { id: "req", header: "Requirements", cell: (p) => p.stats.requirements, className: "tabular-nums font-medium" },
          { id: "tests", header: "Tests", cell: (p) => p.stats.tests, className: "tabular-nums font-medium" },
          { id: "cov", header: "Coverage", cell: (p) => pct(p.stats.coverage_pct), className: "tabular-nums font-medium" },
          { id: "def", header: "Open defects", cell: (p) => p.stats.open_defects, className: "tabular-nums" },
        ]}
      />
      <ProjectDialog open={open} onOpenChange={setOpen} />
      <ConnectRepoDialog open={repoOpen} onOpenChange={setRepoOpen} />
    </>
  );
}

export function ConnectRepoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const { setProjectId } = useProjects();
  const [mode, setMode] = useState<"input" | "preview" | "importing" | "done">("input");
  const [f, setF] = useState({
    repo_url: "https://github.com/sohan10012/EchoBox.git",
    branch: "main",
    commit_sha: "",
    project_key: "",
    project_name: "",
    auth_token: "",
  });

  const [previewData, setPreviewData] = useState<any>(null);
  const [importSteps, setImportSteps] = useState<PipelineStep[]>([
    { id: "validate", label: "Validate URL & Git Ref", desc: "Validates GitHub repository URL structure and sanitizes ref names.", status: "pending" },
    { id: "dns", label: "Resolve DNS & Pin Connection", desc: "Resolves github.com and pins IP via curloptResolve to defeat DNS rebinding.", status: "pending" },
    { id: "clone", label: "Hardened Clone & Token Isolation", desc: "Clones with GIT_ASKPASS token protection without persisting credentials in git config.", status: "pending" },
    { id: "scan", label: "Secret Scan & AST Architecture", desc: "Performs entropy-based secret scanning and AST parsing of routes and classes.", status: "pending" },
    { id: "derive", label: "Extract Clauses & Requirements", desc: "Synthesizes traceable requirements with provenance, marking inferred interfaces.", status: "pending" },
    { id: "envs", label: "Configure Isolated Environments", desc: "Configures fail-closed bwrap+rlimits execution sandbox and simulation harness.", status: "pending" },
  ]);
  const [createdProject, setCreatedProject] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<{ message: string; traceId?: string } | null>(null);

  const previewMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/projects/import-repo", {
        repo_url: f.repo_url.trim(),
        branch: f.branch.trim() || "main",
        commit_sha: f.commit_sha.trim() || null,
        project_key: f.project_key.trim() || null,
        project_name: f.project_name.trim() || null,
        auth_token: f.auth_token.trim() || null,
        dry_run: true,
      }),
    onSuccess: (data) => {
      setPreviewData(data);
      setMode("preview");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to preview repository");
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      api.post<any>("/projects/import-repo", {
        repo_url: f.repo_url.trim(),
        branch: f.branch.trim() || "main",
        commit_sha: f.commit_sha.trim() || null,
        project_key: f.project_key.trim() || null,
        project_name: f.project_name.trim() || null,
        auth_token: f.auth_token.trim() || null,
        dry_run: false,
      }),
    onSuccess: (data) => {
      setImportSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
      setCreatedProject(data.project);
      setMode("done");
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (data?.project?.id) {
        setProjectId(data.project.id);
      }
      toast.ok(`Repository ${f.repo_url} connected and analyzed successfully!`);
    },
    onError: (err: any) => {
      setErrorMessage({
        message: err?.message || "Repository import failed",
        traceId: err?.error?.trace_id || err?.trace_id,
      });
      setImportSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s))
      );
    },
  });

  const handleStartImport = () => {
    setErrorMessage(null);
    setMode("importing");
    setImportSteps([
      { id: "validate", label: "Validate URL & Git Ref", desc: "Validates GitHub repository URL structure and sanitizes ref names.", status: "running" },
      { id: "dns", label: "Resolve DNS & Pin Connection", desc: "Resolves github.com and pins IP via curloptResolve to defeat DNS rebinding.", status: "pending" },
      { id: "clone", label: "Hardened Clone & Token Isolation", desc: "Clones with GIT_ASKPASS token protection without persisting credentials in git config.", status: "pending" },
      { id: "scan", label: "Secret Scan & AST Architecture", desc: "Performs entropy-based secret scanning and AST parsing of routes and classes.", status: "pending" },
      { id: "derive", label: "Extract Clauses & Requirements", desc: "Synthesizes traceable requirements with provenance, marking inferred interfaces.", status: "pending" },
      { id: "envs", label: "Configure Isolated Environments", desc: "Configures fail-closed bwrap+rlimits execution sandbox and simulation harness.", status: "pending" },
    ]);

    const t1 = setTimeout(() => {
      setImportSteps((prev) => prev.map((s) => s.id === "validate" ? { ...s, status: "done" } : s.id === "dns" ? { ...s, status: "running" } : s));
    }, 300);
    const t2 = setTimeout(() => {
      setImportSteps((prev) => prev.map((s) => s.id === "dns" ? { ...s, status: "done" } : s.id === "clone" ? { ...s, status: "running" } : s));
    }, 700);
    const t3 = setTimeout(() => {
      setImportSteps((prev) => prev.map((s) => s.id === "clone" ? { ...s, status: "done" } : s.id === "scan" ? { ...s, status: "running" } : s));
    }, 1200);
    const t4 = setTimeout(() => {
      setImportSteps((prev) => prev.map((s) => s.id === "scan" ? { ...s, status: "done" } : s.id === "derive" ? { ...s, status: "running" } : s));
    }, 1800);

    importMutation.mutate(undefined, {
      onSettled: () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      }
    });
  };

  const handleClose = () => {
    if (mode === "importing" && importMutation.isPending) {
      if (!window.confirm("An import is currently running. Close and cancel?")) return;
    }
    setMode("input");
    setPreviewData(null);
    setErrorMessage(null);
    onOpenChange(false);
  };

  const urlValid = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/.test(f.repo_url.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={
        mode === "preview"
          ? "Repository Dry-Run Preview"
          : mode === "importing"
          ? "Importing Repository Pipeline"
          : mode === "done"
          ? "Import Complete"
          : "Connect GitHub Repository"
      }
      footer={
        <>
          {mode === "input" && (
            <>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                variant="secondary"
                loading={previewMutation.isPending}
                disabled={!urlValid}
                onClick={() => previewMutation.mutate()}
              >
                Preview Ingestion
              </Button>
              <Button
                variant="primary"
                disabled={!urlValid}
                onClick={handleStartImport}
              >
                Confirm & Import
              </Button>
            </>
          )}

          {mode === "preview" && (
            <>
              <Button onClick={() => setMode("input")}>Back to Edit</Button>
              <Button
                variant="primary"
                onClick={handleStartImport}
              >
                Confirm & Ingest Repository
              </Button>
            </>
          )}

          {mode === "importing" && errorMessage && (
            <>
              <Button onClick={() => setMode("input")}>Back to Edit</Button>
              <Button
                variant="primary"
                onClick={handleStartImport}
              >
                Retry Import
              </Button>
            </>
          )}

          {mode === "done" && createdProject && (
            <>
              <Button onClick={handleClose}>Close</Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleClose();
                  nav(`/projects/${createdProject.id}`);
                }}
              >
                Go to Project Overview
              </Button>
            </>
          )}
        </>
      }
    >
      {mode === "input" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Connect a public or private GitHub repository to analyze source code, extract requirements with provenance, and generate traceable test cases.
          </p>
          <Field label="GitHub Repository URL" htmlFor="r_url" hint="Format: https://github.com/owner/repository" error={f.repo_url && !urlValid ? "Must be a valid https://github.com/owner/repo URL" : undefined}>
            <Input id="r_url" placeholder="https://github.com/owner/repo" value={f.repo_url} onChange={(e) => setF({ ...f, repo_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default Branch" htmlFor="r_branch">
              <Input id="r_branch" placeholder="main" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} />
            </Field>
            <Field label="Pin Exact Commit (Optional)" htmlFor="r_sha">
              <Input id="r_sha" placeholder="Full or short SHA" value={f.commit_sha} onChange={(e) => setF({ ...f, commit_sha: e.target.value })} />
            </Field>
          </div>
          <Field label="Private Repository Token (Optional)" htmlFor="r_token" hint="Personal Access Token with repo read permission for private repositories. Transferred via isolated GIT_ASKPASS; never persisted to git config.">
            <Input id="r_token" type="password" placeholder="ghp_..." value={f.auth_token} onChange={(e) => setF({ ...f, auth_token: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project Key (Optional)" htmlFor="r_key" hint="2–8 letters, e.g. ECHO, AUTH">
              <Input id="r_key" placeholder="Auto-derived" value={f.project_key} onChange={(e) => setF({ ...f, project_key: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Project Title (Optional)" htmlFor="r_name">
              <Input id="r_name" placeholder="Auto-derived" value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {mode === "preview" && previewData && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <GitBranch className="h-4 w-4 text-slate-500" />
                  <span>{previewData.owner}/{previewData.repo_name}</span>
                </h4>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Branch <span className="font-mono font-medium">{previewData.default_branch}</span> · Commit <span className="font-mono font-medium">{previewData.commit_sha?.slice(0, 10)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-2xs font-mono text-slate-500">
                  {(previewData.repo_size_bytes / 1024).toFixed(1)} KB ({previewData.file_count} files)
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-2xs font-semibold uppercase">
                  {previewData.target_type}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-200/60 pt-2.5">
              <div>
                <span className="text-slate-500 text-2xs block">Runtime Execution Tier</span>
                {previewData.execution_supported ? (
                  <span className="inline-flex items-center gap-1 font-mono text-2xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 mt-0.5 font-semibold">
                    <Shield className="h-3 w-3 text-purple-600" />
                    {previewData.isolation_tier} (Supported)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-2xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5 font-semibold">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Static Analysis Only
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 text-2xs block">Secret Hygiene Scan</span>
                {previewData.secret_scan?.count === 0 ? (
                  <span className="inline-flex items-center gap-1 text-2xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 mt-0.5 font-medium">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    0 secrets found (clean)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5 font-medium">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    {previewData.secret_scan?.count} files flagged
                  </span>
                )}
              </div>
            </div>

            {previewData.languages && Object.keys(previewData.languages).length > 0 && (
              <div className="border-t border-slate-200/60 pt-2 text-2xs">
                <span className="text-slate-500 block mb-1">Detected Languages</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(previewData.languages).map(([lang, count]) => (
                    <span key={lang} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-mono">
                      {lang}: {String(count)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {previewData.candidate_files && previewData.candidate_files.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-2xs text-slate-500">
                <span>Candidate Ingestion Files ({previewData.candidate_files.length} previewed)</span>
                <span className="font-mono">AST Scan Ready</span>
              </div>
              <div className="max-h-28 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-2xs text-slate-700 space-y-0.5">
                {previewData.candidate_files.map((file: string) => (
                  <div key={file} className="flex items-center gap-1.5 truncate">
                    <FileCode className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "importing" && (
        <div className="space-y-4">
          <PipelineStepper steps={importSteps} />

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>Import Failed</span>
              </div>
              <p>{errorMessage.message}</p>
              {errorMessage.traceId && (
                <p className="font-mono text-2xs text-red-700">Trace ID: {errorMessage.traceId}</p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "done" && createdProject && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm text-emerald-950">Repository Ingestion Complete</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                {createdProject.name} ({createdProject.key}) is now connected with isolated requirements and environments.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-emerald-200/80 pt-2.5 text-center">
            <div className="rounded bg-white/80 p-2 border border-emerald-100">
              <div className="text-base font-semibold text-slate-800">{createdProject.stats?.requirements ?? 0}</div>
              <div className="text-2xs text-slate-500 uppercase">Requirements</div>
            </div>
            <div className="rounded bg-white/80 p-2 border border-emerald-100">
              <div className="text-base font-semibold text-slate-800">{createdProject.stats?.tests ?? 0}</div>
              <div className="text-2xs text-slate-500 uppercase">Tests</div>
            </div>
            <div className="rounded bg-white/80 p-2 border border-emerald-100">
              <div className="text-base font-semibold text-slate-800">{pct(createdProject.stats?.coverage_pct ?? 0)}</div>
              <div className="text-2xs text-slate-500 uppercase">Coverage</div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    key: project?.key ?? "",
    name: project?.name ?? "",
    description: project?.description ?? "",
    project_type: project?.project_type ?? "requirements_based",
    business_domain: project?.business_domain ?? "Enterprise SaaS",
    product_type: project?.product_type ?? "Web Application",
    regulatory_standard: project?.regulatory_standard ?? "SOC 2 Type II",
    default_language: project?.default_language ?? "English (US)",
    business_scenarios: "",
    functional_expectations: "",
    constraints_and_assumptions: "",
  });

  const m = useMutation({
    mutationFn: () => {
      if (project) {
        return api.patch(`/projects/${project.id}`, { name: f.name, description: f.description });
      }
      const scenarios = f.business_scenarios.split("\n").map((s) => s.trim()).filter(Boolean);
      const expectations = f.functional_expectations.split("\n").map((s) => s.trim()).filter(Boolean);
      const constraints = f.constraints_and_assumptions.split("\n").map((s) => s.trim()).filter(Boolean);
      return api.post("/projects", {
        key: f.key,
        name: f.name,
        description: f.description,
        project_type: f.project_type,
        business_domain: f.business_domain,
        product_type: f.product_type,
        regulatory_standard: f.regulatory_standard,
        default_language: f.default_language,
        business_scenarios: scenarios.length > 0 ? scenarios : undefined,
        functional_expectations: expectations.length > 0 ? expectations : undefined,
        constraints_and_assumptions: constraints.length > 0 ? constraints : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.ok(project ? "Project updated" : "Requirements project created");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create project"),
  });

  const keyOk = /^[A-Za-z0-9_-]{2,10}$/.test(f.key);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={project ? "Edit Project" : "New Requirements-Based Quality Project"}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={m.isPending}
            disabled={f.name.length < 3 || (!project && !keyOk)}
            onClick={() => m.mutate()}
          >
            {project ? "Save changes" : "Create Requirements Project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {!project && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Project Key"
              htmlFor="pk"
              hint="2–6 letters, record prefix (e.g. MED, FIN, PAY)"
              error={f.key && !keyOk ? "Use 2–6 alphanumeric characters" : undefined}
            >
              <Input
                id="pk"
                value={f.key}
                placeholder="e.g. CARE"
                onChange={(e) => setF({ ...f, key: e.target.value.toUpperCase() })}
              />
            </Field>

            <Field label="Project Type" htmlFor="pt">
              <Select
                id="pt"
                value={f.project_type}
                onChange={(e) => setF({ ...f, project_type: e.target.value as any })}
              >
                <option value="requirements_based">Requirements-Based (Default)</option>
                <option value="code_based">Code-Based Repository</option>
              </Select>
            </Field>
          </div>
        )}

        <Field label="Project Name" htmlFor="pn">
          <Input
            id="pn"
            value={f.name}
            placeholder="e.g. Patient Clinical Portal"
            onChange={(e) => {
              const name = e.target.value;
              const autoKey = !project && !f.key ? name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() : f.key;
              setF({ ...f, name, key: autoKey || f.key });
            }}
          />
        </Field>

        <Field label="Description" htmlFor="pd">
          <Textarea
            id="pd"
            rows={2}
            value={f.description}
            placeholder="Executive purpose and functional scope..."
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Business Domain" htmlFor="pbd">
            <Select
              id="pbd"
              value={f.business_domain}
              onChange={(e) => setF({ ...f, business_domain: e.target.value })}
            >
              <option value="Healthcare">Healthcare / HealthTech</option>
              <option value="FinTech">FinTech / Banking & Payments</option>
              <option value="E-Commerce">E-Commerce & Retail</option>
              <option value="Enterprise SaaS">Enterprise SaaS</option>
              <option value="Logistics">Logistics & Supply Chain</option>
              <option value="EdTech">EdTech & Learning Platforms</option>
              <option value="Cybersecurity">Cybersecurity & Identity</option>
              <option value="Telecommunications">Telecommunications</option>
              <option value="General Software">General Software</option>
            </Select>
          </Field>

          <Field label="Product Type" htmlFor="pprod">
            <Select
              id="pprod"
              value={f.product_type}
              onChange={(e) => setF({ ...f, product_type: e.target.value })}
            >
              <option value="Web Application">Web Application (React / Next.js / Vue)</option>
              <option value="Mobile Application">Mobile Application (iOS / Android / Flutter)</option>
              <option value="REST API">REST API / OpenAPI Service</option>
              <option value="Microservice Architecture">Microservice Architecture</option>
              <option value="Enterprise Software Suite">Enterprise Software Suite</option>
              <option value="Embedded / IoT System">Embedded / IoT System</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Regulatory Standard" htmlFor="preg">
            <Select
              id="preg"
              value={f.regulatory_standard}
              onChange={(e) => setF({ ...f, regulatory_standard: e.target.value })}
            >
              <option value="SOC 2 Type II">SOC 2 Type II</option>
              <option value="HIPAA">HIPAA (Health Insurance Portability)</option>
              <option value="PCI-DSS">PCI-DSS (Payment Card Industry)</option>
              <option value="GDPR">GDPR (EU Data Protection)</option>
              <option value="ISO 27001">ISO 27001 Information Security</option>
              <option value="FDA 21 CFR Part 11">FDA 21 CFR Part 11</option>
              <option value="None / General">None / General Commercial</option>
            </Select>
          </Field>

          <Field label="Default Locale / Language" htmlFor="plang">
            <Select
              id="plang"
              value={f.default_language}
              onChange={(e) => setF({ ...f, default_language: e.target.value })}
            >
              <option value="English (US)">English (US)</option>
              <option value="English (UK)">English (UK)</option>
              <option value="German (de-DE)">German (de-DE)</option>
              <option value="French (fr-FR)">French (fr-FR)</option>
              <option value="Spanish (es-ES)">Spanish (es-ES)</option>
              <option value="Japanese (ja-JP)">Japanese (ja-JP)</option>
            </Select>
          </Field>
        </div>

        {!project && (
          <>
            <Field
              label="Business Scenarios (Optional, 1 per line)"
              htmlFor="pbsc"
              hint="Free-form stakeholder workflows or user journey goals"
            >
              <Textarea
                id="pbsc"
                rows={2}
                value={f.business_scenarios}
                placeholder="e.g. Registered doctor conducts telehealth consultation and prescribes medicine"
                onChange={(e) => setF({ ...f, business_scenarios: e.target.value })}
              />
            </Field>

            <Field
              label="Functional Expectations (Optional, 1 per line)"
              htmlFor="pfx"
              hint="Key acceptance expectations or critical validation rules"
            >
              <Textarea
                id="pfx"
                rows={2}
                value={f.functional_expectations}
                placeholder="e.g. System must enforce password length >= 12 characters&#10;System must reject room capacity > 50"
                onChange={(e) => setF({ ...f, functional_expectations: e.target.value })}
              />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const q = useQuery({
    queryKey: ["project_detail_info", projectId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });

  if (!projectId) {
    return <ErrorState error="Invalid Project ID" />;
  }

  if (q.isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-6 w-6 animate-spin mx-auto border-2 border-[#3067DB] border-t-transparent rounded-full" />
        <p className="text-xs text-slate-500">Loading project configuration...</p>
      </div>
    );
  }

  const isReq = q.data?.project_type === "requirements_based" || !q.data?.project_type;
  if (isReq) {
    return <RequirementsProjectDashboard projectId={projectId} isDetailView={true} />;
  }
  return <ProductionProjectDashboard projectId={projectId} isDetailView={true} />;
}
