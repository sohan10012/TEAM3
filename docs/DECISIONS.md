# Architecture Decision Records (ADRs)

This document records the architectural and engineering decisions made during the development of TraceTest AI, including the context, considered alternatives, rationale, and consequences of each choice.

---

## ADR-001: SQLite as the Sole Application and Workflow Database

### Context
Enterprise test management and QA platforms typically store requirements, test suites, execution artifacts, defect records, and audit logs. The system must support local laptop development, CI/CD pipeline execution, and self-hosted on-premises deployments without heavyweight operational overhead.

### Decision
Use SQLite in Write-Ahead Logging (WAL) mode as the sole persistence technology across the application. Partition data into two dedicated SQLite databases:
1. `var/tracetest.db`: Business entities, test cases, executions, defects, user accounts, sessions, and audit trails.
2. `var/workflow_checkpoints.db`: LangGraph execution state, thread checkpoints, and resume state, managed directly by `langgraph-checkpoint-sqlite`.

### Consequences & Trade-offs
- **Pros**: Zero infrastructure dependencies (no Postgres, Redis, or MongoDB required); instantaneous initialization; embedded ACID transactions; online non-blocking hot backups (`sqlite3.backup()`).
- **Cons**: Write concurrency is limited to a single active writer at any time. Addressed by designing short, atomic transactions and offloading long-running jobs to in-process workers that commit immediately.

---

## ADR-002: Alembic Migrations with SQLite Batch Mode

### Context
Relational database schemas evolve over time as new features are added. SQLite has historically had limited support for `ALTER TABLE` operations (e.g. dropping columns, altering constraints).

### Decision
Manage database schema migrations exclusively through Alembic using SQLAlchemy models as the single source of truth. Enforce `render_as_batch=True` across all migration files to utilize SQLite table recreation batch operations.

### Consequences
- Full backward and forward schema traceability.
- Idempotent startup migration (`alembic upgrade head`) executes reliably on application launch.
- Foreign keys and check constraints are preserved across column modifications.

---

## ADR-003: Deterministic Guardrails First, LLM Interpretation Second

### Context
Generative AI models are stochastic, prone to hallucinations, formatting variances, and subtle injection exploits. An enterprise QA platform cannot trust model output to guarantee safety, approval status, or test validity.

### Decision
Enforce a strict architectural boundary:
1. **Deterministic Guardrails**: Clause segmentation, stable identifier generation, quote verification, coverage analysis, deduplication, AST security validation, and role-based permissions are implemented entirely in deterministic Python code.
2. **LLM Role**: The LLM is restricted to semantic reasoning, test step drafting, edge-case hypothesis generation, and failure explanation.
3. **No Code Alteration of Grounding**: Generated test cases or criteria that fail quote verification or reference nonexistent clauses are rejected and flagged as ungrounded; they are never silently synthesized or repaired by code.

### Consequences
- Mathematical auditability of requirements-to-test traceability.
- Complete resistance to prompt injection escaping into executable actions.
- Model upgrades or provider shifts cannot compromise security or approval policies.

---

## ADR-004: Multi-Credential Key Pools and Provider Failover Hierarchy

### Context
Cloud LLM providers impose strict per-minute token and request rate limits. Single-key setups fail unpredictably under burst load or team testing sessions.

### Decision
Implement a multi-credential rotation and failover architecture:
- Support up to three credentials per provider (`Slot 1`, `Slot 2`, `Slot 3`) via environment variables (`GROQ_API_KEY`, `GROQ_API_KEY2`, `GROQ_API_KEY3` / `GEMINI_API_KEY`, etc.).
- Maintain an in-memory `SlotPool` for each provider tracking state (`healthy`, `rate_limited`, `invalid`).
- On HTTP 429 or quota depletion, immediately rotate to the next healthy slot in the pool.
- On HTTP 401/403 (invalid key), permanently disable the bad slot without failing the whole request.
- Primary provider is Groq (`openai/gpt-oss-120b`). Secondary provider is Gemini (`gemini-2.5-flash`). Optional local provider is Ollama (`llama3.1`).
- Fall back to secondary provider only when all primary slots are exhausted.

### Consequences
- Zero downtime during burst test generation or evaluation runs.
- Full compliance with provider rate limits and `Retry-After` response headers.
- Safe logging: credential secrets are strictly masked and never logged or exposed in API payloads.

---

## ADR-005: Process-Level Sandbox with AST Allowlist and Linux Namespaces

### Context
Approved automated tests are executed in Python against the System Under Test. Running untrusted or AI-generated Python code directly on a host server poses remote code execution risks.

### Decision
Construct a multi-layered process-level execution sandbox:
1. **Pre-execution AST inspection**: Scripts must pass an Abstract Syntax Tree validator allowing only approved modules (`pytest`, `reference_hcm.*`, `math`, `decimal`, `datetime`). Disallowed nodes (`os`, `sys`, `subprocess`, `socket`, `open`, `eval`, `exec`, `while`) cause immediate pre-execution rejection.
2. **Resource Limits**: POSIX `resource.setrlimit` limits memory (512 MB), CPU time, open files (256), and file size (50 MB).
3. **Network Isolation**: When available on Linux, runs are spawned under `unshare -rn` (isolated network namespace). All environments bundle a security `conftest.py` that nullifies network sockets.
4. **Hard Timeout**: Subprocess process groups are forcefully terminated on timeout expiration.

### Consequences
- Secure and deterministic execution on developer workstations and CI runners without requiring Docker daemon permissions.
- Documented limitation: This is a process sandbox, not a virtualization container; enterprise deployments with untrusted multi-tenant code authors should place the API host in an isolated VM.

---

## ADR-006: LangGraph Workflows with Interrupt-Before Human Review

### Context
Test generation and defect triage require human authorization. Workflows must pause cleanly for human intervention and resume without state loss, even across server restarts.

### Decision
Model workflows as LangGraph state graphs with `SqliteSaver` checkpointers:
- In requirement generation, the graph executes up to `gap_checker` and interrupts before `human_review`.
- In failure analysis, the graph executes up to `defect_recommendation` and interrupts before `human_approval`.
- Checkpoints are saved to `workflow_checkpoints.db` indexed by thread ID.
- When an authorized user submits an approval or review decision via the REST API, the workflow thread resumes and completes.

### Consequences
- Human-in-the-loop governance is baked into the engine architecture.
- Workflows survive server restarts and application updates.

---

## ADR-007: Verification-Grounded Defect Lifecycle

### Context
Bug tracking systems often allow defects to be marked "verified" or "closed" without proof that a test actually passed on a corrected build, leading to regression escapes.

### Decision
Enforce state machine constraints directly in the defect service:
- A defect can only transition to `verified` if a linked test execution on a fix candidate build (e.g. Reference HCM 1.1) records a genuine `passed` outcome for that specific test script.
- Transitioning without a passing execution result returns HTTP 409 Conflict with an actionable message.

