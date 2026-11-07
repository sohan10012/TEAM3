# TraceTest AI — Engineering Operations & Production Manual

## 1. System Prerequisites

Before installing and running TraceTest AI, ensure your system meets the following prerequisites:

| Component | Minimum Version | Recommended Version | Purpose |
|---|---|---|---|
| **Operating System** | Linux (Ubuntu 20.04+) or macOS 12+ | Ubuntu 22.04 LTS / Debian 12 | Linux required for kernel namespace sandboxing (`bwrap`) |
| **Python** | 3.11.x | 3.11.16 or 3.12.x | Backend runtime, FastAPI, AST parsers |
| **Python Package Manager** | `pip` 23+ | `uv` 0.5+ | Fast dependency installation and virtual environment management |
| **Node.js** | 18.x LTS | Node.js 20.x or 22.x LTS | Frontend toolchain, Vite build runner |
| **npm** | 9.x | 10.x+ | Frontend package dependency manager |
| **Git** | 2.34+ | 2.40+ | Ingesting code repositories and version control |
| **SQLite** | 3.35+ | 3.40+ with WAL mode enabled | Embedded database storage |

---

## 2. Fresh-Clone Installation Guide

TraceTest AI can be completely installed and booted from a fresh repository clone in less than three minutes.

### Step 1: Clone the Repository
```bash
git clone https://github.com/sohan10012/TEAM3.git tracetest-ai
cd tracetest-ai
```

### Step 2: Configure Environment Variables
Copy the template configuration file to `.env`:
```bash
cp .env.example .env
```
*(The default configuration runs in deterministic mock mode out of the box with zero required external API keys).*

### Step 3: Set Up the Backend Environment
Create a Python virtual environment and install backend dependencies:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```
*(Alternatively, using `uv`: `uv venv && source .venv/bin/activate && uv pip install -r backend/requirements.txt`)*

### Step 4: Initialize the Database & Default Workspaces
Initialize the SQLite schema (all 44 tables) and seed the default projects:
```bash
PYTHONPATH=backend python3 -m app.db.init_db
```
**Verification**: You will see confirmation output showing successful creation of tables and automatic seeding of all four default projects:
- `ECHO` (EchoBox Code-Based serverless workspace)
- `CUREON` (Cureonix Code-Based healthcare workspace)
- `DAYFORCE` (Dayforce Requirements-Based HCM workspace)
- `WFMQ` (Workforce Management simulation workspace)

### Step 5: Install Frontend Dependencies & Build
In the repository root:
```bash
cd frontend
npm install
npm run build
cd ..
```

---

## 3. Starting the Application

Running TraceTest AI locally requires starting the FastAPI backend and Vite frontend development server in two separate terminals.

### Terminal 1: Backend API Server
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend Health Check**: Open `http://127.0.0.1:8000/api/v1/health`
- **Interactive OpenAPI Documentation**: Open `http://127.0.0.1:8000/api/docs`

> [!IMPORTANT]
> The backend binds strictly to `127.0.0.1` by architectural invariant. It will intentionally reject binding to `0.0.0.0` to protect local operator environments from unauthorized local network access.

### Terminal 2: Frontend Development Server
```bash
cd frontend
npm run dev
```
- **Application URL**: Navigate to `http://localhost:5173` in your browser.
- Use the **Project Selector** dropdown in the top header bar to switch freely between Dayforce, EchoBox, Cureonix, and WFMQ workspaces.

---

## 4. Environment Configuration Specification

All system settings are controlled through environment variables or the `.env` file in the repository root.

> [!IMPORTANT]
> **Secrets Hygiene Rules**:
> - Never commit `.env` or files containing plaintext credentials.
> - Secrets are referenced by variable name or provider slot index only (e.g. `groq-1`, `gemini-2`).
> - Local development accounts generate random per-install credentials stored only as Argon2 hashes in SQLite; one-time plaintext is output to `var/initial_credentials.txt` (file mode `0600`) and never logged or exposed in the UI.

### Complete Variable Reference

