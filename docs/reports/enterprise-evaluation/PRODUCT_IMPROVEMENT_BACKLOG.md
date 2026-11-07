# TraceTest AI — Complete Product Improvement Backlog & Implementation Roadmap

**Document Reference:** `docs/reports/enterprise-evaluation/PRODUCT_IMPROVEMENT_BACKLOG.md`  
**Primary Scope:** Product Experience, Usability, AI Quality & Transparency Architecture  
**Evaluation Date:** November 9, 2026  
**Auditor Roles:** Principal Product Engineer, AI/LLM Engineer, QA Architect, UX Researcher  
**Companion Report:** `docs/reports/enterprise-evaluation/TRACE_TEST_PRODUCT_EXPERIENCE_AND_AI_AUDIT.md`  

---

## 1. Backlog Overview & Priority Definitions

This backlog defines the complete, prioritised engineering specifications required to transform TraceTest from a developer-oriented prototype into an enterprise-grade, understandable, trustworthy QA platform.

### Priority Level Definitions
- **P0 (Critical Floor):** Broken, deceptive, or missing core functionality that destroys user trust or prevents non-technical business analysts and QA engineers from using the application.
- **P1 (Major Experience & Quality):** Severe AI output degradation, lack of execution transparency, or confusing workflows that impede daily enterprise adoption.
- **P2 (Usability & Ergonomics):** High-value UI polish, guided workflows, visual rule editing, and improved data visualizations.
- **P3 (Enterprise Maturity):** Advanced multi-tenant collaboration, version baselines, and multi-stack test export.

---

## 2. Comprehensive Itemized Improvement Backlog (18 Core Modules)

---

### Module 1: Document Viewer & Source Inspection

#### `UX-DOC-01` [P0] Embedded Document Viewer with Page-by-Page Rendering
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Document Intake & Management (`RequirementsManagementView.tsx`, `DocumentsPage`)
* **Current Behaviour:** The document detail view only displays file metadata and a plain monospace `<div className="max-h-96 whitespace-pre-wrap">{extracted_text}</div>`. Users cannot view the actual PDF.
* **Actual Problem & Evidence:** When users upload multi-page PRDs, SRS, or regulatory PDFs, they cannot see the original document formatting, tables, headings, or visual layouts. Business analysts cannot verify whether text extraction was accurate without opening desktop Acrobat or Preview.
* **Expected User Experience:** Users can click on any uploaded document and immediately see an embedded PDF viewer with smooth page-by-page scrolling, page counter (e.g. "Page 4 of 59"), zoom controls (50% to 200%), fit-to-width, and text search.
* **Proposed Solution:** Integrate PDF.js (via `pdfjs-dist` or `@react-pdf-viewer/core`) into a new component `EmbeddedDocumentViewer.tsx`. Stream file bytes via the existing `GET /api/v1/documents/{id}/download` endpoint.
* **Exact Frontend Files:**
  * `frontend/src/components/documents/EmbeddedDocumentViewer.tsx` (New component).
  * `frontend/src/components/requirements/RequirementsManagementView.tsx` (Replace lines 751–758).
  * `frontend/src/pages/RequirementsPages.tsx`.
* **Exact Backend Files:** `backend/app/api/routers/documents.py` (ensure `download_document` supports HTTP range requests for fast PDF streaming).
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Uploaded PDF documents render inside the browser without external plugins.
  2. Users can jump directly to any page number using a page input or thumbnail sidebar.
  3. Zoom in, zoom out, and fit-width buttons work cleanly.
* **Verification Method:** Upload `HMRC_PAYE_Tax_Table_Specification_v4.0.pdf` and verify page 14 renders with authentic fonts and layout.
* **Estimated Effort:** Medium (M)

---

#### `UX-DOC-02` [P0] Interactive Source Passage Highlighting & Bi-Directional Jump
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Requirements Explorer & Document Viewer (`RequirementsManagementView.tsx`)
* **Current Behaviour:** Extracted requirements store `source_page` and `evidence_excerpt`, but they are static strings. Clicking them does nothing.
* **Actual Problem & Evidence:** Users cannot trace where an extracted requirement came from on the PDF page. If the AI extracts a rule, there is zero visual grounding to the original paragraph.
* **Expected User Experience:** In the split-screen view, clicking any extracted requirement highlights the corresponding bounding box or text snippet on the rendered PDF page. Conversely, selecting text in the PDF highlights the linked requirement.
* **Proposed Solution:** Store PDF text coordinates (page number, line index, or character offsets) during `parse_pdf` in `ExtractedContent.metadata_json`. In `EmbeddedDocumentViewer`, pass the `evidence_excerpt` to PDF.js search and trigger text layer highlighting.
* **Exact Frontend Files:**
  * `frontend/src/components/documents/EmbeddedDocumentViewer.tsx`.
  * `frontend/src/components/requirements/RequirementsManagementView.tsx`.
