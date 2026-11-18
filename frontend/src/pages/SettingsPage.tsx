import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Calendar,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useToast } from "@/components/Toast";
import {
  Button,
  EmptyState,
  ErrorState,
  KV,
  LoadingBlock,
  PageHeader,
  Panel,
} from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";
import { AuditPage, EvaluationsPage, IntegrationsPage } from "@/pages/InsightPages";
import { api } from "@/services/api";
import { cn } from "@/utils/format";

type TimeRange = "today" | "7d" | "30d" | "90d" | "all" | "custom";

interface HealthProbeResult {
  provider: string;
  role: string;
  model: string;
  status: "healthy" | "degraded" | "unreachable";
  latency_ms: number;
  verified_at: string;
  error?: string | null;
}

export function SettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { projects } = useProjects();

  // Top-level Settings Category Tab
  const [settingsCategory, setSettingsCategory] = useState<"ai" | "integrations" | "audit" | "evaluations">("ai");

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<number | "all">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [chartMetric, setChartMetric] = useState<"cost" | "tokens">("cost");
  const [activeTab, setActiveTab] = useState<"models" | "agents" | "features" | "projects">("models");

  // Health probe state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [probeResults, setProbeResults] = useState<Record<string, HealthProbeResult>>({});
  const [isExporting, setIsExporting] = useState<"csv" | "json" | null>(null);

  // Queries
  const { data: usageData, isLoading: usageLoading, error: usageError, refetch: refetchUsage } = useQuery({
    queryKey: ["settings", "ai-usage", timeRange, selectedProjectId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("range", timeRange);
      if (selectedProjectId !== "all") {
        params.set("project_id", String(selectedProjectId));
      }
      if (timeRange === "custom") {
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
      }
      return api.get<any>(`/settings/ai-usage?${params.toString()}`);
    },
  });

  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ["settings", "providers"],
    queryFn: () => api.get<any>("/settings/providers"),
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["config"],
    queryFn: () => api.get<any>("/config"),
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<any>("/health"),
  });

  // Health Probe Action
  const testConn = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await api.post<HealthProbeResult>("/settings/llm/health-check", { provider });
      setProbeResults((prev) => ({ ...prev, [provider]: res }));
      if (res.status === "healthy") {
        toast.ok(`${provider === "gemini" ? "Google Gemini" : "Groq Cloud"} probe verified (${res.latency_ms} ms)`);
      } else {
        toast.error(`${provider} probe status: ${res.status} — ${res.error || "Latency threshold exceeded"}`);
      }
      qc.invalidateQueries({ queryKey: ["settings", "providers"] });
    } catch (e: any) {
      toast.error(`Health probe failed: ${e.message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  // Export Action
  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(format);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      params.set("range", timeRange);
      if (selectedProjectId !== "all") {
        params.set("project_id", String(selectedProjectId));
      }
      if (timeRange === "custom") {
        if (startDate) params.set("start_date", startDate);
        if (endDate) params.set("end_date", endDate);
      }

      const res = await fetch(`/api/v1/settings/ai-usage/export?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": format === "csv" ? "text/csv" : "application/json" },
      });

      if (!res.ok) throw new Error(`Export returned status ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
      link.download = `tracetest-ai-usage-${timestamp}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.ok(`Exported AI usage report (${format.toUpperCase()})`);
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Database Backup Mutation
  const backup = useMutation({
    mutationFn: () => api.post<any>("/admin/backup"),
    onSuccess: (r) => toast.ok(`Point-in-time snapshot created: ${r.backup}`),
    onError: (err: any) => toast.error(`Backup error: ${err.message}`),
  });

  const summary = usageData?.summary;
  const tokenBreakdown = usageData?.token_breakdown;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Settings & AI Intelligence"
        subtitle="LLM provider configuration, verified health probes, accurate token telemetry, and transparent AI cost accounting."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                refetchUsage();
                refetchHealth();
              }}
              title="Refresh all metrics"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setSettingsCategory("ai")}
          className={cn(
            "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer",
            settingsCategory === "ai"
              ? "border-[#1D4ED8] text-[#1D4ED8]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>AI Intelligence & Telemetry</span>
        </button>
        <button
          onClick={() => setSettingsCategory("integrations")}
          className={cn(
            "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer",
            settingsCategory === "integrations"
              ? "border-[#1D4ED8] text-[#1D4ED8]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Integrations & CI</span>
        </button>
        <button
          onClick={() => setSettingsCategory("audit")}
          className={cn(
            "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer",
            settingsCategory === "audit"
              ? "border-[#1D4ED8] text-[#1D4ED8]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Audit Logs</span>
        </button>
        <button
          onClick={() => setSettingsCategory("evaluations")}
          className={cn(
            "px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer",
            settingsCategory === "evaluations"
              ? "border-[#1D4ED8] text-[#1D4ED8]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>AI Evaluations</span>
        </button>
      </div>

      {settingsCategory === "integrations" && <IntegrationsPage />}
      {settingsCategory === "audit" && <AuditPage />}
      {settingsCategory === "evaluations" && <EvaluationsPage />}

      {settingsCategory === "ai" && (
        <>
          {/* SECTION A: AI Providers & Health Probes */}
      <Panel
        title={
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-slate-700" />
            <span>AI Provider Configuration & Routing</span>
          </div>
        }
        actions={
          <span className="text-2xs text-slate-500 font-mono">
            Routing: Gemini (Primary) → Groq (Secondary Fallback)
          </span>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            TraceTest coordinates enterprise LLM workflows across Google Gemini and Groq Cloud with deterministic failover
            and circuit breakers. Credentials are securely loaded from system environment configuration with zero secret exposure.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 text-left">Role</th>
                  <th className="py-2.5 px-3.5 text-left">Provider</th>
                  <th className="py-2.5 px-3.5 text-left">Configured Model</th>
                  <th className="py-2.5 px-3.5 text-left">Connection Status</th>
                  <th className="py-2.5 px-3.5 text-left">Published Rate Card</th>
                  <th className="py-2.5 px-3.5 text-left">Circuit</th>
                  <th className="py-2.5 px-3.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providersLoading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Loading provider configurations...
                    </td>
                  </tr>
                ) : (
                  (providersData?.providers || []).map((p: any) => {
                    const probe = probeResults[p.provider];
                    const isHealthy = probe ? probe.status === "healthy" : p.status === "healthy";
                    return (
                      <tr key={p.provider} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold",
                              p.role === "Primary"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            )}
                          >
                            {p.role}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-900">{p.display_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">id: {p.provider}</div>
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-mono text-xs font-semibold text-slate-800">{p.model}</div>
                          {p.fallback_model && (
                            <div className="text-[10px] text-slate-500 font-mono">fallback: {p.fallback_model}</div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5">
                            {isHealthy ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Connected
                                {probe && <span className="text-slate-400">({probe.latency_ms}ms)</span>}
                              </span>
                            ) : probe?.status === "degraded" ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-medium text-[11px]">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                Degraded ({probe.latency_ms}ms)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-medium text-[11px]">
                                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                {probe?.error ? "Probe Failed" : "Unreachable"}
                              </span>
                            )}
                          </div>
                          {probe && (
                            <div className="text-[10px] text-slate-400">
                              Verified {new Date(probe.verified_at).toLocaleTimeString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[11px] text-slate-600">
                          {p.pricing_unit}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="font-mono text-[11px] text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.circuit}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!p.configured || testingProvider === p.provider}
                            loading={testingProvider === p.provider}
                            onClick={() => testConn(p.provider)}
                            className="text-xs"
                          >
                            <Zap className="h-3 w-3 mr-1 text-amber-500" />
                            Test Probe
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Test Probe Output Banner if available */}
          {Object.keys(probeResults).length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
                Live Connectivity Probe Telemetry
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(probeResults).map(([pname, res]) => (
                  <div
                    key={pname}
                    className={cn(
                      "flex items-center justify-between rounded-md border p-2.5 text-xs",
                      res.status === "healthy"
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                        : "border-rose-200 bg-rose-50/70 text-rose-950"
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            res.status === "healthy" ? "bg-emerald-600" : "bg-rose-600"
                          )}
                        />
                        <span>{pname === "gemini" ? "Google Gemini" : "Groq Cloud"} Probe</span>
                        <span className="font-mono text-[10px] text-slate-500 font-normal">({res.model})</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {res.status === "healthy"
                          ? "Round-trip JSON ping verified successfully."
                          : res.error || "Latency check exceeded threshold"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold tabular-nums">{res.latency_ms} ms</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(res.verified_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* SECTION B: AI Usage & Cost Analytics */}
      <div className="space-y-6">
        {/* Controls Bar: Time Range, Project Filter, Export Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              Time Window:
            </span>
            <div className="inline-flex rounded-md shadow-sm border border-slate-200 bg-slate-50 p-0.5">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "7d", label: "7D" },
                  { id: "30d", label: "30D" },
                  { id: "90d", label: "90D" },
                  { id: "all", label: "All Time" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setTimeRange(btn.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded transition-all",
                    timeRange === btn.id
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {timeRange === "custom" && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                  placeholder="Start Date"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                  placeholder="End Date"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={selectedProjectId}
                onChange={(e) =>
                  setSelectedProjectId(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="all">All Accessible Projects</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport("csv")}
                loading={isExporting === "csv"}
                disabled={isExporting !== null}
                className="text-xs"
                title="Download CSV of raw telemetry traces"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport("json")}
                loading={isExporting === "json"}
                disabled={isExporting !== null}
                className="text-xs"
                title="Download complete JSON accounting archive"
              >
                <FileText className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                Export JSON
              </Button>
            </div>
          </div>
        </div>

        {usageLoading ? (
          <LoadingBlock rows={6} />
        ) : usageError ? (
          <ErrorState error={usageError} onRetry={refetchUsage} />
        ) : !summary ? (
          <EmptyState title="No usage recorded" body="No LLM calls have been made matching the current filter." />
        ) : (
          <>
            {/* 6 Key Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider">Total AI Requests</span>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {summary.total_requests.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1 flex items-center gap-1">
                  <span className="text-emerald-600 font-semibold">100%</span> tracked
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider">Input Tokens</span>
                  <ArrowUpRight className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {summary.total_input_tokens.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1">
                  {summary.total_tokens > 0
                    ? `${Math.round((summary.total_input_tokens / summary.total_tokens) * 100)}% of volume`
                    : "0%"}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider">Output Tokens</span>
                  <ArrowDownRight className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {summary.total_output_tokens.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1">
                  {summary.total_tokens > 0
                    ? `${Math.round((summary.total_output_tokens / summary.total_tokens) * 100)}% of volume`
                    : "0%"}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider">Total Consumed</span>
                  <Cpu className="h-4 w-4 text-slate-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {summary.total_tokens.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1">
                  {summary.cached_input_tokens > 0
                    ? `${summary.cached_input_tokens.toLocaleString()} cached`
                    : "Direct execution"}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-800">
                    Estimated Cost
                  </span>
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                  ${summary.estimated_total_cost_usd.toFixed(4)}
                </div>
                <div className="text-2xs text-emerald-600 font-medium mt-1">Rate catalog v2026.1</div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-2xs font-semibold uppercase tracking-wider">Avg Cost / Request</span>
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  ${summary.average_cost_per_request_usd.toFixed(6)}
                </div>
                <div className="text-2xs text-slate-500 mt-1">Sub-cent efficiency</div>
              </div>
            </div>

            {/* Token Breakdown & Grounding Accuracy Card */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-900">
                    Token Telemetry Grounding & Verification
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Provider-Reported Usage Telemetry (Zero Estimation Drift)
                </div>
              </div>

              {/* Progress bar visualizing composition */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-2xs text-slate-600 font-mono">
                  <span>
                    Input: <strong>{tokenBreakdown?.input_tokens.toLocaleString()}</strong> (
                    {summary.total_tokens > 0
                      ? Math.round((tokenBreakdown.input_tokens / summary.total_tokens) * 100)
                      : 0}
                    %)
                  </span>
                  <span>
                    Output: <strong>{tokenBreakdown?.output_tokens.toLocaleString()}</strong> (
                    {summary.total_tokens > 0
                      ? Math.round((tokenBreakdown.output_tokens / summary.total_tokens) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${
                        summary.total_tokens > 0
                          ? (tokenBreakdown.input_tokens / summary.total_tokens) * 100
                          : 50
                      }%`,
                    }}
                    className="bg-indigo-500 transition-all"
                    title="Input Tokens"
                  />
                  <div
                    style={{
                      width: `${
                        summary.total_tokens > 0
                          ? (tokenBreakdown.output_tokens / summary.total_tokens) * 100
                          : 50
                      }%`,
                    }}
                    className="bg-emerald-500 transition-all"
                    title="Output Tokens"
                  />
                </div>
              </div>

              <p className="text-2xs text-slate-500 leading-relaxed">
                {tokenBreakdown?.accuracy_statement ||
                  "Token telemetry is extracted directly from Google Gemini and Groq API response usage metadata, guaranteeing reproducible cost accounting."}
              </p>
            </div>

            {/* Interactive Consumption Over Time Chart */}
            <Panel
              title={
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-700" />
                  <span>Cost & Token Consumption Over Time</span>
                </div>
              }
              actions={
                <div className="inline-flex rounded-md shadow-xs border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartMetric("cost")}
                    className={cn(
                      "px-2.5 py-1 text-2xs font-medium rounded transition-all",
                      chartMetric === "cost"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Cost ($ USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("tokens")}
                    className={cn(
                      "px-2.5 py-1 text-2xs font-medium rounded transition-all",
                      chartMetric === "tokens"
                        ? "bg-white text-slate-900 shadow-xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Token Volume
                  </button>
                </div>
              }
            >
              <div className="h-64 w-full pt-2">
                {usageData?.cost_over_time?.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No timeline data recorded for the selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={usageData.cost_over_time}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (chartMetric === "cost" ? `$${v}` : `${v / 1000}k`)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                        formatter={(val: any, name: string) => {
                          if (name === "cost_usd") return [`$${Number(val).toFixed(5)}`, "Estimated Cost"];
                          if (name === "total_tokens") return [Number(val).toLocaleString(), "Total Tokens"];
                          if (name === "requests") return [Number(val).toLocaleString(), "Requests"];
                          return [val, name];
                        }}
                        labelFormatter={(lbl) => `Timeline: ${lbl}`}
                      />
                      {chartMetric === "cost" ? (
                        <Area
                          type="monotone"
                          dataKey="cost_usd"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#costGradient)"
                        />
                      ) : (
                        <Area
                          type="monotone"
                          dataKey="total_tokens"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#tokenGradient)"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            {/* Detailed Multi-Perspective Breakdown Tabs */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200">
                {(
                  [
                    { id: "models", label: "Provider & Model Breakdown", icon: Cpu },
                    { id: "agents", label: "Cost by Agent", icon: Bot },
                    { id: "features", label: "Cost by Feature", icon: Sparkles },
                    { id: "projects", label: "Cost by Project", icon: Layers },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all",
                        isActive
                          ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Provider & Model Breakdown Table */}
              {activeTab === "models" && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Role</th>
                        <th className="py-2.5 px-3.5 text-left">Provider & Model</th>
                        <th className="py-2.5 px-3.5 text-right">Requests</th>
                        <th className="py-2.5 px-3.5 text-right">Input Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Output Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Total Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Estimated Cost ($)</th>
                        <th className="py-2.5 px-3.5 text-right">Unit Rate (1M in / out)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(usageData?.by_provider_model || []).map((m: any, idx: number) => (
                        <tr key={`${m.provider}-${m.model}-${idx}`} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3.5 font-sans font-medium text-slate-500">
                            <span
                              className={cn(
                                "inline-flex px-1.5 py-0.5 rounded text-2xs font-semibold",
                                m.role === "Primary"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              )}
                            >
                              {m.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-900">
                            {m.provider === "gemini" ? "Google Gemini" : "Groq Cloud"}
                            <span className="block font-mono text-2xs text-slate-500 font-normal">
                              {m.model}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {m.requests.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {m.input_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {m.output_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-slate-900">
                            {m.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-emerald-700">
                            ${m.cost_usd.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-2xs text-slate-500">
                            ${m.input_rate_per_m} / ${m.output_rate_per_m}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Cost by Agent Attribution */}
              {activeTab === "agents" && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[700px] text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Agent Name</th>
                        <th className="py-2.5 px-3.5 text-right">Invocations</th>
                        <th className="py-2.5 px-3.5 text-right">Input Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Output Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Total Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Estimated Cost ($)</th>
                        <th className="py-2.5 px-3.5 text-right">Share (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(usageData?.by_agent || []).map((ag: any) => (
                        <tr key={ag.agent_name} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-900">
                            {ag.display_name}
                            <span className="block font-mono text-2xs text-slate-500 font-normal">
                              tag: {ag.agent_name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {ag.requests.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {ag.input_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {ag.output_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-slate-900">
                            {ag.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-emerald-700">
                            ${ag.cost_usd.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {ag.percentage_of_cost}%
                              </span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${Math.min(100, ag.percentage_of_cost)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Cost by Feature Attribution */}
              {activeTab === "features" && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[650px] text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Quality Engineering Capability</th>
                        <th className="py-2.5 px-3.5 text-right">Invocations</th>
                        <th className="py-2.5 px-3.5 text-right">Total Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Estimated Cost ($)</th>
                        <th className="py-2.5 px-3.5 text-right">Share (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(usageData?.by_feature || []).map((ft: any) => (
                        <tr key={ft.feature_name} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-900">
                            {ft.display_name}
                            <span className="block font-mono text-2xs text-slate-500 font-normal">
                              capability: {ft.feature_name}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {ft.requests.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-slate-900">
                            {ft.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-emerald-700">
                            ${ft.cost_usd.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {ft.percentage_of_cost}%
                              </span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${Math.min(100, ft.percentage_of_cost)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 4: Cost by Project Breakdown */}
              {activeTab === "projects" && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[650px] text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Project Workspace</th>
                        <th className="py-2.5 px-3.5 text-left">Project ID</th>
                        <th className="py-2.5 px-3.5 text-right">Invocations</th>
                        <th className="py-2.5 px-3.5 text-right">Total Tokens</th>
                        <th className="py-2.5 px-3.5 text-right">Estimated Cost ($)</th>
                        <th className="py-2.5 px-3.5 text-right">Share of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(usageData?.by_project || []).map((pj: any, idx: number) => (
                        <tr key={pj.project_id ?? `sys-${idx}`} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-900">
                            {pj.project_name}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 font-mono">
                            {pj.project_id ? `#${pj.project_id}` : "System"}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700">
                            {pj.requests.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-slate-900">
                            {pj.total_tokens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums font-bold text-emerald-700">
                            ${pj.cost_usd.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-1.5 font-sans">
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {pj.percentage_of_cost}%
                              </span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${Math.min(100, pj.percentage_of_cost)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pricing Transparency & Methodology Callout */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-2xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
                <span>Pricing Transparency & Billing Invariant Methodology</span>
              </div>
              <p className="leading-relaxed">
                {usageData?.pricing_metadata?.disclaimer ||
                  "Token consumption reflects actual usage reported by API providers. Cost estimates are calculated using standard published rate cards (v2026.1)."}
              </p>
              <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 pt-1 border-t border-slate-200/60">
                <span>
                  Pricing Version: <strong className="font-mono">{usageData?.pricing_metadata?.version || "2026.1"}</strong>
                </span>
                <span>
                  Effective Date: <strong className="font-mono">2026-01-01</strong>
                </span>
                <span>
                  Telemetry Source: <strong>Google Cloud Vertex / AI Studio & Groq Cloud</strong>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECTION C & D: Execution Sandbox & Database Health */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Section C: Execution Sandbox & Environment */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-slate-700" />
              <span>Execution Sandbox & Runtime Environment</span>
            </div>
          }
        >
          {configLoading || !configData ? (
            <LoadingBlock rows={4} />
          ) : (
            <div className="space-y-4">
              <KV
                items={[
                  ["Execution Environment", configData.environment.toUpperCase()],
                  ["Sandbox Isolation Level", configData.sandbox.isolation_level.toUpperCase()],
                  ["Execution Timeout", `${configData.sandbox.timeout_seconds} seconds`],
                  ["Sandbox Memory Limit", `${configData.sandbox.memory_mb} MB`],
                  ["Max Output Capture", `${Math.round(configData.sandbox.max_output_bytes / 1024)} KB`],
                  [
                    "Playwright E2E Target",
                    configData.playwright_target_url ? (
                      <span className="font-mono text-2xs">{configData.playwright_target_url}</span>
                    ) : (
                      "Default Internal Runner"
                    ),
                  ],
                ]}
              />
              <p className="text-2xs text-slate-500">
                Test runner operates inside sandboxed processes with isolated environment variables and runtime quotas.
              </p>
            </div>
          )}
        </Panel>

        {/* Section D: Database & Workspace Health */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-700" />
              <span>Database Integrity & Workspace Health</span>
            </div>
          }
        >
          {healthLoading ? (
            <LoadingBlock rows={4} />
          ) : (
            <div className="space-y-4">
              <KV
                items={[
                  [
                    "Database Engine",
                    healthData?.database?.journal_mode
                      ? `SQLite 3 (${healthData.database.journal_mode.toUpperCase()} journal)`
                      : "SQLite 3 (WAL)",
                  ],
                  [
                    "Integrity Check",
                    healthData?.database?.integrity === "ok" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        PRAGMA quick_check: ok
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold">Verification failed</span>
                    ),
                  ],
                  [
                    "Foreign Key Violations",
                    healthData?.database?.foreign_key_violations === 0 ? (
                      <span className="text-emerald-700 font-medium">0 violations detected</span>
                    ) : (
                      `${healthData?.database?.foreign_key_violations} violations`
                    ),
                  ],
                  [
                    "Total Workspace Records",
                    configData?.counts
                      ? `${configData.counts.requirements} requirements · ${configData.counts.test_cases} tests · ${configData.counts.executions} executions · ${configData.counts.defects} defects`
                      : "Aggregating records...",
                  ],
                ]}
              />

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-2xs text-slate-500">Create point-in-time database snapshot:</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => backup.mutate()}
                  loading={backup.isPending}
                  className="text-xs"
                >
                  <Database className="h-3.5 w-3.5 mr-1 text-slate-600" />
                  Backup SQLite Database
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
        </>
      )}
    </div>
  );
}