| Variable Name | Purpose | Required / Optional | Default Value | Where Read | Secret? |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `TRACETEST_ENV` | Application environment lifecycle mode (`development`, `test`, `production`). | Optional | `development` | `backend/app/core/config.py` | No |
| `TRACETEST_DATA_DIR` | Filesystem path for persistence (SQLite databases, test artifacts, uploads). | Optional | `./var` | `backend/app/core/config.py` | No |
| `TRACETEST_SECRET_KEY` | HMAC cryptographic signing key for operator session cookies. Auto-generated in dev. | Required in prod | Auto-generated (`var/.secret_key`) | `backend/app/core/config.py` | **Yes** |
| `TRACETEST_SESSION_HOURS` | Lifetime in hours for operator and API authentication sessions. | Optional | `12` | `backend/app/core/config.py` | No |
| `TRACETEST_COOKIE_SECURE` | Enforces `Secure` flag on session and CSRF cookies over HTTPS. | Optional | `false` | `backend/app/core/config.py` | No |
| `TRACETEST_CORS_ORIGINS` | Permitted Cross-Origin Resource Sharing (CORS) origins (comma-separated). | Optional | `http://localhost:5173` | `backend/app/core/config.py` | No |
| `TRACETEST_HOST` | Network interface binding host. Enforces loopback when single-operator is active. | Optional | `127.0.0.1` | `backend/app/core/config.py` | No |
| `TRACETEST_PORT` | HTTP server binding port. | Optional | `8000` | `backend/app/core/config.py` | No |
| `TRACETEST_ALLOWED_HOSTS` | Permitted HTTP Host headers to block DNS rebinding (comma-separated). | Optional | `localhost,127.0.0.1,[::1],testserver` | `backend/app/core/config.py` | No |
| `TRACETEST_REQUIRE_NETWORK_ISOLATION` | Enforces fail-closed bubblewrap/netns network isolation during test runs. | Optional | `true` | `backend/app/core/config.py` | No |
| `TRACETEST_ALLOW_WEAK_SANDBOX` | Explicit opt-in to allow non-isolated host execution when bubblewrap is absent. | Optional | `false` | `backend/app/core/config.py` | No |
| `TRACETEST_SEED_ON_STARTUP` | Automatically populates initial seed workspace dataset on application startup. | Optional | `false` | `backend/app/core/config.py` | No |
| `TRACETEST_RATE_LIMIT_PER_MINUTE` | Global incoming request rate limiting ceiling per client IP address. | Optional | `600` | `backend/app/core/config.py` | No |
| `TRACETEST_SINGLE_OPERATOR` | Enables local single-operator mode on loopback without login walls. | Optional | `true` | `backend/app/core/config.py` | No |
| `TRACETEST_DEV_EMAIL` | Identity email for the primary authoring engineer persona. | Optional | `dev@dayforce-qa.local` | `backend/app/core/config.py` | No |
| `TRACETEST_ADMIN_EMAIL` | Identity email for the platform administrator persona. | Optional | `admin@dayforce-qa.local` | `backend/app/core/config.py` | No |
| `TRACETEST_QA_EMAIL` | Identity email for senior QA automation specialist persona. | Optional | `qa.engineer@dayforce-qa.local` | `backend/app/core/config.py` | No |
| `TRACETEST_REVIEWER_EMAIL` | Identity email for the independent QA Lead / Reviewer persona. | Optional | `reviewer@dayforce-qa.local` | `backend/app/core/config.py` | No |
| `TRACETEST_LLM_MODE` | AI provider operational mode (`live` for real LLM APIs, `mock` for test fixtures). | Optional | `live` | `backend/app/core/config.py` | No |
| `TRACETEST_PRIMARY_PROVIDER` | Primary LLM provider for generation (`groq`, `gemini`, `ollama`, `mock`). | Optional | `groq` | `backend/app/core/config.py` | No |
| `TRACETEST_JUDGE_PROVIDER` | LLM-as-a-Judge provider for independent test evaluation (`gemini`, `groq`, `ollama`, `mock`). | Optional | `gemini` | `backend/app/core/config.py` | No |
| `TRACETEST_JUDGE_MODEL` | Model identifier used by the LLM Judge. | Optional | `gemini-2.5-flash` | `backend/app/core/config.py` | No |
| `GROQ_API_KEY` | Primary API credential for Groq provider (Slot 1). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GROQ_API_KEY2` | Secondary API credential for Groq provider (Slot 2). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GROQ_API_KEY3` | Tertiary API credential for Groq provider (Slot 3). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GROQ_MODEL` | Primary LLM model for Groq completions. | Optional | `openai/gpt-oss-120b` | `backend/app/core/config.py` | No |
| `GROQ_FALLBACK_MODEL` | Secondary fallback model for Groq when primary model rate limits are exhausted. | Optional | `openai/gpt-oss-20b` | `backend/app/core/config.py` | No |
| `GROQ_BASE_URL` | Base endpoint URL for Groq OpenAI-compatible API. | Optional | `https://api.groq.com/openai/v1` | `backend/app/core/config.py` | No |
| `GROQ_CONCURRENCY_PER_SLOT` | Maximum concurrent in-flight requests per Groq API key slot. | Optional | `2` | `backend/app/core/config.py` | No |
| `GEMINI_API_KEY` | Primary API credential for Google Gemini provider (Slot 1). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GEMINI_API_KEY2` | Secondary API credential for Google Gemini provider (Slot 2). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GEMINI_API_KEY3` | Tertiary API credential for Google Gemini provider (Slot 3). | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GEMINI_MODEL` | Primary LLM model for Google Gemini completions. | Optional | `gemini-2.5-flash` | `backend/app/core/config.py` | No |
| `GEMINI_FALLBACK_MODEL` | Secondary fallback model for Google Gemini when primary rate limits trigger. | Optional | `gemini-2.5-flash-lite` | `backend/app/core/config.py` | No |
| `OLLAMA_BASE_URL` | Base endpoint URL for local Ollama instances. | Optional | None | `backend/app/core/config.py` | No |
| `OLLAMA_MODEL` | Model identifier for local Ollama execution. | Optional | `llama3.1` | `backend/app/core/config.py` | No |
| `TRACETEST_LLM_TIMEOUT` | Timeout limit in seconds for external AI HTTP completions. | Optional | `60.0` | `backend/app/core/config.py` | No |
| `TRACETEST_LLM_MAX_RETRIES` | Maximum retry attempts per slot for transient network / 5xx failures. | Optional | `2` | `backend/app/core/config.py` | No |
| `TRACETEST_EXEC_TIMEOUT` | Hard process timeout in seconds for test suite execution in sandbox. | Optional | `60` | `backend/app/core/config.py` | No |
| `TRACETEST_EXEC_MEMORY_MB` | Memory cap (`RLIMIT_AS`) in megabytes for sandboxed child processes. | Optional | `512` | `backend/app/core/config.py` | No |
| `TRACETEST_EXEC_MAX_OUTPUT` | Maximum captured output size (`RLIMIT_FSIZE`) in bytes for execution logs. | Optional | `256000` | `backend/app/core/config.py` | No |
| `TRACETEST_PLAYWRIGHT_TARGET_URL` | Base target URL for Playwright end-to-end browser execution runs. | Optional | None | `backend/app/core/config.py` | No |
| `TRACETEST_CHROMIUM_EXECUTABLE` | Absolute path to Chromium binary executable. | Optional | `/usr/bin/chromium` | `backend/app/core/config.py` | No |
| `GITHUB_TOKEN` | Personal Access Token for private repository cloning via git askpass helper. | Optional | None | `backend/app/core/config.py` | **Yes** |
| `GITHUB_API_URL` | Root API URL for GitHub repository metadata lookups. | Optional | `https://api.github.com` | `backend/app/core/config.py` | No |
| `TRACETEST_CI_TOKEN` | Bearer token for authenticating CI test result ingestion endpoints. | Optional | None | `backend/app/api/routers/misc.py` | **Yes** |
| `TRACETEST_URL` | Target TraceTest server base URL used by CI reporting scripts. | Optional | `http://127.0.0.1:8000` | `scripts/ci_report.py` | No |