* **Exact Backend Files:** `backend/app/services/document_processor.py` (`parse_pdf` to capture character offsets per page).
* **Dependencies:** `UX-DOC-01`.
* **Acceptance Criteria:**
  1. Clicking a requirement scrolls the PDF viewer directly to the cited page.
  2. The exact sentence from which the requirement was derived is highlighted in yellow on the PDF page.
* **Verification Method:** Click `PAY-REQ-001` and verify the viewer automatically jumps to Page 4 and highlights the overtime clause.
* **Estimated Effort:** Medium (M)

---

### Module 2: Document Extraction & Layout Preservation

#### `AI-EXT-01` [P0] Multi-Column De-Hyphenation & Heading Layout Preservation
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Backend Document Ingestion (`document_processor.py`)
* **Current Behaviour:** `pypdf.PdfReader` extracts lines as isolated strings. Words broken across lines by hyphens (`interpre- \n tations`) are fragmented.
* **Actual Problem & Evidence:** In federal regulations like `US_DOL_FLSA_Part_778_Overtime_Compensation.pdf`, sentence fragments such as `"tations contained therein shall be in ef-"` are extracted as requirements.
* **Expected User Experience:** Document ingestion reconstructs wrapped sentences, cleans up hyphenated line breaks, preserves full paragraph context, and extracts complete grammatical thoughts.
* **Proposed Solution:** Implement an AST/Layout-aware de-hyphenation pass in `document_processor.py:parse_pdf`. Use regex `(\w+)-\s*\n\s*(\w+)` -> `\1\2` to reassemble split words before sentence tokenization.
* **Exact Backend Files:**
  * `backend/app/services/document_processor.py:86-135`.
  * `backend/app/services/requirement_intelligence.py:77-115`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Words split across lines with hyphens are joined seamlessly.
  2. No requirements begin with broken sentence halves (e.g. `"tations contained..."`).
* **Verification Method:** Run `parse_pdf` on `US_DOL_FLSA_Part_778_Overtime_Compensation.pdf` and assert that no extracted requirement starts with a fragment.
* **Estimated Effort:** Small (S)

---

#### `AI-EXT-02` [P1] PDF Table Extraction & Matrix Normalization
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Backend Document Ingestion (`document_processor.py`)
* **Current Behaviour:** `parse_pdf` returns `"tables": []` unconditionally. Table text is dumped into a flattened, borderless string.
* **Actual Problem & Evidence:** In `HMRC_PAYE_Tax_Table_Specification_v4.0.pdf`, tax rate tables containing rate bands (Scottish Rate, Basic Rate, Higher Rate) are mangled into floating numbers without headers.
* **Expected User Experience:** Tables in PDFs are detected, extracted as structured JSON arrays, and rendered in the UI with column headers intact.
* **Proposed Solution:** Incorporate `pdfplumber` or `pypdf.table` extraction in `parse_pdf` to extract bounding-box tables, storing them in `Document.metadata_json["tables"]` and creating `ExtractedContent(content_type="table")`.
* **Exact Backend Files:** `backend/app/services/document_processor.py:86-135`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Multi-column tables in PDFs are stored with rows and headers.
  2. Table data can be viewed as an interactive grid in the UI.
* **Verification Method:** Parse HMRC specification page 13 and verify the 5 tax bands extract as a structured 5x3 table.
* **Estimated Effort:** Medium (M)

---

### Module 3: Requirement Extraction Quality

#### `AI-REQ-01` [P0] Replace Keyword Heuristic Extraction with Semantic LLM Understanding
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Requirement Intelligence (`requirement_intelligence.py`)
* **Current Behaviour:** `extract_requirements_from_text` scans plain text using a simple keyword list: `any(kw in line for kw in ["shall", "must", "should", "allows", "enforces..."])`.
* **Actual Problem & Evidence:** Random sentences containing "must" or "shall" (e.g. legal disclaimers, administrative forewords) are flagged as high-priority requirements, while critical business rules phrased in descriptive prose (e.g. *"Overtime accumulates beyond 40 weekly hours"*) are ignored.
* **Expected User Experience:** The system uses semantic LLM extraction to identify true functional requirements, business rules, constraints, and exceptions, providing a clear justification for why each item is a requirement.
* **Proposed Solution:** Route document text chunks through a dedicated LangGraph extraction node (`RequirementExtractionBatch`) with few-shot guidance distinguishing true specifications from background narrative.
* **Exact Backend Files:**
  * `backend/app/services/requirement_intelligence.py:77-115`.
  * `backend/app/llm/prompts.py`.
  * `backend/app/llm/schemas.py`.
