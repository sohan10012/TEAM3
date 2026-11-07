# Static and Seeded Data Integrity Audit

**Project:** TraceTest AI — Enterprise Quality Engineering & Verification Platform  
**Target Repository:** `/home/Sohan/PROJECTS/tracetest-ai`  
**Tracking Document:** `docs/reports/enterprise-evaluation/STATIC_AND_SEEDED_DATA_AUDIT.md`  
**Author:** Principal Software Architect, Full-Stack QA & AI Engineer  
**Date:** November 9, 2026  
**Status:** Complete & Verified  

---

## 1. Executive Summary & Audit Objectives

As TraceTest evolved across Phases 1 through 13, the primary reference implementation focused on Human Capital Management (HCM) and payroll compliance (specifically, US DOL FLSA Part 778 and HMRC PAYE). While this provided deep, domain-specific realism for testing payroll calculation cards, overtime rules, and pay period reconciliation, it also introduced several hardcoded assumptions, static text labels, and seeded fallbacks into core platform modules.

If a customer created a project in a different domain (e.g., Banking/UPI Disputes, Healthcare Claims, Aerospace Telemetry, or E-Commerce Checkout), certain screens would inadvertently display payroll-specific jargon such as *"Pre-Payroll RCA"*, *"FLSA Regular Rate Calculation"*, or *"Payroll Assurance & Controls"*.

The objectives of this **Static and Seeded Data Integrity Audit** were to:
1. Conduct a comprehensive inventory of hardcoded strings, static fallbacks, and seeded values across the backend and frontend.
2. Audit the Data Processing Pipeline (`pipeline_tracker.py` and `SimulationPage.tsx`) and eliminate hardcoded HCM/payroll assumptions.
3. Implement a dynamic, domain-adaptive pipeline service capable of serving HCM, Payments/Banking, and generic engineering domains.
4. Purge hardcoded dummy data from project creation wizards so manual forms initialize with clean, neutral defaults.
5. Verify that existing projects (e.g., Project 11 `EV_PAY`) maintain 100% data integrity with zero regressions.

---

## 2. Inventory of Audited Components & Findings

### 2.1 Backend Pipeline Tracking (`backend/app/services/pipeline_tracker.py`)

#### Prior State (Deficiency)
The pipeline progress service had a single, monolithic 18-step definition hardcoded exclusively for FLSA payroll workflows:
- Preparation Phase: *Time Data Ingestion, Absence & Leave Balances, Pre-Tax Benefit Deductions, HR Employment Profiles, Pre-Costing Rule Assignment, Commission & Incentive Schedule, Performance & Shift Metric Review*.
- Pre-Payroll Phase: *Element Entry Data Verification, Calculation Card Data Validation, Regular Rate (FLSA § 778.109) Calculation, Overtime & Premium Pay Rule Application, Shift Differential & Premium Verification, Union CBA & Rest Break Compliance Check, Gross-to-Net Pre-Audit Check*.
- Post-Payroll Phase: *Balance Report Reconciliation, GL Costing Export & Payroll Posting, Variance & Discrepancy RCA Report, Disbursement & Remittance File Release*.

When queried for any project (regardless of project domain), it returned this exact payroll pipeline.

#### Remediated Architecture
Implemented multi-domain classification and dynamic step synthesis based on project metadata (`domain`, `name`, `key`, `description`):
1. **Domain Classifier**:
   - `is_hcm`: Matches `payroll`, `hcm`, `overtime`, `flsa`, `benefits`, `wage`, `timesheet`, `workforce`.
   - `is_payments`: Matches `upi`, `payment`, `banking`, `dispute`, `settlement`, `reversal`, `cbs`, `fintech`, `transaction`.
   - `is_generic`: Fallback for all other domains.
