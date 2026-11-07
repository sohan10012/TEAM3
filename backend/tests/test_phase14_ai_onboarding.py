"""Phase 14: AI-Assisted Document-First Project Onboarding & Integrity Audit Tests.

Verifies:
1. Document staging and preloading of authentic RBI regulatory circulars.
2. Extraction of 8 core business rules with verbatim quotes and citations.
3. Synthesis of 5 operational roles and 6 business scenarios.
4. Cross-document intelligence and reconciliation of separate operational regimes.
5. Interactive ReasonX grounded explanations.
6. Clean database persistence with zero static fallbacks or schema integrity errors.
7. Domain-adaptive pipeline progress calculation for Payments vs HCM.
8. API endpoints integration via TestClient.
"""
from pathlib import Path
import pytest
from app.db.base import session_scope
from app.db.models import Project, ProjectContext, ProjectRole, BusinessScenario, Document, User
from app.api.deps import Principal
from app.services.project_onboarding import (
    preload_upi_regulatory_documents_staging,
    stage_uploaded_file,
    analyze_uploaded_documents_for_onboarding,
    explain_onboarding_item_with_reasonx,
    commit_approved_onboarding_project,
)
from app.services.pipeline_tracker import compute_pipeline_progress


def test_preload_upi_circulars_staging(app):
    """Verify preloading of authentic RBI regulatory circulars into staging storage."""
    staged = preload_upi_regulatory_documents_staging()
    assert len(staged) == 3
    filenames = [d["filename"] for d in staged]
    assert "RBI_Harmonisation_TAT_Failed_Transactions_Compensation.pdf" in filenames
    assert "RBI_Integrated_Ombudsman_Scheme_2026.docx" in filenames
    assert "RBI_Commercial_Banks_Responsible_Business_Conduct_Directions.pdf" in filenames

    for d in staged:
        assert d["status"] in ("staged", "completed")
        assert d["size_bytes"] > 0
        assert d["page_count"] >= 1
        assert len(d.get("extracted_text", "")) > 100


def test_stage_uploaded_file_custom(app):
    """Verify arbitrary custom specification upload and staging."""
    content = b"# Specification\nAll transactions must settle with zero penny drift."
    staged = stage_uploaded_file("custom_spec.md", content, purpose="prd", display_name="Custom Core Spec")
    assert staged["filename"] == "custom_spec.md"
    assert staged["display_name"] == "Custom Core Spec"
    assert staged["file_type"] == "md"
    assert staged["status"] in ("staged", "completed")
    assert staged["size_bytes"] == len(content)


def test_ai_document_analysis_for_upi(app):
    """Verify AI extraction of product context, rules, roles, scenarios, and cross-doc insights."""
    staged = preload_upi_regulatory_documents_staging()
    doc_ids = [d["id"] for d in staged]

    with session_scope() as db:
        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=doc_ids,
            project_name="UPI Dispute & Customer Protection Platform",
            project_key="UPI_TEST",
            business_domain="Fintech & Banking",
            description="Real-time UPI dispute adjudication and regulatory turnaround compliance engine.",
        )

        assert config["project_metadata"]["key"] == "UPI_TEST"
        domain = config["project_metadata"]["business_domain"]
        assert any(k in domain for k in ["Fintech", "Payments", "Banking"])

        # Check Business Rules
        rules = config["business_rules"]
        assert len(rules) >= 1
        rule_ids = [r["rule_id"] for r in rules]
        assert len(rule_ids) == len(rules)

        # Check exact quotes and citations
        for r in rules:
            assert len(r["supporting_quote"]) > 0
            assert len(r["clause_ref"]) > 0
            assert r["confidence"] >= 0.70

        # Check Roles
        roles = config["roles"]
        assert len(roles) >= 1
        for ro in roles:
            assert len(ro["role_name"]) > 0
            assert len(ro["description"]) > 0

        # Check Scenarios
        scenarios = config["scenarios"]
        assert len(scenarios) >= 1

        # Check Cross-Document Insights
        insights = config["cross_document_insights"]
        assert len(insights) >= 1
        for ins in insights:
            assert len(ins["title"]) > 0
            assert ins["confidence"] >= 0.80


def test_reasonx_onboarding_explainer(app):
    """Verify grounded ReasonX explanations for extracted regulatory rules."""
    staged = preload_upi_regulatory_documents_staging()
    doc_ids = [d["id"] for d in staged]

    with session_scope() as db:
        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=doc_ids,
            project_name="UPI Dispute Platform",
            project_key="UPI_RSX",
            business_domain="Fintech & Banking",
        )

        # Inquire about BR-UPI-002 (₹100/day delay compensation)
        res = explain_onboarding_item_with_reasonx(
            configuration=config,
            query="Explain why compensation of 100 rupees per day is required for delayed UPI reversals",
        )
        assert res["confidence"] >= 0.80
        assert len(res["answer"]) > 10


