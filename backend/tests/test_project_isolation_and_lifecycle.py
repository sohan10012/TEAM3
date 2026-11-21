"""Automated Regression Suite for Global Project Data Isolation, Release Decisions, and Project Lifecycle Deletion."""
from __future__ import annotations


def test_global_project_data_isolation_and_cross_project_rejection(admin):
    # 1. Create two isolated test projects
    ra = admin.post("/projects", json={
        "name": "Isolation Alpha Platform",
        "key": "ISO_ALP",
        "description": "Synthetic project for isolation verification A",
        "project_type": "requirements_based",
        "business_domain": "Cloud Infrastructure",
    })
    assert ra.status_code == 201, ra.text
    proj_a = ra.json()
    proj_a_id = proj_a["id"]

    rb = admin.post("/projects", json={
        "name": "Isolation Beta Platform",
        "key": "ISO_BET",
        "description": "Synthetic project for isolation verification B",
        "project_type": "requirements_based",
        "business_domain": "Fintech Payments",
    })
    assert rb.status_code == 201, rb.text
    proj_b = rb.json()
    proj_b_id = proj_b["id"]

    try:
        # 2. Add requirement and test in Project A
        r_req_a = admin.post("/requirements", json={
            "project_id": proj_a_id,
            "title": "Alpha Cloud Storage Access Control Policy",
            "description": "The system shall enforce least-privilege IAM roles for storage access.",
            "category": "security",
            "priority": "high",
        })
        assert r_req_a.status_code == 201, r_req_a.text
        req_a = r_req_a.json()
        req_a_id = req_a["id"]

        r_test_a = admin.post("/tests", json={
            "requirement_id": req_a_id,
            "title": "Verify IAM Role Least Privilege on S3 Buckets",
            "test_type": "security",
            "test_category": "positive",
            "clause_keys": ["C1"],
            "expected_result": "Access restricted",
            "source_quote": "The system shall enforce least-privilege IAM roles",
            "steps": [{"action": "Assume role", "expected": "Access restricted"}],
        })
        assert r_test_a.status_code == 201, r_test_a.text
        test_a = r_test_a.json()
        test_a_id = test_a["id"]

        # 3. Add requirement and test in Project B
        r_req_b = admin.post("/requirements", json={
            "project_id": proj_b_id,
            "title": "Beta Instant Payment Settlement Invariant",
            "description": "The system shall settle interbank transactions within 15 seconds.",
            "category": "business_rule",
            "priority": "critical",
        })
        assert r_req_b.status_code == 201, r_req_b.text
        req_b = r_req_b.json()
        req_b_id = req_b["id"]

        r_test_b = admin.post("/tests", json={
            "requirement_id": req_b_id,
            "title": "Verify 15-second Settlement Timeout Invariant",
            "test_type": "functional",
            "test_category": "positive",
            "clause_keys": ["C1"],
            "expected_result": "Settled under 15s",
            "source_quote": "The system shall settle interbank transactions within 15 seconds",
            "steps": [{"action": "Send payment", "expected": "Settled under 15s"}],
        })
        assert r_test_b.status_code == 201, r_test_b.text
        test_b = r_test_b.json()
        test_b["id"]

        # 4. Create Defect in Project A linked to Test A
        r_def_a = admin.post("/defects", json={
            "project_id": proj_a_id,
            "title": "Over-permissive S3 bucket policy allows public read",
            "severity": "high",
            "priority": "p1",
            "test_case_id": test_a_id,
            "expected_result": "Bucket access restricted",
            "actual_result": "Bucket accessible publicly",
        })
        assert r_def_a.status_code == 201, r_def_a.text
        r_def_a.json()

        # 5. Verify Project Scoping: Project B views must NOT leak Project A data
        r_list_b_reqs = admin.get(f"/requirements?project_id={proj_b_id}")
        assert r_list_b_reqs.status_code == 200
        b_req_titles = [x["title"] for x in r_list_b_reqs.json()["items"]]
        assert "Beta Instant Payment Settlement Invariant" in b_req_titles
        assert "Alpha Cloud Storage Access Control Policy" not in b_req_titles

        r_list_b_defs = admin.get(f"/defects?project_id={proj_b_id}")
        assert r_list_b_defs.status_code == 200
        assert len(r_list_b_defs.json()["items"]) == 0

        r_list_a_defs = admin.get(f"/defects?project_id={proj_a_id}")
        assert r_list_a_defs.status_code == 200
        a_def_titles = [x["title"] for x in r_list_a_defs.json()["items"]]
        assert "Over-permissive S3 bucket policy allows public read" in a_def_titles

        # 6. Cross-project rejection: Creating a defect in Project B referencing Test A or Req A must FAIL
        r_cross_def = admin.post("/defects", json={
            "project_id": proj_b_id,
            "title": "Attempted cross-project defect linking",
            "severity": "medium",
            "priority": "p2",
            "test_case_id": test_a_id,  # Belongs to Project A!
            "expected_result": "Rejected",
            "actual_result": "Rejected",
        })
        assert r_cross_def.status_code == 400
        assert "Test case belongs to another project" in r_cross_def.text

        r_cross_def2 = admin.post("/defects", json={
            "project_id": proj_b_id,
            "title": "Attempted cross-project requirement linking",
            "severity": "medium",
            "priority": "p2",
            "requirement_id": req_a_id,  # Belongs to Project A!
            "expected_result": "Rejected",
            "actual_result": "Rejected",
        })
        assert r_cross_def2.status_code == 400
        assert "Requirement belongs to another project" in r_cross_def2.text

        # 7. Release Decision Evaluation: Zero executions must return insufficient_evidence, never approved
        rel_dec = admin.get(f"/projects/{proj_a_id}/release-decision")
        assert rel_dec.status_code == 200
        rel_data = rel_dec.json()
        assert rel_data["status"] == "insufficient_evidence"
        assert rel_data["is_approved"] is False
        assert rel_data["readiness_score"] <= 35.0
        assert any("execution" in r.lower() for r in rel_data["reasons"])

        # 8. Project Lifecycle Deletion:
        # Rejection with invalid confirm key
        r_del_bad = admin.delete(f"/projects/{proj_a_id}?confirm_key=WRONG_KEY")
        assert r_del_bad.status_code == 400
        assert "does not match project key" in r_del_bad.text

        # Successful deletion with exact project key
        r_del_ok = admin.delete(f"/projects/{proj_a_id}?confirm_key=ISO_ALP")
        assert r_del_ok.status_code == 204

        # Verify Project A is completely gone (404)
        r_get_a = admin.get(f"/projects/{proj_a_id}")
        assert r_get_a.status_code == 404

        # Verify Project B is intact and untouched
        r_get_b = admin.get(f"/projects/{proj_b_id}")
        assert r_get_b.status_code == 200
        assert r_get_b.json()["key"] == "ISO_BET"

    finally:
        # Cleanup Project B
        admin.delete(f"/projects/{proj_b_id}?confirm_key=ISO_BET")