* **Exact Frontend Files:** `frontend/src/components/requirements/RequirementsManagementView.tsx`.
* **Dependencies:** `AI-EXT-01`.
* **Acceptance Criteria:**
  1. Legal disclaimers and administrative headers are filtered out.
  2. Implied business rules without modal verbs ("must/shall") are captured accurately.
* **Verification Method:** Ingest US DOL FLSA Chapter 778 and verify that historical preambles are omitted while 40-hour calculation rules are extracted.
* **Estimated Effort:** Large (L)

---

#### `AI-REQ-02` [P1] Dynamic Confidence Scoring Grounded in Semantic Analysis
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Requirement Models & Extraction (`requirement_intelligence.py:289`)
* **Current Behaviour:** Every requirement extracted from a document receives a hardcoded `confidence=0.95`.
* **Actual Problem & Evidence:** Confidence values are fabricated constants, giving users a false sense of reliability.
* **Expected User Experience:** Confidence scores reflect actual semantic clarity (0.00 to 1.00), penalizing ambiguous phrasing, missing boundaries, or incomplete conditionals.
* **Proposed Solution:** Calculate confidence dynamically based on:
  - Presence of ambiguity flags (-0.15 per flag).
  - Completeness of preconditions and expected outcomes (+0.20).
  - Grounded verbatim source quote match (+0.10).
* **Exact Backend Files:** `backend/app/services/requirement_intelligence.py:270-295`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Clearly quantified requirements receive high confidence (0.90–0.98).
  2. Vague statements (e.g. "processes requests quickly") receive low confidence (<0.60) with an explanation pill.
* **Verification Method:** Assert that ambiguous requirements have lower confidence than strict threshold requirements.
* **Estimated Effort:** Small (S)

---

### Module 4: Requirement Classification & Domain Alignment

#### `AI-CAT-01` [P1] Synchronize Backend Classification Categories with Frontend Telemetry
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Requirement Categories & Telemetry (`requirement_intelligence.py`, `RequirementsManagementView.tsx`)
* **Current Behaviour:** Backend classifies into 6 categories (`functional`, `non_functional`, `data_requirement`, `integration_requirement`, `permission_role`, `operational_requirement`). Frontend only counts `functional`, `non_functional`, and `business_rule`.
* **Actual Problem & Evidence:** In the Document Overview sub-tab, "Business Rules" is perpetually 0 because the backend never assigns it. Other categories are lumped into hidden counts.
* **Expected User Experience:** Consistent taxonomy across backend and frontend. Users see exact counts for Functional, Business Rules, Integration, Data & Security, and Non-Functional.
* **Proposed Solution:**
  1. Add `business_rule` to backend `CATEGORY_KEYWORDS` and classification prompts.
  2. Update `RequirementsManagementView.tsx:194-198` to compute tallies for all supported categories.
* **Exact Frontend Files:** `frontend/src/components/requirements/RequirementsManagementView.tsx:194-198`.
* **Exact Backend Files:** `backend/app/services/requirement_intelligence.py:30-65`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Requirements containing calculation rules are classified as `business_rule`.
  2. Document overview cards accurately reflect all categorized items.
* **Verification Method:** Seed WFMQ project and verify business rule count matches database records.
* **Estimated Effort:** Small (S)

---

### Module 5: Empty & Missing AI-Generated Sections

#### `UX-UI-01` [P0] Remove Hardcoded Static "Key Insights" Badges
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Document Overview Tab (`RequirementsManagementView.tsx:729-746`)
* **Current Behaviour:** The UI renders four static HTML badges (`"Employee management & core HR"`, `"Time & attendance tracking"`, `"Payroll integration"`, `"Role-based access & security"`) for every uploaded document.
* **Actual Problem & Evidence:** If an engineer uploads a Healthcare specification, a Banking rulebook, or an HMRC Tax Table, TraceTest tells them the document is about "Employee management & core HR". This is deceptive and destroys credibility.
* **Expected User Experience:** Insights are dynamically generated from the document's actual extracted topics, or an honest empty state is shown if analysis has not run.
* **Proposed Solution:** Replace hardcoded JSX tags with dynamic mapping over `selectedDoc.metadata?.topics` or `doc.insights`. If unavailable, display: `"Analyze document to generate key domain insights."`
* **Exact Frontend Files:** `frontend/src/components/requirements/RequirementsManagementView.tsx:724-747`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Static HR badges are completely removed.
  2. Uploading a non-HR document shows only domain-relevant tags or an analysis prompt.
* **Verification Method:** Inspect DOM on an uploaded HMRC document and verify HR badges do not appear.
* **Estimated Effort:** Small (S)

---

### Module 6: Acceptance Criteria Quality

