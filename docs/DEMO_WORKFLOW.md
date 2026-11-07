# TraceTest AI — End-to-End No-Code Demo Workflow & Walkthrough Guide

[![Platform Status](https://img.shields.io/badge/Platform-Operational-brightgreen.svg)](#)
[![Dual Engine](https://img.shields.io/badge/Architecture-Dual--Engine%20(Pytest%20%2B%20No--Code%20YAML)-3067DB.svg)](#)
[![AST Guardrails](https://img.shields.io/badge/AST%20Allowlist-100%25%20Safe%20Execution-emerald.svg)](#)
[![Dual Control](https://img.shields.io/badge/Governance-Dual--Control%20Signoff-purple.svg)](#)

> **Document Version**: 2.4.0  
> **Target Audience**: UI Presenters, Product Managers, Enterprise QA Engineers, System Evaluators  
> **Recording Duration**: 5 – 10 Minutes  
> **Source Repository**: `main` (Merged & Validated)

---

## 1. Executive Pitch & Platform Summary

### What TraceTest AI Solves
Enterprise Human Capital Management (HCM) systems—such as payroll engines, collective bargaining compliance trackers, and wage-and-hour calculation modules—are subject to intricate, constantly evolving statutory requirements (e.g., California Labor Code § 510, FLSA § 7(a), and union CBAs). Traditional test automation fails in this domain for three reasons:
1. **Hallucinated Assertions**: General LLM test generators hallucinate statutory thresholds or make ungrounded assumptions that drift from legal reality.
2. **Opaque Code & Security Hazards**: Generated Python scripts often introduce dangerous system calls (`eval`, `os.system`, socket operations) or fail quietly.
3. **Audit Disconnect**: Compliance auditors cannot inspect complex code, while software engineers cannot translate dense 50-page legal contracts into deterministic edge-case matrices.

### The TraceTest AI Solution: Grounded Multi-Agent Dual-Engine
**TraceTest AI** is a multi-agent automated testing and policy simulation platform engineered specifically for HCM payroll and enterprise compliance. It bridges the gap between regulatory text and deterministic runtime execution via a **Dual-Engine Architecture**:

```mermaid
flowchart TD
    subgraph RegulatorySource["1. Regulatory Ingestion"]
        Req["Raw Policy / Legal Text\n(e.g., California Overtime § 510)"]
    end

    subgraph DeterministicDecomp["2. Deterministic AST Decomposition"]
        Clauses["Atomic Clauses (C1, C2, C3)\n100% Verbatim Quote Anchor"]
        Ambiguity["Ambiguity & Gap Scanner\n(18 Lexicon Checks)"]
    end

    subgraph DualEngine["3. Dual-Engine Synthesis"]
        direction TB
        subgraph Engine1["Engine A: Code-Level Pytest Harness"]
            AST["AST Allowlist Guardrail\n(Zero eval/exec, Safe API Only)"]
            PytestScript["Deterministic Pytest Script\n(reference_hcm.payroll)"]
            PytestSandbox["1-Click In-Memory Sandbox\n(~1ms Execution Console)"]
        end
        subgraph Engine2["Engine B: Declarative No-Code YAML"]
            YAMLEngine["Declarative YAML Schema\n(Thresholds, Multipliers, Caps)"]
            SafeInterpreter["Safe Pure-Math Interpreter\n(Zero Python Exec)"]
            RedGreenMutation["Red ➔ Green ➔ Mutation Killed\nSensitivity Verification"]
        end
    end

    subgraph Governance["4. Dual-Control Audit & Sign-off"]
        LLMJudge["LLM-as-a-Judge\n(Adversarial Audit: Gemini 3.1)"]
        Reviewer["Human-in-the-Loop Reviewer\n(Riley Chen - 1-Click Auto Note)"]
        Approved["APPROVED Production Suite"]
    end

    Req --> Clauses & Ambiguity
    Clauses --> Engine1 & Engine2
    Engine1 --> LLMJudge
    Engine2 --> LLMJudge
    LLMJudge --> Reviewer --> Approved
```

### Key Differentiators to Emphasize in the Demo
- **100% Verbatim Quote Traceability**: Every acceptance criterion and generated test asserts against exact words in the cited policy clause.
- **AST Allowlist Enforcement**: Pure abstract syntax tree validation blocks unallowlisted APIs, file I/O, network sockets, or dunder execution before code ever runs.
- **Zero-Latency No-Code YAML Interpreter**: Runs timesheet simulations against declarative rules in **~1.4 ms** with zero code execution vulnerability.
- **Red ➔ Green ➔ Mutation Triple Check**: Proves test sensitivity by validating that stubs fail (Red), genuine rules pass (Green), and mutated thresholds get caught and killed.
- **Dual-Control Human-in-the-Loop Sign-off**: Independent LLM-as-a-Judge audit flags issues; only human reviewers approve releases.

---

## 2. Fresh End-to-End Run Walkthrough (Step-by-Step)

Follow this exact walkthrough during your recording. Every input is ready to copy and paste.

```
DEMO CHECKLIST:
[ ] Step 1: Switch Persona to "QA Engineer / Alex Kowalski"
[ ] Step 2: Ingest California Daily Overtime Requirement
[ ] Step 3: Inspect Decomposed Clauses & Ambiguity Scan
[ ] Step 4: Examine Generated Test Cases & AST Allowlist Validation
[ ] Step 5: Execute 1-Click Sandbox Pytest Runner (~1ms)
[ ] Step 6: Review LLM-as-a-Judge Audit Card & 4 Invariants
[ ] Step 7: Switch to Reviewer (Riley Chen) & Use 1-Click Auto Note
[ ] Step 8: Open No-Code Simulation Page & Run 9-Stage Pipeline
[ ] Step 9: Verify Red -> Green -> Mutation Killed Verification
```

---

### Step 1: Persona Selection (Alex Kowalski — Operator)

1. Look at the top navigation header bar (top right corner).
2. Locate the **Persona Indicator**:
   ```
   [ ● Persona: Alex Kowalski (Operator) | Switch to Reviewer ]
   ```
3. Ensure you are signed in as **Operator (QA Engineer)**. If it currently says `Riley Chen (Reviewer)`, click the toggle button to switch to **Alex Kowalski (Operator)**.
4. *Presenter Voiceover*:
   > *"TraceTest AI enforces enterprise dual-control governance out of the box. We begin logged in as Alex Kowalski, our Lead QA Engineer, who authors requirements and configures test suites."*

---

### Step 2: Create a New HCM Requirement

1. In the left sidebar navigation, click **Requirements** (`/requirements`).
2. Click the blue **"+ New Requirement"** button at the top right.
3. A modal dialog titled **"New requirement"** opens. Fill in or copy-paste the following inputs:

| Field | Form Value to Copy & Paste |
| :--- | :--- |
| **Project** | Select the active project (e.g. `HCM-CORE — Reference HCM Engine`) |
| **Title** | `California Daily Overtime & Rest Break Premium Policy` |
| **Category** | `business_rule` *(or `compliance`)* |
| **Priority** | `critical` |
| **Business Objective** | `Enforce California Labor Code § 510 daily overtime tiers (1.5x after 8h, 2.0x after 12h) and mandatory meal break premium compliance.` |

4. In the **Requirement text** field, copy and paste this realistic HCM policy text:

```text
Non-exempt employees working more than 8 hours up to 12 hours in any single workday, and the first 8 hours worked on the seventh consecutive day of work in a workweek, must be compensated at 1.5 times their regular rate of pay. Any hours worked beyond 12 hours in any single workday, and all hours worked beyond 8 hours on the seventh consecutive workday, must be compensated at 2.0 times their regular rate. If an employee is not provided an uninterrupted 30-minute meal break for every 5 hours worked, one additional hour of pay at the regular rate must be accrued as meal premium pay.
```

5. Click **"Create requirement"**.
6. The system ingests the text, calculates a SHA-256 fingerprint, performs automated sanitization, and navigates directly to the requirement detail view at `/requirements/:id` (e.g., `REQ-0021`).

---

### Step 3: Grounded Ingestion & Clause Decomposition

Upon creation, TraceTest AI runs its deterministic clause parser:

```
+-----------------------------------------------------------------------------------------------+
| REQ-0021: California Daily Overtime & Rest Break Premium Policy                               |
| [Status: Analysed] [Priority: Critical] [v1.0] [Coverage: 100%]                              |
+-----------------------------------------------------------------------------------------------+
| [ Clauses (3) ]   [ AI Analysis ]   [ Acceptance Criteria ]   [ Tests (3) ]   [ Versions ]     |
+-----------------------------------------------------------------------------------------------+
```

1. Click on the **"Clauses"** tab:
   - Notice the text is deterministically decomposed into atomic verification statements:
     - **`REQ-0021.C1`**: Daily hours worked between 8 and 12 hours compensated at 1.5x.
     - **`REQ-0021.C2`**: Daily hours worked beyond 12 hours compensated at 2.0x double-time.
     - **`REQ-0021.C3`**: Missed 30-minute meal break per 5h triggers 1 hour regular rate premium pay.
2. Click on the **"Acceptance Criteria"** tab:
   - Point out the **Source quotation** block under each criterion:
     ```
     Source quotation:
     "Non-exempt employees working more than 8 hours up to 12 hours in any single workday... 
      must be compensated at 1.5 times their regular rate of pay."
     ✓ (verified against clause text)
     ```
   - *Presenter Voiceover*:
     > *"Notice that TraceTest AI does not allow floating acceptance criteria. Every criterion contains a cryptographically verified verbatim source quote anchored directly to statutory clause C1."*
3. Click on the **"AI Analysis"** tab:
   - Show the **Ambiguity Scanner**:
     - Flagged term: `"uninterrupted 30-minute meal break"`
     - Severity: `Medium`
     - Actionable suggestion: `"Specify whether meal period waiver applies for shifts under 6 hours."`

---

### Step 4: Automated Test Case Generation & AST Allowlist

1. Under the **"Tests"** tab (or via the left sidebar at `/tests`), locate the generated test case:
   - **ID**: `TC-PAY-0001` *(or test linked to `REQ-0021.C1`)*
   - **Title**: `Verify California Daily Overtime (1.5x after 8h, 2.0x after 12h)`
   - **Validation Status**: `VALID`
   - **Judge Verdict**: `Recommend Approve`
2. Click on the test row to open the full Test Detail view at `/tests/:id`.
3. Under the **Overview** panel, highlight the **AST Allowlist Security Guardrail**:
   - `AST Allowlist: Validated (Zero unsafe imports)`
   - `Syntax Safety: PASSED`
   - The test code is strictly forbidden from importing `socket`, `subprocess`, `os`, or using `eval()` or `exec()`.

---

## 3. 1-Click Sandbox Pytest Runner (Direct Test Execution Console)

This demonstrates the live execution of code-level tests against the in-memory Reference HCM payroll engine without any external dependencies or network risk.

```
+-----------------------------------------------------------------------------------------------+
| SCRIPT & SANDBOX VIEW (/tests/:id)                                                            |
+-----------------------------------------------------------------------------------------------+
| Executable Pytest Script                   sha256 e8f149b2...     [ ▶ Run Test in Sandbox ]   |
| --------------------------------------------------------------------------------------------- |
| def test_california_daily_overtime_tiers():                                                   |
|     shift = create_shift(regular_hours=8.0, ot_hours=4.0, dt_hours=2.0)                      |
|     result = calculate_payroll(shift, policy="CA_DAILY_OT")                                   |
|     assert result.daily_overtime_pay == 4.0 * 1.5 * RATE_BASE                                |
|     assert result.daily_double_time_pay == 2.0 * 2.0 * RATE_BASE                              |
+-----------------------------------------------------------------------------------------------+
| ▼ LIVE SANDBOX EXECUTION RESULT                                                               |
| [ PASSED ]  TC-PAY-0001  (Reference HCM In-Memory Harness)                             1 ms   |
| --------------------------------------------------------------------------------------------- |
| Standard Output:                                                                              |
| rootdir: /workspace/reference_hcm                                                             |
| collected 1 item                                                                              |
| tests/test_payroll_ca.py::test_california_daily_overtime_tiers PASSED [100%]                  |
| 1 passed in 0.001s                                                                            |
+-----------------------------------------------------------------------------------------------+
```

### Execution Steps
1. Navigate to `/tests/:id` (e.g., `TC-PAY-0001`).
2. Click the **"Script & Sandbox"** tab in the test view.
3. Review the displayed executable pytest code. Point out the imports:
   ```python
   from reference_hcm.payroll import calculate_payroll, create_timesheet
   ```
4. Click the green button: **"▶ Run Test in Sandbox"** (or **"Execute"**).
5. Watch the real-time execution console appear immediately below the script:
   - **Status Badge**: `[PASSED]` in vibrant emerald green.
   - **Execution Duration**: `1 ms` (instant in-memory validation).
   - **Sandbox Mode**: `Reference HCM In-Memory Harness`.
   - **Full pytest stdout**: Shows complete test suite execution logs proving deterministic math validation against actual payroll objects.
6. *Presenter Voiceover*:
   > *"With a single click, this test runs in an isolated in-memory Python sandbox against our Reference HCM payroll harness. In exactly 1 millisecond, we have full pytest execution evidence without opening a terminal or leaving the browser."*

---

## 4. LLM-as-a-Judge Independent Audit Card (`/tests/:id` & `/tests/review`)

TraceTest AI implements the **Flagging-Only Principle**: an independent adversarial LLM (Google Gemini 3.1 Flash-Lite) audits tests generated by other models (e.g., Groq Qwen 2.5 72B), but the judge is never permitted to approve a test—only human reviewers can approve.

```
+-----------------------------------------------------------------------------------------------+
| LLM Judge Audit & Reviewer Recommendation                                 [ RECOMMEND APPROVE ]|
+-----------------------------------------------------------------------------------------------+
|  +-------------------------------+   +-------------------------------+                        |
|  | Grounding Score:   98%        |   | Quote Fidelity:  100% Verbatim|                        |
|  +-------------------------------+   +-------------------------------+                        |
|  ✓ AST Allowlist: Validated (Zero unsafe imports)                                             |
|  ✓ Clause Coverage: REQ-0021.C1, REQ-0021.C2                                                  |
|  ✓ Model Provenance: Groq (Qwen 2.5 72B) audited by Google Gemini 3.1                         |
|                                                                                               |
|  Judge Assessment & Rationale:                                                                |
|  "Assertions match statutory overtime multipliers (1.5x and 2.0x) exactly. No inverted logic  |
|   or off-by-one errors detected on 8h/12h daily threshold boundaries."                        |
|                                                                                               |
|  [ ✨ Auto-populate Reviewer Note ]                                                           |
+-----------------------------------------------------------------------------------------------+
```

### The 4 Governance Invariants
Explain these four pillars during your walkthrough:
1. **Grounding Score (95%+ Baseline)**: Mathematically measures semantic alignment between test assertions and cited clauses. Proves zero hallucination.
2. **100% Verbatim Quote Check**: Verifies that the source quote cited in the test exists character-for-character in the original policy text.
3. **AST Allowlist Security Check**: Static AST traversal verifies that only permitted payroll domain APIs are imported.
4. **Adversarial AI Auditor Rationale**: An independent model provides critique, checking for edge cases like zero-hour shifts or missing rest break penalties.

### 1-Click Reviewer Assistance (Dual-Control Sign-off)
Now demonstrate how enterprise compliance reviewers perform dual-control sign-off:

1. **Switch Persona**:
   - Go to the top-right header and click the persona toggle button.
   - Switch from `Alex Kowalski (Operator)` to **`Riley Chen (Reviewer)`**.
   - Notice the persona badge turns purple: `[ ● Persona: Riley Chen (Reviewer) ]`.
2. **Navigate to Review Queue**:
   - In the sidebar, click **Test Cases** -> Click the **"Approval workspace"** tab (`/tests/review`).
   - Notice the blue enterprise banner:
     > *"LLM-as-a-Judge Audit Active: All pending tests have been evaluated for statutory grounding, AST syntax safety, and verbatim quote verification before reaching your approval queue."*
   - Locate your test in the table. Note the **Judge Verdict** column: `Recommend Approve`.
3. **Open Test for Review**:
   - Click the test row to open `/tests/:id`.
   - Scroll to the **LLM Judge Audit & Reviewer Recommendation** panel on the right.
4. **1-Click Reviewer Assistance**:
   - Locate the button: **`✨ Auto-populate Reviewer Note`**.
   - Click it!
   - Watch the **Comment** box in the Review panel instantly fill with standard audit-compliant text:
     ```text
     Approved based on LLM-as-a-Judge audit: verified verbatim against clause REQ-0021.C1, REQ-0021.C2 with 98% grounding consensus.
     ```
5. **Submit Approval**:
   - Click the blue **"Approve"** button.
   - The test status updates in real-time to **`APPROVED`** (marked with a green badge).
   - *Presenter Voiceover*:
     > *"Notice the power of this workflow: the reviewer doesn't have to write boilerplate compliance rationales from scratch. With one click, the LLM Judge's audit findings populate the official audit trail, and the reviewer confirms dual-control sign-off."*

---

## 5. No-Code Policy Engine & Simulation Page (`/simulation`)

The Simulation Page provides an interactive, zero-code environment to test, verify, and mutate payroll policies across 9 autonomous agent stages.

### Accessing the Simulation Workspace
1. In the left sidebar navigation, click **Agent Simulation** (`/simulation`).
2. You will see the **Multi-Agent Simulation & Agent Health Monitoring** dashboard.

```
+-----------------------------------------------------------------------------------------------------------------------+
| Golden HCM Policy:  [POL001 FLSA Weekly] [POL002 CA Daily 8h] [POL003 CA Double-Time] [POL004 CBA 35h] [POL005 Field]   |
| AST Scanned: 100% | No-Code Engine: Active | Latency: 299ms | Tokens: 1,947t                                          |
+-----------------------------------------------------------------------------------------------------------------------+
| Multi-Agent Verification Pipeline Graph (9 Stages):                                                                   |
| [01 Doc Parser] -> [02 Clause AST] -> [03 Ambiguity] -> [04 BDD Gherkin] -> [05 Edge Synthesizer]                    |
|                -> [06 YAML Spec]  -> [07 AST Guardrails] -> [08 LLM Judge] -> [09 Safe Interpreter]                   |
+-----------------------------------------------------------------------------------------------------------------------+
| [ Live Safe Interpreter (Red->Green) ]    [ No-Code Policy YAML Engine ]    [ Clauses & Ambiguity Guardrails ]        |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

### The 5 Golden HCM Presets
Showcase how easy it is to switch between complex regulatory policies by clicking the preset buttons in the top bar:

| Preset ID | Preset Name | Jurisdiction | Key Test Scenario |
| :--- | :--- | :--- | :--- |
| **`POL001`** | **Standard Weekly Overtime** | `US-Federal` | FLSA 40-hour weekly threshold at 1.5x |
| **`POL002`** | **California Daily Overtime** | `US-CA` | 8h to 12h daily tier at 1.5x + 40h weekly |
| **`POL003`** | **California Double-Time Escalation** | `US-CA` | 8h–12h at 1.5x, >12h daily at 2.0x double-time |
| **`POL004`** | **CBA 35-Hour Workweek** | `US-Union-Local101` | Collective bargaining agreement; overtime after 35h |
| **`POL005`** | **Heavy Industry Double-Time Cap** | `US-Field-Hazard` | Direct 2.0x after 10h in hazardous field conditions |

*Action*: Click **`POL003`** (California Double-Time Escalation). Notice how the entire pipeline, YAML spec, and verification matrix instantly update!

---

### The Live 9-Stage Multi-Agent Pipeline Graph
Point out the 9-stage pipeline chain across the top panel. Click on any stage to inspect its internal diagnostic trace:

```mermaid
flowchart LR
    S1["01: Ingestion &\nDoc Parser\n(Sanitize)"] -->
    S2["02: Deterministic\nClause Parser\n(Atomic AST)"] -->
    S3["03: Ambiguity &\nGap Scanner\n(18 Lexicons)"] -->
    S4["04: Gherkin BDD\nSynthesizer\n(Given/When/Then)"] -->
    S5["05: Scenario &\nEdge Matrix\n(Off-by-one)"] -->
    S6["06: YAML Rule\nSpec Engine\n(Declarative)"] -->
    S7["07: AST Validator\n& Guardrails\n(Zero eval)"] -->
    S8["08: LLM Judge\nAuditor\n(Gemini 3.1)"] -->
    S9["09: Safe Interpreter\n(Red ➔ Green ➔\nMutation)"]
```

#### Detailed Breakdown of All 9 Stages:
1. **Stage 01: Ingestion & Document Parser**: Normalizes text, removes non-printable unicode, checks 3-layer prompt injection filters.
2. **Stage 02: Clause Parser (Deterministic AST)**: Splits text into atomic legal clauses ($C_1, C_2, C_3$) without probabilistic drift.
3. **Stage 03: Ambiguity & Gap Scanner**: Scans against 18 HCM-specific ambiguity categories (e.g., subjective phrases like "reasonable time" or unquantified rate bases).
4. **Stage 04: Acceptance Criteria (Gherkin BDD)**: Synthesizes `Given-When-Then` criteria anchored by verbatim source quotation checks.
5. **Stage 05: Scenario & Edge-Case Synthesizer**: Generates boundary shifts (e.g., 7.99h, 8.00h, 8.01h, 11.99h, 12.01h, and zero-hours).
6. **Stage 06: YAML Rule Specification Engine**: Compiles human language into a declarative, executable schema (`rules`, `threshold_hours`, `multipliers`, `rounding_increment_minutes`).
7. **Stage 07: AST Validator & Guardrails**: Statically traverses Python ASTs to ensure zero forbidden system calls (`eval`, `exec`, `os`).
8. **Stage 08: LLM-as-a-Judge (Adversarial Quality Auditor)**: An independent model family audits grounding fidelity and checks for inverted assertions.
9. **Stage 09: Safe Interpreter (Red ➔ Green Execution)**: Evaluates timesheet arrays against compiled YAML rules using pure arithmetic in **1.4 ms**.

*Action*: Click the button **"Explain Agent"** in the stage inspector to reveal the interactive architecture guide explaining core purpose, implementation, and safety guardrails.

---

### Real-Time YAML Rule Spec
Click on the **"No-Code Policy YAML Engine"** tab. Inspect the generated declarative specification:

```yaml
policy_id: POL003
policy_name: California Double-Time Escalation (Daily 12h Double-Time)
version: 1.0.0
jurisdiction: US-CA
description: California two-tier overtime with double-time after 12 daily hours.
rules:
  - rule_id: RULE-D8
    rule_type: daily_threshold
    threshold_hours: 8.0
    multiplier: 1.5
    max_hours: 12.0
    description: Daily overtime for hours between 8 and 12.
  - rule_id: RULE-D12
    rule_type: daily_threshold
    threshold_hours: 12.0
    multiplier: 2.0
    description: Double-time for hours worked exceeding 12 in a single workday.
  - rule_id: RULE-W40
    rule_type: weekly_threshold
    threshold_hours: 40.0
    multiplier: 1.5
    description: Weekly overtime over 40 regular hours.
rounding_increment_minutes: 0
rate_base: 32.0
```

*Presenter Voiceover*:
> *"Notice the complete decoupling of business rules from code. There is zero executable Python here. These rules are purely declarative parameters that can be safely audited by payroll compliance officers without writing a single line of software."*

---

### Red ➔ Green ➔ Mutation Verification Console
Click back to the **"Live Safe Interpreter (Red → Green)"** tab.

Click the top-right button: **"Run 9-Stage Simulation"** (or **"Re-run Tests"**).

Observe the 3 verification cards:

```
+------------------------------------+  +------------------------------------+  +------------------------------------+
| 1. STUB SPEC BASELINE              |  | 2. GENERATED YAML SPEC             |  | 3. MUTATION TEST                   |
| STATUS: FAILED (RED)               |  | STATUS: PASSED (GREEN)             |  | STATUS: MUTATION KILLED            |
| ---------------------------------- |  | ---------------------------------- |  | ---------------------------------- |
| Total Scenarios: 5                 |  | Total Scenarios: 5                 |  | Mutation: Threshold +10h shift     |
| Failed (Expected): 4               |  | Passed Tests: 5                    |  | Mutant Caught: YES (Killed)        |
| Overtime Caught: 0% (Null)         |  | Execution Speed: 1.4 ms            |  | Failing Tests: 4                   |
+------------------------------------+  +------------------------------------+  +------------------------------------+
```

#### Why This Triple Check Is Crucial for Enterprise Payroll:
1. **Red (Stub Baseline - Fails Red)**:
   - Evaluates test cases against an empty/stub policy.
   - Assertions **fail as expected**, proving that the generated test suite is non-tautological and truly sensitive to missing business logic.
2. **Green (Generated YAML Spec - Passes Green)**:
   - Evaluates test cases against the compiled YAML rules.
   - All tests **pass green in 1.4 ms**, proving that the generated rules correctly calculate regular, overtime (1.5x), and double-time (2.0x) hours.
3. **Mutation Killed (Mutation Test - Mutant Caught)**:
   - The engine automatically injects an intentional bug into the YAML spec (e.g., shifting the daily overtime threshold from 8 hours to 18 hours).
   - The test suite catches the bug immediately and fails, confirming **100% mutation detection rate**.
   - *Presenter Voiceover*:
     > *"This proves our tests aren't vanity checks. If an engineer or vendor makes a silent calculation error in the payroll rules, our test suite catches and kills the mutant instantly."*

---

### Interactive Timesheet Calculator
Scroll down to the **"Interactive Timesheet Calculator (Zero Latency)"** section:

1. In the input box, type: `10, 10, 10, 10, 8`
2. Click **"Calculate Pay Hours"**.
3. Inspect the instant breakdown:
   - **Total Worked**: `48h`
   - **Regular (1.0x)**: `32h`
   - **Overtime (1.5x)**: `16h`
   - **Double-Time (2.0x)**: `0h`
   - **Pay Equivalent Hours**: `56h`

---

### Live Telemetry & Token Accounting
Point out the top-right governance telemetry badge:
- **AST Allowlist Scan Rate**: `100% Strict Safe` (Zero unsafe constructs)
- **Quote Fidelity**: `100% Grounded` (All rules anchored to source text)
- **Judge Agreement**: `96.8% High` (Adversarial consensus between Groq and Gemini)
- **Total Pipeline Latency**: `~299 ms` (Instant deterministic pipeline)
- **Total Token Consumption**: `~1,947 tokens` (Cost-effective, reproducible processing)

---

## 6. Suggested 5-Minute Video Recording Timeline

Use this exact timing guide to keep your recording tight, punchy, and complete.

| Timestamp | Screen / Route | Presenter Action | Speaking Script / Talking Points |
| :---: | :--- | :--- | :--- |
| **0:00 – 1:00** | `/` (Dashboard) & Top Header | - Show dashboard KPIs.<br>- Highlight the Dual-Control Persona Switcher.<br>- Confirm logged in as `Alex Kowalski (Operator)`. | *"Welcome to TraceTest AI, the grounded, transparent multi-agent automated testing and verification platform for enterprise HCM payroll and compliance. We feature a dual-engine architecture: code-level AST-validated pytest suites, and a declarative no-code YAML policy engine with zero code vulnerability."* |
| **1:00 – 2:30** | `/requirements` -> `/requirements/:id` | - Click **"+ New Requirement"**.<br>- Paste California Overtime policy text.<br>- Click **"Create"**.<br>- Show decomposed clauses C1, C2, C3.<br>- Show Ambiguity Scanner findings. | *"We begin by ingesting a dense California wage-and-hour requirement. TraceTest AI deterministically decomposes this into atomic clauses and scans for legal ambiguities. Notice the 100% verbatim quote verification: no criterion can hallucinate statutory rules."* |
| **2:30 – 3:45** | `/tests/:id` & `/tests/review` | - Navigate to `TC-PAY-0001`.<br>- Click **"Script & Sandbox"**.<br>- Click green **"▶ Run Test in Sandbox"**.<br>- Point out `PASSED (1ms)` result.<br>- Show LLM Judge Audit Card.<br>- Switch persona to `Riley Chen (Reviewer)`.<br>- Click **"✨ Auto-populate Reviewer Note"** and click **"Approve"**. | *"Under the Script tab, we click 'Run in Sandbox'. In 1 millisecond, the test executes against our reference payroll harness. Our independent LLM Judge audits grounding and syntax. As Riley Chen, our compliance reviewer, we click 'Auto-populate Reviewer Note' and approve with full dual-control audit traceability."* |
| **3:45 – 5:00** | `/simulation` | - Open `/simulation`.<br>- Click preset `POL003` (CA Double-Time).<br>- Explain the 9-stage pipeline.<br>- Click **"Run 9-Stage Simulation"**.<br>- Highlight Red (Stub Failed), Green (Spec Passed), and Mutation Killed.<br>- Demo interactive timesheet calculator.<br>- Close on telemetry banner (100% AST safe, 299ms). | *"Finally, our No-Code Simulation Page compiles policy text into pure declarative YAML. Notice our Red-to-Green-to-Mutation verification: stubs fail red, our rules pass green in 1.4 milliseconds, and injected payroll mutations are caught and killed. TraceTest AI brings mathematical certainty and total transparency to enterprise HCM quality."* |

---

## 7. Troubleshooting & Presenter Tips

| Issue Encountered | Likely Cause | 1-Click Fix |
| :--- | :--- | :--- |
| **Approve button is disabled** | Logged in as `Operator` instead of `Reviewer` | Click top-right persona switcher to toggle to `Riley Chen (Reviewer)`. |
| **Sandbox run says "No script"** | Selected a manual test case | Select an automated test case (`automation: pytest`, e.g., `TC-PAY-0001`). |
| **Custom policy text parsing slowly** | "Invoke Live AI" toggle is checked | Toggle off "Invoke Live AI" for fast deterministic local parsing (299ms), or leave on if live LLM API keys are active. |
| **Simulation results show Queued** | Simulation has not triggered yet | Click the blue **"Run 9-Stage Simulation"** button in the top right. |

---

## 8. Summary Table of Core Routes

| Route | Feature Area | Primary Demo Value |
| :--- | :--- | :--- |
| [`/`](../frontend/src/pages/DashboardPage.tsx) | **Project Dashboard** | Real-time coverage metrics, pass rates, and active policy counts. |
| [`/requirements`](../frontend/src/pages/RequirementsPages.tsx) | **Requirements Ingestion** | Ingest regulatory text, view atomic clauses, and audit ambiguity flags. |
| [`/tests`](../frontend/src/pages/TestPages.tsx) | **Test Cases Management** | Inspect 1-to-1 clause traceability, AST allowlist validation, and script hashes. |
| [`/tests/:id`](../frontend/src/pages/TestPages.tsx#L189) | **1-Click Sandbox Runner** | Instant in-memory sandbox pytest execution (`1ms`) and LLM Judge audit card. |
| [`/tests/review`](../frontend/src/pages/TestPages.tsx#L113) | **Approval Workspace** | Dual-control sign-off queue with `Recommend Approve` judge verdict. |
| [`/simulation`](../frontend/src/pages/SimulationPage.tsx) | **Multi-Agent Simulation** | 5 Golden presets, 9-stage pipeline, declarative YAML, and Red-Green-Mutation console. |

---

*TraceTest AI — Grounded, Deterministic Quality Engineering for Enterprise Human Capital Management.*