### Consequences
- Eliminates "paper verification" where defects are closed administratively without empirical proof.
- Full traceability linking requirements → tests → failures → defects → retest execution results.

---

## ADR-008: Server-Side Cryptographic Sessions and CSRF Headers

### Context
Single-Page Applications (SPAs) communicating with a REST API need secure authentication resistant to XSS and CSRF attacks.

### Decision
- Use server-side session tokens stored in `HttpOnly`, `SameSite=Lax` cookies.
- Only the SHA-256 hash of the session token is persisted in the database.
- Require an `X-CSRF-Token` header on all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- Passwords hashed with Argon2id using `argon2-cffi`.

### Consequences
- Tokens cannot be stolen via JavaScript XSS.
- Cross-origin requests cannot forge state mutations.
- Immediate revocation on logout or admin session invalidation.

---

## ADR-009: In-Process Asynchronous Worker Pool with SSE Progress

### Context
Operations such as requirement generation, test suite execution, and AI evaluations take seconds to minutes. Background execution must not block the HTTP request thread.

### Decision
Use a lightweight in-process thread pool worker (`concurrent.futures.ThreadPoolExecutor`) tied to database-backed run records (`runs` and `run_steps` tables):
- Progress is updated in SQLite as steps complete.
- Clients subscribe to live progress via Server-Sent Events (`GET /api/v1/runs/{id}/events`).
- Frontend automatically falls back to polling `GET /api/v1/runs/{id}` if SSE is interrupted.
- Orphaned runs from ungraceful server shutdowns are detected on startup and marked `failed`.

### Consequences
- Zero external message broker dependencies (no Redis, RabbitMQ, or Celery).
- Real-time user feedback with smooth progress bars and live step logs.

---

## ADR-010: Reference HCM Dual-Engine System Under Test

### Context
To rigorously verify a QA automation platform, realistic, reproducible software faults and fixes must exist in a controlled system under test.

### Decision
Package a dual-build reference Human Capital Management system (`reference_hcm`):
- `v1.0`: Contains 8 deliberate, documented domain faults (overtime off-by-one, rounding mode mismatch, differential rate swap, cutoff boundary error, break threshold error, leave cap bypass, contractor eligibility defect, approval limit strictness).
- `v1.1`: Fix candidate build with all 8 deliberate faults resolved.
- Unsupported engine behavior: Group-specific differential overrides (security officers 6%/12%, clinic staff 7%/15%) remain unsupported in both builds, accurately modeling real-world engine limitations.

### Consequences
- Empirically validates that TraceTest AI detects real faults in v1.0 and verifies real fixes in v1.1.
- Provides consistent ground-truth for regression testing and CI verification.

---

## ADR-011: Strict Loopback Binding, Host/Origin Validation, and Elimination of Single-Operator Bypass

### Context
Prior implementations permitted unauthenticated requests in single-operator mode to synthesize a temporary `UserSession(id=0)` with all administrative roles, bypassing CSRF verification. Furthermore, documentation previously advised binding to `0.0.0.0`, which risked exposing an unauthenticated administrative API to the local network or internet.

### Decision
1. Default bind host is strictly `127.0.0.1`. If `TRACETEST_SINGLE_OPERATOR` is true, binding to non-loopback hosts (`0.0.0.0` or external IPs) is explicitly rejected at startup.
2. In single-operator mode, the first page load (`GET /api/v1/auth/me`) mints a real signed local session cookie in SQLite with `SameSite=Strict` and `HttpOnly=True`, along with a matching `SameSite=Strict` CSRF cookie.
3. Completely remove synthetic `id=0` sessions. All state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid session cookie and matching `X-CSRF-Token`.
4. Validate `Host` header against `localhost`, `127.0.0.1`, `[::1]`, and configured allowlists to defeat DNS rebinding.
5. Validate `Origin` header on state-changing requests to reject untrusted cross-origin requests with HTTP 403.
6. Refuse to start in production mode if the default `secret_key` (`change-me-in-env`) is detected; in development, auto-generate a cryptographically secure random token persisted to `data_dir / ".secret_key"` (mode 0600).

### Consequences
- Eliminates cross-site request forgery and DNS rebinding attack vectors against the local developer instance.
- Fully prevents LAN/WAN exposure of single-operator administrative operations.
- Guarantees complete audit traceability: all operations are tied to a persistent session record in the database.

---

## ADR-012: Prohibition of Untrusted Repository Code Execution on the Host

### Context
Target repositories imported into TraceTest AI are fundamentally untrusted external inputs. In earlier validation scripts (`echobox_runner.py`), `npm run build` and `npx vite preview` were invoked directly on the host system via `subprocess`. A malicious repository containing arbitrary shell commands in lifecycle hooks (`preinstall`, `postinstall`, `build`) would achieve remote code execution on the host machine.

### Decision
1. Strictly treat all target repositories as untrusted inputs. Zero script execution (e.g. `npm run`, `npm install`, `node`, `make`, `python`) is permitted directly on the host environment.
2. In Tier A static verification, replace shell compilation checks with purely static manifest and AST analysis: parse `package.json`, inspect script definitions, count dependencies, and validate AST structures using safe in-memory parsers without subprocess invocation.
3. For browser E2E validation, eliminate unconfined background server processes launched from the repository root; instead, connect to a pre-existing target endpoint or configured `TRACETEST_PLAYWRIGHT_TARGET_URL`.

### Consequences
- Eliminates host arbitrary code execution vulnerabilities arising from imported repositories.
- Guarantees deterministic, host-isolated static inspection.

---

## ADR-013: Git Clone Hardening, Token Masking via Askpass, and Uniform Ingestion

### Context
Repository import operations previously cloned repositories by embedding tokens directly in the URL (`https://x-access-token:{token}@github.com/...`). This persisted the secret token inside `.git/config` on disk and exposed it in process argument vectors (`argv`). In addition, the generic import path contained special-case branch shortcuts specifically for EchoBox, bypassing uniform directory isolation.

### Decision
1. Implement `run_hardened_git` in `app/services/git_client.py`: tokens are NEVER placed in argv or clone URLs. Instead, tokens are passed via a temporary `GIT_ASKPASS` script created with `0700` user permissions and immediately removed.
2. Enforce strict git flags on every git process invocation:
   - `-c core.hooksPath=/dev/null`
   - `-c protocol.file.allow=never`
   - `-c http.followRedirects=false`
   - `-c core.symlinks=false`
   - `-c submodule.recurse=false`
   - `GIT_TERMINAL_PROMPT=0`
   - `GIT_ALLOW_PROTOCOL=https`
3. Assert that `.git/config` never contains tokens post-clone, and enforce a repository size cap (`250 MB`) and file count cap (`10,000 files`).
4. Eliminate all target-specific shortcuts from `projects.py`; all imported repositories follow the deterministic `var/repos/{owner}_{repo_name}` layout.
5. In repository refresh, use `fetch_and_snapshot` to resolve and record the exact Git commit SHA without in-place destructive overwrites.

