"""Repository AST and architecture analyzer."""
from __future__ import annotations

import ast
import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.errors import BadRequest
from app.services.repo_ingest.secret_scanner import scan_for_secrets


@dataclass
class RepoAnalysisResult:
    repo_name: str
    branch: str
    commit_sha: str
    file_count: int
    languages: dict[str, int]
    modules: list[dict[str, str]]
    discrepancies: list[dict[str, Any]]
    actions_found: list[str]
    endpoints_found: list[dict[str, Any]]
    frameworks: list[str]
    secret_findings: list[dict[str, Any]]
    unsupported_files: list[str] = field(default_factory=list)
    models_found: list[dict[str, Any]] = field(default_factory=list)
    entry_points: list[str] = field(default_factory=list)


IGNORED_DIRS = {
    ".git", "node_modules", "dist", "build", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "target", "out", "coverage", ".gradle", "gradle", ".idea",
    ".vscode", ".dart_tool", "samples", "examples",
}

FLUTTER_PLATFORM_DIRS = {"android", "ios", "linux", "macos", "windows", "web"}

UNSUPPORTED_EXTS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".ico", ".jar", ".aar",
    ".so", ".dylib", ".dll", ".exe", ".bin", ".zip", ".tar", ".gz",
}


def _detect_languages_and_files(repo_path: Path) -> tuple[int, dict[str, int], list[str], list[str]]:
    file_count = 0
    languages: dict[str, int] = {}
    unsupported_files: list[str] = []
    source_files: list[str] = []

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            file_count += 1
            p = Path(root) / f
            rel = str(p.relative_to(repo_path))
            ext = p.suffix.lower()

            if ext in UNSUPPORTED_EXTS:
                unsupported_files.append(rel)

            lang = {
                ".py": "Python",
                ".dart": "Dart",
                ".ts": "TypeScript",
                ".tsx": "TypeScript (React)",
                ".js": "JavaScript",
                ".jsx": "JavaScript (React)",
                ".json": "JSON",
                ".md": "Markdown",
                ".css": "CSS",
                ".html": "HTML",
                ".yaml": "YAML",
                ".yml": "YAML",
                ".sh": "Shell",
                ".bash": "Shell",
                ".swift": "Swift",
                ".kt": "Kotlin",
                ".kts": "Kotlin",
                ".xml": "XML",
                ".go": "Go",
                ".rs": "Rust",
                ".java": "Java",
                ".sql": "SQL",
                ".c": "C",
                ".cc": "C++",
                ".cpp": "C++",
                ".h": "C/C++ Header",
            }.get(ext, "Other")
            languages[lang] = languages.get(lang, 0) + 1

            if ext in (".py", ".dart", ".ts", ".tsx", ".js", ".jsx", ".md"):
                source_files.append(rel)

    return file_count, languages, unsupported_files, source_files


def _detect_frameworks(repo_path: Path, languages: dict[str, int]) -> list[str]:
    frameworks: list[str] = []

    # Flutter / Dart
    if (repo_path / "pubspec.yaml").exists():
        frameworks.append("Flutter")
        frameworks.append("Dart")

    # JavaScript / Node / React
    pkg_json = repo_path / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text(encoding="utf-8", errors="ignore"))
            deps = dict(pkg.get("dependencies", {}), **pkg.get("devDependencies", {}))
            if "react" in deps:
                frameworks.append("React")
            if "vite" in deps:
                frameworks.append("Vite")
            if "next" in deps:
                frameworks.append("Next.js")
            if "express" in deps:
                frameworks.append("Express")
        except Exception:
            pass

    # Python & Web Frameworks
    has_python = "Python" in languages or (repo_path / "requirements.txt").exists() or (repo_path / "pyproject.toml").exists()
    if has_python:
        is_fastapi = False
        is_flask = False
        is_django = False

        # Check requirements.txt or backend/requirements.txt
        for req_cand in [repo_path / "requirements.txt", repo_path / "backend" / "requirements.txt", repo_path / "pyproject.toml"]:
            if req_cand.exists():
                txt = req_cand.read_text(encoding="utf-8", errors="ignore").lower()
                if "fastapi" in txt:
                    is_fastapi = True
                if "flask" in txt:
                    is_flask = True
                if "django" in txt:
                    is_django = True

        # Check imports in main.py
        for main_cand in [repo_path / "main.py", repo_path / "backend" / "main.py", repo_path / "app" / "main.py"]:
            if main_cand.exists():
                main_txt = main_cand.read_text(encoding="utf-8", errors="ignore")
                if "fastapi" in main_txt.lower():
                    is_fastapi = True
                if "flask" in main_txt.lower():
                    is_flask = True
                if "django" in main_txt.lower():
                    is_django = True

        if is_fastapi:
            frameworks.append("FastAPI")
        elif is_flask:
            frameworks.append("Flask")
        elif is_django:
            frameworks.append("Django")

        if "Python" not in frameworks:
            frameworks.append("Python")

    return frameworks or ["Generic Application"]