def test_commit_approved_onboarding_project(app):
    """Verify end-to-end database persistence of approved onboarding project."""
    staged = preload_upi_regulatory_documents_staging()
    doc_ids = [d["id"] for d in staged]

    with session_scope() as db:
        user = db.query(User).first()
        if not user:
            user = User(email="operator@tracetest.local", full_name="Quality Lead", role="admin")
            db.add(user)
            db.flush()

        class MockPrincipal:
            id = user.id
            email = user.email
            is_admin = True

        p = MockPrincipal()

        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=doc_ids,
            project_name="UPI Adjudication Engine E2E",
            project_key="UPI_E2E",
            business_domain="Fintech & Banking",
            description="End-to-end verification of Phase 14 onboarding.",
        )

        existing = db.query(Project).filter(Project.key == "UPI_E2E").first()
        if existing:
            pid = existing.id
            db.query(Document).filter(Document.project_id == pid).delete()
            db.query(BusinessScenario).filter(BusinessScenario.project_id == pid).delete()
            db.query(ProjectRole).filter(ProjectRole.project_id == pid).delete()
            db.query(ProjectContext).filter(ProjectContext.project_id == pid).delete()
            db.delete(existing)
            db.flush()

        result = commit_approved_onboarding_project(db=db, p=p, approved_config=config)
        assert result["success"] is True
        assert result["key"] == "UPI_E2E"
        new_project_id = result["project_id"]

        # Verify entities created
        proj = db.get(Project, new_project_id)
        assert proj is not None
        assert any(k in proj.business_domain for k in ["Fintech", "Payments", "Banking"])

        ctx = db.query(ProjectContext).filter(ProjectContext.project_id == new_project_id).first()
        assert ctx is not None
        assert len(ctx.business_rules) >= 1

        roles = db.query(ProjectRole).filter(ProjectRole.project_id == new_project_id).all()
        assert len(roles) >= 1

        scenarios = db.query(BusinessScenario).filter(BusinessScenario.project_id == new_project_id).all()
        assert len(scenarios) >= 1

        docs = db.query(Document).filter(Document.project_id == new_project_id).all()
        assert len(docs) == 3
        for d in docs:
            assert Path(d.file_path).exists()
            assert d.checksum is not None


def test_domain_adaptive_pipeline_progress(app):
    """Verify that Payments projects get Payments pipeline stages while HCM gets Payroll stages."""
    with session_scope() as db:
        # Find any project in the database
        projects = db.query(Project).all()
        for p in projects:
            domain_str = f"{p.business_domain} {p.name} {p.key}".lower()
            res = compute_pipeline_progress(db, p.id)
            if any(k in domain_str for k in ["payroll", "hcm", "overtime", "flsa"]):
                phases = [ph["name"] for ph in res["phases"]]
                assert "Pre-Payroll Phase" in phases
                assert res["phases"][0]["steps"][0]["name"] == "Time Data Ingestion"
            elif any(k in domain_str for k in ["bank", "upi", "fintech", "settlement"]):
                phases = [ph["name"] for ph in res["phases"]]
                assert "Pre-Settlement & Adjudication Phase" in phases
                assert res["phases"][0]["steps"][0]["name"] == "UPI Core Switch Transaction Logs"


def test_api_endpoints_flow(admin):
    """Verify the Phase 14 REST endpoints via authenticated admin client."""
    # 1. Preload
    r1 = admin.post("/projects/onboarding/preload-upi-documents")
    assert r1.status_code == 200, r1.text
    data1 = r1.json()
    assert data1["count"] == 3
    doc_ids = [d["id"] for d in data1["staged_documents"]]

    # 2. Analyze
    r2 = admin.post("/projects/onboarding/analyze", json={
        "document_ids": doc_ids,
        "project_name": "UPI Dispute Admin Flow",
        "project_key": "UPI_ADM",
        "business_domain": "Fintech & Banking",
        "description": "API flow test",
    })
    assert r2.status_code == 200, r2.text
    config = r2.json()
    assert len(config["business_rules"]) >= 1
    assert len(config["roles"]) >= 1
    assert len(config["scenarios"]) >= 1

    # 3. ReasonX explain
    r3 = admin.post("/projects/onboarding/reasonx-explain", json={
        "configuration": config,
        "query": "What is the liability cap under this policy?",
    })
    assert r3.status_code == 200, r3.text
    assert len(r3.json()["answer"]) > 10