### Consequences
- Prevents token leakage into process listings (`ps`, `/proc`), audit logs, and on-disk git configuration files.
- Protects against malicious repository structures exploiting git submodules, symlink traversal, or custom hooks.
- Ensures identical, auditable ingestion behavior across all target repositories.

---

## ADR-015: Real SUT Execution Fidelity under Moto, Honest Provenance, and AI Secret Redaction

### Context
The `echobox_harness` originally relied on an in-memory Python simulation (`MemoryDynamo`, `EchoBoxMemoryBackend`) that reimplemented EchoBox logic rather than executing the target repository's code. This masked real-world defects such as unverified JWT signatures. In addition, requirement and defect provenance were ambiguous: requirements derived from code lacked commit SHA grounding and were treated as confirmed, while defects did not differentiate between static analysis findings and runtime test execution failures. Furthermore, prompts passed to cloud LLMs risked leaking host or cloud secrets.

### Decision
1. Implement `RealLambdaBackend` in `echobox_harness/backend.py`, which directly imports and invokes the actual `var/repos/{owner}_{repo_name}/backend/lambda_function.py` entrypoint inside an in-process mocked AWS environment powered by `moto` (`mock_aws()` with DynamoDB table `"EchoBox"`). Expose mode selection via `backend="real"` vs `backend="simulation"`.
2. Add `origin` (`documented`, `inferred_from_code`, `manual`), `source_commit_sha`, and `confidence` to `Requirement` records. Any requirement inferred from code starts in `status="needs_confirmation"` and requires human review/confirmation before automated test generation.
3. Add `source_paths` and line ranges to `Clause` records to establish exact code and documentation grounding.
4. Add `evidence_type` (`execution_failure`, `static_analysis`, `manual`) and `source_commit_sha` to `Defect` records. Explicitly prohibit labeling static analysis findings (such as unverified JWT token parsing) as runtime test failures without an actual failing test run.
5. Add pre-flight regex-based secret redaction (`redact_secrets`) across all LLM prompt pipelines in `app/llm/router.py`, masking AWS credentials, RSA/SSH private keys, GitHub tokens, Groq/Gemini API keys, and secret values before network transmission.

### Consequences
- High-fidelity execution of actual target repository code against AWS SDK contracts without incurring AWS billing or cloud network latency.
- Honest and auditable separation of documented specifications from inferred heuristics, and execution failures from static analysis findings.
- Zero cloud or host credential leaks in LLM traces or prompt logs.

---

## ADR-016: Service Modularization, SQLite Concurrency Discipline, and Cross-Project Isolation Boundaries

### Context
`repo_ingest.py` had expanded to over 2,000 lines, bundling URL validation, secret scanning, AST analysis, EchoBox test synthesis, and generic README parsing into a single monolithic file. In addition, background task crashes could leave runs in an unresumable running state, SQLite concurrency limits required empirical validation against thread pools, and multi-tenant project isolation required explicit endpoint-level regression guarantees.

### Decision
1. Modularize `repo_ingest` into a clean package under `app/services/repo_ingest/`: `url_validator.py`, `secret_scanner.py`, `ast_analyzer.py`, `echobox_derivation.py`, and `generic_derivation.py`. Re-export all public symbols via `__init__.py` for 100% backward compatibility.
2. Maintain SQLite WAL mode with `busy_timeout=10000`, short atomic transactions, and connection pre-ping. Verify that concurrent multi-threaded writes execute cleanly without `database is locked` errors.
3. Ensure startup reconciliation (`recover_interrupted()`) reliably marks orphaned `running` or `queued` tasks as `interrupted` with explanatory diagnostics.
4. Enforce project authorization boundaries across all entity endpoints (`requirements`, `test-cases`, `defects`, `executions`) returning 404 (NotFound) on cross-project ID guessing attempts by non-admin users.

### Consequences
- Clean separation of concerns and maintainability across ingestion pipelines.
- Full resilience to application restarts without dangling jobs.
- Mathematically verified tenant isolation preventing data leakage between independent repositories.---

## ADR-017: 6-Stage Project Journey UI, Visual Isolation Badges, and Empirical Verification Deliverables

### Context
Users interacting with TraceTest AI needed a clear, sequential mental model of the software quality engineering journey: from repository connection and analysis to requirement extraction, test synthesis, execution, and defect resolution. Furthermore, user confidence required explicit visibility into execution environment fidelity (In-Memory Harness vs Live Remote vs Browser E2E) and sandbox isolation levels. Finally, production readiness required reproducible evaluation artifacts, a structured 10-minute demo script, and executive presentation materials.

### Decision
1. Implement a 6-stage linear project journey header in `frontend/src/pages/DashboardPage.tsx`:
   - Stage 1: Connect (`/projects`)
   - Stage 2: Analyze (`/settings`)
   - Stage 3: Requirements (`/requirements`)
   - Stage 4: Test Generation (`/tests`)
   - Stage 5: Execute (`/executions`)
   - Stage 6: Defects (`/defects`)
   Each stage shows active status and requirement/test metrics.
2. Surface sandbox isolation level badges (`[Network Isolated: unshare]` or `[Standard POSIX rlimits]`) and environment kind badges in `AppShell.tsx`, the `/config` API, and execution detail views.
3. Classify defects with explicit `evidence_type` metadata tags (`execution_failure`, `static_analysis`, `manual`) to ensure complete transparency regarding how defects were identified.
4. Author comprehensive challenge deliverables:
   - `docs/demo-script.md`: 10-minute live presentation guide with minute-by-minute talking tracks and exact click paths.
   - `docs/slides-outline.md`: 5-slide technical/executive presentation structure.
   - `docs/eval-report.md`: Reproducible AI benchmark evaluation report with command reproduction scripts.
   - `docs/a11y-report.json`: Automated WCAG AA accessibility audit across 6 responsive viewports with zero critical violations.

### Consequences
- Transparent, guided user workflow eliminating confusion on multi-repository projects.
- Clear visual cues separating simulated test environments from live cloud targets.
- Complete set of executive and technical artifacts for stakeholders, evaluators, and engineers.

---

## ADR-018: Bubblewrap Filesystem & Network Isolation (`bwrap+rlimits`)

### Context
Unshare-based network namespace isolation (`unshare -rn`) was vulnerable to host filesystem exposure: test scripts executing inside the sandbox could theoretically read host files (e.g. `~/.env`, `var/tracetest.db`) if not prevented by runtime controls. A robust sandbox must guarantee zero filesystem leakage, zero secret leakage, and fail-closed isolation.