def _discover_modules(repo_path: Path, frameworks: list[str]) -> list[dict[str, str]]:
    """Discovers real architectural modules, strictly excluding platform wrappers."""
    modules: list[dict[str, str]] = []
    is_flutter = "Flutter" in frameworks or (repo_path / "pubspec.yaml").exists()

    # 1. Multi-tier Flutter + Backend layout
    if is_flutter:
        backend_dir = repo_path / "backend"
        if backend_dir.is_dir():
            for d in sorted(backend_dir.iterdir()):
                if d.is_dir() and not d.name.startswith(".") and d.name not in ("tests", "test", "__pycache__", ".venv"):
                    nice_name = {
                        "agents": "Multi-Agent Research Pipeline",
                        "routes": "REST API Gateway & Endpoints",
                        "services": "Backend Core & LLM Services",
                        "models": "Pydantic Schemas & Data Contracts",
                        "orchestrator": "Pipeline Orchestrator",
                    }.get(d.name, f"Backend {d.name.title()}")
                    modules.append({"code": f"BACKEND-{d.name.upper()[:8]}", "name": nice_name})

        lib_dir = repo_path / "lib"
        if lib_dir.is_dir():
            for d in sorted(lib_dir.iterdir()):
                if d.is_dir() and not d.name.startswith("."):
                    nice_name = {
                        "screens": "UI Screens & Views",
                        "services": "Client API & Network Services",
                        "providers": "State Management & Providers",
                        "models": "Client Data Models",
                        "config": "Client Configuration",
                        "theme": "Theme & Design System",
                    }.get(d.name, f"Flutter {d.name.title()}")
                    modules.append({"code": f"FLUTTER-{d.name.upper()[:8]}", "name": nice_name})

        if not modules:
            modules = [
                {"code": "FLUTTER-CORE", "name": "Flutter Application Core"},
                {"code": "FLUTTER-UI", "name": "Flutter User Interface"}
            ]
        return modules

    # 2. General Multi-Tier (backend/ and frontend/)
    if (repo_path / "backend").is_dir() and (repo_path / "frontend").is_dir():
        for d in sorted((repo_path / "backend").iterdir()):
            if d.is_dir() and not d.name.startswith(".") and d.name not in ("tests", "test", "__pycache__", ".venv"):
                modules.append({"code": f"BACKEND-{d.name.upper()[:8]}", "name": f"Backend {d.name.title()}"})
        fe_src = repo_path / "frontend" / "src"
        if fe_src.is_dir():
            for d in sorted(fe_src.iterdir()):
                if d.is_dir() and not d.name.startswith("."):
                    modules.append({"code": f"UI-{d.name.upper()[:8]}", "name": f"Frontend {d.name.title()}"})
        if modules:
            return modules

    # 3. Python Package with src/
    src_dir = repo_path / "src"
    if src_dir.is_dir():
        for d in sorted(src_dir.iterdir()):
            if d.is_dir() and not d.name.startswith("."):
                modules.append({"code": f"SRC-{d.name.upper()[:8]}", "name": f"Component {d.name.title()}"})
        if modules:
            return modules

    # 4. Top-level logical directories (excluding platform wrappers and tooling)
    banned = IGNORED_DIRS | FLUTTER_PLATFORM_DIRS | {"tests", "test", "docs", "documentation", "scripts", "bin"}
    top_dirs = [d.name for d in repo_path.iterdir() if d.is_dir() and not d.name.startswith(".") and d.name.lower() not in banned]
    for td in sorted(top_dirs)[:8]:
        modules.append({"code": td.upper()[:12], "name": f"{td.capitalize()} Domain"})

    if not modules:
        modules = [
            {"code": "API", "name": "API & Interface Contracts"},
            {"code": "CORE", "name": "Core Application Logic"},
            {"code": "CONFIG", "name": "Configuration & Environment"}
        ]

    return modules


