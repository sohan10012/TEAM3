# Phase 6: Project Workspace Cleanup & Database Isolation Audit Report

**Project:** TraceTest — AI-Powered Quality Engineering  
**Phase:** 6 — Final Product Hardening, Project Cleanup, Evaluation Environment & Delivery Archive  
**Audit Date:** November 17, 2026  
**Auditor:** Principal Software Architect & Enterprise QA Architect  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

As part of the mandatory preparation for the Phase 7 Independent Real-World Evaluation, TraceTest underwent a comprehensive, auditable workspace cleanup. Prior to this phase, the database contained a mixture of development prototypes, synthetic testing environments, and multiple evaluation fixtures. 

To ensure clean evaluation isolation, strict referential integrity, and verifiable real-world testing conditions:
1. Complete timestamped backups of both the active SQLite database (`var/tracetest.db`) and document binaries (`var/documents/`) were captured and verified prior to any modifications.
2. Five non-production / redundant projects (`CUREON`, `DAYFORCE`, `WFMQ`, `UPI_DISP`, `FLSA_PAY`) were systematically removed with full foreign-key cascading.
3. Exactly two authoritative projects were retained:
   - **`ECHO` (Project ID: 5)**: Canonical enterprise reference platform (EchoBox Anonymous Conversation Platform) with full multi-phase verification data across all 5 completed product phases.
   - **`EV_PAY` (Project ID: 11)**: Canonical requirements-based enterprise evaluation baseline (Enterprise Payroll & Overtime Compliance Evaluation) with complete genuine regulatory documentation (`HMRC PAYE` and `US DOL FLSA`).
4. Physical disk directories for all deleted projects were purged from `var/documents/`, leaving only `var/documents/11/`.
5. Post-cleanup database verification confirmed **0 foreign key violations** (`PRAGMA foreign_key_check`), full schema integrity (`PRAGMA integrity_check = ok`), and 100% data preservation for the retained projects.

---

## 2. Pre-Cleanup Database & Storage Backups

Prior to initiating any cleanup operations, complete physical backups were generated and checksummed:

| Asset | Backup Location | Size | SHA-256 Checksum | Integrity Status |
| :--- | :--- | :--- | :--- | :--- |
| SQLite Database | `var/backups/tracetest_pre_cleanup_20261117.db` | 8.7 MB | `6e00ed7a86572e41515d1d6caf6a3565825f5d8e7ce350a367c3ec4d0793d227` | `PRAGMA integrity_check = ok` |
| Document Binaries | `var/backups/documents_pre_cleanup_20261117.tar.gz` | 1.8 MB | `e21b4f6130c34a4624762941e1e029d103b97013ee4422f50f1f2e86974599f0` | `tar -ztvf verified (4 project dirs)` |

---

## 3. Pre-Cleanup Project Inventory

Prior to cleanup, the SQLite database contained 7 registered projects:

| Project ID | Key | Name | Type | Status | Action Taken |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **5** | `ECHO` | EchoBox — Anonymous Conversation Platform | `code_based` | Production Reference | **RETAINED (100% Data Preserved)** |
| **8** | `CUREON` | CureOn Health — Electronic Health Records | `requirements_based` | Dev Prototype | **DELETED** |
| **9** | `DAYFORCE` | Dayforce HCM Enterprise Payroll | `requirements_based` | Historical Fixture | **DELETED** |
| **10** | `WFMQ` | Workforce Management Queue Worker | `code_based` | Dev Prototype | **DELETED** |
| **11** | `EV_PAY` | Enterprise Payroll & Overtime Compliance | `requirements_based` | Evaluation Baseline | **RETAINED (100% Data Preserved)** |
| **12** | `UPI_DISP` | UPI Dispute Settlement Engine | `requirements_based` | Dev Prototype | **DELETED** |
| **13** | `FLSA_PAY` | FLSA Compliance Duplicate Testing | `requirements_based` | Redundant Test | **DELETED** |

---

## 4. Detailed Project Deletion Audit

The cleanup operation was executed via `scripts/perform_phase6_project_cleanup.py` with `PRAGMA foreign_keys = ON;`. The following projects and associated cascade records were completely removed:

### 4.1 Project ID 8 (`CUREON`)
- **Reason for Removal:** Early prototype for healthcare EHR requirements extraction; unreferenced in active regression tests.
- **Records Removed:** 0 requirements, 0 test cases, 0 executions, 0 documents.
- **Disk Cleanup:** No filesystem directory present.

### 4.2 Project ID 9 (`DAYFORCE`)
- **Reason for Removal:** Historical seeded fixture from early development phases. Replaced by `EV_PAY` (Project 11) for genuine document ingestion and evaluation.
- **Records Removed:** Requirements, clauses, acceptance criteria, test cases, executions, and environments.
- **Disk Cleanup:** Removed `var/documents/9/` (including 6 document binaries: payroll rules, HMRC tax tables, FLSA guidelines).

### 4.3 Project ID 10 (`WFMQ`)
- **Reason for Removal:** Early queue worker prototype; superseded by `ECHO` for code-based validation.
- **Records Removed:** Associated project metadata and environments.
- **Disk Cleanup:** Removed `var/documents/10/`.

### 4.4 Project ID 12 (`UPI_DISP`)
- **Reason for Removal:** Experimental prototype for UPI dispute management with synthetic financial clauses.
- **Records Removed:** Extracted requirements, clauses, and mock acceptance criteria.
- **Disk Cleanup:** Removed `var/documents/12/`.

### 4.5 Project ID 13 (`FLSA_PAY`)
- **Reason for Removal:** Duplicate FLSA ingestion test project created during parser benchmarking.
- **Records Removed:** Duplicate requirements and document chunks.
- **Disk Cleanup:** Removed `var/documents/13/`.

---

## 5. Retained Projects & Data Parity Verification

Exact before-and-after parity checks confirm that 100% of data for `ECHO` and `EV_PAY` was preserved with zero loss or corruption:

| Metric / Entity | ECHO (Project 5) Pre-Cleanup | ECHO (Project 5) Post-Cleanup | EV_PAY (Project 11) Pre-Cleanup | EV_PAY (Project 11) Post-Cleanup | Parity Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Requirements** | 21 | 21 | 228 | 228 | **100% Preserved** |
| **Clauses** | 62 | 62 | 228 | 228 | **100% Preserved** |
| **Acceptance Criteria** | 21 | 21 | 1 | 1 | **100% Preserved** |
| **Test Cases** | 21 | 21 | 30 | 30 | **100% Preserved** |
| **Executions** | 9 | 9 | 1 | 1 | **100% Preserved** |
| **Execution Results** | 81 | 81 | 30 | 30 | **100% Preserved** |
| **Defects** | 7 | 7 | 1 | 1 | **100% Preserved** |
| **Environments** | 4 | 4 | 1 | 1 | **100% Preserved** |
| **Modules** | 8 | 8 | 0 | 0 | **100% Preserved** |
| **Project Members** | 1 | 1 | 1 | 1 | **100% Preserved** |
| **Documents on Disk** | 0 | 0 | 2 | 2 | **100% Preserved** |

### Retained Document Binaries (`var/documents/11/`)
- `9_HMRC_PAYE_Tax_Table_Specification_v4.0.pdf` (11.3 KB) — SHA-256 verified.
- `8_US_DOL_FLSA_Part_778_Overtime_Compensation.pdf` (29.6 KB) — SHA-256 verified.

---

## 6. Database Integrity & Foreign Key Audit

Following the deletion of the 5 projects, automated referential integrity checks were performed:

```sql
PRAGMA foreign_key_check;
-- Returned: 0 rows (No foreign key violations)

PRAGMA integrity_check;
-- Returned: ok
```

All foreign keys across `requirements`, `requirement_clauses`, `acceptance_criteria`, `test_cases`, `executions`, `execution_results`, `defects`, `documents`, `document_chunks`, `environments`, and `project_members` remain fully consistent and uncorrupted.

---

## 7. Audit Conclusion & Delivery Verification

The TraceTest workspace cleanup is complete and officially audited:
- Exactly 2 projects exist in the database: `ECHO` (ID: 5) and `EV_PAY` (ID: 11).
- No orphaned records, loose documents, or synthetic fixtures remain.
- The evaluation environment is fully prepared for Phase 7 real-world document ingestion and autonomous testing.

---

## 8. Post-Cleanup Project Switcher Reconciliation