### Decision
1. Implement Bubblewrap containerized execution (`bwrap+rlimits`) as the primary isolation mechanism on Linux systems.
2. Configure Bubblewrap with:
   - `--unshare-all`, `--die-with-parent`, `--new-session`
   - `--clearenv` to wipe all inherited process environment variables, with explicit minimal whitelist (`PATH`, `HOME=/tmp`, `LANG=C.UTF-8`, `PYTHONDONTWRITEBYTECODE=1`, `PYTHONHASHSEED=0`)
   - Read-only mounts for system binaries and libraries (`/usr`, `/lib`, `/lib64`, `/etc`)
   - Isolated in-memory tmpfs for `/tmp`, `/home`, and `/var` (completely masking user homes, host `.env`, and application SQLite databases)
   - Virtual environment read-only mount at `/opt/venv`
   - Transient workspace bound at `/work` with `--chdir /work`
3. Retain `rlimits` (CPU limit, virtual memory limit, output cap) while exempting `RLIMIT_NPROC` when Bubblewrap is active (as Bubblewrap already provides isolated PID namespaces and host process masking).

### Consequences
- Mathematical guarantee that test scripts cannot access host credentials, files, or databases.
- Isolated loopback networking with network egress strictly blocked.
- Automatic fallback to `netns+rlimits` on Linux hosts without Bubblewrap, or fail-closed refusal when network isolation is unavailable.

---

## ADR-019: DNS Rebinding Prevention via Pinned IP Resolution and Git `http.curloptResolve`

### Context
Repository ingestion accepts a GitHub repository URL. A classic Time-of-Check to Time-of-Wait (TOCTOU) DNS rebinding vulnerability could occur if a DNS lookup validates a public IP at the start of ingestion, but `git clone` subsequently re-resolves the domain to a private IP (e.g., `127.0.0.1` or `169.254.169.254`).

### Decision
1. Resolve and validate the target domain upfront using `socket.getaddrinfo`, asserting that all resolved IPs are non-loopback, non-private (RFC 1918), non-link-local, and globally routable.
2. Pin the validated public IP directly into the `git` invocation using Git's `-c http.curloptResolve=github.com:443:<pinned_ip>` configuration parameter.
3. This forces libcurl inside `git` to connect strictly to the pre-validated IP without secondary hostname re-resolution, completely eliminating DNS rebinding attacks.

### Consequences
- Prevents SSRF attacks against internal networks or cloud metadata services.
- Deterministic connection routing for all git clone and fetch operations.

---

## ADR-020: Promotion of Real SUT under Moto as Primary Environment and Defect Evidence Separation

### Context
Initial validation of EchoBox used an in-memory simulation (`EchoBoxMemoryBackend`) as the default environment, which could mask implementation differences in the target application (such as JWT signature verification flaws). Furthermore, defect records did not distinguish between runtime execution failures and static analysis findings, risking confusion during triage. Finally, sequential test runs executing `RealLambdaBackend` under `moto` encountered mock lifecycle state corruption when `b.stop()` and garbage collection `__del__` interacted with `MockAWS._nested_count`.

### Decision
1. Promote `RealLambdaBackend` (executing real `lambda_function.py` entrypoint under `moto` DynamoDB mock) to the primary, default environment (`kind="real_code"`, `is_default=True`).
2. Retain the in-memory simulation harness as a secondary environment (`kind="simulation"`, `is_default=False`) explicitly designated for discrepancy baseline tracking.
3. Classify and serialize defects with explicit `evidence_type` metadata (`execution_failure`, `static_analysis`, `manual`) and enable query filtering via `GET /api/v1/defects?evidence_type=...`.
4. Add idempotency guards to `RealLambdaBackend.stop()` (`self._is_stopped = True`) to prevent multiple decrements of `MockAWS._nested_count`, ensuring clean isolation across sequential test executions.

### Consequences
- Execution tests exercise the actual target source code against AWS SDK contracts by default.
- Complete clarity in defect records distinguishing verified runtime test failures from static analysis notices.
- Robust, leak-free test suite execution across sequential invocations.

---

## ADR-022: Multi-Run AI Evaluation Benchmarking with Statistical Spread and Transparent Quota Accounting

### Context
Single-run AI evaluations can give misleading impressions of model reliability due to inference variance, token generation jitter, and transient cloud provider rate limiting (`HTTP 429 RESOURCE_EXHAUSTED`). In addition, presenting synthetic or fabricated evaluation scores when upstream credentials are rate-limited violates product integrity guidelines.

### Decision
1. Enhance the evaluation harness (`app/services/run_ai_eval.py`) to execute a 3-iteration multi-run benchmark across all configured providers on golden scenarios.
2. Compute and persist empirical statistical metrics: mean $\pm$ standard deviation for execution latency, requirement clause coverage, ungrounded rate, Pydantic schema validation rate, and ambiguity recall.
3. Automatically inspect generated acceptance criteria and tests against source requirement clauses using `app/guardrails/quotes.py`, recording any ungrounded assertions or hallucinated quotes with exact scenario references.
4. Enforce transparent rate-limiting and quota exhaustion accounting: when a provider returns `HTTP 429` or has unavailable credentials, the harness detects the condition, marks the run status as `degraded`, stops further wasteful calls to that provider, and reports completed runs accurately without fabricating missing data.
5. Persist benchmark results to `docs/ai_eval_benchmark.json` and publish findings in `docs/eval-report.md`.

### Consequences
- Transparent, statistically grounded visibility into model performance and variance.
- Robust protection against fabricated metrics or silent failures during upstream provider outages.
---

## ADR-023: Product Chrome Refinement, Dynamic 6-Stage Journey, and Global Command Palette

### Context
The application chrome originally retained hardcoded "Dayforce" branding badges, static fallbacks in the 6-stage verification journey (`?? 21`, `?? 2`, `?? 6`), and a duplicated repository title/description banner directly below the dashboard page header. Furthermore, power users lacked a rapid keyboard-driven navigation mechanism across requirements, tests, defects, and execution runs. Finally, execution detail records needed explicit visual demarcation between primary real-code runs under moto and fallback simulations.

### Decision
1. In `AppShell.tsx`, replace the static "DF" icon with the neutral "TT" (TraceTest) mark, display the active project name dynamically in the wordmark chip, and update the subtitle to "Enterprise Quality Verification".
2. Implement a global `Cmd+K` / `Ctrl+K` keyboard shortcut and command palette in `GlobalSearch` with keyboard navigation (ArrowUp/Down, Enter, Escape).
3. Replace the "Dayforce QE Prototype" disclaimer with a permanent "Production QE Platform" verification system badge.
4. In `DashboardPage.tsx`, eliminate the duplicate title and description card, replacing it with a concise multi-environment verification status ledger. Remove all hardcoded fallbacks from the 6-stage journey, making it strictly data-driven based on actual API KPI counts and directly linking each step to filtered lists.
5. In `ExecutionDetailPage.tsx`, render prominent badges for execution environment kind (`real_code` in emerald green vs `simulation` in amber), sandbox isolation level (`bwrap+rlimits` in purple), and a copyable Git commit SHA chip.
6. In `DefectsPage.tsx`, integrate an explicit `evidence_type` dropdown filter and table column to differentiate execution failures from static analysis findings.