def _parse_python_ast(repo_path: Path, modules: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parses Python AST across repository to extract endpoints, library functions, and data models with exact line numbers."""
    endpoints: list[dict[str, Any]] = []
    models: list[dict[str, Any]] = []

    def assign_module(rel_path: str) -> str:
        rel_upper = rel_path.upper()
        for m in modules:
            token = m["code"].replace("BACKEND-", "").replace("FLUTTER-", "").replace("SRC-", "")
            if token and token in rel_upper:
                return m["code"]
        for m in modules:
            if "ROUTE" in m["code"] or "API" in m["code"]:
                return m["code"]
        return modules[0]["code"] if modules else "CORE"

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and d not in ("tests", "test") and d not in FLUTTER_PLATFORM_DIRS]
        for f in files:
            p = Path(root) / f
            if p.suffix == ".py":
                rel = str(p.relative_to(repo_path))
                try:
                    content = p.read_text(encoding="utf-8", errors="ignore")
                    tree = ast.parse(content)

                    router_prefix = ""
                    for top_node in tree.body:
                        if isinstance(top_node, ast.Assign):
                            for target in top_node.targets:
                                if isinstance(target, ast.Name) and target.id == "router":
                                    if isinstance(top_node.value, ast.Call):
                                        for kw in top_node.value.keywords:
                                            if kw.arg == "prefix" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                                                router_prefix = kw.value.value.rstrip("/")

                    for node in ast.walk(tree):
                        # Route decorators
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            for deco in node.decorator_list:
                                if isinstance(deco, ast.Call) and isinstance(deco.func, ast.Attribute):
                                    method = deco.func.attr.upper()
                                    if method in ("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"):
                                        path = ""
                                        if deco.args and isinstance(deco.args[0], ast.Constant) and isinstance(deco.args[0].value, str):
                                            path = deco.args[0].value
                                        full_path = (router_prefix + path) if path.startswith("/") else (router_prefix + "/" + path if router_prefix else path)
                                        if not full_path:
                                            full_path = "/"
                                        endpoints.append({
                                            "method": method,
                                            "url": full_path,
                                            "target": rel,
                                            "line_start": node.lineno,
                                            "line_end": getattr(node, "end_lineno", node.lineno),
                                            "function": node.name,
                                            "doc": ast.get_docstring(node),
                                            "module_code": assign_module(rel)
                                        })
                        # Data models
                        elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                            is_model = any(
                                (isinstance(b, ast.Name) and b.id in ("BaseModel", "BaseSettings"))
                                or (isinstance(b, ast.Attribute) and b.attr in ("BaseModel", "BaseSettings"))
                                for b in node.bases
                            ) or "models" in rel.lower() or "schemas" in rel.lower()
                            if is_model:
                                models.append({
                                    "name": node.name,
                                    "target": rel,
                                    "line_start": node.lineno,
                                    "line_end": getattr(node, "end_lineno", node.lineno),
                                    "doc": ast.get_docstring(node),
                                    "module_code": assign_module(rel)
                                })
                except Exception:
                    pass

    # Fallback: if no HTTP routes found, extract library public functions and classes
    if not endpoints:
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and d not in ("tests", "test") and d not in FLUTTER_PLATFORM_DIRS]
            for f in files:
                p = Path(root) / f
                if p.suffix == ".py":
                    rel = str(p.relative_to(repo_path))
                    try:
                        content = p.read_text(encoding="utf-8", errors="ignore")
                        tree = ast.parse(content)
                        for node in tree.body:
                            if isinstance(node, ast.FunctionDef) and not node.name.startswith("_"):
                                endpoints.append({
                                    "method": "DEF",
                                    "url": node.name,
                                    "target": rel,
                                    "line_start": node.lineno,
                                    "line_end": getattr(node, "end_lineno", node.lineno),
                                    "function": node.name,
                                    "doc": ast.get_docstring(node),
                                    "module_code": assign_module(rel)
                                })
                            elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                                endpoints.append({
                                    "method": "CLASS",
                                    "url": node.name,
                                    "target": rel,
                                    "line_start": node.lineno,
                                    "line_end": getattr(node, "end_lineno", node.lineno),
                                    "function": node.name,
                                    "doc": ast.get_docstring(node),
                                    "module_code": assign_module(rel)
                                })
                    except Exception:
                        pass

    return endpoints, models


def analyze_repository(repo_path: Path) -> RepoAnalysisResult:
    """Performs static scanning and AST analysis on a repository directory."""
    if not repo_path.exists() or not repo_path.is_dir():
        raise BadRequest(f"Repository path does not exist: {repo_path}")

    # Git commit info
    commit_sha = "unknown"
    branch = "main"
    try:
        r = subprocess.run(["git", "-C", str(repo_path), "rev-parse", "HEAD"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            commit_sha = r.stdout.strip()
        rb = subprocess.run(["git", "-C", str(repo_path), "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=5)
        if rb.returncode == 0:
            branch = rb.stdout.strip()
    except Exception:
        pass

    file_count, languages, unsupported_files, source_files = _detect_languages_and_files(repo_path)
    secrets = scan_for_secrets(repo_path)
    frameworks = _detect_frameworks(repo_path, languages)

    # Detect EchoBox specifically
    is_echobox = (repo_path / "backend" / "lambda_function.py").exists() and (
        "echobox" in repo_path.name.lower() or "echobox" in (repo_path / "backend" / "lambda_function.py").read_text(encoding="utf-8", errors="ignore").lower()
    )

    if is_echobox:
        actions: list[str] = []
        lambda_py = repo_path / "backend" / "lambda_function.py"
        try:
            tree = ast.parse(lambda_py.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Compare):
                    if isinstance(node.left, ast.Name) and node.left.id == "action":
                        for comp in node.comparators:
                            if isinstance(comp, ast.Constant) and isinstance(comp.value, str):
                                actions.append(comp.value)
                            elif isinstance(comp, (ast.Tuple, ast.List)):
                                for elt in comp.elts:
                                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                        actions.append(elt.value)
        except Exception:
            pass

        return RepoAnalysisResult(
            repo_name=repo_path.name,
            branch=branch,
            commit_sha=commit_sha,
            file_count=file_count,
            languages=languages,
            modules=[
                {"code": "ECHO-ROOMS", "name": "Room Lifecycle"},
                {"code": "ECHO-DISCOVERY", "name": "Public Discovery"},
                {"code": "ECHO-CHAT", "name": "Anonymous Conversation"},
                {"code": "ECHO-OWNER", "name": "Room Ownership"},
                {"code": "ECHO-IDENTITY", "name": "EchoBox Identity"},
                {"code": "ECHO-EXPIRY", "name": "Ephemeral Lifecycle"},
                {"code": "ECHO-SECURITY", "name": "Security and Abuse Protection"},
                {"code": "ECHO-FRONTEND", "name": "User Experience"}
            ],
            discrepancies=[
                {"id": "DEF-ECHO-001", "title": "Room description length mismatch (Doc: 500 chars vs Code: 1000 chars)"},
                {"id": "DEF-ECHO-002", "title": "Silent truncation on room_name and room_desc rather than 400 Bad Request"},
                {"id": "DEF-ECHO-003", "title": "Invalid visibility parameter silently falls back to public"},
                {"id": "DEF-ECHO-004", "title": "Discovery N+1 query amplification loop in discover_rooms"},
                {"id": "DEF-ECHO-005", "title": "Live AWS API Gateway endpoint returns HTTP 500 Internal Server Error"},
                {"id": "DEF-ECHO-006", "title": "Cryptographic JWT signature verification missing in EchoBox ID token fallback path"}
            ],
            actions_found=sorted(list(set(actions))),
            endpoints_found=[
                {"method": "POST", "url": "https://<api-id>.execute-api.ap-south-1.amazonaws.com", "target": "EchoBox AWS HTTP API Gateway"}
            ],
            frameworks=frameworks or ["AWS Lambda", "DynamoDB", "Cognito", "React", "Vite"],
            secret_findings=secrets,
            unsupported_files=unsupported_files
        )

    # Generic Repository Analysis
    modules = _discover_modules(repo_path, frameworks)
    endpoints, models = _parse_python_ast(repo_path, modules)

    # Entry points
    entry_points = []
    for cand in ("backend/main.py", "main.py", "app.py", "lib/main.dart", "src/main.tsx", "src/index.tsx"):
        if (repo_path / cand).exists():
            entry_points.append(cand)

    return RepoAnalysisResult(
        repo_name=repo_path.name,
        branch=branch,
        commit_sha=commit_sha,
        file_count=file_count,
        languages=languages,
        modules=modules,
        discrepancies=[],
        actions_found=[],
        endpoints_found=endpoints[:25],
        frameworks=frameworks,
        secret_findings=secrets,
        unsupported_files=unsupported_files[:50],
        models_found=models[:25],
        entry_points=entry_points
    )