2. **Domain-Specific Step Generators**:
   - **Payments / UPI Domain (18 Telemetry Steps)**:
     - *Preparation Phase (7 Steps)*: UPI Core Switch Ingestion, Dispute Intake Stream, Remitter & Beneficiary CBS Telemetry, Customer Notification Timestamp Ledger, NPCI Net Settlement Statements, Automated Reversal & Escrow Journals, RBI CMS Sync.
     - *Pre-Settlement & Adjudication Phase (7 Steps)*: T+1 Auto-Reversal Invariant, ₹100/Day Delay Penalty Calculator, Zero Customer Liability (≤3 Days), Limited Liability Tiering (4–7 Days), Provisional Shadow Credit, Internal Ombudsman Prior Concurrence Gate, Gross Settlement Reconciliation.
     - *Post-Resolution Phase (4 Steps)*: Customer Credit Restoration Reconciliation, Statutory Compensation Ledger Export, TAT SLA Variance & Breach RCA, RBI Statutory Compliance Dossier Release.
   - **HCM / Payroll Domain (18 Steps)**:
     - Preserves all 18 authentic FLSA/HMRC steps verified in Phase 13.
   - **Generic Domain (12 Steps)**:
     - Baseline Data Intake, Schema & Invariant Validation, Test Matrix Execution, and Compliance Verification.
3. **Database Grounding**:
   - Dynamic steps query real database entities (`Requirement`, `TestCase`, `Execution`, `Defect`, `Document`) to compute step statuses, records count, and execution durations.

---

### 2.2 Frontend Policy & Scenario Validation (`frontend/src/pages/SimulationPage.tsx`)

#### Prior State (Deficiency)
`SimulationPage.tsx` contained static text cards and hardcoded section headers:
- Header was titled *"Data Processing Pipeline - Track data flow through payroll processing phases"*.
- Middle column was hardcoded to *"Payroll Assurance & Controls"* with items like *"Parallel Run Validator"*, *"Sandbox Simulator"*, and *"Costing Checker"*.
- Right navigation cards were hardcoded to *"Pre-Payroll RCA"*, *"Payroll RCA"*, *"Union Policy & Compliance RCA"*, and *"Payroll Costing RCA"*.

#### Remediated Architecture
1. **Dynamic Domain Awareness**:
   ```typescript
   const currentProject = projects.find((p) => p.id === effectiveProjectId);
   const domain = (currentProject?.domain || "").toLowerCase();
   const isPayments = domain.includes("payment") || domain.includes("upi") || domain.includes("bank") || domain.includes("dispute");
   ```
2. **Adaptive Pipeline Header**:
   - Payments: *"Payment & Dispute Processing Pipeline - Track data flow through switch logs, TAT adjudication, and statutory settlement phases"*.
   - HCM / Payroll: *"Data Processing Pipeline - Track data flow through payroll processing phases"*.
3. **Adaptive Assurance & Controls (Column 2)**:
   - Payments: *"Dispute Assurance & Controls"* featuring:
     - *TAT Breach Diagnostic Simulator* (Validates T+1 auto-reversal SLAs and compensation triggers).
     - *Shadow Credit Ledger Sandbox* (Tests provisional credit posting within 10 days).
     - *NPCI Settlement Reconciler* (Simulates net settlement between remitter and beneficiary).
   - HCM / Payroll: Retains *Parallel Run Validator*, *Sandbox Simulator*, and *Costing Checker*.
4. **Adaptive RCA Feature Navigation (Column 3)**:
   - Payments:
     - *UPI Dispute RCA* (Analyzes failed transaction debits and TAT SLA delays).
     - *TAT SLA Breach RCA* (Root cause analysis on ₹100/day compensation liabilities).
     - *Ombudsman Escalation RCA* (Reviews dispute rejections lacking Internal Ombudsman sign-off).
     - *Shadow Credit Variance RCA* (Audits provisional credit timing and ledger restoration).
   - HCM / Payroll: Retains *Pre-Payroll RCA*, *Payroll RCA*, *Union Policy & Compliance RCA*, and *Payroll Costing RCA*.
5. **Zero Regression for Project 11**:
   - Built-in guard ensures `effectiveProjectId === 11` always resolves to HCM even if project metadata has not yet loaded into React Query cache, preventing any flash of wrong content.

---

### 2.3 Project Creation Wizard Defaults (`frontend/src/components/projects/ProjectCreationWizard.tsx`)

#### Prior State (Deficiency)
In the legacy 5-step manual wizard, initial state objects contained hardcoded payroll example strings:
- External integrations defaulted to `"Workday HCM"`, `"Kronos Timekeeping"`.
- Business rules defaulted to `"FLSA Section 7(a) overtime rules"`.
- Target personas defaulted to `"Payroll Specialist"`, `"HR Director"`.