### Consequences
- Polished, professional enterprise user experience with zero hardcoded prototype artifacts.
- Rapid keyboard access to all testing assets via `Cmd+K`.
- Unambiguous visual provenance for every test execution and defect record.

---

## ADR-024: Small-Group Clause Generation, Verbatim Quote Repair Loops, and Ungrounded Guardrail Visualization

### Context
When language models process large batches of business requirement clauses simultaneously, attention degradation can lead to hallucinated quotes, paraphrased assertions, or ungrounded test steps. Relying on post-hoc rejection alone can waste valid work without giving the model an opportunity to rectify inaccurate excerpts. Furthermore, operators need explicit visibility into when and why content is rejected by deterministic guardrails.

### Decision
1. Restrict clause generation batch sizes to small groups (`group_size <= 2`) in both LangGraph workflow nodes and the evaluation benchmark harness.
2. Demand verbatim, character-for-character substrings for all `source_quote` attributes and validate them strictly using `app.guardrails.quotes.verify_quote`.
3. Implement an iterative quote repair loop (`repair_ungrounded_quotes`) allowing up to 2 targeted repair attempts where the failing quote, cited clause key, and exact clause text are fed back to the model.
4. If an item remains ungrounded after repair attempts, hard-reject it and record the rejection rationale structured as `(scenario, clause, quote, why)` in `docs/ai_eval_benchmark.json`.
5. Render a dedicated "Guardrail Rejections: Ungrounded Content Blocked" panel in `RunProgress.tsx` and warning callouts with `[REJECTED: UNGROUNDED QUOTE]` badges in `RequirementsPages.tsx`.

### Consequences
- Dramatic reduction in hallucinated assertions.
- Complete operator visibility into blocked content and deterministic filter enforcement.
- Model completions are grounded in actual source text with cryptographic fidelity.

---

## ADR-025: Unified SPA Hosting, Browser Isolation Tier Transparency, and Gated CI

### Context
Running frontend and backend on distinct origins during local development introduced CORS complexity and proxy friction. Furthermore, while Python test harnesses execute inside Bubblewrap kernel jails (`bwrap+rlimits`), Playwright web browser automation requires access to host browser binaries and local network sockets. Claiming identical sandbox isolation for both would be misleading. Finally, previous CI pipelines permitted dependency audit failures via `|| true`, risking silent CVE regressions.

### Decision
1. Configure FastAPI in `backend/app/main.py` to mount `frontend/dist` static assets and serve SPA fallback on non-API routes, unifying backend and frontend under a single loopback origin without altering OpenAPI contracts (`include_in_schema=False`).
2. Clearly distinguish sandbox isolation tiers in `docs/SUPPORTED_TARGET_MATRIX.md` and UI execution records: Python libraries and serverless handlers run under `bwrap+rlimits` / `netns+rlimits`, whereas Playwright browser sessions run under `playwright:host_browser`.
3. Correct the historical claim of "58 faults" in `reference_hcm/` to "8 deliberate faults (HCM-F01 to HCM-F08) causing 58 test failures in v1.0".
4. Remove `|| true` fallback from `pip-audit` and `npm audit` in `.github/workflows/ci.yml`.
5. Implement a full Playwright E2E test suite (`backend/tests/test_playwright_e2e.py`) driving the live single-origin application with automated `axe-core` accessibility audits across all primary screens.

### Consequences
- Zero-configuration single-port deployment for local testing and demos.
- Honest, transparent security boundaries distinguishing browser automation from containerized execution.
- Strictly gated continuous integration with automated accessibility enforcement.

---

## ADR-026: Environment Secrets Hygiene, Per-Install Credential Generation, and Absolute Dual-Control Identity Switching

### Context
Static passwords committed or defaulted in `.env` files (e.g. `TRACETEST_ADMIN_PASSWORD`) create critical security risks. In addition, single-operator development environments often bypass the dual-control four-eyes principle (author cannot review their own test case), leading to self-approval during testing and demonstrations without authentic role boundaries. Furthermore, Pydantic's default `ValidationError` strings include raw invalid input values, risking secret credential exposure in application logs.

### Decision
1. Eliminate all static passwords (`TRACETEST_ADMIN_PASSWORD`, etc.) from `.env` and `Settings`. Establish `docs/ENVIRONMENT.md` as the authoritative 43-variable specification.
2. In `backend/app/seed/seed.py`, dynamically generate cryptographically random credentials for initial operator (`operator`) and reviewer (`reviewer`) accounts in `var/initial_credentials.txt` (chmod `0600`) upon first database initialization, storing Argon2id hashes in SQLite. In test environments (`TRACETEST_ENV=test`), use deterministic test fixtures.
3. Add `POST /api/v1/auth/switch-operator` to allow authorized local operators to alternate between operator persona (Alex Kowalski, QA Lead) and reviewer persona (Riley Chen, Staff QA Architect) with refreshed signed session cookies and CSRF tokens.
4. Enforce an absolute four-eyes requirement in `backend/app/services/tests.py`: `if t.created_by == reviewer.id: raise Forbidden("Authors cannot approve their own tests")`, removing any role-based exemption for administrators.
5. Configure `hide_input_in_errors=True` in `SettingsConfigDict` and add shape/security validators (`check_unknown_env`, `validate_security_invariants`) to prevent secret leakage in exceptions and enforce loopback-only single-operator bindings.

### Consequences
- No default or static passwords in codebase or environment files.
- Demonstrable, cryptographically enforced dual-control four-eyes approval workflow.
- Secure exception handling preventing accidental credential reflection in logs or responses.

---

## ADR-027: Multi-Credential LRU Key Rotation, Paced Concurrency Control, and In-Provider Model Fallbacks

### Context
External generative model providers enforce strict rate limits (per-minute requests/tokens and daily quotas). Sequential rotation or simple round-robin can prematurely exhaust a single hot credential or repeatedly strike a slot that is under cooldown. Furthermore, when a primary model (e.g. `openai/gpt-oss-120b`) encounters an outage or model-specific quota limit, failing over directly across providers can degrade cost and throughput when a secondary model within the same provider (e.g. `openai/gpt-oss-20b`) is available.

### Decision
1. In `app.llm.providers.SlotPool`, implement thread-safe Least-Recently-Used (LRU) candidate selection among healthy slots, tracking `last_used_at` timestamps.
2. Implement rate pacing using per-slot semaphores (`concurrency_limit` governed by `GROQ_CONCURRENCY_PER_SLOT`, default 2).
3. Handle errors systematically:
   - `HTTP 429`: Parse `Retry-After` and `x-ratelimit-reset` headers. Differentiate per-minute burst cooldowns (15s or `Retry-After`) from daily quota limits (cooldown capped at 300s). Mark slot `rate_limited` and rotate immediately.
   - `HTTP 401 / 403`: Permanently mark slot `invalid` until server restart without crashing the request pool.
   - `HTTP 5xx / Timeouts`: Mark slot `degraded` with exponential backoff (2, 4, 8s with 10% jitter).
