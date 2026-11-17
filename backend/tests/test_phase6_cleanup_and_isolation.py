"""
Phase 6 Automated Test Suite: Project Cleanup, Retained Project Integrity,
Cross-Project Security Isolation, Document Ingestion Duplicate Detection,
and Clean Evaluation Workspace Verification.
"""
from __future__ import annotations

import io
import pytest
from sqlalchemy import select
from app.db.models import Project


def test_retained_projects_in_database(app):
    from app.db.base import make_engine
    from sqlalchemy.orm import Session
    
    eng = make_engine()
    with Session(eng) as db:
        projects = list(db.execute(select(Project).order_by(Project.id)).scalars().all())
        assert len(projects) >= 1
        for p in projects:
            assert p.status == "active"


def test_cross_project_isolation(admin):
    # 1. Fetch projects
    res = admin.get("/projects")
    assert res.status_code == 200
    p_data = res.json()
    items = p_data.get("items", [])
    if len(items) >= 2:
        p1 = items[0]
        p2 = items[1]
        
        # Verify requirements from p1 are not listed under p2
        r1 = admin.get(f"/requirements?project_id={p1['id']}")
        r2 = admin.get(f"/requirements?project_id={p2['id']}")
        assert r1.status_code == 200
        assert r2.status_code == 200
        ids1 = {r["id"] for r in r1.json().get("items", [])}
        ids2 = {r["id"] for r in r2.json().get("items", [])}
        assert ids1.isdisjoint(ids2)


def test_invalid_project_id_returns_not_found(admin):
    # Query an invalid/non-existent project ID
    res = admin.get("/projects/999999")
    assert res.status_code == 404
    
    # Query dashboard for non-existent project
    dash_res = admin.get("/projects/999999/dashboard")
    assert dash_res.status_code == 404


def test_project_deletion_authorization_and_cascade(admin, qa):
    # 1. Create a temporary project to delete
    create_res = admin.post("/projects", json={
        "key": "TMPDEL",
        "name": "Temporary Deletion Project",
        "project_type": "requirements_based",
        "description": "To test project deletion authorization and cascading."
    })
    assert create_res.status_code == 201
    temp_proj = create_res.json()
    temp_id = temp_proj["id"]
    
    # 2. QA role (non-admin) should be rejected with 403 Forbidden
    del_forbidden = qa.delete(f"/projects/{temp_id}")
    assert del_forbidden.status_code == 403
    
    # 3. Admin can delete
    del_ok = admin.delete(f"/projects/{temp_id}")
    assert del_ok.status_code == 204
    
    # 4. Now fetching it returns 404
    get_res = admin.get(f"/projects/{temp_id}")
    assert get_res.status_code == 404


def test_duplicate_document_upload_rejected_with_conflict(admin):
    # Get an active project
    p_res = admin.get("/projects")
    items = p_res.json().get("items", [])
    assert len(items) > 0
    pid = items[0]["id"]
    
    content = b"Unique document content for duplicate testing: ABC-12345-XYZ"
    files = {"file": ("test_doc.md", io.BytesIO(content), "text/markdown")}
    
    # Upload first time
    up1 = admin.post(
        f"/projects/{pid}/documents",
        files=files,
        data={"display_name": "Test Unique Doc", "auto_process": "false"}
    )
    assert up1.status_code == 201
    
    # Upload identical content second time -> must raise 409 Conflict
    files2 = {"file": ("test_doc_duplicate.md", io.BytesIO(content), "text/markdown")}
    up2 = admin.post(
        f"/projects/{pid}/documents",
        files=files2,
        data={"display_name": "Test Duplicate Doc", "auto_process": "false"}
    )
    assert up2.status_code == 409
    err_msg = up2.json().get("detail") or up2.json().get("error", {}).get("message", "")
    assert "Duplicate document detected" in err_msg


def test_fresh_evaluation_project_starts_completely_clean(admin):
    # Create evaluation project without seeded data
    create_res = admin.post("/projects", json={
        "key": "EVAL7",
        "name": "Phase 7 Real-World Document Evaluation",
        "project_type": "requirements_based",
        "description": "Evaluation Project: starts with zero pre-seeded requirements, test cases, or execution history.",
        "auto_extract": False
    })
    assert create_res.status_code == 201
    eval_proj = create_res.json()
    eid = eval_proj["id"]
    
    # Verify 0 requirements
    reqs_res = admin.get(f"/requirements?project_id={eid}")
    assert reqs_res.status_code == 200
    assert len(reqs_res.json().get("items", [])) == 0
    
    # Verify 0 test cases
    tests_res = admin.get(f"/tests?project_id={eid}")
    assert tests_res.status_code == 200
    assert len(tests_res.json().get("items", [])) == 0
    
    # Verify 0 executions
    exec_res = admin.get(f"/executions?project_id={eid}")
    assert exec_res.status_code == 200
    assert len(exec_res.json().get("items", [])) == 0
    
    # Verify 0 documents
    docs_res = admin.get(f"/projects/{eid}/documents")
    assert docs_res.status_code == 200
    assert len(docs_res.json()) == 0
    
    # Clean up test evaluation project
    del_res = admin.delete(f"/projects/{eid}")
    assert del_res.status_code == 204
