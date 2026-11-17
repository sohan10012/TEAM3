import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SettingsPage } from "@/pages/SettingsPage";
import { ToastProvider } from "@/components/Toast";
import { api } from "@/services/api";

// Mock api service
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock useProjects hook
vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({
    projects: [
      { id: 5, name: "Project Alpha" },
      { id: 12, name: "Amazon AWS Evaluation" },
    ],
    activeProject: null,
    setActiveProject: vi.fn(),
  }),
}));

const mockUsageData = {
  summary: {
    total_requests: 723,
    total_input_tokens: 406114,
    total_output_tokens: 357083,
    total_tokens: 763197,
    cached_input_tokens: 0,
    reasoning_tokens: 0,
    estimated_total_cost_usd: 0.2364,
    average_cost_per_request_usd: 0.000327,
    provider_reported_ratio: 1.0,
  },
  token_breakdown: {
    input_tokens: 406114,
    output_tokens: 357083,
    cached_input_tokens: 0,
    reasoning_tokens: 0,
    total_tokens: 763197,
    reported_by: "provider_telemetry",
    provider_telemetry_count: 723,
    fallback_estimated_count: 0,
    accuracy_statement: "Ground-truth token counts recorded from Google Gemini and Groq API usage metadata.",
  },
  by_provider_model: [
    {
      provider: "gemini",
      model: "gemini-3.8-flash",
      role: "Primary",
      requests: 520,
      input_tokens: 280000,
      output_tokens: 240000,
      cached_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 520000,
      cost_usd: 0.1610,
      input_rate_per_m: 0.075,
      output_rate_per_m: 0.30,
      cached_rate_per_m: 0.01875,
      pricing_version: "2026.1",
    },
    {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      role: "Secondary",
      requests: 203,
      input_tokens: 126114,
      output_tokens: 117083,
      cached_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 243197,
      cost_usd: 0.0754,
      input_rate_per_m: 0.15,
      output_rate_per_m: 0.60,
      cached_rate_per_m: 0.075,
      pricing_version: "2026.1",
    },
  ],
  cost_over_time: [
    {
      date: "2026-11-17",
      requests: 723,
      input_tokens: 406114,
      output_tokens: 357083,
      total_tokens: 763197,
      cost_usd: 0.2364,
    },
  ],
  by_agent: [
    {
      agent_name: "reasonx",
      display_name: "ReasonX AI Autonomous Agent",
      requests: 127,
      input_tokens: 120000,
      output_tokens: 111515,
      total_tokens: 231515,
      cost_usd: 0.0689,
      percentage_of_cost: 29.1,
    },
    {
      agent_name: "test_generator",
      display_name: "Test Case Generator",
      requests: 189,
      input_tokens: 105000,
      output_tokens: 96993,
      total_tokens: 201993,
      cost_usd: 0.0614,
      percentage_of_cost: 26.0,
    },
  ],
  by_feature: [
    {
      feature_name: "reasonx_conversations",
      display_name: "ReasonX Agent Conversations & Tasks",
      requests: 127,
      total_tokens: 231515,
      cost_usd: 0.0689,
      percentage_of_cost: 29.1,
    },
    {
      feature_name: "test_case_generation",
      display_name: "Test Case & Step Generation",
      requests: 189,
      total_tokens: 201993,
      cost_usd: 0.0614,
      percentage_of_cost: 26.0,
    },
  ],
  by_project: [
    {
      project_id: 5,
      project_name: "Project Alpha",
      requests: 481,
      total_tokens: 487153,
      cost_usd: 0.1502,
      percentage_of_cost: 63.5,
    },
    {
      project_id: 12,
      project_name: "Amazon AWS Evaluation",
      requests: 226,
      total_tokens: 267875,
      cost_usd: 0.0830,
      percentage_of_cost: 35.1,
    },
  ],
  pricing_metadata: {
    version: "2026.1",
    effective_date: "2026-01-01",
    disclaimer: "Token consumption reflects actual usage reported by API providers.",
  },
};

const mockProvidersData = {
  mode: "live",
  primary_provider: "gemini",
  providers: [
    {
      provider: "gemini",
      display_name: "Google Gemini",
      role: "Primary",
      model: "gemini-3.8-flash",
      fallback_model: "gemini-3.1-pro-preview",
      status: "healthy",
      configured: true,
      circuit: "closed",
      pricing_unit: "$0.075 / 1M in · $0.30 / 1M out",
    },
    {
      provider: "groq",
      display_name: "Groq Cloud",
      role: "Secondary",
      model: "openai/gpt-oss-120b",
      fallback_model: null,
      status: "healthy",
      configured: true,
      circuit: "closed",
      pricing_unit: "$0.15 / 1M in · $0.60 / 1M out",
    },
  ],
};

