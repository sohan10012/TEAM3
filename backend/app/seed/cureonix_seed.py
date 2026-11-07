"""Idempotent seed service for the permanent default Cureonix Code-Based project.

Initializes:
1. CUREON Project ("Cureonix Service", ID: 8)
2. 2 Environments (Application Sandbox, Backend Simulation)
3. 1 GitHub Integration ("sohan10012/Cureonix")
4. 11 Subsystem Modules
5. 23 Grounded Requirements (with 32 Clauses, 23 Acceptance Criteria, 23 Versions)
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

log = logging.getLogger("tracetest.seed.cureonix")
SEED_DATA_PATH = Path(__file__).resolve().parent / "cureon_seed_data.json"


def ensure_cureonix_project(db: Session, force_reseed: bool = False) -> Project:
    """Ensure the CUREON code-based project is fully initialized and persisted."""
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

    proj = db.execute(select(Project).where(Project.key == "CUREON")).scalars().first()

    if proj and not force_reseed:
        req_count = db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()
        if len(req_count) >= 23:
            log.info("Cureonix project already fully initialized (ID: %d, Req: %d).", proj.id, len(req_count))
            return proj
        log.info("Cureonix project exists (ID: %d) but has incomplete data. Re-hydrating...", proj.id)

    if not SEED_DATA_PATH.exists():
        log.warning("Cureonix seed data not found at %s. Returning project.", SEED_DATA_PATH)
        return proj or Project(key="CUREON", name="Cureonix Service", description="Cureonix", organisation_id=org.id)

    with open(SEED_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    proj = seed_project_from_data(db, data, default_id=8, user_id=admin_id, org_id=org.id)
    log.info("Cureonix project seeding complete (ID: %d).", proj.id)
    return proj