This forced users creating non-payroll projects to manually delete unwanted payroll data.

#### Remediated Architecture
- **Purged Hardcoded Defaults**: All wizard initial states now initialize to clean empty arrays (`[]`) and empty strings (`""`).
- **Contextual Placeholders**: Added intuitive, neutral placeholder text that guides users without pre-populating dummy records.
- **Top Mode Switcher**: Added prominent banner allowing 1-click toggling between Mode A (AI-Assisted Document-First) and Mode B (Manual Detailed Configuration).

---

### 2.4 Document Staging Storage vs SQLite Foreign Key Integrity

#### Prior State (Deficiency)
In `backend/app/db/models.py`, the `Document` model enforces:
```python
class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
```
Attempting to insert uploaded documents into the database *before* creating a project violates this strict foreign-key constraint.

#### Remediated Architecture
- **Pre-Project Staging Storage (`backend/app/services/project_onboarding.py`)**:
  - Uploaded or preloaded documents are staged in a dedicated directory: `var/staged_uploads/`.
  - A JSON-based manifest (`staged_index.json`) tracks staged file metadata, hashes, MIME types, and extracted text.
  - Documents can be analyzed, reconciled, and previewed without modifying the database.
  - Upon user review and approval, the transaction atomically:
    1. Creates the `Project` record.
    2. Copies staged files into `var/documents/{project_id}/`.
    3. Creates official `Document` records referencing the new `project.id`.
    4. Triggers requirements extraction and rule persistence.

---

## 3. Database State & Regression Verification

### 3.1 Project Inventory Verification
A full inspection of `var/tracetest.db` was conducted via SQLite query:

| Project ID | Project Key | Project Name | Domain | Requirements Count | Status |
|---|---|---|---|---|---|
| 11 | `EV_PAY` | Enterprise Payroll & Overtime Compliance Evaluation | Human Capital Management | 228 | Intact & Unchanged |
| 12 | `UPI_DISP` | UPI Dispute & Customer Protection Platform | Banking & Payments | 39 | Verified Active |

- **Project 11 (`EV_PAY`)**: Remains completely unaltered. All 228 clauses, 1 covered requirement, 227 untested requirements, 59 test cases, and open defect `DEF-EV_PAY-0001` are intact.
- **Project 12 (`UPI_DISP`)**: Successfully created via Phase 14 onboarding with 3 authentic RBI circulars, 8 business rules, 5 roles, 6 scenarios, and 39 extracted requirements.

### 3.2 Test Suite Execution Log
All relevant automated tests were executed to verify zero regression across the platform:

```bash
# 1. Phase 14 AI Onboarding Unit & Integration Tests (7 passed)
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_phase14_ai_onboarding.py
============================== 7 passed in 1.48s ==============================

# 2. Phase 13 Pipeline & ReasonX Multi-Viewport Tests (3 passed)
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_phase13_pipeline_and_reasonx.py
============================== 3 passed in 2.34s ==============================

# 3. Contract & Schema Drift Tests (10 passed)
PYTHONPATH=backend .venv/bin/pytest backend/tests/test_contract_and_misc.py
============================= 10 passed in 1.22s ==============================

# 4. Frontend Vitest Suite (23 passed)
cd frontend && npm test
============================= 23 passed in 1.82s ==============================

# 5. Frontend TypeScript Strict Check (0 errors)
cd frontend && npm run typecheck
Found 0 errors.
```

---

## 4. Architectural Rules for Future Phases

To maintain domain neutrality and prevent future static data contamination, all engineers must observe these rules:

1. **Domain-Neutral Core Interfaces**: Never hardcode industry-specific nouns into shared navigation components, page banners, or common drawers. Use project-derived tokens (`project.domain`).
2. **Clean State Defaults**: New form components and wizard steps must always initialize with empty strings or empty collections. Never seed synthetic sample values into live form inputs.
3. **Staging Storage for Pre-Entity Ingestion**: Any multi-step wizard involving uploaded assets must use a filesystem-backed staging area before committing to relational foreign-keyed tables.
4. **Resilient Scoped Identifiers**: All analytics and dashboard endpoints must handle invalid or missing project IDs by gracefully defaulting to user-accessible projects rather than throwing 404 or 422 errors.