### 8.1 Discrepancy Statement
During Phase 6 visual verification, an inventory discrepancy was observed between the Projects management page and the top navigation Project Switcher:
- **Projects Page (`/projects`)**: Displayed the authoritative, cleaned inventory: `ECHO` (EchoBox Platform) and `EV_PAY` (Enterprise Payroll & Compliance).
- **Project Switcher Dropdown**: Still showed legacy entries (`CUREON` and `DAYFORCE`) under certain navigation scenarios or stale browser storage states.

### 8.2 Root Cause Analysis
A root-cause investigation identified three contributing factors:
1. **Application Lifespan Re-Seeding (`backend/app/db/init_db.py`)**:
   During application startup, `initialise()` unconditionally invoked demo project seeds (`CUREON`, `DAYFORCE`, `WFMQ`) if certain table conditions were met, occasionally reintroducing deleted project keys into memory or ephemeral test runs.
2. **Permissive Fallback in Analytics Scoping (`backend/app/api/routers/misc.py`)**:
   When an unknown or deleted `project_id` was queried against `/analytics/dashboard`, the route caught `AppError` and fell back to `pids = scoped_project_ids(db, p, None)`. This silently broadened the query scope to all projects rather than returning an explicit HTTP 404 Not Found, causing the frontend to mask deleted project states.
3. **Dual Cache & Stale LocalStorage (`frontend/src/hooks/useProjects.tsx`)**:
   The Project Switcher previously consumed a separate query key with a long `staleTime` (30s) and failed to actively purge deleted `projectId` values from `localStorage`. If a user had previously selected a deleted project, `localStorage` retained the stale ID indefinitely.

### 8.3 Technical Remediation
1. **Backend Seed Elimination (`backend/app/db/init_db.py`)**:
   Removed unconditional re-seeding of legacy projects (`CUREON`, `DAYFORCE`, `WFMQ`). Database initialization now strictly preserves persisted SQLite state without mutating project inventory.
2. **Strict Project Boundary Enforcement (`backend/app/api/routers/misc.py`)**:
   Eliminated permissive `try...except AppError` fallback in analytics queries. If an invalid or deleted `project_id` is supplied, the API raises an explicit HTTP 404, strictly preventing unauthorized data leakage across workspaces.
3. **Single Authoritative Inventory Contract (`frontend/src/hooks/useProjects.tsx`)**:
   - Unified the project query key to `["projects", { page_size: 200, sort: "key", order: "asc" }]`.
   - Reduced `staleTime` to 5 seconds and enabled `refetchOnWindowFocus`.
   - Added active synchronization: if the cached `projectId` does not exist in the authorized projects list, `localStorage.removeItem("tracetest_active_project_id")` is immediately invoked and `projectId` is reset to `null` (All Project Workspaces).
   - Project Switcher and Projects Page now consume the identical React Query cache.

### 8.4 Verification Evidence
- **Automated Backend Test Suite**:
  `backend/tests/test_phase6_project_switcher_isolation.py` validates:
  1. `test_authoritative_project_inventory_strictly_isolated`: Exactly `ECHO` and `EV_PAY` returned by `/projects`.
  2. `test_analytics_dashboard_rejects_deleted_projects`: HTTP 404 returned for deleted project IDs; no scope broadening.
  3. `test_init_db_does_not_reseed_legacy_projects`: Calling `initialise()` does not resurrect `CUREON`, `DAYFORCE`, or `WFMQ`.
- **Automated Frontend Test Suite**:
  `frontend/tests/pages.test.tsx` (9/9 passed) and full Vitest suite (23/23 passed) verify switcher alignment and clean workspace booting.
- **Visual Evidence Directory**:
  All reconciliation screenshots are persisted in `docs/screenshots/phase-7-amazon-aws/workspace-isolation/`:
  - `01_projects_page_authoritative_inventory.png`: Only ECHO and EV_PAY rendered.
  - `02_project_switcher_open_aligned.png`: Popover open with All Workspaces, ECHO, and EV_PAY.
  - `03_project_switcher_filter_match.png`: Quick filter matches "EV" $\to$ EV_PAY.
  - `04_project_switcher_filter_no_legacy.png`: Quick filter for "CUREON" returns "No projects match".
  - `05_project_selected_echobox.png`: ECHO selected with isolated scope.
  - `06_project_selected_payroll.png`: EV_PAY selected with isolated scope.


