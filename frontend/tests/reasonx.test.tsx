import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { ReasonXMark } from "@/components/brand/ReasonXMark";
import { ReasonXApprovalCard } from "@/components/reasonx/ReasonXApprovalCard";
import {
  ReasonXConversationHistory,
  type ConversationSummary,
} from "@/components/reasonx/ReasonXConversationHistory";
import { ReasonXEvidencePanel } from "@/components/reasonx/ReasonXEvidencePanel";
import { ReasonXLauncher } from "@/components/reasonx/ReasonXLauncher";
import { ReasonXMarkdown } from "@/components/reasonx/ReasonXMarkdown";
import { ReasonXTaskTimeline } from "@/components/reasonx/ReasonXTaskTimeline";
import { ReasonXTemplateGallery } from "@/components/reasonx/ReasonXTemplateGallery";

describe("ReasonX UI Components & Redesign", () => {
  test("ReasonXMark renders geometric vector identity mark", () => {
    const { container } = render(<ReasonXMark size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  test("ReasonXLauncher renders properly with enterprise branding and toggles", async () => {
    const handleToggle = vi.fn();
    render(
      <ReasonXLauncher
        isOpen={false}
        onToggle={handleToggle}
        isRunning={false}
        hasUnreadOrApproval={true}
      />
    );

    const button = screen.getByRole("button", { name: /Open ReasonX/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", expect.stringContaining("Open ReasonX (Alt+R)"));

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

  test("ReasonXTaskTimeline renders plan steps with human-readable descriptions", () => {
    const plan = [
      {
        step: 1,
        title: "Retrieve project security requirements",
        tool: "inspect_requirements",
      },
      {
        step: 2,
        title: "Analyze test execution results",
        tool: "inspect_executions",
      },
    ];

    const steps = [
      {
        step_number: 1,
        title: "Retrieve project security requirements",
        status: "completed" as const,
        tool: "inspect_requirements",
        elapsed_ms: 120,
      },
      {
        step_number: 2,
        title: "Analyze test execution results",
        status: "running" as const,
        tool: "inspect_executions",
      },
    ];

    render(<ReasonXTaskTimeline plan={plan} steps={steps} currentStep={2} />);

    expect(screen.getByText(/Execution Plan/i)).toBeInTheDocument();
    expect(screen.getByText("Retrieve project security requirements")).toBeInTheDocument();
    expect(screen.getByText("Analyze test execution results")).toBeInTheDocument();
    expect(screen.getByText("Inspecting requirements and coverage")).toBeInTheDocument();
  });

  test("ReasonXTemplateGallery renders 6 categories and handles prompt selection", async () => {
    const handleSelect = vi.fn();
    render(<ReasonXTemplateGallery onSelect={handleSelect} />);

    expect(screen.getByText("How can I help?")).toBeInTheDocument();
    expect(screen.getByText("Choose a task to get started, or ask ReasonX anything about this project.")).toBeInTheDocument();
    expect(screen.getByText("Project Overview")).toBeInTheDocument();
    expect(screen.getByText("Requirements & Coverage")).toBeInTheDocument();
    expect(screen.getByText("Test Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Execution Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Defect Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Policy & Compliance")).toBeInTheDocument();

    expect(screen.getByText("Summarize Project Status")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Summarize Project Status"));
    expect(handleSelect).toHaveBeenCalledWith(
      "Summarize the overall quality status, pass rates, and release readiness of this project."
    );
  });

  test("ReasonXConversationHistory displays empty state correctly", () => {
    render(
      <ReasonXConversationHistory
        conversations={[]}
        activeId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("No previous conversations")).toBeInTheDocument();
    expect(
      screen.getByText("Your conversations will appear here when you start using ReasonX.")
    ).toBeInTheDocument();
  });

  test("ReasonXConversationHistory filters by search query and shows messages count", async () => {
    const mockConversations: ConversationSummary[] = [
      {
        id: 1,
        title: "AWS S3 Encryption Audit",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        message_count: 4,
        preview: "Analyzed 12 requirements and verified TLS 1.2 policies.",
      },
      {
        id: 2,
        title: "Payroll Compliance Verification",
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        message_count: 2,
        preview: "Audited statutory formulas for statutory leave.",
      },
    ];

    const handleSelect = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ReasonXConversationHistory
        conversations={mockConversations}
        activeId={1}
        onSelect={handleSelect}
        onNew={vi.fn()}
        onDelete={handleDelete}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("AWS S3 Encryption Audit")).toBeInTheDocument();
    expect(screen.getByText("Payroll Compliance Verification")).toBeInTheDocument();
    expect(screen.getByText(/4 messages/i)).toBeInTheDocument();

    // Test Search Filter
    const searchInput = screen.getByPlaceholderText("Search conversations...");
    await userEvent.type(searchInput, "Encryption");
    expect(screen.getByText("AWS S3 Encryption Audit")).toBeInTheDocument();
    expect(screen.queryByText("Payroll Compliance Verification")).not.toBeInTheDocument();
  });

  test("ReasonXMarkdown renders headings, bold text, lists, and tables cleanly", () => {
    const md = `### Summary Report
**Status:** All tests passing.
- Verified TLS 1.2
- Audited CORS policies

| Metric | Value |
| --- | --- |
| Pass Rate | 100% |
`;

    const { container } = render(<ReasonXMarkdown content={md} />);
    expect(screen.getByText("Summary Report")).toBeInTheDocument();
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Verified TLS 1.2")).toBeInTheDocument();
    expect(screen.getByText("Audited CORS policies")).toBeInTheDocument();
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(screen.getByText("Pass Rate")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
