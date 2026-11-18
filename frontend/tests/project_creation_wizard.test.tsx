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
