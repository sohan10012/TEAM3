from __future__ import annotations

import pytest
from app.db.base import session_scope
from app.db.models import AcceptanceCriterion, Requirement, TestCase, User


def test_acceptance_criteria_phase2_endpoints(qa, reviewer, admin):
    # 1. Get first available project
    projs = qa.get("/projects").json()["items"]
    assert len(projs) > 0
    proj = projs[0]
    proj_id = proj["id"]

    # Ensure acceptance criteria exist
    admin.post(f"/projects/{proj_id}/generate-acceptance-criteria", headers={"X-CSRF-Token": admin.csrf})

    # Fetch criteria for project
    resp = qa.get(f"/projects/{proj_id}/acceptance-criteria")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0
    first = items[0]
    assert "id" in first
    assert "key" in first
    assert "requirement_key" in first
    assert "linked_test_count" in first

    ac_id = first["id"]

    # 2. GET /acceptance-criteria/{ac_id}
    detail_resp = qa.get(f"/acceptance-criteria/{ac_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == ac_id
    assert "requirement" in detail
    assert detail["requirement"]["id"] == first["requirement_id"]
    assert "clauses" in detail
    assert "linked_test_cases" in detail
    assert "reviews" in detail

    # 3. PATCH /acceptance-criteria/{ac_id} (requires requirement.write)
    patch_resp = qa.patch(
        f"/acceptance-criteria/{ac_id}",
        json={"description": "Updated description for verification test.", "actor": "Test Admin"},
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert patch_resp.status_code == 200
    patched = patch_resp.json()
    assert patched["description"] == "Updated description for verification test."
    assert patched["actor"] == "Test Admin"

    # 4. Review /acceptance-criteria/{ac_id}/review (requires test.review)
    # Request clarification
    rev_resp = reviewer.post(
        f"/acceptance-criteria/{ac_id}/review",
        json={"decision": "request_clarification", "comment": "Need confirmation on timeout limits."},
        headers={"X-CSRF-Token": reviewer.csrf},
    )
    assert rev_resp.status_code == 200
    assert rev_resp.json()["review_status"] == "needs_clarification"

    # Check that comment is required for request_changes
    err_resp = reviewer.post(
        f"/acceptance-criteria/{ac_id}/review",
        json={"decision": "request_changes", "comment": ""},
        headers={"X-CSRF-Token": reviewer.csrf},
    )
    assert err_resp.status_code == 400

    # Approve
    appr_resp = reviewer.post(
        f"/acceptance-criteria/{ac_id}/review",
        json={"decision": "approve", "comment": "Approved following review."},
        headers={"X-CSRF-Token": reviewer.csrf},
    )
    assert appr_resp.status_code == 200
    assert appr_resp.json()["review_status"] == "approved"

    # Verify review history in detail endpoint
    detail_after = qa.get(f"/acceptance-criteria/{ac_id}").json()
    assert len(detail_after["reviews"]) >= 2
    assert detail_after["reviews"][0]["decision"] == "approve"

    # 5. POST /requirements/{req_id}/generate-acceptance-criteria
    gen_resp = qa.post(
        f"/requirements/{first['requirement_id']}/generate-acceptance-criteria",
        headers={"X-CSRF-Token": qa.csrf},
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert "requirement_id" in gen_data
    assert "created_count" in gen_data
    assert "criteria_keys" in gen_data