def test_clause_classification_and_domain_ac_synthesis(admin):
    from app.services.requirement_intelligence import classify_clause_type

    # 1. Verify 7-category clause classification
    assert classify_clause_type("The system shall enforce multi-factor authentication for root accounts.") == "normative_requirement"
    assert classify_clause_type("Administrators should rotate cryptographic keys every 90 days.") == "recommendation_guidance"
    assert classify_clause_type("AWS Organizations allows you to centrally manage and govern your environment.") == "informational_content"
    assert classify_clause_type("For example, when a user requests a password reset, an email token is generated.") == "explanatory_statement"
    assert classify_clause_type("Figure 3.1: Architecture diagram") == "not_actionable"
    assert classify_clause_type("Short fragment") == "duplicate_or_fragmented"

    # 2. Test domain-aware AC synthesis without generic HTTP 200/400 boilerplate
    ra = admin.post("/projects", json={
        "name": "AC Craft Quality Project",
        "key": "AC_CRAFT",
        "description": "Tests domain-specific AC synthesis",
        "project_type": "requirements_based",
        "business_domain": "Cloud Security",
    })
    assert ra.status_code == 201
    p_id = ra.json()["id"]

    try:
        r_req = admin.post("/requirements", json={
            "project_id": p_id,
            "title": "Enforce strict envelope encryption with AWS KMS customer managed keys",
            "description": "All customer data at rest must be encrypted using customer managed KMS keys with dual-control rotation.",
            "category": "security",
            "priority": "critical",
        })
        assert r_req.status_code == 201
        req_id = r_req.json()["id"]

        r_gen = admin.post(f"/requirements/{req_id}/generate-acceptance-criteria")
        assert r_gen.status_code == 200
        gen_res = r_gen.json()
        assert gen_res["created_count"] >= 2

        r_acs = admin.get(f"/requirements/{req_id}/acceptance-criteria")
        assert r_acs.status_code == 200
        acs_data = r_acs.json()
        acs = acs_data["items"] if isinstance(acs_data, dict) and "items" in acs_data else acs_data
        assert len(acs) >= 2

        ac_texts = " ".join([a["description"] + " " + (a.get("expected_output") or "") for a in acs])
        # Verify domain relevance & Given/When/Then structure
        assert "given" in ac_texts.lower()
        assert "when" in ac_texts.lower()
        assert "then" in ac_texts.lower()
        assert "HTTP 200/201" not in ac_texts
        assert "HTTP 400 Bad Request" not in ac_texts
        assert "SOC2 / ISO 27001 audit logging invariant" not in ac_texts
        # Human review must be preserved
        assert all(a["review_status"] == "pending" for a in acs)
    finally:
        admin.delete(f"/projects/{p_id}?confirm_key=AC_CRAFT")