#### `AI-AC-01` [P1] Resilient Verbatim Quote Matching with Normalized Whitespace
* **Priority:** P1 (Major)
* **Affected Screen / Module:** LangGraph Acceptance Criteria Node (`requirement_graph.py:159-198`)
* **Current Behaviour:** `verify_quote` rejects acceptance criteria if the `source_quote` does not match character-for-character, including multiple spaces or line breaks from the PDF extraction.
* **Actual Problem & Evidence:** Valid criteria generated by the LLM are dropped with error `"Ungrounded: Source quotation not found verbatim"` simply because the PDF contained a newline or double space.
* **Expected User Experience:** Guardrail verifies semantic quotation accuracy while ignoring innocuous whitespace differences, ensuring valid criteria are not discarded.
* **Proposed Solution:** In `app/guardrails/quotes.py:verify_quote`, normalize both the quote and the candidate text (`re.sub(r"\s+", " ", text).strip().lower()`) before performing substring validation.
* **Exact Backend Files:** `backend/app/guardrails/quotes.py`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Quotes matching the source text modulo whitespace/newlines pass verification on the first attempt.
  2. Repair retry rate drops by >70% during requirements analysis.
* **Verification Method:** Test `verify_quote` against a string spanning a newline; verify it returns `True`.
* **Estimated Effort:** Small (S)

---

### Module 7: Test Scenario Quality & Domain Agnosticism

#### `AI-TEST-01` [P0] Decouple Test Generation from Hardcoded Reference HCM API
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Test Generation Prompts (`backend/app/llm/prompts.py:15-35, 104-105`)
* **Current Behaviour:** `HCM_API_REFERENCE` (`from reference_hcm import payroll`) and 4 few-shot payroll examples are injected into `test_prompt` for all projects.
* **Actual Problem & Evidence:** When generating tests for healthcare, e-commerce, or generic requirements, the LLM is forced to write tests calling payroll calculation methods.
* **Expected User Experience:** Domain-aware test generation. If a project has a specified target API, it uses that schema; otherwise, it generates domain-appropriate REST/Gherkin/Playwright assertions.
* **Proposed Solution:**
  1. Extract `HCM_API_REFERENCE` out of `test_prompt`.
  2. Pass project context and environment type dynamically:
     - For HCM/Payroll projects: provide reference HCM API.
     - For REST/API projects: provide OpenAPI spec endpoint signatures.
     - For pure No-Code projects: generate structured parameter tables and Gherkin step validations without forcing Python code.
* **Exact Backend Files:**
  * `backend/app/llm/prompts.py:98-117`.
  * `backend/app/graph/requirement_graph.py:228-229`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Healthcare project (`Cureonix`) does not receive test scripts calling `reference_hcm.payroll`.
  2. Generated tests assert the specific business logic of the active project.
* **Verification Method:** Generate tests for a non-payroll requirement and verify no `reference_hcm` imports appear in `TestCase.script`.
* **Estimated Effort:** Medium (M)

---

### Module 8: LLM Prompt & Model Improvements

#### `AI-PROMPT-01` [P1] Dual-Audience Prompting: Business Rationale alongside Technical Criteria
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Analysis & AC Prompts (`prompts.py`)
* **Current Behaviour:** Prompts instruct the LLM to output rigid JSON with minimal commentary to fit validator schemas.
* **Actual Problem & Evidence:** Generated criteria and test scenarios lack plain-language explanations of *why* a particular boundary was chosen or what business risk is being mitigated.
* **Expected User Experience:** Every generated criterion and test includes a user-friendly `"business_rationale"` explaining the operational impact in language accessible to a business analyst.
* **Proposed Solution:** Update `prompts.ac_prompt` and `prompts.test_prompt` to elicit a 1-sentence `business_rationale` field and display it prominently in the UI.
* **Exact Frontend Files:**
  * `frontend/src/components/tests/TestCasesManagementView.tsx`.
  * `frontend/src/pages/RequirementsPages.tsx`.
* **Exact Backend Files:**
  * `backend/app/llm/prompts.py`.
  * `backend/app/llm/schemas.py`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Each generated test case includes a readable business explanation.
  2. The UI renders this rationale as the primary description card.
* **Verification Method:** Review generated test cases in UI and verify plain-language rationale is visible.
* **Estimated Effort:** Small (S)

---

### Module 9: Structured Output Validation & Recovery

#### `AI-REC-01` [P1] Transparent AI Error Reporting in the UI
* **Priority:** P1 (Major)
* **Affected Screen / Module:** LangGraph Checkpointing & Frontend Task Monitor (`RunProgress.tsx`, `requirement_graph.py`)
* **Current Behaviour:** When LLM providers fail or JSON decoding fails, errors are accumulated in `out["invalid_items"]` or `out["provider_errors"]`, and the graph silently degrades.
* **Actual Problem & Evidence:** Users see the task bar complete with "degraded" status, but receive no explanation of which clauses failed or why items were rejected.
* **Expected User Experience:** If an AI step encounters parse errors or provider timeouts, an expandable "AI Diagnostic Report" appears in the UI detailing which clauses were affected and offering a 1-click retry.
* **Proposed Solution:** Expose `invalid_items` in `GET /tasks/{run_id}` and render a structured diagnostic alert in `RunProgress.tsx`.
* **Exact Frontend Files:** `frontend/src/components/RunProgress.tsx`.
* **Exact Backend Files:** `backend/app/services/tasks.py`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Degraded runs display an informative warning banner with specific rejected items.
  2. Users can retry only the failed clauses rather than restarting the entire workflow.