---

## 5. Verification & Test Execution Suite

Every pull request and release is verified through automated test suites:

```bash
# 1. Complete Backend Test Suite (216 tests)
cd backend
pytest -v

# 2. Playwright End-to-End Headless Browser Suite (4 tests)
# (Requires frontend/dist built via npm run build)
pytest tests/test_playwright_e2e.py -v

# 3. Frontend Component & Integration Suite (21 tests)
cd ../frontend
npm test

# 4. Frontend TypeScript Static Typecheck
npm run typecheck

# 5. Frontend Production Bundle Compilation
npm run build

# 6. Backend Code Formatting & Linters
cd ../backend
ruff check app tests
mypy app

# 7. Documentation Invariants, Link Resolution & Schema Audit (8 stages)
cd ..
python3 scripts/verify_docs.py
```

---

## 6. Production Deployment & Hardening

### 6.1 Systemd Service Unit (`/etc/systemd/system/tracetest.service`)
```ini
[Unit]
Description=TraceTest AI Backend Daemon
After=network.target

[Service]
Type=simple
User=tracetest
Group=tracetest
WorkingDirectory=/opt/tracetest-ai/backend
Environment="PATH=/opt/tracetest-ai/backend/.venv/bin"
EnvironmentFile=/opt/tracetest-ai/.env
ExecStart=/opt/tracetest-ai/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 6.2 Reverse Proxy Configuration (Nginx)
In production, place Nginx in front of TraceTest to terminate TLS while preserving loopback communication:

```nginx
server {
    listen 443 ssl http2;
    server_name tracetest.internal.company.com;

    ssl_certificate /etc/ssl/certs/tracetest.crt;
    ssl_certificate_key /etc/ssl/private/tracetest.key;

    # Serve compiled static frontend
    location / {
        root /opt/tracetest-ai/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to loopback FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6.3 Automated Database Backups
SQLite Write-Ahead Logging allows online non-blocking backups:
```bash
# Trigger hot backup via authenticated API
curl -X POST http://127.0.0.1:8000/api/v1/admin/backup \
     -H "Authorization: Bearer <TRACETEST_CI_TOKEN>"
```
Snapshots are placed into `var/backups/tracetest_backup_<timestamp>.db`.

---

## 7. Security Architecture & Controls

TraceTest AI implements defense-in-depth security:

1. **Loopback Binding Invariant**: The service binds to `127.0.0.1` by design, eliminating open listening ports on multi-user or shared cloud workstations.
2. **POSIX Subprocess Resource Ceilings**:
   - `RLIMIT_CPU`: Maximum 30 seconds CPU time.
   - `RLIMIT_AS`: Maximum 512 MB virtual memory.
   - `RLIMIT_NOFILE`: Maximum 256 open file descriptors.
   - `RLIMIT_NPROC`: Maximum 64 child processes.
   - `RLIMIT_FSIZE`: Maximum 10 MB file output.
3. **AST Allowlist Pre-Execution Gate**:
   Every Python test script is statically analyzed. Scripts attempting to call `eval()`, `exec()`, `open()`, or import `os`, `sys`, `subprocess`, `socket`, or `shutil` are rejected before execution.
4. **Git Askpass Credential Isolation**:
   When cloning remote repositories, credentials are provided via a temporary executable `GIT_ASKPASS` script rather than embedding tokens into git command lines or remote URLs.
5. **Zero Credential Leakage Invariant**:
   Automated verification scans all markdown documents, scripts, and logs for leaked API keys (`gsk_*`, `AIza*`, private keys) before allowing release commits.

---

## 8. GitHub Integration Setup

To connect a remote GitHub repository to TraceTest AI:

1. Navigate to **Projects** $\rightarrow$ **Connect GitHub Repository** (or use the Dashboard quick action).
2. Enter the HTTPS URL: `https://github.com/owner/repository`.
3. Provide an optional **GitHub Personal Access Token** (PAT) with `repo` scope for private repositories.
4. Click **Inspect & Connect Repository**:
   - TraceTest AI validates the URL against SSRF and command injection.
   - Discovers available remote branches.
   - Clones the branch and parses code AST (endpoints, models, actions).
   - Generates initial requirements and creates a dedicated, isolated project workspace.

---

## 9. Troubleshooting & Operational FAQ

### Q1: "OperationalError: database is locked"
- **Cause**: A concurrent SQLite write took longer than the configured timeout.
- **Solution**: SQLite WAL mode is configured with `PRAGMA busy_timeout=5000;`. Ensure you are not running long external maintenance locks on `var/tracetest.db`. To clear stale journal locks:
  ```bash
  python3 scripts/db.py checkpoint
  ```

### Q2: "Playwright timeout waiting for #root"
- **Cause**: `test_playwright_e2e.py` spins up a live server serving `frontend/dist`. If `frontend/dist` has not been compiled, the HTML file cannot load React.
- **Solution**: Compile the frontend bundle:
  ```bash
  cd frontend && npm run build
  ```

### Q3: "Vite port 5173 is already in use"
- **Cause**: A previous dev server instance was left running in the background.
- **Solution**: Terminate the existing process:
  ```bash
  fuser -k 5173/tcp || kill $(lsof -t -i:5173)
  ```

### Q4: "Missing API keys when generating tests"
- **Cause**: Neither `GROQ_API_KEY` nor `GEMINI_API_KEY` is present in `.env`.
- **Solution**: TraceTest AI automatically falls back to deterministic local fixtures (`TRACETEST_LLM_MODE=mock`), generating valid statutory tests with zero API keys. To use live LLMs, add your API keys to `.env` and set `TRACETEST_LLM_MODE=live`.

---

## 10. Operational Boundaries & Known Limitations

- **Process Sandbox Platform**: Kernel namespace isolation (`bwrap`) is supported on Linux kernels 5.4+. macOS and Windows WSL fall back to POSIX `setrlimit` resource capping.
- **SQLite Concurrency**: Designed for teams up to 25 concurrent operators. Multi-region enterprise deployments with thousands of concurrent test executions should configure external PostgreSQL.
- **Static AST Extraction**: Dynamic Python metaprogramming (e.g. dynamically generated routes via `setattr`) is not discoverable through static AST parsing and should be defined via Requirements Intake documents.
