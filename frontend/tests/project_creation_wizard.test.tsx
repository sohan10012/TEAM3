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

test("ProjectCreationWizard Step 4 renders accurate provenance, 5-factor confidence popover, separated rule chips, testable scenarios and single-doc state", async () => {
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
        page_count: 84,
        status: "staged",
      },
    ],
    [
      /^\/api\/v1\/projects\/onboarding\/analyze/,
      {
        detected_domain: "Cloud Security Architecture",
        product_overview: "AWS Well-Architected Security Pillar Framework",
        problem_statement: "Workload isolation, emergency access, and automated threat detection.",
        business_rules: [
          {
            rule_id: "BR-001",
            title: "Account-Level Workload Isolation for Production and Non-Production Environments",
            description: "In AWS, accounts serve as a hard security boundary. Account-level separation is strongly recommended to isolate production workloads.",
            supporting_quote: "Account-level separation is strongly recommended, as it provides a boundary for permissions, billing, and isolation.",
            confidence: 0.956,
            confidence_breakdown: {
              quotation_match: 1.0,
              semantic_support: 0.98,
              classification_certainty: 0.96,
              context_clarity: 0.95,
              extraction_ambiguity: 0.96,
            },
            confidence_rationale: "Quotation match: 100% (verbatim grounded). Prescriptive normative requirement.",
            physical_page_number: 13,
            printed_page_number: 7,
            section_title: "AWS Account Management and Separation",
            is_inferred: false,
            approval_status: "suggested",
          },
          {
            rule_id: "BR-007",
            title: "SEC03-BP03 Establish Emergency Access Process",
            description: "Workload architectures must establish emergency break-glass procedures.",
            supporting_quote: "Create a process that allows for emergency access to your workloads in the unlikely event of an issue with your centralized identity provider.",
            confidence: 0.958,
            confidence_breakdown: {
              quotation_match: 1.0,
              semantic_support: 0.98,
              classification_certainty: 0.96,
              context_clarity: 0.95,
              extraction_ambiguity: 0.96,
            },
            confidence_rationale: "Quotation match: 100% (verbatim grounded).",
            physical_page_number: 73,
            printed_page_number: 67,
            section_title: "SEC03-BP03 Establish Emergency Access Process",
            is_inferred: false,
            approval_status: "suggested",
          },
        ],
        roles: [
          {
            role_name: "IAM Administrator",
            description: "Manages identity federation and emergency break-glass roles.",
            permissions: ["iam:AssumeRole", "sts:GetFederationToken"],
            responsibilities: "Maintain emergency access credentials and monitor break-glass usage.",
            restrictions: "Emergency access must require secondary approval and time-bounded session expiry.",
            source_document: "wellarchitected-security-pillar.pdf",
            clause_ref: "SEC03-BP03",
            is_inferred: true,
          },
        ],
        scenarios: [
          {
            scenario_id: "SCN-001",
            title: "Workload Account Isolation",
            description: "Cloud Architect enforces separate AWS accounts for production and staging workloads.",
            actor: "Cloud Architect",
            preconditions: "AWS Organization is configured with separate Workload and Core OUs.",
            expected_outcome: "GIVEN: Multi-account structure WHEN: Development workload is deployed THEN: Production resources cannot be accessed.",
            business_rules: ["BR-001"],
            module: "Account Governance",
            evidence_type: "inferred",
          },
          {
            scenario_id: "SCN-002",
            title: "Emergency Break-Glass Workload Access",
            description: "Centralized IdP failure triggers pre-provisioned emergency break-glass procedure.",
            actor: "IAM Administrator",
            preconditions: "Primary corporate IdP is unavailable or unreachable.",
            expected_outcome: "GIVEN: Centralized IdP outage WHEN: IAM Administrator triggers emergency access THEN: Access is granted with 1-hour session limit and immediate CISO alert.",
            business_rules: ["BR-007"],
            module: "Identity & Access Management",
            evidence_type: "inferred",
          },
        ],
        cross_document_insights: [],
      },
    ],
  ]);

  renderApp(<ProjectCreationWizard open={true} onOpenChange={() => {}} />);

  // Step 1: Project Details
  fireEvent.change(screen.getByPlaceholderText(/e\.g\. UPI Dispute/i), {
    target: { value: "AWS Well-Architected Security Project" },
  });
  fireEvent.change(screen.getByPlaceholderText(/e\.g\. UPI_DISP/i), {
    target: { value: "AWS_SEC" },
  });
  await waitFor(() => expect(screen.getByText(/Key available/i)).toBeInTheDocument());

  // Step 2: Stage Document
  fireEvent.click(screen.getAllByRole("button", { name: /Next: Document Intake/i })[0]);
  await waitFor(() => expect(screen.getByText(/Document Intake & Specification Staging/i)).toBeInTheDocument());

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const dummyFile = new File(["pdf bytes"], "wellarchitected-security-pillar.pdf", { type: "application/pdf" });
  fireEvent.change(fileInput, { target: { files: [dummyFile] } });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Next: Run AI Document Analysis \(1\)/i })).toBeInTheDocument();
  });

  // Step 3: Run AI Document Analysis
  fireEvent.click(screen.getByRole("button", { name: /Next: Run AI Document Analysis \(1\)/i }));

  // Step 4: Verify Human Review & Approval Screen
  await waitFor(
    () => {
      expect(screen.getByText(/Business Rules & Invariants \(2\)/i)).toBeInTheDocument();
    },
    { timeout: 3000 }
  );

  // 1. Verify Full Business Rule Headings without ellipsis truncation
  expect(
    screen.getByText(/Account-Level Workload Isolation for Production and Non-Production Environments/i)
  ).toBeInTheDocument();
  expect(
    screen.getAllByText(/SEC03-BP03 Establish Emergency Access Process/i).length
  ).toBeGreaterThan(0);

  // 2. Verify Physical vs Printed Page Provenance Footnote
  expect(screen.getAllByText(/Printed Page/i).length).toBeGreaterThan(1);
  expect(screen.getByText(/PDF Page 13/i)).toBeInTheDocument();
  expect(screen.getByText(/PDF Page 73/i)).toBeInTheDocument();

  // 3. Verify 5-Factor Confidence Score Badge & Popover Trigger
  const confBadge = screen.getAllByRole("button", { name: /96% Confidence/i })[0];
  expect(confBadge).toBeInTheDocument();
  fireEvent.click(confBadge);

  await waitFor(() => {
    expect(screen.getByText(/5-Factor Confidence Scoring/i)).toBeInTheDocument();
    expect(screen.getByText(/Quotation Match \(35%\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Semantic Support \(25%\):/i)).toBeInTheDocument();
  });

  // 4. Verify Business Scenarios Tab: Separate clickable rule chips (NOT BR-001BR-007)
  const scenariosTabBtn = screen.getByRole("button", { name: /Business Scenarios \(2\)/i });
  fireEvent.click(scenariosTabBtn);

  await waitFor(() => {
    expect(screen.getByText(/Workload Account Isolation/i)).toBeInTheDocument();
    expect(screen.getByText(/Emergency Break-Glass Workload Access/i)).toBeInTheDocument();
  });

  // Check Actor Responsibility assignments (Not blanket CISO)
  expect(screen.getAllByText(/Cloud Architect/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/IAM Administrator/i).length).toBeGreaterThan(0);

  // Check structured Given / When / Then acceptance criteria
  expect(screen.getAllByText(/GIVEN/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/WHEN/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/THEN/i).length).toBeGreaterThan(0);

  // Check distinct rule chips exist as separate buttons
  const br1Chip = screen.getByRole("button", { name: /BR-001/i });
  const br7Chip = screen.getByRole("button", { name: /BR-007/i });
  expect(br1Chip).toBeInTheDocument();
  expect(br7Chip).toBeInTheDocument();

  // 5. Verify Cross-Document Insights Tab: Single Document Evaluation Active
  const insightsTabBtn = screen.getByRole("button", { name: /Cross-Doc Insights \(0\)/i });
  fireEvent.click(insightsTabBtn);

  await waitFor(() => {
    expect(screen.getByText(/Single Document Evaluation Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-document conflict detection and reconciliation activate automatically when 2 or more specifications are staged/i)).toBeInTheDocument();
  });
});
