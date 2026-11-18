import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProjectCreationWizard } from "@/components/projects/ProjectCreationWizard";
import { ME, mockFetch, renderApp } from "./helpers";

test("ProjectCreationWizard Step 2 removes synthetic fixtures and provides clear Next navigation and interactive upload", async () => {
  mockFetch([
    [/^\/api\/v1\/me$/, ME],
    [/^\/api\/v1\/projects$/, []],
    [/^\/api\/v1\/projects\/validate-key/, { valid: true, key: "MY_PROJ", message: "Key available" }],
    [
      /^\/api\/v1\/projects\/onboarding\/upload/,
      {
        id: 101,
        filename: "aws-s3-spec.pdf",
        display_name: "aws-s3-spec",
        file_type: "pdf",
        document_type: "prd",
        size_bytes: 45000,
        page_count: 3,
        status: "staged",
      },
    ],
  ]);

  renderApp(<ProjectCreationWizard open={true} onOpenChange={() => {}} />);

  // Verify Modal Title
  expect(screen.getByText(/Requirements-Based Quality Platform Wizard/i)).toBeInTheDocument();

  // Step 1: Fill Name and Key
  const nameInput = screen.getByPlaceholderText(/e\.g\. UPI Dispute/i);
  fireEvent.change(nameInput, { target: { value: "AWS Cloud Security Platform" } });

  const keyInput = screen.getByPlaceholderText(/e\.g\. UPI_DISP/i);
  fireEvent.change(keyInput, { target: { value: "AWS_SEC" } });

  // Wait for key validation
  await waitFor(() => {
    expect(screen.getByText(/Key available/i)).toBeInTheDocument();
  });

  // Click Next: Document Intake in footer
  const nextBtn = screen.getAllByRole("button", { name: /Next: Document Intake/i })[0];
  fireEvent.click(nextBtn);

  // Verify we are on Step 2
  await waitFor(() => {
    expect(screen.getByText(/Document Intake & Specification Staging/i)).toBeInTheDocument();
  });

  // Requirement 1: Verify Synthetic test fixture is NOT present
  expect(screen.queryByText(/Sample Test Fixtures/i)).toBeNull();
  expect(screen.queryByText(/Load Sample Fixture \(Synthetic\)/i)).toBeNull();
  expect(screen.queryByText(/Demonstration Fixture/i)).toBeNull();

  // Requirement 2: Verify Back and Next buttons are present in footer
  const backBtn = screen.getByRole("button", { name: /Back: Project Details/i });
  expect(backBtn).toBeInTheDocument();

  const nextStepBtn = screen.getAllByRole("button", { name: /Next: AI Document Analysis/i })[0];
  expect(nextStepBtn).toBeInTheDocument();
  expect(nextStepBtn).toBeDisabled(); // Disabled because 0 documents are staged

  // Requirement 3: Interactive Document Upload
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(fileInput).not.toBeNull();

  const dummyFile = new File(["dummy pdf content"], "aws-s3-spec.pdf", { type: "application/pdf" });
  fireEvent.change(fileInput, { target: { files: [dummyFile] } });

  // Verify document is staged and Next button is enabled with document count
  await waitFor(() => {
    expect(screen.getAllByText(/aws-s3-spec/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Authentic Document/i)).toBeInTheDocument();
  });

  const enabledNextBtn = screen.getByRole("button", { name: /Next: Run AI Document Analysis \(1\)/i });
  expect(enabledNextBtn).toBeInTheDocument();
  expect(enabledNextBtn).not.toBeDisabled();
});

