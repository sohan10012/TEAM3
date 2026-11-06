"""Restricted subprocess execution of approved pytest scripts.

Defence in depth:
  1. Scripts must pass the AST allowlist (app.guardrails.ast_validator) — rechecked here.
  2. Each run gets a fresh temporary directory containing only the scripts, a copy of the
     Reference HCM public package and a guard conftest.
  3. The child runs with an empty environment (only REFERENCE_HCM_VERSION and a minimal PATH),
     Python isolated mode (-I), no bytecode writes and no pytest cache.
  4. POSIX resource limits: address space, CPU seconds, open files, max file size, no core dumps.
  5. Network: the guard conftest disables socket creation; on Linux the child is additionally
     placed in a new network namespace when `unshare` is permitted.
  6. Hard wall-clock timeout (process group is killed) and an output-size cap.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import REPO_ROOT, get_settings
from app.guardrails.ast_validator import validate_script

GUARD_CONFTEST = '''
import socket as _socket

class _BlockedSocket(_socket.socket):
    def __init__(self, *a, **k):
        raise RuntimeError("Network access is disabled in the TraceTest sandbox")

def _blocked(*a, **k):
    raise RuntimeError("Network access is disabled in the TraceTest sandbox")

_socket.socket = _BlockedSocket
_socket.create_connection = _blocked
_socket.getaddrinfo = _blocked
'''

PLAYWRIGHT_CONFTEST = '''
import os, pytest
from playwright.sync_api import sync_playwright

TARGET_URL = os.environ.get("TRACETEST_TARGET_URL", "")
ART = os.environ.get("TRACETEST_ARTIFACT_DIR", ".")

@pytest.fixture
def base_url():
    return TARGET_URL

@pytest.fixture
def page(request):
    with sync_playwright() as p:
        exe = os.environ.get("TRACETEST_CHROMIUM_EXECUTABLE") or None
        browser = p.chromium.launch(executable_path=exe)
        pg = browser.new_page()
        logs = []
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        yield pg
        name = request.node.nodeid.split("::")[0].replace("/", "_").replace(".py", "")
        pg.screenshot(path=os.path.join(ART, name + ".png"))
        with open(os.path.join(ART, name + ".console.log"), "w") as fh:
            fh.write("\\n".join(logs))
        browser.close()
'''


@dataclass
class ScriptSpec:
    test_key: str
    script: str

    @property
    def file_name(self) -> str:
        return "test_" + self.test_key.replace("-", "_").lower() + ".py"

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.script.encode()).hexdigest()


@dataclass
class TestOutcome:
    test_key: str
    status: str  # passed|failed|error|skipped|timed_out|cancelled
    duration_ms: int = 0
    message: str = ""
    stack_trace: str = ""
    stdout: str = ""
    functions: int = 0


@dataclass
class SandboxResult:
    status: str  # completed | timed_out | error
    outcomes: dict[str, TestOutcome] = field(default_factory=dict)
    duration_ms: int = 0
    log: str = ""
    junit_xml: str = ""
    returncode: int | None = None
    network_namespace: bool = False
    artifact_files: list[Path] = field(default_factory=list)
    isolation_level: str = "none"


@dataclass
class SandboxedProbeResult:
    status: str  # passed | failed | error | timed_out
    stdout: str = ""
    stderr: str = ""
    error_message: str | None = None
    duration_ms: int = 0
    isolation_level: str = "none"


def _limits(memory_mb: int | None, cpu_seconds: int, is_bwrap: bool = False):
    def apply() -> None:  # runs in the child (POSIX only)
        if hasattr(os, "setsid"):
            os.setsid()
        try:
            import resource
            limits = [(getattr(resource, "RLIMIT_CPU", 0), cpu_seconds),
                      (getattr(resource, "RLIMIT_FSIZE", 0), 50 * 1024 * 1024),
                      (getattr(resource, "RLIMIT_CORE", 0), 0)]
            if not is_bwrap and hasattr(resource, "RLIMIT_NPROC"):
                # Block fork bombs by capping max concurrent processes per user (skipped under bwrap which unshares PID namespace)
                limits.append((resource.RLIMIT_NPROC, 64))
            if memory_mb and hasattr(resource, "RLIMIT_AS"):  # browsers reserve large virtual address spaces, so Playwright runs skip RLIMIT_AS
                limits += [(resource.RLIMIT_AS, memory_mb * 1024 * 1024), (getattr(resource, "RLIMIT_NOFILE", 0), 256)]
            for lim, val in limits:
                try:
                    if hasattr(resource, "setrlimit"):
                        resource.setrlimit(lim, (val, val))
                except (ValueError, OSError):
                    pass
        except ImportError:
            pass
    return apply


_UNSHARE_OK: bool | None = None
_BWRAP_OK: bool | None = None


def _bwrap_available() -> bool:
    global _BWRAP_OK
    if _BWRAP_OK is None:
        path = shutil.which("bwrap")
        if not path or not sys.platform.startswith("linux"):
            _BWRAP_OK = False
        else:
            try:
                cmd = [path, "--unshare-all", "--ro-bind", "/usr", "/usr"]
                for d in ["/bin", "/lib", "/lib64"]:
                    p = Path(d)
                    if p.is_symlink():
                        cmd.extend(["--symlink", os.readlink(d), d])
                    elif p.exists():
                        cmd.extend(["--ro-bind", d, d])
                cmd.extend(["--proc", "/proc", "--dev", "/dev", "/usr/bin/true"])
                r = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=5,
                )
                _BWRAP_OK = r.returncode == 0
            except Exception:
                _BWRAP_OK = False
    return _BWRAP_OK


def _unshare_available() -> bool:
    global _UNSHARE_OK
    if _UNSHARE_OK is None:
        path = shutil.which("unshare")
        if not path or not sys.platform.startswith("linux"):
            _UNSHARE_OK = False
        else:
            try:
                r = subprocess.run([path, "-rn", "true"], capture_output=True, timeout=5)
                _UNSHARE_OK = r.returncode == 0
            except Exception:
                _UNSHARE_OK = False
    return _UNSHARE_OK


def detect_isolation_level() -> str:
    """Detects available execution isolation level."""
    if sys.platform.startswith("linux") and _bwrap_available():
        return "bwrap+rlimits"
    if sys.platform.startswith("linux") and _unshare_available():
        return "netns+rlimits"
    if os.name == "posix":
        return "rlimits_only"
    return "none"



def _parse_junit(xml_text: str, file_to_key: dict[str, str]) -> dict[str, TestOutcome]:
    out: dict[str, TestOutcome] = {}
    if not xml_text:
        return out
    root = ET.fromstring(xml_text)
    rank = {"passed": 0, "skipped": 1, "failed": 2, "error": 3}
    for case in root.iter("testcase"):
        classname = case.get("classname", "")
        module = classname.split(".")[0] + ".py" if classname else ""
        key = file_to_key.get(module)
        if key is None:
            continue
        status, message, trace = "passed", "", ""
        for tag in ("failure", "error", "skipped"):
            el = case.find(tag)
            if el is not None:
                status = {"failure": "failed", "error": "error", "skipped": "skipped"}[tag]
                message = el.get("message", "") or ""
                trace = el.text or ""
                break
        sysout = case.find("system-out")
        dur = int(float(case.get("time", "0") or 0) * 1000)
        prev = out.get(key)
        if prev is None:
            out[key] = TestOutcome(key, status, dur, message[:4000], trace[:20000],
                                   (sysout.text or "")[:8000] if sysout is not None else "", 1)
        else:
            prev.duration_ms += dur
            prev.functions += 1
            if rank[status] > rank[prev.status]:
                prev.status, prev.message, prev.stack_trace = status, message[:4000], trace[:20000]
    return out


def run_pytest(specs: list[ScriptSpec], hcm_version: str | None, runner: str = "pytest",
               target_url: str | None = None, timeout_s: int | None = None,
               artifact_dir: Path | None = None, skip_ast_validation: bool = False,
               env_kind: str = "real_code", source_repo_dir: Path | None = None) -> SandboxResult:
    settings = get_settings()
    timeout_s = timeout_s or settings.exec_timeout_seconds
    allow_pw = runner == "playwright"
    file_to_key: dict[str, str] = {}
    pre_rejected: dict[str, TestOutcome] = {}

    work = Path(tempfile.mkdtemp(prefix="tt-sandbox-"))
    try:
        if runner == "pytest":
            if source_repo_dir and Path(source_repo_dir).exists():
                p_src = Path(source_repo_dir)
                for item in p_src.iterdir():
                    if item.name in (".git", ".venv", "node_modules", "dist", "__pycache__", ".pytest_cache"):
                        continue
                    dest = work / item.name
                    if item.is_dir():
                        shutil.copytree(item, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
                    elif item.is_file():
                        shutil.copy2(item, dest)
            if (REPO_ROOT / "reference_hcm").exists():
                shutil.copytree(REPO_ROOT / "reference_hcm", work / "reference_hcm",
                                ignore=shutil.ignore_patterns("__pycache__"))
            if (REPO_ROOT / "echobox_harness").exists():
                shutil.copytree(REPO_ROOT / "echobox_harness", work / "echobox_harness",
                                ignore=shutil.ignore_patterns("__pycache__"))
            if (REPO_ROOT / "var" / "repos" / "sohan10012_EchoBox" / "backend").exists():
                shutil.copytree(REPO_ROOT / "var" / "repos" / "sohan10012_EchoBox" / "backend", work / "echobox_real_backend",
                                ignore=shutil.ignore_patterns("__pycache__"))
            elif (REPO_ROOT / "var" / "repos" / "EchoBox" / "backend").exists():
                shutil.copytree(REPO_ROOT / "var" / "repos" / "EchoBox" / "backend", work / "echobox_real_backend",
                                ignore=shutil.ignore_patterns("__pycache__"))
            (work / "conftest.py").write_text(GUARD_CONFTEST)
        else:
            (work / "conftest.py").write_text(PLAYWRIGHT_CONFTEST)
        for spec in specs:
            if not skip_ast_validation:
                report = validate_script(spec.script, allow_playwright=allow_pw, env_kind=env_kind)
                if not report.valid:
                    pre_rejected[spec.test_key] = TestOutcome(
                        spec.test_key, "error", 0, "Rejected by AST allowlist: " + "; ".join(report.errors))
                    continue
            (work / spec.file_name).write_text(spec.script)
            file_to_key[spec.file_name] = spec.test_key

        if not file_to_key:
            return SandboxResult("completed", pre_rejected, 0, "No valid scripts to execute")

        junit = work / "junit.xml"
        art = artifact_dir or (work / "artifacts")
        art.mkdir(parents=True, exist_ok=True)
        env = {"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1", "HOME": str(work),
               "PYTHONHASHSEED": "0", "LANG": "C.UTF-8"}
        if hcm_version:
            env["REFERENCE_HCM_VERSION"] = hcm_version
        if runner == "playwright":
            env["TRACETEST_TARGET_URL"] = target_url or ""
            env["TRACETEST_ARTIFACT_DIR"] = str(art)
            if settings.chromium_executable:
                env["TRACETEST_CHROMIUM_EXECUTABLE"] = str(settings.chromium_executable)
            for k in ("TRACETEST_CHROMIUM_EXECUTABLE", "PLAYWRIGHT_BROWSERS_PATH"):
                if os.environ.get(k):
                    env[k] = os.environ[k]
            env["HOME"] = os.environ.get("HOME", str(work))
        if os.name == "nt":
            sys_root = os.environ.get("SYSTEMROOT", "C:\\Windows")
            sys_32 = str(Path(sys_root) / "System32")
            py_dir = str(Path(sys.executable).parent)
            env["SYSTEMROOT"] = sys_root
            env["PATH"] = f"{py_dir};{sys_32};{sys_root};" + os.environ.get("PATH", "")
            if "PATHEXT" in os.environ:
                env["PATHEXT"] = os.environ["PATHEXT"]
            if "VIRTUAL_ENV" in os.environ:
                env["VIRTUAL_ENV"] = os.environ["VIRTUAL_ENV"]
        cmd = [sys.executable, "-I", "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", "-o",
               "console_output_style=classic", f"--junitxml={junit}", "--rootdir", str(work), str(work)]
        iso_level = detect_isolation_level()
        use_netns = False
        if runner == "pytest":
            if iso_level == "bwrap+rlimits":
                use_netns = True
                bwrap_bin = shutil.which("bwrap") or "bwrap"
                bwrap_cmd = [
                    bwrap_bin,
                    "--unshare-all",
                    "--die-with-parent",
                    "--new-session",
                    "--clearenv",
                    "--setenv", "PATH", "/usr/bin:/bin",
                    "--setenv", "HOME", "/tmp",
                    "--setenv", "LANG", "C.UTF-8",
                    "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
                    "--setenv", "PYTHONHASHSEED", "0",
                    "--ro-bind", "/usr", "/usr",
                ]
                for d in ["/bin", "/lib", "/lib64"]:
                    p = Path(d)
                    if p.is_symlink():
                        target = os.readlink(d)
                        bwrap_cmd.extend(["--symlink", target, d])
                    elif p.exists():
                        bwrap_cmd.extend(["--ro-bind", d, d])
                bwrap_cmd.extend([
                    "--proc", "/proc",
                    "--dev", "/dev",
                    "--tmpfs", "/tmp",
                    "--tmpfs", "/home",
                    "--tmpfs", "/var",
                ])
                if Path("/etc").exists():
                    bwrap_cmd.extend(["--ro-bind", "/etc", "/etc"])
                venv_dir = Path(sys.prefix).resolve()
                if venv_dir != Path("/usr"):
                    bwrap_cmd.extend(["--ro-bind", str(venv_dir), "/opt/venv"])
                    python_bin = "/opt/venv/bin/python3"
                else:
                    python_bin = sys.executable
                if hcm_version:
                    bwrap_cmd.extend(["--setenv", "REFERENCE_HCM_VERSION", hcm_version])
                bwrap_cmd.extend(["--bind", str(work), "/work", "--chdir", "/work"])
                cmd = bwrap_cmd + [
                    python_bin, "-I", "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider",
                    "-o", "console_output_style=classic", "--junitxml=/work/junit.xml",
                    "--rootdir", "/work", "/work"
                ]
            elif iso_level == "netns+rlimits":
                use_netns = True
                cmd = [shutil.which("unshare") or "unshare", "-rn", *cmd]
            else:
                if os.environ.get("TRACETEST_ALLOW_WEAK_SANDBOX") == "0":
                    allow_weak = False
                elif os.environ.get("TRACETEST_ALLOW_WEAK_SANDBOX") in ("1", "true", "True"):
                    allow_weak = True
                else:
                    allow_weak = settings.allow_weak_sandbox
                if not allow_weak:
                    raise RuntimeError(
                        f"Sandbox execution refused: network namespace isolation ('unshare -rn') is unavailable "
                        f"(detected level: '{iso_level}'). TraceTest AI fails closed to prevent network exfiltration. "
                        "Set TRACETEST_ALLOW_WEAK_SANDBOX=1 to override."
                    )
                iso_level = f"weak:{iso_level}"
        else:
            iso_level = "playwright:host_browser"
        start = time.monotonic()
        popen_kw: dict = {"cwd": str(work), "env": env, "stdout": subprocess.PIPE, "stderr": subprocess.STDOUT}
        if os.name == "posix":
            popen_kw["preexec_fn"] = _limits(
                settings.exec_memory_mb if runner == "pytest" else None,
                timeout_s + 5,
                is_bwrap=(iso_level == "bwrap+rlimits"),
            )
        else:
            popen_kw["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        proc = subprocess.Popen(cmd, **popen_kw)
        timed_out = False
        try:
            raw, _ = proc.communicate(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                if os.name == "posix" and hasattr(os, "killpg"):
                    os.killpg(proc.pid, getattr(signal, "SIGKILL", signal.SIGTERM))
                else:
                    proc.kill()
            except ProcessLookupError:
                pass
            raw, _ = proc.communicate()
        duration = int((time.monotonic() - start) * 1000)
        cap = settings.exec_max_output_bytes
        text = (raw or b"")[:cap].decode("utf-8", "replace")
        if raw and len(raw) > cap:
            text += f"\n[output truncated at {cap} bytes]"

        junit_text = junit.read_text() if junit.exists() else ""
        outcomes = _parse_junit(junit_text, file_to_key)
        for key in file_to_key.values():
            if key not in outcomes:
                outcomes[key] = TestOutcome(key, "timed_out" if timed_out else "error", 0,
                                            "Execution timed out" if timed_out else
                                            "No result reported by pytest (collection or interpreter error)",
                                            text[-4000:])
        outcomes.update(pre_rejected)
        files = [p for p in art.glob("*") if p.is_file()] if artifact_dir else []
        status = "timed_out" if timed_out else ("completed" if junit_text else "error")
        return SandboxResult(status, outcomes, duration, text, junit_text, proc.returncode, use_netns, files, iso_level)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def run_sandboxed_pytest(
    test_content: str,
    timeout_seconds: int = 15,
    mount_echobox_harness: bool = False,
    env_kind: str = "generic",
) -> SandboxedProbeResult:
    """Convenience runner for isolated, sandboxed execution of test content."""
    spec = ScriptSpec("probe", test_content)
    result = run_pytest(
        specs=[spec],
        hcm_version=None,
        runner="pytest",
        timeout_s=timeout_seconds,
        skip_ast_validation=True,
        env_kind=env_kind,
    )
    outcome = result.outcomes.get("probe")
    status = outcome.status if outcome else ("passed" if result.status == "completed" and result.returncode == 0 else "error")
    err_msg = outcome.message if outcome and outcome.message else (result.log if status != "passed" else None)
    return SandboxedProbeResult(
        status=status,
        stdout=result.log,
        stderr="",
        error_message=err_msg,
        duration_ms=result.duration_ms,
        isolation_level=result.isolation_level,
    )