def test_traceability_matrix_five_coverage_categories(admin):
    ra = admin.post("/projects", json={
        "name": "Traceability 5-Category Project",
        "key": "TRC_CAT",
        "description": "Verifies 5-category requirement coverage",
        "project_type": "requirements_based",
        "business_domain": "Enterprise QA",
    })
    assert ra.status_code == 201
    p_id = ra.json()["id"]

    try:
        # Req 1: Not covered (0 tests)
        r1 = admin.post("/requirements", json={
            "project_id": p_id,
            "title": "Uncovered Requirement with Zero Tests",
            "description": "No test cases are linked to this requirement.",
            "category": "functional",
            "priority": "medium",
        })
        assert r1.status_code == 201
        r1_id = r1.json()["id"]

        # Req 2: Pending validation (has test, but 0 executions)
        r2 = admin.post("/requirements", json={
            "project_id": p_id,
            "title": "Pending Validation Requirement with Unexecuted Test",
            "description": "Linked to test that has never run.",
            "category": "security",
            "priority": "high",
        })
        assert r2.status_code == 201
        r2_id = r2.json()["id"]

        admin.post("/tests", json={
            "requirement_id": r2_id,
            "title": "Unexecuted Test Case for R2",
            "test_type": "security",
            "test_category": "positive",
            "clause_keys": ["C1"],
            "expected_result": "Success",
            "source_quote": "Linked to test that has never run.",
            "steps": [{"action": "Check", "expected": "Success"}],
        })

        # Query traceability overview
        r_trc = admin.get(f"/projects/{p_id}/traceability/overview")
        assert r_trc.status_code == 200
        trc_data = r_trc.json()

        assert trc_data["total_requirements"] == 2
        assert trc_data["not_covered_requirements"] == 1
        assert trc_data["pending_validation_requirements"] == 1
        assert trc_data["fully_covered_requirements"] == 0

        # Query traceability hierarchy
        r_hier = admin.get(f"/projects/{p_id}/traceability/hierarchy")
        assert r_hier.status_code == 200
        nodes = r_hier.json()["nodes"]
        node_map = {n["id"]: n for n in nodes}
        assert node_map[r1_id]["coverage_status"] == "not_covered"
        assert node_map[r2_id]["coverage_status"] == "pending_validation"
    finally:
        admin.delete(f"/projects/{p_id}?confirm_key=TRC_CAT")