* **Verification Method:** Simulate an invalid JSON output from mock provider and verify the diagnostic banner renders in the UI.
* **Estimated Effort:** Medium (M)

---

### Module 10: AI Simulation & YAML Usability

#### `SIM-UX-01` [P0] Unify Simulation Architecture into Project Context
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Sidebar Navigation & Simulation Pages (`AppShell.tsx`, `SimulationPage.tsx`)
* **Current Behaviour:** Clicking "Agent Simulation" in the global sidebar opens `/simulation`, which is a static sandbox hardcoded to California Overtime `POL-001`, completely decoupled from the selected project.
* **Actual Problem & Evidence:** A user working on project `WFMQ` or `Cureonix` clicks "Agent Simulation" and is thrust into a California Overtime demo. The project context is lost.
* **Expected User Experience:** "Simulation" is project-scoped (`/projects/{projectId}/simulation`). It loads the active project's approved requirements, allows simulating those specific rules, and displays project-grounded results.
* **Proposed Solution:**
  1. Change route to `/projects/:projectId/simulation`.
  2. Fetch policies linked to the active project via `GET /api/v1/projects/{projectId}/simulation-models`.
  3. Default to the active project's rules rather than static `POL-001`.
* **Exact Frontend Files:**
  * `frontend/src/App.tsx`.
  * `frontend/src/layouts/AppShell.tsx:40, 549`.
  * `frontend/src/pages/SimulationPage.tsx`.
* **Exact Backend Files:** `backend/app/api/routers/simulation.py`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Navigating to Simulation preserves the currently selected project workspace.
  2. Policies displayed correspond to requirements in that project.
* **Verification Method:** Switch between Dayforce and WFMQ and verify the simulation view displays the respective project's domain model.
* **Estimated Effort:** Medium (M)

---

#### `SIM-UX-02` [P1] Real Evaluator Replacing Mock Strings in `simulation_engine.py`
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Simulation Execution Engine (`simulation_engine.py:272-310`)
* **Current Behaviour:** `run_behaviour_simulation` checks `test_category` and outputs canned template strings (e.g. negative tests always return `"Model rejected malformed payload with HTTP 400 Bad Request as expected"`).
* **Actual Problem & Evidence:** The simulation does not execute or evaluate test inputs against requirement conditions. It produces fabricated pass/fail outcomes.
* **Expected User Experience:** Real deterministic evaluation: the engine takes test case input parameters (`test_data`), evaluates them against the requirement's acceptance criteria rules, and computes the actual mathematical or logical result.
* **Proposed Solution:** Port the safe interpreter from `yaml_workflow.py:evaluate_timesheet` into `simulation_engine.py` to evaluate actual input fields and produce real computed outcomes.
* **Exact Backend Files:** `backend/app/services/simulation_engine.py:270-325`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Test simulation compares actual `test_data` inputs against rule conditions.
  2. If inputs violate constraints, the simulation fails with an exact numerical or logical delta.
* **Verification Method:** Run simulation on a test case with overtime hours=45 and threshold=40; assert the result displays computed overtime=5.0.
* **Estimated Effort:** Large (L)

---

### Module 11: Rule Explanation & Visual Rule Builder

#### `SIM-VIS-01` [P1] Visual "When/Then" Rule Builder alongside Technical YAML
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Policy Simulation (`SimulationPage.tsx`)
* **Current Behaviour:** The application displays raw YAML in an unassisted textarea.
* **Actual Problem & Evidence:** Business analysts and QA engineers cannot easily read or edit YAML without introducing indentation errors.
* **Expected User Experience:** Users can toggle between **"Visual Rule Builder"** and **"YAML Code View"**. The Visual Builder allows adding rules using structured blocks:
  - *When:* `Worked Hours` > `8.0`
  - *Then:* Apply Multiplier `1.5x` up to `12.0` hours
  - *Description:* Standard daily overtime tier.
* **Proposed Solution:** Build a structured React component `VisualRuleBuilder.tsx` that synchronizes bidirectional state with the underlying YAML model.
* **Exact Frontend Files:**
  * `frontend/src/components/simulation/VisualRuleBuilder.tsx` (New component).
  * `frontend/src/pages/SimulationPage.tsx`.
