"""
Phase 6 Project Switcher & Workspace Isolation Acceptance Test Suite:
Verifies that:
1. Database initialization (init_db) does NOT resurrect deleted projects (CUREON, DAYFORCE, WFMQ).
2. Endpoints (/analytics/dashboard, /analytics/quality, /traceability/matrix) with an invalid/deleted
   project_id return 404 Not Found and strictly refuse to broaden scope across other projects.
3. The /projects endpoint returns only authoritative active projects.
"""
from __future__ import annotations

from sqlalchemy import select

from app.db.base import make_engine
from app.db.init_db import initialise
from app.db.models import Project


def test_init_db_does_not_resurrect_deleted_projects(app):
    """
    Ensure initialise does not recreate legacy or deleted projects.
    """
    eng = make_engine()
    # Call initialise directly to simulate application reboot / lifespan startup
    initialise(seed=False)

    from sqlalchemy.orm import Session
    with Session(eng) as db:
        keys = set(db.execute(select(Project.key)).scalars().all())
        # CUREON, DAYFORCE, WFMQ must NEVER be resurrected by init_db
        assert "CUREON" not in keys, "CUREON must not be resurrected by init_db"
        assert "DAYFORCE" not in keys, "DAYFORCE must not be resurrected by init_db"
        assert "WFMQ" not in keys, "WFMQ must not be resurrected by init_db"


def test_analytics_and_matrix_endpoints_strict_project_isolation(admin):
    """
    Ensure /analytics/dashboard, /analytics/quality, and /traceability/matrix
    reject nonexistent/deleted project_id with 404 rather than silently broadening scope.
    """
    invalid_pid = 999999

    # 1. Analytics Dashboard
    r_dash = admin.get(f"/analytics/dashboard?project_id={invalid_pid}")
    assert r_dash.status_code == 404, f"Expected 404 for invalid project_id, got {r_dash.status_code}"

    # 2. Analytics Quality
    r_qual = admin.get(f"/analytics/quality?project_id={invalid_pid}")
    assert r_qual.status_code == 404, f"Expected 404 for invalid project_id, got {r_qual.status_code}"

    # 3. Traceability Matrix
    r_matrix = admin.get(f"/traceability/matrix?project_id={invalid_pid}")
    assert r_matrix.status_code == 404, f"Expected 404 for invalid project_id, got {r_matrix.status_code}"


def test_project_listing_contains_only_authorized_projects(admin):
    """
    Ensure /projects returns only active projects and none of the purged legacy projects.
    """
    res = admin.get("/projects?page_size=100")
    assert res.status_code == 200
    data = res.json()
    items = data.get("items", [])
    keys = {p["key"] for p in items}

    # Ensure purged projects are not in the response
    assert "CUREON" not in keys
    assert "DAYFORCE" not in keys
    assert "WFMQ" not in keys
