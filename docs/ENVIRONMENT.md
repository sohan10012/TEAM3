# TraceTest AI — Environment Configuration Specification

This authoritative document details all environment variables recognized across TraceTest AI (FastAPI backend, execution sandbox, AI routing pool, CI scripts, and CLI helpers).

> [!IMPORTANT]
> **Secrets Hygiene Rules**:
> - Never commit `.env` or files containing plaintext credentials.
> - Secrets are referenced by variable name or provider slot index only (e.g. `groq-1`, `gemini-2`).
> - Local development accounts generate random per-install credentials stored only as Argon2 hashes in SQLite; one-time plaintext is output to `var/initial_credentials.txt` (file mode `0600`) and never logged or exposed in the UI.

---

## Authoritative Variable Reference

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

## Dual-Control Identity Switching in Single-Operator Mode

To facilitate evaluation and live demonstration of the four-eyes approval policy (`requester_id != reviewer_id`) without requiring manual login screens:
1. The platform initializes with **Alex Kowalski** (`dev@dayforce-qa.local`) as the default Operator persona.
2. A second persona, **Riley Chen** (`reviewer@dayforce-qa.local`, QA Lead), is seeded in SQLite with independent credentials stored in `var/initial_credentials.txt`.
3. An identity toggle in the header (`POST /api/v1/auth/switch-operator`) switches the active session between `operator` and `reviewer`.
4. When acting as `operator`, approving tests authored by the operator is blocked with `403 Forbidden: Authors cannot approve their own tests`.
5. Toggling to `reviewer` updates the active session to Riley Chen, allowing compliant dual-control test approvals.