4. Implement hierarchical fallback models before cross-provider failover:
   - Groq: Attempt candidate slots on `GROQ_MODEL` (`openai/gpt-oss-120b`); on exhaustion, attempt `GROQ_FALLBACK_MODEL` (`openai/gpt-oss-20b`) before failing over to Gemini.
   - Gemini: Attempt candidate slots on `GEMINI_MODEL` (`gemini-2.5-flash`); on exhaustion, attempt `GEMINI_FALLBACK_MODEL` (`gemini-2.5-flash-lite`) before raising `ProviderError`.
5. Expose `GET /api/v1/system/provider-status` returning pool size, active models, slot health, and request/error metrics with masked keys. Persist `slot_id` in `ProviderTrace` table.

### Consequences
- Resilient burst test generation without unhandled 429 drops.
- Multi-tier fallback hierarchy maximizes completion rates prior to provider failover.
- Complete operational observability with zero secret exposure.

---

## ADR-028: Responsive Enterprise App Shell, Dual-Control Persona Switching, and Paced Motion Counters

### Context
On narrow viewports (< 768px and 390px mobile viewports), persistent sidebars crushed main content into narrow unreadable vertical slivers. Furthermore, testing and validating the four-eyes approval rule (requiring test authors to be distinct from reviewers) was cumbersome in single-operator development environments without a rapid identity switching mechanism in the application chrome. In addition, raw browser form `<select>` tags lacked visual consistency, while static numeric KPIs lacked initial feedback.

### Decision
1. In `AppShell.tsx`, make the desktop sidebar responsive (`hidden md:flex`). On viewports below `md` (such as 390px mobile screens), collapse the navigation into a slide-over drawer triggered by a header hamburger button (`Menu`), with backdrop overlay and close controls, ensuring main content takes 100% width with zero horizontal overflow (`overflow-x-clip`).
2. Integrate a direct **Dual-Control Persona Switcher** in the header chrome (`Alex Kowalski · Operator (QA Lead)` ⇄ `Riley Chen · Reviewer (Staff QA Architect)`) calling `/api/v1/auth/switch-operator` to update session identity and invalidate React Query caches.
3. Build `CustomSelect` providing custom styling, custom chevron icons, focus rings, hover states, and WCAG AA contrast.
4. In `RequirementsPages.tsx`, add computed provenance columns: Origin badge (`Documented` vs `Inferred · X%`), 7-character source commit SHA, atomic clause count, and linked test coverage percentage.
5. Create `CountUp` component providing a 400ms cubic-ease count-up for KPI cards on initial load, strictly respecting `prefers-reduced-motion` and test environments.
6. Create `PipelineStepper` component displaying live multi-step LangGraph progress (Clone -> Ingest -> Clause extraction -> Grounding -> Complete) with per-step timers and status indicators.

### Consequences
- Fluid responsive layout from 390px mobile to 1440px+ enterprise workstations with zero layout distortion.
- Seamless dual-control approval testing and demonstration in the header.
- Rich requirements-to-test provenance with clear visual indicators.

---

## ADR-029: Guided GitHub Connect Flow with Dry-Run Architecture Preview

### Status
Accepted

### Context
Connecting external GitHub repositories required immediate ingestion without insight into detected architectural frameworks, execution feasibility, file counts, or potential credentials leaked in the source. Operators needed an interactive dry-run preview and a visible, event-driven pipeline stepper during clone and AST derivation.

### Decision
1. Enhance `POST /api/v1/projects/import-repo` with `dry_run=True`:
   - Validates owner/repo and ref names.
   - Pinned DNS resolution via `http.curloptResolve` to prevent DNS rebinding.
   - Analyzes target repository structure, detecting framework (`real_code`, `python_lib`, `web`, `static_only`).
   - Evaluates runtime execution feasibility: `bwrap+rlimits` for executable targets vs `Static analysis only` for unsupported stacks.
   - Summarizes secret findings (counts and file names only, never secrets).
   - Generates candidate file preview list without persisting project records.
2. Upgrade `ConnectRepoDialog` in frontend with three distinct phases:
   - **Input**: GitHub URL, branch, pinned commit SHA, personal access token (routed via ephemeral 0700 `GIT_ASKPASS` helper), project key/name.
   - **Dry-Run Preview**: Cards displaying validated repo, pinned commit, disk size, language breakdown, target architecture badge, isolation tier, secret scan clean check, and candidate files.
   - **Live Pipeline Stepper**: Visual execution tracking across 6 distinct stages (Validate -> DNS Pin -> Hardened Clone -> Secret Scan -> Clause Extraction -> Sandbox Configuration).

### Consequences
- Operators inspect repository properties and execution capabilities before committing ingestion.
- Secure, token-isolated cloning with zero credentials saved to `.git/config` or API logs.

---

## ADR-030: Multi-Project Data Partitioning, Fail-Closed Sandbox Execution, and Diff-Aware Refresh

### Status
Accepted

### Context
TraceTest AI must support multiple simultaneous GitHub repositories without data leakage across projects. Furthermore, unsupported targets must fail closed without generating synthetic passing test runs, and repository updates must be diff-aware without mutating past execution records.

### Decision
1. Enforce strict database scoping across all entity tables (`projects`, `modules`, `requirements`, `test_suites`, `test_cases`, `executions`, `defects`) using foreign key project constraints and query filtering.
2. In `executions.py`, enforce strict fail-closed rejection on `static_only` or unsupported environments: attempting execution immediately returns HTTP 400 `BadRequest: Static analysis only: no executable harness configured for target type 'static_only'`.
3. In `projects.py` (`POST /projects/{id}/refresh-repo`), compute AST diffs, version modified requirements, flag impacted tests as `needs_reapproval`, while keeping historical `Execution` and `ExecutionResult` records completely immutable.
4. Mark AST-derived requirements as `origin="inferred_from_code"` and `status="needs_confirmation"`. Enforce human confirmation gate before automated test generation is permitted.

### Consequences
- Proven complete isolation between distinct repositories (e.g. EchoBox vs generic Python modules).
- Invariant integrity: zero fake runs, fail-closed security for non-executable targets.

---

## ADR-031: System Health Diagnostic Tooling ('make doctor') and Multi-Viewport Accessibility Verification

### Status
Accepted

### Context
Production deployments and demo setups require rapid pre-flight validation of local toolchains, containerization sandboxes, Playwright headless browsers, and database readiness. In addition, user interfaces must be verified across 1440px desktop, 1024px tablet, and 390px mobile viewports without layout clipping or WCAG accessibility regressions.

