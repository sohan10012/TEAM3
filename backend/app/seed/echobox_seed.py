"""Idempotent seed service for the permanent default EchoBox Code-Based project.

Initializes:
1. ECHO Project ("EchoBox — Anonymous Conversation Platform", ID: 5)
2. 4 Environments (Real Code SUT, In-Memory Simulation, AWS Live, Local Test)
3. 1 GitHub Integration ("sohan10012/EchoBox")
4. 8 Subsystem Modules (Rooms, Discovery, Chat, Owner, Identity, Expiry, Security, Frontend)
5. 21 Grounded Requirements (with 62 Clauses, 21 Acceptance Criteria, 21 Versions)
6. 21 Test Cases (with 63 Test Steps)
7. 9 Executions (with 100 Execution Results)
8. 7 Defect Records (including DEF-ECHO-006 JWT signature verification vulnerability)
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Defect, Execution, Organisation, Project, Requirement, TestCase, User
from app.seed.seed_helper import seed_project_from_data

log = logging.getLogger("tracetest.seed.echobox")
SEED_DATA_PATH = Path(__file__).resolve().parent / "echo_seed_data.json"


def ensure_echobox_project(db: Session, force_reseed: bool = False) -> Project:
    """Ensure the ECHO code-based project is fully initialized and persisted."""
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

    proj = db.execute(select(Project).where(Project.key == "ECHO")).scalars().first()

    if proj and not force_reseed:
        req_count = db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()
        test_count = db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars().all()
        exec_count = db.execute(select(Execution).where(Execution.project_id == proj.id)).scalars().all()
        defect_count = db.execute(select(Defect).where(Defect.project_id == proj.id)).scalars().all()

        if len(req_count) >= 21 and len(test_count) >= 21 and len(exec_count) >= 9 and len(defect_count) >= 7:
            log.info("EchoBox project already fully initialized (ID: %d, Req: %d, Tests: %d, Exec: %d, Def: %d).",
                     proj.id, len(req_count), len(test_count), len(exec_count), len(defect_count))
            return proj
        log.info("EchoBox project exists (ID: %d) but has incomplete data. Re-hydrating...", proj.id)

    if not SEED_DATA_PATH.exists():
        log.warning("EchoBox seed data not found at %s. Returning project.", SEED_DATA_PATH)
        return proj or Project(key="ECHO", name="EchoBox", description="EchoBox", organisation_id=org.id)

    with open(SEED_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    proj = seed_project_from_data(db, data, default_id=5, user_id=admin_id, org_id=org.id)
    log.info("EchoBox project seeding complete (ID: %d).", proj.id)
    return proj
