"""Idempotent seed service for the WFMQ demonstration Requirements-Based project.

Initializes:
1. WFMQ Project ("Workforce Management Quality Project", ID: 10)
2. 1 Environment ("Simulation (WFMQ Deterministic)")
3. 3 Documents
4. 39 Requirements (with 55 Clauses, 78 Acceptance Criteria, 39 Versions)
5. 391 Test Cases (with 507 Test Steps)
6. 2 Executions (with 782 Execution Results)
7. 3 Defect Records
8. ProjectContext, 4 ProjectRoles, 6 RequirementClarifications
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Organisation, Project, Requirement, User
from app.seed.seed_helper import seed_project_from_data

log = logging.getLogger("tracetest.seed.wfmq")
SEED_DATA_PATH = Path(__file__).resolve().parent / "wfmq_seed_data.json"


def ensure_wfmq_project(db: Session, force_reseed: bool = False) -> Project:
    """Ensure the WFMQ requirements-based project is fully initialized and persisted."""
    settings = get_settings()

    org = db.execute(select(Organisation)).scalars().first()
    if not org:
        org = Organisation(name="TraceTest Quality Engineering", slug="tracetest-qe")
        db.add(org)
        db.flush()

    admin = db.execute(select(User).where(User.email == settings.admin_email)).scalars().first()
    if not admin:
        admin = db.execute(select(User)).scalars().first()
    admin_id = admin.id if admin else 1

    proj = db.execute(select(Project).where(Project.key == "WFMQ")).scalars().first()

    if proj and not force_reseed:
        req_count = db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()
        if len(req_count) >= 39:
            log.info("WFMQ project already fully initialized (ID: %d, Req: %d).", proj.id, len(req_count))
            return proj
        log.info("WFMQ project exists (ID: %d) but has incomplete data. Re-hydrating...", proj.id)

    if not SEED_DATA_PATH.exists():
        log.warning("WFMQ seed data not found at %s. Returning project.", SEED_DATA_PATH)
        return proj or Project(key="WFMQ", name="Workforce Management Quality Project", description="WFMQ", organisation_id=org.id)

    with open(SEED_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    proj = seed_project_from_data(db, data, default_id=10, user_id=admin_id, org_id=org.id)
    log.info("WFMQ project seeding complete (ID: %d).", proj.id)
    return proj
