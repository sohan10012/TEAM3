from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api import serializers as S
from app.api.deps import (
    PageParams,
    Principal,
    accessible_project_ids,
    current_principal,
    get_project_checked,
    page_params,
    paginate,
    require,
)
from app.core.errors import BadRequest, Conflict, NotFound
from app.db.base import get_db, utcnow
from app.db.models import (
    BusinessScenario,
    Defect,
    Document,
    Environment,
    Module,
    Organisation,
    Project,
    ProjectContext,
    ProjectMember,
    ProjectRole,
    Requirement,
    TestCase,
    TestSuite,
    User,
)
from app.services import audit
from app.services.analytics import coverage_by_project
from app.services.requirement_intelligence import analyze_and_extract_project_requirements

router = APIRouter(prefix="/projects", tags=["projects"])


def _with_stats(db: Session, p: Project) -> dict:
    out = S.project(p)
    out["stats"] = {
        "requirements": db.scalar(select(func.count()).select_from(Requirement).where(Requirement.project_id == p.id)),
        "tests": db.scalar(select(func.count()).select_from(TestCase).where(TestCase.project_id == p.id)),
        "suites": db.scalar(select(func.count()).select_from(TestSuite).where(TestSuite.project_id == p.id)),
        "open_defects": db.scalar(select(func.count()).select_from(Defect).where(
            Defect.project_id == p.id, Defect.approval_status == "approved",
            Defect.status.notin_(["verified", "closed"]))),
        "members": db.scalar(select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id == p.id)),
    }
    cov = coverage_by_project(db, [p.id])
    out["stats"]["coverage_pct"] = cov[0]["coverage_pct"] if cov else 0.0
    from app.db.models import Integration
    gh = db.execute(select(Integration).where(Integration.project_id == p.id, Integration.kind == "github")).scalar_one_or_none()
    out["github"] = gh.config if gh and gh.config else None
    return out


@router.get("")
def list_projects(pp: PageParams = Depends(page_params), status: str | None = None,
                  p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    stmt = select(Project).where(Project.id.in_(accessible_project_ids(db, p) or [-1]))
    if status:
        stmt = stmt.where(Project.status == status)
    if pp.q:
        stmt = stmt.where(Project.name.ilike(f"%{pp.q}%") | Project.key.ilike(f"%{pp.q}%"))
    return paginate(db, stmt, pp, {"name": Project.name, "key": Project.key, "updated_at": Project.updated_at},
                    Project.key, lambda x: _with_stats(db, x))


@router.get("/validate-key")
def validate_project_key(key: str, db: Session = Depends(get_db)):
    key_clean = key.strip().upper()
    if not re.fullmatch(r"[A-Z0-9_-]{2,10}", key_clean):
        return {"valid": False, "key": key_clean, "message": "Key must be 2–10 alphanumeric characters or hyphens/underscores."}
    exists = db.execute(select(Project).where(Project.key == key_clean)).scalar_one_or_none()
    if exists:
        return {"valid": False, "key": key_clean, "message": f"Project key '{key_clean}' is already in use."}
    return {"valid": True, "key": key_clean, "message": "Project key is available."}


class ProjectRoleIn(BaseModel):
    role_name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)
    responsibilities: str = ""
    restrictions: str = ""


class BusinessScenarioIn(BaseModel):
    title: str
    description: str
    actor: str = ""
    preconditions: str = ""
    expected_outcome: str = ""
    business_rules: str = ""
    module: str = ""


class ProjectContextIn(BaseModel):
    product_overview: str = ""
    problem_statement: str = ""
    target_users: list[str] = Field(default_factory=list)
    product_modules: list[str] = Field(default_factory=list)
    architecture_context: str = ""
    technical_stack: dict[str, Any] = Field(default_factory=dict)
    external_integrations: list[str] = Field(default_factory=list)
    business_rules: list[str] = Field(default_factory=list)
    security_expectations: str = ""
    privacy_requirements: str = ""
    performance_expectations: str = ""
    availability_expectations: str = ""
    regulatory_standards: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    additional_context: str = ""


