"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from app.api.routers import auth, defects, documents, execution, misc, projects, requirements, simulation, tests, users
from app.core.config import get_settings
from app.core.errors import install_handlers
from app.services.audit import current_trace_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.config import get_settings
    get_settings().validate_security_invariants()
    from app.db.init_db import initialise
    initialise()
    yield



app = FastAPI(title="TraceTest AI", version="1.0.0", lifespan=lifespan,
              description="Enterprise QA lifecycle and test intelligence platform API.",
              openapi_url="/api/v1/openapi.json", docs_url="/api/docs", redoc_url=None)
install_handlers(app)
settings = get_settings()
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Trace-Id"])

_buckets: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


@app.middleware("http")
async def platform_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or uuid.uuid4().hex[:16]
    request.state.trace_id = trace_id
    token = current_trace_id.set(trace_id)
    try:
        # 0. Payload size limit (10MB max) to mitigate unbounded payload memory exhaustion
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > 10 * 1024 * 1024:
                    return JSONResponse(
                        status_code=413,
                        content={"error": {
                            "code": "payload_too_large",
                            "message": "Request payload exceeds 10MB limit",
                            "details": None,
                            "trace_id": trace_id,
                        }},
                    )
            except ValueError:
                pass

        # 1. Host header validation to prevent DNS rebinding attacks
        raw_host = request.headers.get("host", "").strip()
        if raw_host:
            if raw_host.startswith("["):
                host_name = raw_host.split("]")[0] + "]"
            else:
                host_name = raw_host.split(":")[0]
            s = get_settings()
            allowed = {h.strip().lower() for h in s.allowed_hosts.split(",") if h.strip()}
            allowed |= {"localhost", "127.0.0.1", "[::1]", "::1", "testserver"}
            if host_name.lower() not in allowed:
                return JSONResponse(
                    status_code=400,
                    content={"error": {
                        "code": "invalid_host",
                        "message": f"Host '{host_name}' is not allowed",
                        "details": None,
                        "trace_id": trace_id,
                    }},
                )

        # 2. Origin validation on state-changing requests (defeats CSRF / cross-site requests)
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            if origin:
                clean_origin = origin.strip().rstrip("/").lower()
                s = get_settings()
                allowed_origins = {o.strip().rstrip("/").lower() for o in s.cors_origins.split(",") if o.strip()}
                server_origin = f"{request.url.scheme}://{request.url.netloc}".rstrip("/").lower()
                allowed_origins |= {
                    server_origin,
                    "http://localhost:5173", "http://127.0.0.1:5173",
                    "http://localhost:8000", "http://127.0.0.1:8000",
                    "http://testserver", "https://testserver"
                }
                if clean_origin not in allowed_origins:
                    return JSONResponse(
                        status_code=403,
                        content={"error": {
                            "code": "cross_origin_rejected",
                            "message": f"Cross-origin request from '{origin}' rejected",
                            "details": None,
                            "trace_id": trace_id,
                        }},
                    )

        if request.url.path.startswith("/api/") and not request.url.path.endswith("/events"):
            ident = request.cookies.get("tt_session") or (request.client.host if request.client else "anon")
            limit = get_settings().rate_limit_per_minute
            now = time.monotonic()
            with _lock:
                q = _buckets[ident]
                while q and now - q[0] > 60:
                    q.popleft()
                if len(q) >= limit:
                    return JSONResponse(status_code=429, content={"error": {
                        "code": "rate_limited", "message": "Too many requests", "details": None, "trace_id": trace_id}})
                q.append(now)
        response = await call_next(request)
    finally:
        current_trace_id.reset(token)
    response.headers["X-Trace-Id"] = trace_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none';"
    )
    return response


api = APIRouter(prefix="/api/v1")
for r in (auth.router, users.router, projects.router, documents.router, requirements.router, tests.router,
          execution.router, defects.router, misc.router, simulation.router):
    api.include_router(r)
app.include_router(api)

_dist_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist_dir.exists():
    _assets_dir = _dist_dir / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": "Not found"}})
        target = _dist_dir / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(_dist_dir / "index.html")