* **Dependencies:** `SIM-UX-01`.
* **Acceptance Criteria:**
  1. Editing a rule in the visual builder updates the YAML preview instantaneously.
  2. Non-technical users can add, reorder, or delete rules without touching raw YAML.
* **Verification Method:** Create a daily threshold rule in the visual UI and verify the generated YAML matches the specification.
* **Estimated Effort:** Medium (M)

---

### Module 12: Test Execution Transparency & Detailed Logs

#### `EXEC-TR-01` [P0] Lift Prohibition on Executing Non-Code Requirements Test Suites
* **Priority:** P0 (Critical)
* **Affected Screen / Module:** Execution Service (`executions.py:54-57`)
* **Current Behaviour:** `create_execution` throws `409 Conflict: No approved, validated automated tests to execute` if tests do not contain a Python script targeting HCM.
* **Actual Problem & Evidence:** Users who generate tests in a pure Requirements-Based project cannot execute them through the standard test runner.
* **Expected User Experience:** Users can run any approved test suite. If tests are automated scripts, they run in the sandbox; if they are specification tests, they run through the verified simulation engine.
* **Proposed Solution:** Update `create_execution` to allow routing `simulation` or `specification` tests through `simulation_engine.py` without throwing a 409 conflict.
* **Exact Backend Files:** `backend/app/services/executions.py:47-75`.
* **Dependencies:** `SIM-UX-02`.
* **Acceptance Criteria:**
  1. Requirements-Based test suites can be executed with 1 click.
  2. Execution generates an auditable record with full results.
* **Verification Method:** Trigger suite execution on Dayforce workspace and verify run transitions to `completed` without errors.
* **Estimated Effort:** Medium (M)

---

### Module 13: Expected-versus-Actual Comparison

#### `EXEC-RES-01` [P1] Expandable Test Result Cards with Side-by-Side Expected vs. Actual
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Test Runs Results Sub-Tab (`TestRunsManagementView.tsx:877-894`)
* **Current Behaviour:** The test results list only displays the test title and a status badge (`passed`, `failed`).
* **Actual Problem & Evidence:** Business analysts have no idea what value was expected or what was actually returned.
* **Expected User Experience:** Clicking any test result row expands a clean comparison card:
  - **Inputs:** `{ "weekly_hours": 42, "hourly_rate": 25.0 }`
  - **Expected Outcome:** `Overtime Hours: 2.0, Gross Pay: $1075.00`
  - **Actual Outcome:** `Overtime Hours: 0.0, Gross Pay: $1000.00`
  - **Delta:** `-2.0 Overtime Hours (Underpayment of $75.00)`
* **Proposed Solution:** Render a structured `ResultDetailCard.tsx` when a result row is clicked, parsing `test_case.test_data`, `test_case.expected_result`, and `execution_result.stdout`/`message`.
* **Exact Frontend Files:** `frontend/src/components/executions/TestRunsManagementView.tsx:880-893`.
* **Exact Backend Files:** `backend/app/api/serializers.py:execution_result`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Clicking a test result expands to reveal full input parameters and expected vs. actual outcomes.
  2. Discrepancies are highlighted in red.
* **Verification Method:** Inspect a failed test in the UI and verify the expected vs. actual comparison card renders clearly.
* **Estimated Effort:** Medium (M)

---

### Module 14: Failure Explanation & Defect Actionability

#### `DEF-UX-01` [P1] One-Click "Log Defect from Failure" with Pre-Populated Evidence
* **Priority:** P1 (Major)
* **Affected Screen / Module:** Test Runs & Defect Creation (`TestRunsManagementView.tsx`, `ExecutionDefectPages.tsx`)
* **Current Behaviour:** "Log Defect" is a standalone dialog asking the user to manually type an `execution_result_id` integer.
* **Actual Problem & Evidence:** Extremely tedious and error-prone. Users must look up database primary keys across screens.
* **Expected User Experience:** Every failed test in the Execution Results tab has an inline **"Log Defect"** button. Clicking it opens a pre-populated dialog containing:
  - Defect Title: `[Failure in {test_key}] {title}`
  - Linked Requirement: Automatically linked.
  - Linked Execution Result: Automatically bound.
  - Reproduction Steps: Pre-filled with the exact test steps and failing inputs.
* **Proposed Solution:** Add a direct navigation handler from `TestRunsManagementView.tsx` to `DefectsPage?create=true&result_id={id}&test_id={t_id}` and bind fields automatically in `CreateDefectDialog`.
* **Exact Frontend Files:**
  * `frontend/src/components/executions/TestRunsManagementView.tsx`.
  * `frontend/src/pages/ExecutionDefectPages.tsx:278-305`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Failed test rows display a direct "Log Defect" action button.
  2. The defect dialog opens with test title, inputs, and stack trace pre-filled.
  3. The resulting defect is automatically linked to the failed execution result.