class ProjectIn(BaseModel):
    key: str = Field(min_length=2, max_length=10)
    name: str = Field(min_length=3, max_length=200)
    description: str = ""
    project_type: str = Field(default="requirements_based")
    business_domain: str = ""
    product_type: str = ""
    business_goal: str = ""
    owner_name: str = ""
    team: str = ""
    version: str = "1.0.0"
    environment_name: str = ""
    status: str = "active"
    target_users_and_roles: list[str] = Field(default_factory=list)
    objectives: list[str] = Field(default_factory=list)
    business_scenarios: list[str] = Field(default_factory=list)
    functional_expectations: list[str] = Field(default_factory=list)
    non_functional_expectations: list[str] = Field(default_factory=list)
    constraints_and_assumptions: list[str] = Field(default_factory=list)
    explicit_exclusions: list[str] = Field(default_factory=list)
    context: ProjectContextIn | None = None
    roles: list[ProjectRoleIn] = Field(default_factory=list)
    scenarios: list[BusinessScenarioIn] = Field(default_factory=list)
    document_ids: list[int] = Field(default_factory=list)
    auto_extract: bool = False


ProjectIn.model_rebuild()


@router.post("", status_code=201)
def create_project(body: ProjectIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    key = body.key.upper()
    if not re.fullmatch(r"[A-Z0-9_-]{2,10}", key):
        raise BadRequest("Project key must be 2-10 letters/numbers/hyphens")
    if db.execute(select(Project).where(Project.key == key)).scalar_one_or_none():
        raise Conflict("Project key already in use")
    org = db.execute(select(Organisation)).scalars().first()
    proj = Project(
        key=key,
        name=body.name,
        description=body.description,
        project_type=body.project_type,
        business_domain=body.business_domain,
        product_type=body.product_type,
        business_goal=body.business_goal,
        owner_name=body.owner_name or (p.user.full_name or p.email if hasattr(p, "user") else ""),
        team=body.team,
        version=body.version or "1.0.0",
        environment_name=body.environment_name,
        target_users_and_roles=body.target_users_and_roles,
        objectives=body.objectives,
        business_scenarios=body.business_scenarios,
        functional_expectations=body.functional_expectations,
        non_functional_expectations=body.non_functional_expectations,
        constraints_and_assumptions=body.constraints_and_assumptions,
        explicit_exclusions=body.explicit_exclusions,
        organisation_id=org.id,
        owner_id=p.id,
    )
    db.add(proj)
    db.flush()
    db.add(ProjectMember(project_id=proj.id, user_id=p.id, project_role="owner"))

    # 1. Persist ProjectContext if provided
    if body.context:
        ctx = ProjectContext(
            project_id=proj.id,
            product_overview=body.context.product_overview,
            problem_statement=body.context.problem_statement,
            target_users=body.context.target_users,
            product_modules=body.context.product_modules,
            architecture_context=body.context.architecture_context,
            technical_stack=body.context.technical_stack,
            external_integrations=body.context.external_integrations,
            business_rules=body.context.business_rules,
            security_expectations=body.context.security_expectations,
            privacy_requirements=body.context.privacy_requirements,
            performance_expectations=body.context.performance_expectations,
            availability_expectations=body.context.availability_expectations,
            regulatory_standards=body.context.regulatory_standards,
            assumptions=body.context.assumptions,
            exclusions=body.context.exclusions,
            dependencies=body.context.dependencies,
            additional_context=body.context.additional_context,
        )
        db.add(ctx)

    # 2. Persist ProjectRoles if provided
    for r in body.roles:
        db.add(ProjectRole(
            project_id=proj.id,
            role_name=r.role_name,
            description=r.description,
            permissions=r.permissions,
            responsibilities=r.responsibilities,
            restrictions=r.restrictions,
        ))

    # 3. Persist BusinessScenarios if provided
    for sc in body.scenarios:
        db.add(BusinessScenario(
            project_id=proj.id,
            title=sc.title,
            description=sc.description,
            actor=sc.actor,
            preconditions=sc.preconditions,
            expected_outcome=sc.expected_outcome,
            business_rules=sc.business_rules,
            module=sc.module,
        ))

    # 4. Associate uploaded draft documents if provided
    if body.document_ids:
        docs_to_link = db.execute(
            select(Document).where(Document.id.in_(body.document_ids))
        ).scalars().all()
        for d in docs_to_link:
            d.project_id = proj.id

    # 5. Environment configuration
    if key.startswith("DF") or "dayforce" in body.name.lower():
        db.add(Environment(project_id=proj.id, name="QA — Reference HCM 1.0", kind="reference_hcm", hcm_version="1.0", is_default=True))
        db.add(Environment(project_id=proj.id, name="Fix candidate — Reference HCM 1.1", kind="reference_hcm", hcm_version="1.1"))
    elif body.project_type == "requirements_based":
        db.add(Environment(project_id=proj.id, name=f"{body.name} Simulation Engine", kind="simulation", is_default=True))
    else:
        db.add(Environment(project_id=proj.id, name=f"{body.name} Local Sandbox", kind="simulation", is_default=True))

    db.flush()

    # 6. Trigger initial grounded requirements extraction for requirements-based projects if explicitly requested
    if body.project_type == "requirements_based" and body.auto_extract:
        try:
            analyze_and_extract_project_requirements(db, proj.id, p.id)
        except Exception:
            pass  # Non-fatal if extraction encounters minor warnings

    audit.record(db, p.id, "project.created", "project", proj.id, proj.key, proj.id)
    db.commit()
    return _with_stats(db, proj)


@router.get("/{project_id}/context")
def get_project_context(project_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    ctx = db.execute(select(ProjectContext).where(ProjectContext.project_id == project_id)).scalar_one_or_none()
    if not ctx:
        return {"project_id": project_id, "has_context": False}
    return S.project_context(ctx)


@router.put("/{project_id}/context")
def update_project_context(project_id: int, body: ProjectContextIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    ctx = db.execute(select(ProjectContext).where(ProjectContext.project_id == project_id)).scalar_one_or_none()
    if not ctx:
        ctx = ProjectContext(project_id=project_id)
        db.add(ctx)
    ctx.product_overview = body.product_overview
    ctx.problem_statement = body.problem_statement
    ctx.target_users = body.target_users
    ctx.product_modules = body.product_modules
    ctx.architecture_context = body.architecture_context
    ctx.technical_stack = body.technical_stack
    ctx.external_integrations = body.external_integrations
    ctx.business_rules = body.business_rules
    ctx.security_expectations = body.security_expectations
    ctx.privacy_requirements = body.privacy_requirements
    ctx.performance_expectations = body.performance_expectations
    ctx.availability_expectations = body.availability_expectations
    ctx.regulatory_standards = body.regulatory_standards
    ctx.assumptions = body.assumptions
    ctx.exclusions = body.exclusions
    ctx.dependencies = body.dependencies
    ctx.additional_context = body.additional_context
    ctx.updated_at = utcnow()
    db.commit()
    return S.project_context(ctx)


@router.get("/{project_id}/roles")
def list_project_roles(project_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    roles = db.execute(select(ProjectRole).where(ProjectRole.project_id == project_id).order_by(ProjectRole.role_name)).scalars().all()
    return [S.project_role(r) for r in roles]


@router.post("/{project_id}/roles", status_code=201)
def add_project_role(project_id: int, body: ProjectRoleIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    role = ProjectRole(
        project_id=project_id,
        role_name=body.role_name.strip(),
        description=body.description.strip(),
        permissions=body.permissions,
        responsibilities=body.responsibilities.strip(),
        restrictions=body.restrictions.strip(),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return S.project_role(role)


@router.patch("/{project_id}/roles/{role_id}")
def update_project_role(project_id: int, role_id: int, body: ProjectRoleIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    role = db.get(ProjectRole, role_id)
    if not role or role.project_id != project_id:
        raise NotFound("Role not found")
    role.role_name = body.role_name.strip()
    role.description = body.description.strip()
    role.permissions = body.permissions
    role.responsibilities = body.responsibilities.strip()
    role.restrictions = body.restrictions.strip()
    db.commit()
    db.refresh(role)
    return S.project_role(role)


@router.delete("/{project_id}/roles/{role_id}", status_code=204)
def delete_project_role(project_id: int, role_id: int, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    role = db.get(ProjectRole, role_id)
    if not role or role.project_id != project_id:
        raise NotFound("Role not found")
    db.delete(role)
    db.commit()
    return None


@router.get("/{project_id}/scenarios")
def list_business_scenarios(project_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    scenarios = db.execute(select(BusinessScenario).where(BusinessScenario.project_id == project_id).order_by(BusinessScenario.created_at)).scalars().all()
    return [S.business_scenario(s) for s in scenarios]


@router.post("/{project_id}/scenarios", status_code=201)
def add_business_scenario(project_id: int, body: BusinessScenarioIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    sc = BusinessScenario(
        project_id=project_id,
        title=body.title.strip(),
        description=body.description.strip(),
        actor=body.actor.strip(),
        preconditions=body.preconditions.strip(),
        expected_outcome=body.expected_outcome.strip(),
        business_rules=body.business_rules.strip(),
        module=body.module.strip(),
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return S.business_scenario(sc)


@router.patch("/{project_id}/scenarios/{scenario_id}")
def update_business_scenario(project_id: int, scenario_id: int, body: BusinessScenarioIn, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    sc = db.get(BusinessScenario, scenario_id)
    if not sc or sc.project_id != project_id:
        raise NotFound("Scenario not found")
    sc.title = body.title.strip()
    sc.description = body.description.strip()
    sc.actor = body.actor.strip()
    sc.preconditions = body.preconditions.strip()
    sc.expected_outcome = body.expected_outcome.strip()
    sc.business_rules = body.business_rules.strip()
    sc.module = body.module.strip()
    db.commit()
    db.refresh(sc)
    return S.business_scenario(sc)


@router.delete("/{project_id}/scenarios/{scenario_id}", status_code=204)
def delete_business_scenario(project_id: int, scenario_id: int, p: Principal = Depends(require("project.admin")), db: Session = Depends(get_db)):
    get_project_checked(db, p, project_id)
    sc = db.get(BusinessScenario, scenario_id)
    if not sc or sc.project_id != project_id:
        raise NotFound("Scenario not found")
    db.delete(sc)
    db.commit()
    return None


class RepoImportIn(BaseModel):
    repo_url: str = Field(default="https://github.com/sohan10012/EchoBox.git", description="Public or private GitHub URL")
    branch: str = Field(default="main", description="Git branch to checkout")
    commit_sha: str | None = Field(default=None, description="Optional pinned commit SHA")
    project_key: str | None = Field(default=None, description="Project key (2-10 characters)")
    project_name: str | None = Field(default=None, description="Human-readable project title")
    auth_token: str | None = Field(default=None, description="Optional GitHub access token for private repositories")
    dry_run: bool = False


@router.post("/import-repo", status_code=201)
def import_repository(body: RepoImportIn, p: Principal = Depends(require("project.admin")),
                      db: Session = Depends(get_db)):
    from app.core.config import REPO_ROOT
    from app.services.git_client import clone_repository
    from app.services.repo_ingest import (
        analyze_repository,
        ingest_echobox_project,
        ingest_generic_project,
        validate_git_ref,
        validate_github_url,
    )

    owner, repo_name = validate_github_url(body.repo_url)
    branch = validate_git_ref(body.branch)
    if body.commit_sha:
        validate_git_ref(body.commit_sha)

    # Locate or clone repository via hardened git client
    target_dir = REPO_ROOT / "var" / "repos" / f"{owner}_{repo_name}"
    if not target_dir.exists() and (REPO_ROOT / "var" / "repos" / repo_name).exists():
        target_dir = REPO_ROOT / "var" / "repos" / repo_name

    pinned_commit = clone_repository(
        repo_url=body.repo_url,
        target_dir=target_dir,
        branch=branch,
        commit_sha=body.commit_sha,
        auth_token=body.auth_token,
    )

    analysis = analyze_repository(target_dir)

    is_echo = repo_name.lower() == "echobox" or (body.project_key and body.project_key.upper() == "ECHO")

    # Target architecture matrix determination per docs/SUPPORTED_TARGET_MATRIX.md
    if is_echo:
        target_type = "real_code"
        execution_supported = True
        isolation_tier = "bwrap+rlimits"
    elif ("Python" in analysis.frameworks or (target_dir / "pyproject.toml").exists() or (target_dir / "setup.py").exists()) and not any(
        f in analysis.frameworks for f in ("React", "Express", "Next.js", "Vite")
    ):
        target_type = "python_lib"
        execution_supported = True
        isolation_tier = "bwrap+rlimits"
    elif any(f in analysis.frameworks for f in ("React", "Express", "Next.js", "Vite", "FastAPI")):
        target_type = "web"
        execution_supported = True
        isolation_tier = "playwright:host_browser"
    else:
        target_type = "static_only"
        execution_supported = False
        isolation_tier = "Static analysis only"

    total_bytes = 0
    candidate_files: list[str] = []
    if target_dir.exists():
        for p_file in target_dir.rglob("*"):
            if ".git" in p_file.parts:
                continue
            if p_file.is_file():
                try:
                    total_bytes += p_file.stat().st_size
                except OSError:
                    pass
                rel_parts = p_file.relative_to(target_dir).parts
                if not any(part in (".venv", "node_modules", "__pycache__", "dist", ".git", ".pytest_cache") for part in rel_parts):
                    if len(candidate_files) < 30:
                        candidate_files.append(str(p_file.relative_to(target_dir)))

    secret_findings_count = len(analysis.secret_findings)
    secret_files = sorted(list(set(f.get("file", "unknown") for f in analysis.secret_findings)))

    if body.dry_run:
        return {
            "dry_run": True,
            "owner": owner,
            "repo_name": repo_name,
            "default_branch": branch,
            "commit_sha": pinned_commit or analysis.commit_sha,
            "repo_size_bytes": total_bytes,
            "file_count": analysis.file_count,
            "languages": analysis.languages,
            "frameworks": analysis.frameworks,
            "target_type": target_type,
            "execution_supported": execution_supported,
            "isolation_tier": isolation_tier,
            "secret_scan": {
                "count": secret_findings_count,
                "files": secret_files,
            },
            "candidate_files": candidate_files,
            "analysis": analysis.__dict__,
        }

    if is_echo:
        proj = ingest_echobox_project(db, p.id, target_dir)
    else:
        pkey = body.project_key or repo_name[:6].upper()
        pname = body.project_name or f"{repo_name.replace('-', ' ').title()} Service"
        proj = ingest_generic_project(db, p.id, target_dir, pkey, pname, body.repo_url, branch, pinned_commit or analysis.commit_sha)

    return {
        "ok": True,
        "project": _with_stats(db, proj),
        "analysis": analysis.__dict__,
        "import_summary": getattr(proj, "_import_summary", None)
    }


@router.post("/{project_id}/refresh-repo")
def refresh_repository(project_id: int, p: Principal = Depends(require("project.admin")),
                       db: Session = Depends(get_db)):
    from app.core.config import REPO_ROOT
    from app.db.models import Integration
    from app.services.git_client import fetch_and_snapshot
    from app.services.repo_ingest import analyze_repository

    proj = get_project_checked(db, p, project_id)
    ig = db.execute(select(Integration).where(Integration.project_id == proj.id, Integration.kind == "github")).scalar_one_or_none()
    ig_cfg = ig.config if ig else None
    if isinstance(ig_cfg, str):
        try:
            ig_cfg = json.loads(ig_cfg)
        except Exception:
            ig_cfg = {}
    if not ig or not ig_cfg or not ig_cfg.get("repo"):
        raise BadRequest("Project is not connected to a GitHub repository")

    repo_full = ig_cfg["repo"]
    owner, repo_name = repo_full.split("/")
    target_dir = REPO_ROOT / "var" / "repos" / f"{owner}_{repo_name}"
    if not target_dir.exists() and (REPO_ROOT / "var" / "repos" / repo_name).exists():
        target_dir = REPO_ROOT / "var" / "repos" / repo_name

    if not target_dir.exists():
        raise BadRequest(f"Local repository directory not found at {target_dir}")

    # Fetch latest commit snapshot securely without in-place overwrite
    new_sha, has_changed = fetch_and_snapshot(target_dir)
    analysis = analyze_repository(target_dir)
    from app.services.repo_ingest import diff_aware_refresh
    diff_res = diff_aware_refresh(db, proj, target_dir, p.id)

    return {
        "ok": True,
        "project_id": proj.id,
        "latest_commit": analysis.commit_sha,
        "file_count": analysis.file_count,
        "analysis": analysis.__dict__,
        "diff_refresh": diff_res
    }


@router.delete("/{project_id}/disconnect-repo")
def disconnect_repository(project_id: int, p: Principal = Depends(require("project.admin")),
                         db: Session = Depends(get_db)):
    from app.db.models import Integration
    proj = get_project_checked(db, p, project_id)
    ig = db.execute(select(Integration).where(Integration.project_id == proj.id, Integration.kind == "github")).scalar_one_or_none()
    if ig:
        db.delete(ig)
        audit.record(db, p.id, "project.repo_disconnected", "project", proj.id, proj.key, proj.id)
        db.commit()
    return {"ok": True, "message": "Repository disconnected. QA history and test evidence preserved."}


@router.get("/{project_id}")
def get_project(project_id: int, p: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    out = _with_stats(db, proj)
    out["modules"] = [S.module(m) for m in db.execute(select(Module).where(Module.project_id == proj.id)).scalars()]
    out["environments"] = [S.environment(e) for e in
                           db.execute(select(Environment).where(Environment.project_id == proj.id)).scalars()]
    members = db.execute(select(ProjectMember, User).join(User, User.id == ProjectMember.user_id)
                         .where(ProjectMember.project_id == proj.id)).all()
    out["members"] = [{"user": S.user(u), "project_role": pm.project_role} for pm, u in members]
    return out


def _parse_iso_date(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", ""))
    except ValueError as exc:
        raise BadRequest("Dates must be ISO-8601") from exc


@router.get("/{project_id}/dashboard")
def get_project_dashboard(
    project_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
    execution_id: int | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    """Returns aggregated, production-ready telemetry for the project dashboard."""
    proj = get_project_checked(db, p, project_id)
    from app.services.project_dashboard import get_project_dashboard_data
    return get_project_dashboard_data(
        db=db,
        project_id=proj.id,
        date_from=_parse_iso_date(date_from),
        date_to=_parse_iso_date(date_to),
        selected_execution_id=execution_id,
    )


@router.get("/{project_id}/requirements-dashboard")
def get_requirements_dashboard(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.requirements_dashboard import get_requirements_project_dashboard_data
    return get_requirements_project_dashboard_data(db=db, project_id=proj.id)


@router.get("/{project_id}/traceability")
def get_project_traceability(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.requirements_dashboard import get_project_traceability_matrix
    return get_project_traceability_matrix(db=db, project_id=proj.id)


@router.get("/{project_id}/quality-report")
def get_project_quality_report(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.requirements_dashboard import generate_comprehensive_quality_report
    return generate_comprehensive_quality_report(db=db, project_id=proj.id)


@router.get("/{project_id}/quality-report.html")
def get_project_quality_report_html(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    from fastapi.responses import Response
    proj = get_project_checked(db, p, project_id)
    from app.services.requirements_dashboard import generate_quality_report_html
    content = generate_quality_report_html(db=db, project_id=proj.id)
    return Response(content=content, media_type="text/html")


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = None
    status: str | None = Field(None, pattern="^(active|archived)$")


@router.patch("/{project_id}")
def update_project(project_id: int, body: ProjectPatch, p: Principal = Depends(require("project.admin")),
                   db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(proj, k, v)
    proj.updated_at = utcnow()
    action = "project.archived" if body.status == "archived" else "project.updated"
    audit.record(db, p.id, action, "project", proj.id, proj.key, proj.id, body.model_dump(exclude_none=True))
    db.commit()
    return _with_stats(db, proj)


class MemberIn(BaseModel):
    user_id: int
    project_role: str = "member"


@router.post("/{project_id}/members", status_code=201)
def add_member(project_id: int, body: MemberIn, p: Principal = Depends(require("project.admin")),
               db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    if db.get(User, body.user_id) is None:
        raise NotFound("User")
    if db.execute(select(ProjectMember).filter_by(project_id=proj.id, user_id=body.user_id)).scalar_one_or_none():
        raise Conflict("User is already a member")
    db.add(ProjectMember(project_id=proj.id, user_id=body.user_id, project_role=body.project_role))
    audit.record(db, p.id, "project.member_added", "project", proj.id, proj.key, proj.id, {"user_id": body.user_id})
    db.commit()
    return {"ok": True}


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: int, user_id: int, p: Principal = Depends(require("project.admin")),
                  db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    pm = db.execute(select(ProjectMember).filter_by(project_id=proj.id, user_id=user_id)).scalar_one_or_none()
    if pm is None:
        raise NotFound("Membership")
    db.delete(pm)
    audit.record(db, p.id, "project.member_removed", "project", proj.id, proj.key, proj.id, {"user_id": user_id})
    db.commit()
    return {"ok": True}


class ModuleIn(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=200)
    description: str = ""


@router.post("/{project_id}/modules", status_code=201)
def add_module(project_id: int, body: ModuleIn, p: Principal = Depends(require("project.admin")),
               db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    if db.execute(select(Module).filter_by(project_id=proj.id, code=body.code.upper())).scalar_one_or_none():
        raise Conflict("Module code already exists")
    m = Module(project_id=proj.id, code=body.code.upper(), name=body.name, description=body.description)
    db.add(m)
    audit.record(db, p.id, "module.created", "module", None, body.code.upper(), proj.id)
    db.commit()
    return S.module(m)


class EnvIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    kind: str = Field("simulation", pattern="^(reference_hcm|web|real_code|python_lib|simulation|static_only)$")
    hcm_version: str | None = Field(None, pattern=r"^1\.[01]$")
    base_url: str | None = Field(None, max_length=500)


@router.post("/{project_id}/environments", status_code=201)
def add_environment(project_id: int, body: EnvIn, p: Principal = Depends(require("project.admin")),
                    db: Session = Depends(get_db)):
    proj = get_project_checked(db, p, project_id)
    if body.kind == "reference_hcm" and not body.hcm_version:
        raise BadRequest("Reference HCM environments need hcm_version 1.0 or 1.1")
    if body.kind == "web" and not (body.base_url or "").startswith(("http://", "https://")):
        raise BadRequest("Web environments need an http(s) base_url")
    e = Environment(project_id=proj.id, **body.model_dump())
    db.add(e)
    audit.record(db, p.id, "environment.created", "environment", None, body.name, proj.id)
    db.commit()
    return S.environment(e)


@router.post("/{project_id}/generate-acceptance-criteria")
def trigger_generate_criteria(
    project_id: int,
    p: Principal = Depends(require("requirement.write")),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.test_design import generate_acceptance_criteria_for_project
    return generate_acceptance_criteria_for_project(db, proj.id, author_id=p.id)


@router.get("/{project_id}/acceptance-criteria")
def list_project_criteria(
    project_id: int,
    requirement_id: int | None = None,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.db.models import AcceptanceCriterion
    stmt = select(AcceptanceCriterion).join(Requirement).where(Requirement.project_id == proj.id)
    if requirement_id:
        stmt = stmt.where(AcceptanceCriterion.requirement_id == requirement_id)
    rows = db.execute(stmt.order_by(AcceptanceCriterion.id)).scalars().all()
    return [S.criterion(a) for a in rows]


@router.post("/{project_id}/generate-tests")
def trigger_generate_tests(
    project_id: int,
    p: Principal = Depends(require("test.write")),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.test_design import generate_test_scenarios_for_project
    return generate_test_scenarios_for_project(db, proj.id, author_id=p.id)


@router.post("/{project_id}/validate-specifications", status_code=201)
def trigger_specification_validation(
    project_id: int,
    p: Principal = Depends(require("suite.execute")),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.simulation_engine import run_specification_validation
    exec_run = run_specification_validation(db, proj.id, user_id=p.id)
    return S.execution(db, exec_run)


@router.post("/{project_id}/run-simulation", status_code=201)
def trigger_behaviour_simulation(
    project_id: int,
    p: Principal = Depends(require("suite.execute")),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.services.simulation_engine import run_behaviour_simulation
    exec_run = run_behaviour_simulation(db, proj.id, user_id=p.id)
    return S.execution(db, exec_run)


@router.get("/{project_id}/simulation-models")
def list_project_simulation_models(
    project_id: int,
    p: Principal = Depends(current_principal),
    db: Session = Depends(get_db),
):
    proj = get_project_checked(db, p, project_id)
    from app.db.models import SimulationModel
    models = db.execute(
        select(SimulationModel).where(SimulationModel.project_id == proj.id)
    ).scalars().all()
    return [S.simulation_model(m) for m in models]
