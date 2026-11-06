# Security Architecture & Credential Protection — TraceTest AI

## 1. Threat Model & Security Posture

TraceTest AI is designed to process untrusted natural language requirements, execute user-provided and AI-generated code, and interact with external cloud services. The architecture implements strict defense-in-depth boundaries to prevent prompt injection, remote code execution (RCE), privilege escalation, and credential exposure.

---

## 2. Credential Security & Secret Isolation

### Strict Credential Protections:
1. **Zero Secret Hardcoding**: API keys, session tokens, and passwords are never hardcoded in source files (`.py`, `.ts`, `.tsx`, `.json`, `.yaml`).
2. **Local Environment Boundary**: Credentials reside exclusively in `.env` (strictly excluded via `.gitignore`).
3. **Log Sanitization**: Full keys are never printed in console output, application logs, or database rows.
4. **Committed Placeholders Only**: `.env.example` provides structured placeholder documentation without secret values.

---

## 3. Subprocess Execution Sandbox Security

Executing Python test scripts safely requires multi-layered containment (`app/execution/sandbox.py`):

1. **AST Allowlist Enforcement**:
   - Every script is parsed with Python's `ast` module before execution.
   - Any access to `open`, `eval`, `exec`, `__import__`, `globals`, `locals`, `vars`, `breakpoint`, `os`, `sys`, or `subprocess` triggers immediate rejection.
2. **POSIX Resource Limits (`setrlimit`)**:
   - `RLIMIT_CPU` capped at 60s.
   - `RLIMIT_AS` capped at 512MB (preventing memory exhaustion attacks).
   - `RLIMIT_FSIZE` capped at 50MB (preventing disk filling attacks).
   - `RLIMIT_CORE` set to 0.
   - `RLIMIT_NOFILE` capped at 256.
3. **Network Namespace Isolation (`unshare -rn`)**:
   - On Linux hosts, executions run in a private network namespace where external interfaces are unconfigured and only loopback is present.
   - Guard `conftest.py` disables socket instantiation at the runtime layer.

---

## 4. Prompt Injection & AI Guardrails

When processing untrusted requirements:
1. **XML Boundary Encapsulation**: Requirements are enclosed within strict untrusted blocks (`<REQUIREMENT>...</REQUIREMENT>`).
2. **System Prompt Enforcement**: AI models are instructed to treat requirement content strictly as data to be parsed, never as instructions to follow.
3. **Deterministic Grounding**: Every acceptance criterion and test case must cite a verbatim source quote. If the quotation cannot be found in the cited clauses, the test is rejected.

---

## 5. Web & API Security

- **CORS Policies**: Explicit origin restrictions configured via `TRACETEST_CORS_ORIGINS`.
- **CSRF Tokens**: Double-submit cookie CSRF tokens for state-modifying requests.
- **Request Size Limiting**: 64KB body size cap enforced by middleware.
- **Rate Limiting**: Configured per client IP (default 600 requests/minute).