* **Verification Method:** Click "Log Defect" on a failed test and verify the defect is created and linked without manual ID entry.
* **Estimated Effort:** Small (S)

---

### Module 15: Requirement-to-Test Traceability Usability

#### `TR-UX-01` [P2] Hierarchical Tree View for Requirement-to-Test Coverage
* **Priority:** P2 (Usability)
* **Affected Screen / Module:** Traceability Matrix (`InsightPages.tsx:90-120`)
* **Current Behaviour:** Renders an exhaustive 2D grid with 50+ vertical rotated column headers, making horizontal scrolling necessary.
* **Actual Problem & Evidence:** Unreadable on laptops or standard 1080p monitors. QA managers cannot easily audit coverage.
* **Expected User Experience:** A toggle between **"Matrix View"** and **"Tree View"**:
  - The Tree View lists requirements hierarchically:
    - `REQ-001: Daily Overtime Rule` (Covered - 3 Tests)
      - `Clause 1: Hours over 8 paid at 1.5x` -> Linked to `TC-001`, `TC-002`
      - `Clause 2: Hours over 12 paid at 2.0x` -> Linked to `TC-003`
      - `Criteria AC1: Given 10 hours...`
* **Proposed Solution:** Build a collapsible accordion tree component `TraceabilityTreeView.tsx` grouped by Requirement -> Clause -> Test Cases.
* **Exact Frontend Files:**
  * `frontend/src/components/traceability/TraceabilityTreeView.tsx` (New component).
  * `frontend/src/pages/InsightPages.tsx:88-125`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Users can switch between Matrix view and Hierarchical Tree view.
  2. Untested clauses are highlighted with a distinct red badge in the tree view.
* **Verification Method:** Open Traceability on WFMQ workspace in Tree View and verify clauses expand cleanly.
* **Estimated Effort:** Medium (M)

---

### Module 16: User-Facing Terminology & Information Architecture

#### `UX-ARCH-01` [P2] Role-Based Language Normalization (Business Analyst vs. Developer)
* **Priority:** P2 (Usability)
* **Affected Screen / Module:** Global App Shell & Sub-Headers (`AppShell.tsx`, `RequirementsProjectDashboard.tsx`)
* **Current Behaviour:** The UI exposes deep developer terms: `AST validator`, `fail-closed bwrap+rlimits sandbox`, `content_hash sha256`, `netns isolation`.
* **Actual Problem & Evidence:** Intimidating and irrelevant to business analysts and QA leads reviewing specifications.
* **Expected User Experience:** Plain enterprise quality language:
  - `Sandboxed Environment` -> `Automated Verification Harness`
  - `AST Validator` -> `Specification Syntax Check`
  - `netns+rlimits` -> `Isolated Security Sandbox`
  - Developer diagnostics remain accessible via an expandable "Advanced Technical Details" panel.
* **Proposed Solution:** Update UI labels in `AppShell.tsx`, `RequirementsProjectDashboard.tsx`, and `InsightPages.tsx` to use enterprise QA terminology.
* **Exact Frontend Files:**
  * `frontend/src/layouts/AppShell.tsx`.
  * `frontend/src/components/dashboard/RequirementsProjectDashboard.tsx`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Top navigation pills display human-readable security and status labels.
  2. Technical debugging jargon is tucked inside expandable detail drawers.
* **Verification Method:** Inspect dashboard header and verify no raw Linux kernel flag strings (`netns+rlimits`) are exposed as primary titles.
* **Estimated Effort:** Small (S)

---

### Module 17: Loading, Progress & Error States

#### `UX-STATE-01` [P2] Stage-Aware Progress Stepper for Multi-Step Document Intake
* **Priority:** P2 (Usability)
* **Affected Screen / Module:** Document Intake & Reprocess (`RequirementsManagementView.tsx`)
* **Current Behaviour:** Clicking "Reprocess" shows a brief toast, leaving the user with no visual indication of background extraction progress.
* **Actual Problem & Evidence:** Users assume the system froze and re-click "Reprocess" multiple times, creating redundant background jobs.
* **Expected User Experience:** A real-time progress drawer or modal appears showing the active stage:
  `[✓] Parsing PDF Pages -> [✓] Extracting Clauses -> [⟳] Generating Acceptance Criteria (4/12) -> [ ] Designing Test Cases`.
* **Proposed Solution:** Connect the document processing task ID to the existing `useTaskMonitor` hook and render an inline stepper modal.
* **Exact Frontend Files:** `frontend/src/components/requirements/RequirementsManagementView.tsx`.
* **Exact Backend Files:** `backend/app/services/document_processor.py`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Reprocessing a document displays an active progress stepper with live percentage.
  2. The modal dismisses automatically upon completion with a summary of extracted items.
* **Verification Method:** Click Reprocess on a document and watch the multi-stage progress bar update in real time.
* **Estimated Effort:** Medium (M)