test("ProjectCreationWizard Step 3 renders estimated time remaining and Antigravity-style autonomous live activity pipeline", async () => {
  let analysisCalled = false;
  mockFetch([
    [/^\/api\/v1\/me$/, ME],
    [/^\/api\/v1\/projects$/, []],
    [/^\/api\/v1\/projects\/validate-key/, { valid: true, key: "AWS_SEC", message: "Key available" }],
    [
      /^\/api\/v1\/projects\/onboarding\/upload/,
      {
        id: 1067,
        filename: "wellarchitected-security-pillar.pdf",
        display_name: "wellarchitected-security-pillar",
        file_type: "pdf",
        document_type: "spec",
        size_bytes: 2800000,
        page_count: 240,
        status: "staged",
      },
    ],
    [
      /^\/api\/v1\/projects\/onboarding\/analyze/,
      () => {
        analysisCalled = true;
        return {
          detected_domain: "Cloud Security Architecture",
          product_overview: "AWS Well-Architected Security Pillar Framework",
          problem_statement: "Workload isolation, IAM access enforcement, and automated threat detection.",
          business_rules: [
            {
              rule_id: "SEC-001",
              title: "Account-level separation is strongly recommended",
              description: "Account-level separation is strongly recommended for environment isolation.",
              supporting_quote: "Account-level separation is strongly recommended, as it provides boundary.",
              confidence: 0.98,
              is_inferred: false,
              approval_status: "suggested",
            },
          ],
          roles: [
            {
              role_id: "ROLE-001",
              name: "Cloud Security Architect",
              description: "Designs workload security baseline",
              responsibilities: ["Establish multi-account structure"],
            },
          ],
          scenarios: [
            {
              scenario_id: "SCENARIO-001",
              title: "Workload Account Isolation",
              description: "Isolating environments across accounts",
              steps: ["Create separate accounts", "Apply SCPs"],
              expected_outcome: "Environments isolated",
            },
          ],
          cross_document_insights: [],
        };
      },
    ],
  ]);

  renderApp(<ProjectCreationWizard open={true} onOpenChange={() => {}} />);

  // Step 1: Fill Name and Key
  fireEvent.change(screen.getByPlaceholderText(/e\.g\. UPI Dispute/i), {
    target: { value: "AWS Security Platform" },
  });
  fireEvent.change(screen.getByPlaceholderText(/e\.g\. UPI_DISP/i), {
    target: { value: "AWS_SEC" },
  });

  await waitFor(() => {
    expect(screen.getByText(/Key available/i)).toBeInTheDocument();
  });

  // Next to Step 2
  fireEvent.click(screen.getAllByRole("button", { name: /Next: Document Intake/i })[0]);

  await waitFor(() => {
    expect(screen.getByText(/Document Intake & Specification Staging/i)).toBeInTheDocument();
  });

  // Stage authentic document
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const dummyFile = new File(["pdf bytes"], "wellarchitected-security-pillar.pdf", { type: "application/pdf" });
  fireEvent.change(fileInput, { target: { files: [dummyFile] } });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Next: Run AI Document Analysis \(1\)/i })).toBeInTheDocument();
  });

  // Click Next: Run AI Document Analysis
  fireEvent.click(screen.getByRole("button", { name: /Next: Run AI Document Analysis \(1\)/i }));

  // Verify Step 3 displays:
  // 1. Antigravity-Style Live Activity Terminal
  await waitFor(() => {
    expect(screen.getByText(/TraceTest Context Engine • Autonomous Pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE/i)).toBeInTheDocument();
  });

  // 2. Estimated time remaining pill (not elapsed time)
  expect(screen.getByText(/Estimated time:/i)).toBeInTheDocument();
  expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  expect(screen.queryByText(/^Elapsed: \d+/i)).toBeNull();

  // 3. Document Extraction Pipeline with 5 stages
  expect(screen.getByText(/Document Text Ingestion & Clause Normalization/i)).toBeInTheDocument();
  expect(screen.getByText(/Domain Rule & Regulatory Invariant Synthesis/i)).toBeInTheDocument();
  expect(screen.getByText(/Verbatim Source Quote Verification & Provenance Mapping/i)).toBeInTheDocument();

  // Wait for analysis to complete and transition to Step 4
  await waitFor(
    () => {
      expect(analysisCalled).toBe(true);
      expect(screen.getByText(/Approve & Create Project/i)).toBeInTheDocument();
    },
    { timeout: 3000 }
  );
});