const mockConfigData = {
  environment: "production",
  isolation_level: "container",
  github_configured: true,
  playwright_target_url: "http://127.0.0.1:5173",
  data_dir: "var/data",
  sandbox: {
    timeout_seconds: 60,
    memory_mb: 512,
    max_output_bytes: 1048576,
    isolation_level: "container",
  },
  counts: {
    requirements: 42,
    test_cases: 68,
    executions: 14,
    defects: 8,
  },
};

const mockHealthData = {
  status: "ok",
  database: {
    integrity: "ok",
    foreign_key_violations: 0,
    journal_mode: "wal",
  },
  time: "2026-11-17T18:00:00Z",
};

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <SettingsPage />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("SettingsPage AI Usage & Cost Redesign", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url.startsWith("/settings/ai-usage")) return Promise.resolve(mockUsageData);
      if (url === "/settings/providers") return Promise.resolve(mockProvidersData);
      if (url === "/config") return Promise.resolve(mockConfigData);
      if (url === "/health") return Promise.resolve(mockHealthData);
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  it("renders page header and time range filters", async () => {
    renderSettingsPage();

    expect(screen.getByText("Settings & AI Intelligence")).toBeInTheDocument();
    expect(
      screen.getByText(/LLM provider configuration, verified health probes, accurate token telemetry/i)
    ).toBeInTheDocument();

    // Verify filter buttons
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("7D")).toBeInTheDocument();
    expect(screen.getByText("30D")).toBeInTheDocument();
    expect(screen.getByText("90D")).toBeInTheDocument();
    expect(screen.getByText("All Time")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("displays clean AI providers summary without slot internals or masked secrets", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getAllByText("Google Gemini").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Groq Cloud").length).toBeGreaterThan(0);
    });

    // Check roles
    expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secondary").length).toBeGreaterThan(0);

    // Verify no secret slot tokens or slot tables are displayed
    expect(screen.queryByText(/Slot Pools Table/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Masked Secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/test-key-mock/i)).not.toBeInTheDocument();

    // Models displayed cleanly
    expect(screen.getAllByText("gemini-3.8-flash").length).toBeGreaterThan(0);
    expect(screen.getAllByText("openai/gpt-oss-120b").length).toBeGreaterThan(0);
  });

  it("renders the 6 key AI metrics and token breakdown card", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText("723")).toBeInTheDocument();
      expect(screen.getAllByText("406,114").length).toBeGreaterThan(0);
      expect(screen.getAllByText("357,083").length).toBeGreaterThan(0);
      expect(screen.getAllByText("763,197").length).toBeGreaterThan(0);
      expect(screen.getByText("$0.2364")).toBeInTheDocument();
      expect(screen.getByText("$0.000327")).toBeInTheDocument();
    });

    // Grounding verification badge
    expect(screen.getByText(/Provider-Reported Usage Telemetry/i)).toBeInTheDocument();
  });

  it("allows switching between breakdown tabs (models, agents, features, projects)", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText("Provider & Model Breakdown")).toBeInTheDocument();
    });

    // Switch to Cost by Agent
    fireEvent.click(screen.getByText("Cost by Agent"));
    expect(screen.getByText("ReasonX AI Autonomous Agent")).toBeInTheDocument();
    expect(screen.getByText("Test Case Generator")).toBeInTheDocument();

    // Switch to Cost by Feature
    fireEvent.click(screen.getByText("Cost by Feature"));
    expect(screen.getByText("ReasonX Agent Conversations & Tasks")).toBeInTheDocument();
    expect(screen.getByText("Test Case & Step Generation")).toBeInTheDocument();

    // Switch to Cost by Project
    fireEvent.click(screen.getByText("Cost by Project"));
    expect(screen.getAllByText("Project Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Amazon AWS Evaluation").length).toBeGreaterThan(0);
  });

  it("executes live health probe and displays probe feedback without slots", async () => {
    (api.post as any).mockImplementation((url: string) => {
      if (url === "/settings/llm/health-check") {
        return Promise.resolve({
          provider: "gemini",
          role: "Primary",
          model: "gemini-3.8-flash",
          status: "healthy",
          latency_ms: 124,
          verified_at: "2026-11-17T18:05:00Z",
          error: null,
        });
      }
      return Promise.reject(new Error(`Unhandled POST: ${url}`));
    });

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getAllByText("Test Probe")[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("Test Probe")[0]);

    await waitFor(() => {
      expect(screen.getByText(/Live Connectivity Probe Telemetry/i)).toBeInTheDocument();
      expect(screen.getAllByText(/124 ms/i).length).toBeGreaterThan(0);
    });
  });

  it("renders Execution Sandbox and Database Integrity without raw filesystem paths", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText("Execution Sandbox & Runtime Environment")).toBeInTheDocument();
      expect(screen.getByText("Database Integrity & Workspace Health")).toBeInTheDocument();
      expect(screen.getByText(/PRAGMA quick_check: ok/i)).toBeInTheDocument();
    });

    // Verify raw user home directory path is never shown
    expect(screen.queryByText(/\/home\/Sohan/i)).not.toBeInTheDocument();
  });
});
