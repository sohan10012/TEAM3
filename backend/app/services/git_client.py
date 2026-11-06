"""Hardened Git client for secure repository cloning, token handling, and revision pinning."""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

from app.core.errors import BadRequest

HARDENED_GIT_CONFIG = [
    "-c", "core.hooksPath=/dev/null",
    "-c", "protocol.file.allow=never",
    "-c", "http.followRedirects=false",
    "-c", "core.symlinks=false",
    "-c", "submodule.recurse=false",
]

DEFAULT_TIMEOUT = 60
MAX_REPO_BYTES = 250_000_000  # 250 MB
MAX_REPO_FILES = 10_000


def run_hardened_git(
    args: list[str],
    cwd: Path | None = None,
    auth_token: str | None = None,
    pinned_ip: str | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> subprocess.CompletedProcess[str]:
    """Runs a git command with strict security flags, isolated environment, and token protection."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/tmp"),
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_ALLOW_PROTOCOL": "https",
    }
    if os.name == "nt":
        if "SYSTEMROOT" in os.environ:
            env["SYSTEMROOT"] = os.environ["SYSTEMROOT"]
        if "SystemRoot" in os.environ:
            env["SystemRoot"] = os.environ["SystemRoot"]
        if "TEMP" in os.environ:
            env["TEMP"] = os.environ["TEMP"]
        if "TMP" in os.environ:
            env["TMP"] = os.environ["TMP"]
    askpass_script: Path | None = None

    if auth_token and auth_token.strip():
        # Never pass token in argv or URL. Use GIT_ASKPASS with strict permissions (0700)
        temp_dir = Path(tempfile.mkdtemp(prefix="tt-git-askpass-"))
        askpass_script = temp_dir / "askpass.sh"
        # The script outputs the token when prompted for password, and 'x-access-token' for username
        askpass_content = (
            "#!/bin/sh\n"
            "case \"$1\" in\n"
            "  *Username*|*username*) echo \"x-access-token\" ;;\n"
            "  *) echo \"$TRACETEST_GIT_TOKEN\" ;;\n"
            "esac\n"
        )
        askpass_script.write_text(askpass_content, encoding="utf-8")
        askpass_script.chmod(stat.S_IRWXU)
        env["GIT_ASKPASS"] = str(askpass_script)
        env["TRACETEST_GIT_TOKEN"] = auth_token.strip()

    extra_config: list[str] = []
    if os.name == "nt":
        extra_config.extend(["-c", "http.sslbackend=schannel"])
    if pinned_ip and pinned_ip.strip():
        # Pin DNS to defeat DNS rebinding attacks
        extra_config.extend(["-c", f"http.curloptResolve=github.com:443:{pinned_ip.strip()}"])

    cmd = ["git"] + HARDENED_GIT_CONFIG + extra_config + args
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd) if cwd else None,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc
    finally:
        if askpass_script and askpass_script.parent.exists():
            shutil.rmtree(askpass_script.parent, ignore_errors=True)


def clone_repository(
    repo_url: str,
    target_dir: Path,
    branch: str = "main",
    commit_sha: str | None = None,
    auth_token: str | None = None,
    pinned_ip: str | None = None,
) -> str:
    """Clones a repository securely without persisting credentials into .git/config."""
    from app.services.repo_ingest.url_validator import resolve_and_validate_github_url

    if not pinned_ip and repo_url.startswith("https://github.com/"):
        try:
            _, _, resolved_ip = resolve_and_validate_github_url(repo_url)
            pinned_ip = resolved_ip
        except Exception:
            pass

    target_dir.parent.mkdir(parents=True, exist_ok=True)
    if not target_dir.exists():
        clone_args = [
            "clone",
            "--depth", "50",
            "--no-recurse-submodules",
            "-b", branch,
            repo_url,
            str(target_dir),
        ]
        proc = run_hardened_git(clone_args, auth_token=auth_token, pinned_ip=pinned_ip, timeout=DEFAULT_TIMEOUT)
        if proc.returncode != 0:
            err = (proc.stderr or "").replace(auth_token, "[REDACTED]") if auth_token else (proc.stderr or "")
            raise BadRequest(f"Git clone failed: {err[:200]}")

        # Post-clone security assertions
        # 1. Assert .git/config does not contain the auth_token
        git_config = target_dir / ".git" / "config"
        if git_config.exists() and auth_token:
            config_text = git_config.read_text(encoding="utf-8", errors="ignore")
            if auth_token in config_text:
                git_config.write_text(config_text.replace(auth_token, "[REDACTED]"))
                raise BadRequest("Security error: Token was persisted to .git/config")

        # 2. Check clone size cap & file count cap
        file_count = 0
        total_bytes = 0
        for p in target_dir.rglob("*"):
            if ".git" in p.parts:
                continue
            if p.is_file():
                file_count += 1
                total_bytes += p.stat().st_size
                if total_bytes > MAX_REPO_BYTES:
                    shutil.rmtree(target_dir, ignore_errors=True)
                    raise BadRequest(f"Repository exceeds maximum allowed size ({MAX_REPO_BYTES // 1_000_000} MB)")
                if file_count > MAX_REPO_FILES:
                    shutil.rmtree(target_dir, ignore_errors=True)
                    raise BadRequest(f"Repository exceeds maximum allowed file count ({MAX_REPO_FILES})")

    if commit_sha:
        proc = run_hardened_git(["checkout", commit_sha], cwd=target_dir, timeout=15)
        if proc.returncode != 0:
            raise BadRequest(f"Failed to checkout commit {commit_sha}: {proc.stderr[:100]}")

    rev_proc = run_hardened_git(["rev-parse", "HEAD"], cwd=target_dir, timeout=5)
    return rev_proc.stdout.strip() if rev_proc.returncode == 0 else "unknown"


def fetch_and_snapshot(
    target_dir: Path,
    auth_token: str | None = None,
) -> tuple[str, bool]:
    """Fetches updates without in-place overwrite, returning (new_commit_sha, has_changed)."""
    r_curr = run_hardened_git(["rev-parse", "HEAD"], cwd=target_dir, timeout=5)
    curr_sha = r_curr.stdout.strip()

    proc = run_hardened_git(["fetch", "--depth", "50"], cwd=target_dir, auth_token=auth_token, timeout=30)
    if proc.returncode != 0:
        raise BadRequest(f"Git fetch failed: {proc.stderr[:200]}")

    r_remote = run_hardened_git(["rev-parse", "FETCH_HEAD"], cwd=target_dir, timeout=5)
    new_sha = r_remote.stdout.strip() if r_remote.returncode == 0 else curr_sha
    has_changed = bool(new_sha and new_sha != curr_sha)
    return new_sha, has_changed