---

### Module 18: End-User Onboarding & Guided Workflows

#### `UX-ONB-01` [P2] Interactive "First Requirement to Verified Test" Guided Tour
* **Priority:** P2 (Usability)
* **Affected Screen / Module:** Main Dashboard (`RequirementsProjectDashboard.tsx`)
* **Current Behaviour:** An empty workspace displays disconnected cards with no guided onboarding flow for first-time business analysts.
* **Actual Problem & Evidence:** New users do not know whether they should upload a document, author a requirement manually, or open the simulation.
* **Expected User Experience:** A 4-step guided interactive banner:
  1. *Step 1: Upload Specification* (Drop PDF/DOCX)
  2. *Step 2: Review Clauses & Triage Ambiguities* (Resolve flags)
  3. *Step 3: Generate Test Matrix* (Positive, Negative, Boundary)
  4. *Step 4: Run Verification & Check Coverage*
* **Proposed Solution:** Add an interactive onboarding checklist banner in `RequirementsProjectDashboard.tsx` that dynamically updates as each milestone is achieved.
* **Exact Frontend Files:** `frontend/src/components/dashboard/RequirementsProjectDashboard.tsx`.
* **Dependencies:** None.
* **Acceptance Criteria:**
  1. Empty or new projects render the guided 4-step workflow stepper.
  2. Completing a step checks off the milestone and highlights the next recommended action.
* **Verification Method:** Create a brand new project and verify the guided onboarding checklist guides the user through document upload to test generation.
* **Estimated Effort:** Small (S)

---

## 3. Recommended Implementation Phases & Execution Roadmap

```mermaid
flowchart TD
    subgraph "Phase 1: Foundational Trust & Inspection (Weeks 1-2)"
        P1A["UX-DOC-01: Embedded PDF Viewer"]
        P1B["AI-EXT-01: Multi-column De-hyphenation"]
        P1C["UX-UI-01: Remove Static Fake HR Badges"]
        P1D["SIM-UX-01: Connect Simulation to Project Context"]
    end
    subgraph "Phase 2: Real AI Quality & Domain Agnosticism (Weeks 3-4)"
        P2A["AI-REQ-01: Semantic LLM Extraction"]
        P2B["AI-TEST-01: Remove Hardcoded Payroll API Bias"]
        P2C["AI-AC-01: Normalized Whitespace Quote Matching"]
        P2D["SIM-UX-02: Real Deterministic Rule Evaluator"]
    end
    subgraph "Phase 3: Execution Transparency & Defect Actionability (Weeks 5-6)"
        P3A["EXEC-TR-01: Enable Execution for No-Code Suites"]
        P3B["EXEC-RES-01: Expected vs Actual Detail Cards"]
        P3C["DEF-UX-01: 1-Click Defect Creation from Failure"]
        P3D["UX-DOC-02: Bi-Directional PDF Highlight Jump"]
    end
    subgraph "Phase 4: Usability & Enterprise Ergonomics (Weeks 7-8)"
        P4A["SIM-VIS-01: Visual When/Then Rule Builder"]
        P4B["TR-UX-01: Hierarchical Traceability Tree View"]
        P4C["UX-ARCH-01: QA/BA Plain-Language Normalization"]
        P4D["UX-ONB-01: 4-Step Guided Onboarding Tour"]
    end

    Phase 1 --> Phase 2 --> Phase 3 --> Phase 4
```

### Phase Summary Table

| Phase | Core Objective | Key Deliverables | Effort | Impact on Product |
|---|---|---|:---:|---|
| **Phase 1** | **Foundational Trust & Source Visibility** | Embedded PDF.js viewer, de-hyphenated text parsing, removal of fake HR insight badges, project-scoped simulation routing. | 3.5 Weeks | **Eliminates P0 showstoppers.** Users can view documents and trust basic UI badges. |
| **Phase 2** | **AI Quality & Domain Agnosticism** | Semantic LLM requirement extraction, removal of hardcoded `reference_hcm` bias, normalized quote verification, real rule evaluation. | 4.0 Weeks | **Solves AI quality.** Platform can ingest any enterprise domain (healthcare, banking, HR) reliably. |
| **Phase 3** | **Execution Transparency & Defect Flow** | Unrestricted no-code test execution, expected-vs-actual side-by-side comparison, 1-click defect logging, bi-directional PDF jump. | 3.5 Weeks | **Empowers QA analysts.** Failures are transparent and actionable without technical hurdles. |
| **Phase 4** | **Usability, Ergonomics & Polish** | Visual "When/Then" rule builder, hierarchical traceability tree, plain-language terminology, guided 4-step onboarding. | 3.0 Weeks | **Enterprise adoption.** Transforms TraceTest into an intuitive, polished commercial-grade product. |