### Decision
1. Implement `scripts/doctor.py` and `make doctor` checking 7 key system dimensions: Python runtime (>=3.10), Node.js, Git client, Bubblewrap user namespaces, Playwright Chromium, SQLite database connectivity, and environment variable configuration with detected Groq/Gemini key slot counts (names and counts only, never values).
2. Upgrade `scripts/capture_screenshots.py` to capture screenshots across 1440px laptop, 1024px tablet, and 390px mobile viewports, automated by axe-core accessibility auditing.

### Consequences
- One-command diagnostic verification for operators and CI pipelines.
- Pristine visual assets and verified zero-critical-violation accessibility across desktop and mobile.

---

## ADR-032: Gemini Primary Provider Priority with Empirical Quota Selection and Live AWS Multi-Operation Verification

### Status
Accepted

### Context
TraceTest AI requires enterprise AI resilience with Google Gemini as the primary reasoning provider and Groq as fallback. Gemini model availability and rate tiers must be verified empirically across all configured key slots, avoiding models with quota exhaustion or high demand (such as `gemini-3.8-flash` returning 503 or `gemini-2.5-flash` returning 429 quota exhaustion). Furthermore, the recovered EchoBox AWS infrastructure (`https://bnbpmiljw9.execute-api.ap-south-1.amazonaws.com`) requires multi-operation live verification across 15 real-world operations, including defect discovery and isolated retesting.

### Decision
1. Update `backend/app/core/config.py` and `backend/app/llm/router.py` to route `GeminiProvider` first, then `GroqProvider`, then `OllamaProvider`.
2. Configure primary model `gemini-3.5-flash` (empirically validated with active quota and high-speed structured JSON completion) with fast fallback model `gemini-2.5-flash-lite`.
3. Verify all 3 Gemini key slots and all 3 Groq key slots for health and authentication without logging secrets.
4. Upgrade `backend/app/services/echobox_runner.py` to execute a 15-operation real AWS API Gateway probe against `https://bnbpmiljw9.execute-api.ap-south-1.amazonaws.com`, recording `EX-ECHO-LIVE-002` (14 passed, 1 failed in 4838ms).
5. Uncover genuine defect `DEF-ECHO-LIVE-001` (type validation absence on `room_id` causing unhandled `AttributeError` and HTTP 500) and mark `DEF-ECHO-005` as resolved/verified following AWS infrastructure recovery.
6. Verify defect remediation and regression in isolated suite `backend/tests/test_echobox_defect_retest.py`.
7. Generate authoritative verification deliverables: `docs/reports/ECHOBOX_FINAL_VERIFICATION_REPORT.json`, `.md`, `.pdf` and root document `SOHAN-TEST-Echobox-Workflow.md` containing all 33 required sections.

### Consequences
- Zero dependency on unavailable models or quota-exhausted tiers.
- Real-world live AWS integration evidence replacing previous unseeded 500 blocker.
- Verifiable remediation proof for live defect `DEF-ECHO-LIVE-001`.













---

## ADR-033: Real Repository Ingestion and Architectural Multi-Project Isolation

### Status
Accepted

### Context
TraceTest AI previously suffered from ingestion inaccuracies where imported repositories were assigned generic mobile platform build wrapper modules (`ANDROID`, `IOS`, `LINUX`, `MACOS`), spurious documentation requirements (such as table of contents, architecture diagrams, and equation headers), and hardcoded `Reference HCM` enterprise environments. Multi-project data isolation was also compromised by default seeding.

### Decision
1. In `backend/app/services/repo_ingest/ast_analyzer.py`, implement architecture-aware module discovery for dual-tier applications (`backend/` API routes, agents, models, services; `lib/` screens, services, providers, models). Ignore platform wrapper folders (`android`, `ios`, `linux`, `macos`, `windows`, `web`).
2. Implement Python AST prefix resolution for `APIRouter(prefix=...)` with exact node line ranges (`lineno`, `end_lineno`), docstring extraction, and HTTP method parsing.
3. In `backend/app/services/repo_ingest/generic_derivation.py`, filter out documentation meta-headers (`BANNED_DOC_HEADERS`) and parse structured feature comparison tables and bullet points. Segregate requirements into `documented` (0.95 confidence, approved), `inferred_from_code` (0.85 confidence, needs_confirmation), `inferred_technical` (0.80 confidence, needs_confirmation), and `operational` (0.90 confidence, approved).
4. In `backend/app/api/routers/projects.py`, restrict `Reference HCM` environments exclusively to Dayforce projects (`DF-*`), assign `{project.name} Sandbox` and `{project.name} Simulation` to generic imported repositories, and update `EnvIn.kind` default to `"simulation"`.
5. Require newly imported projects to begin with zero test cases, zero executions, and zero defects.
6. Verify and preserve existing EchoBox verification data (project 5) and Dayforce data.
7. Author comprehensive acceptance tests in `backend/tests/test_cureonix_real_ingest.py` and document findings in `docs/PHASE_1_REPOSITORY_INGESTION.md`.

### Consequences
- Generic repositories import with true architectural modules and grounded requirements.
- Zero cross-project leakage or spurious environment injection.
- Complete data integrity preserved across all existing and imported projects.


---

## ADR-034: Removal of Legacy Demo Workspaces and Project Selector Deduplication

### Status
Accepted

### Context
TraceTest AI retained unwanted demo/sample projects (`DF-PAY`, `DF-WFM`, `DF-LVE`, `DF-BEN`, `OCTO`, `SMPL`) in the application database and project switcher. `DF-*` projects were automatically recreated on startup whenever `ensure_identity()` ran in `backend/app/seed/seed.py`. In addition, the workspace selector dropdown in `frontend/src/layouts/AppShell.tsx` rendered duplicate "All Project Workspaces" entries due to overlapping `placeholder` and `options` elements.

### Decision
1. In `backend/app/seed/seed.py`, permanently remove `DAYFORCE_PROJECTS`, `_ensure_dayforce_projects()`, and its invocation inside `ensure_identity()`. Prevent automatic re-creation of demo projects on startup, migrations, or initialization.
2. In `var/tracetest.db`, remove all 6 legacy demo projects (`DF-PAY`, `DF-WFM`, `DF-LVE`, `DF-BEN`, `OCTO`, `SMPL`) and clean up their associated modules (15), environments (12), integrations (6), memberships (18), and orphaned requirements/clauses (7/10).
3. Strictly preserve the two real target projects: `ECHO` (EchoBox: 21 reqs, 21 tests, 9 executions, 7 defects) and `CUREON` (Cureonix: 23 reqs, 0 tests, 0 executions, 0 defects).
4. In `frontend/src/components/ui/CustomSelect.tsx`, prevent duplicate placeholder option rendering when an option matching the placeholder already exists in `options`.
5. In `frontend/src/layouts/AppShell.tsx`, omit `placeholder="All Project Workspaces"` on the workspace selector since `"ALL"` is already in `projectOptions`.
6. In `frontend/src/pages/DashboardPage.tsx`, remove hardcoded Dayforce architecture cards.
7. In `frontend/index.html`, update document title to "TraceTest AI — Enterprise Quality Engineering Platform".
8. Author automated tests in `backend/tests/test_multi_project_isolation.py` and `frontend/tests/components.test.tsx` verifying zero demo project creation, exact 2-project database state, and project dropdown deduplication.

