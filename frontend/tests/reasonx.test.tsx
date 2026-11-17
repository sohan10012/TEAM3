import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { ReasonXApprovalCard } from "@/components/reasonx/ReasonXApprovalCard";
import { ReasonXEvidencePanel } from "@/components/reasonx/ReasonXEvidencePanel";
import { ReasonXLauncher } from "@/components/reasonx/ReasonXLauncher";
import { ReasonXModelIndicator } from "@/components/reasonx/ReasonXModelIndicator";
import { ReasonXTaskTimeline } from "@/components/reasonx/ReasonXTaskTimeline";
import { ReasonXTemplateGallery } from "@/components/reasonx/ReasonXTemplateGallery";

describe("ReasonX UI Components", () => {
  test("ReasonXLauncher renders properly with active states and toggles", async () => {
    const handleToggle = vi.fn();
    render(
      <ReasonXLauncher
        isOpen={false}
        onToggle={handleToggle}
        isRunning={false}
        hasUnreadOrApproval={true}
      />
    );

    const button = screen.getByRole("button", { name: /Open ReasonX AI Assistant/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", expect.stringContaining("ReasonX AI Autonomous Agent"));

    await userEvent.click(button);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  test("ReasonXApprovalCard renders Level 3/4 risk warnings and handles approve/reject", async () => {
    const handleApprove = vi.fn().mockResolvedValue(undefined);
    const handleReject = vi.fn().mockResolvedValue(undefined);

    const request = {
      task_id: 101,
      action: "create_defect",
      risk_level: 3,
      impact_summary: "Will file a new Defect in project AWS_EVAL with severity Critical.",
      payload: {
        title: "Enforce TLS 1.2 on S3 Buckets",
        severity: "critical",
      },
    };

    render(
      <ReasonXApprovalCard
        request={request}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );

    expect(screen.getByText("Persistent Project Change Confirmation")).toBeInTheDocument();
    expect(screen.getByText(/Level 3 Gate/i)).toBeInTheDocument();
    expect(screen.getByText(request.impact_summary)).toBeInTheDocument();
    expect(screen.getByText(/Enforce TLS 1.2 on S3 Buckets/)).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /Approve & Execute/i });
    await userEvent.click(approveBtn);
    expect(handleApprove).toHaveBeenCalledWith(101);
  });

  test("ReasonXEvidencePanel displays grounded document citations", () => {
    const evidence = [
      {
        source_document: "amazon-s3-security-guide.pdf",
        page: 4,
        section: "Enforcing Encryption in Transit",
        requirement_id: "REQ-AWS-0001",
        quote: "Use bucket policies that deny s3:GetObject unless aws:SecureTransport is true.",
      },
    ];

    render(
      <MemoryRouter>
        <ReasonXEvidencePanel evidence={evidence} projectId={12} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Verified Source Grounding & Statutory Evidence/i)).toBeInTheDocument();
    expect(screen.getByText("amazon-s3-security-guide.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Page:/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/Section:/i)).toBeInTheDocument();
    expect(screen.getByText("Enforcing Encryption in Transit")).toBeInTheDocument();
    expect(screen.getByText(/deny s3:GetObject unless aws:SecureTransport is true/)).toBeInTheDocument();
  });

  test("ReasonXModelIndicator displays active Gemini model and provider latency", () => {
    render(
      <ReasonXModelIndicator
        model="gemini-3.8-flash"
        provider="gemini"
        latencyMs={842}
        workflowStage="Executing plan"
      />
    );

    expect(screen.getByText("gemini-3.8-flash")).toBeInTheDocument();
    expect(screen.getByText("(842ms)")).toBeInTheDocument();
    expect(screen.getByText("Executing plan")).toBeInTheDocument();
  });

  test("ReasonXTaskTimeline renders Plan-Act-Verify workflow steps", () => {
    const plan = [
      {
        step: 1,
        title: "Retrieve project security requirements",
        tool: "get_requirements",
        risk_level: 1,
      },
      {
        step: 2,
        title: "Analyze failed test execution logs",
        tool: "get_test_execution_insights",
        risk_level: 1,
      },
    ];

    const steps = [
      {
        step_number: 1,
        title: "Retrieve project security requirements",
        status: "completed" as const,
        tool: "get_requirements",
        elapsed_ms: 120,
      },
      {
        step_number: 2,
        title: "Analyze failed test execution logs",
        status: "running" as const,
        tool: "get_test_execution_insights",
      },
    ];

    render(<ReasonXTaskTimeline plan={plan} steps={steps} currentStep={2} />);

    expect(screen.getByText(/Autonomous Execution Plan/i)).toBeInTheDocument();
    expect(screen.getByText("Retrieve project security requirements")).toBeInTheDocument();
    expect(screen.getByText("Analyze failed test execution logs")).toBeInTheDocument();
    expect(screen.getByText(/get_requirements/)).toBeInTheDocument();
  });

  test("ReasonXTemplateGallery allows selecting quick prompts by category", async () => {
    const handleSelect = vi.fn();
    render(<ReasonXTemplateGallery onSelect={handleSelect} />);

    expect(screen.getByText("Project Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Summarize Project Status")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Summarize Project Status"));
    expect(handleSelect).toHaveBeenCalledWith(
      "Summarize the overall quality status, pass rates, and release readiness of this project."
    );
  });
});