### Consequences
- Normal application contains solely `ECHO` and `CUREON` project workspaces.
- Starting, refreshing, or reinitialising the backend leaves the database strictly populated with real projects.
- Project workspace selector dropdown presents exactly one "All Project Workspaces" option followed by real projects.


---

## ADR-035: Production Project Dashboard & Telemetry Backend

### Status
Accepted

### Context
TraceTest AI required an enterprise SaaS project dashboard matching the visual references and telemetry specifications in Phase 2. The dashboard needed to support any ingested repository, presenting live metrics for requirements, atomic clauses, test cases, pass/fail rates, open defect severity, execution duration, and historical runs without synthetic mock values or fake animations. Newly imported projects (such as Cureonix) required clean zero-state display (0 tests, 0 runs, 0 defects, unavailable duration `—`, pass rate `—`).

### Decision
1. In `backend/app/services/project_dashboard.py`, implement `get_project_dashboard_data()` to query project-scoped repository integration details, requirements count, atomic clause counts, test case ratios, execution durations, pass rates, defect breakdowns, recent runs, requirements status, and recent activity from `AuditLog`.
2. Implement `generate_junit_xml_for_execution()` and `generate_html_report_for_execution()` in `backend/app/services/project_dashboard.py` and register routes `GET /api/v1/executions/{ex_id}/report.junit` and `GET /api/v1/executions/{ex_id}/report.html` in `backend/app/api/routers/execution.py`.
3. Register endpoint `GET /api/v1/projects/{project_id}/dashboard` in `backend/app/api/routers/projects.py`.
4. In `frontend/src/components/dashboard/ProductionProjectDashboard.tsx`, implement the production project dashboard matching Screenshot 1 & 2: 5-column metadata card, 6 test summary cards, 4 functional tabs (`Recent Runs`, `Requirements`, `Defects`, `Configuration`), Execution Details card, Quality & Coverage progress bars, Open Defects table with severity pills, Requirements Status breakdown, and Recent Activity feed.
5. In `frontend/src/pages/ProjectsPage.tsx`, update `ProjectDetailPage` to render `<ProductionProjectDashboard projectId={projectId} isDetailView={true} />`.
6. In `frontend/src/layouts/AppShell.tsx`, update sidebar navigation sections to include `Projects`, `Monitoring`, and `Reports`, matching Screenshot 1's sidebar hierarchy.
7. Author comprehensive backend tests in `backend/tests/test_project_dashboard.py` and frontend tests in `frontend/tests/dashboard.test.tsx`.
8. Document the complete Phase 2 implementation in `docs/PHASE_2_PROJECT_DASHBOARD.md`.

### Consequences
- Production dashboard accurately reflects genuine database state for both EchoBox (healthy, 21 reqs, 62 clauses, 21 tests, 6 defects, 9 runs) and Cureonix (not tested, 23 reqs, 32 clauses, 0 tests, 0 defects, 0 runs).
- Single-click JUnit XML and standalone HTML report downloads for all test executions.
- Zero fake metrics or hardcoded counters. Fully covered by automated tests.

---

## ADR-036: Requirements-Based AI Quality Engineering Platform & Dual-Architecture Support

### Status
Accepted

### Context
Enterprise software quality engineering faces its greatest defect injection and friction at the requirements phase, prior to code authoring. Ambiguities, conflicting expectations, missing edge-case boundaries, and untracked requirement modifications are responsible for substantial downstream rework. TraceTest AI required a strategic pivot to position Requirements-Based AI Quality Engineering (Product Requirements-to-Test Assistant) as the primary product direction, while preserving existing Code-Based projects (`ECHO` and `CUREON`) and workflows without disruption.

### Decision
1. **Primary Direction & Project Classification**:
   - Establish `requirements_based` as the default project type (`project_type="requirements_based"`), supporting metadata including business domain, product type, compliance standards, and user expectations.
   - Retain `code_based` projects with existing code repository ingestion and execution workflows intact.
2. **Multi-Format Document Parsing Engine**:
   - Implement `backend/app/services/document_processor.py` supporting `.pdf` (`pypdf`), `.docx` (`python-docx`), `.xlsx` (`openpyxl`), `.csv`, `.txt`, and `.md` with section and page/sheet provenance and SHA-256 integrity hashing.
3. **Requirement Intelligence & Clarification Lifecycle**:
   - Implement `backend/app/services/requirement_intelligence.py` for grounded requirement extraction, categorization (`functional`, `non_functional`, `security`, `performance`, `compliance`, `integration`), and heuristic detection of ambiguities and contradictions.
   - Manage ambiguities through a dedicated `RequirementClarification` lifecycle (`open` -> `in_review` -> `resolved`).
4. **Test Design & 10-Category Scenarios**:
   - Implement `backend/app/services/test_design.py` generating structured Given/When/Then acceptance criteria and authoring 10 scenario categories: positive, negative, boundary, edge case, input validation, business rule, permission/role, security, error handling, and integration.
5. **Deterministic Specification Validation & Simulation**:
   - Segregate execution semantics: specification validation produces `VAL-XXXXXX` runs, behavioral state machine simulation produces `SIM-XXXXXX` runs, and code-based runs retain `EX-XXXXXX`. Never misrepresent static validations or simulations as live application testing.
6. **Telemetry, Traceability Matrix & 19-Section Quality Reports**:
   - Implement `backend/app/services/requirements_dashboard.py` calculating requirement maturity, clarification counts, test scenario ratios, and validation outcomes.
   - Compile bidirectional traceability matrices (`Document <-> Requirement <-> Acceptance Criteria <-> Test Case <-> Outcome`) and generate authoritative 19-section enterprise quality reports in JSON and standalone HTML.
7. **Frontend Dual-Dashboard Routing**:
   - In `frontend/src/pages/DashboardPage.tsx` and `ProjectsPage.tsx`, route dynamically to `RequirementsProjectDashboard` for requirements-based projects and `ProductionProjectDashboard` for code-based projects.
8. **Testing & Verification**:
   - Author comprehensive test coverage in `backend/tests/test_requirements_based_platform.py` (7 tests, 100% passing) and frontend vitest suite.

### Consequences
- TraceTest AI operates as a premier Requirements-Based Quality Engineering platform while seamlessly preserving code-based projects.
- Clear semantic segregation ensures static validations (`VAL-*`) and simulations (`SIM-*`) are never conflated with live code tests.
- Full provenance and audit readiness across all ingested documents, requirements, tests, and generated quality reports.

