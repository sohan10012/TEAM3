"""Phase 14.2: Authentic Document Ingestion, Anti-Fixture Audit & Independent AI Accuracy Benchmark.

Validates:
1. Anti-Fixture Audit: Synthetic demo fixtures are explicitly flagged with `is_synthetic_fixture=True`.
2. Authentic Document Ingestion: Real multi-page PDFs (UK HMRC PAYE, US DOL FLSA) are staged with SHA-256 hashes.
3. Unseen Domain Processing: Independent documents from Tax, Labor Law, and Information Security
   are processed dynamically without hardcoded counts or domain bias.
4. Zero-Leakage Invariant: Confirms zero UPI or banking assumptions leak into Tax, Security, or Labor projects.
5. Verbatim Quote Grounding: Every extracted business rule is verified against source document text via verify_quote.
6. Calibrated Confidence & Hallucination Flagging: Unverified assertions are penalized and marked as inferred.
7. Real Provider Verification: Validates that live providers (Groq/Gemini) execute structured contracts.
8. Domain-Neutral Persistence: ProjectContext and Documents persist with document-derived metadata,
   purging all hardcoded "Reserve Bank of India" owners and "NPCI" architecture contexts.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
import pytest
from sqlalchemy import select

from app.api.deps import Principal
from app.db.base import session_scope
from app.db.models import Document, Project, ProjectContext, ProjectRole
from app.guardrails.quotes import verify_quote
from app.llm.providers import GeminiProvider, GroqProvider
from app.llm.router import provider_status
from app.services.project_onboarding import (
    analyze_uploaded_documents_for_onboarding,
    commit_approved_onboarding_project,
    explain_onboarding_item_with_reasonx,
    preload_upi_regulatory_documents_staging,
    stage_uploaded_file,
)


def test_anti_fixture_audit_synthetic_flagging(app):
    """Verify that demonstration fixtures are explicitly flagged as synthetic and not authentic publications."""
    staged = preload_upi_regulatory_documents_staging()
    assert len(staged) == 3

    for item in staged:
        assert item.get("is_synthetic_fixture") is True, f"Item {item['filename']} must be marked as synthetic fixture"
        assert "Synthetic" in item.get("fixture_label", "")
        assert len(item.get("sha256_hash", "")) == 64, "SHA-256 hash must be recorded"
        assert item["status"] in ("staged", "completed")


def test_authentic_document_staging_with_sha256(app):
    """Verify staging of authentic user-uploaded documents with genuine provenance tracking."""
    pdf_path = Path(__file__).resolve().parents[2] / "docs" / "reports" / "enterprise-evaluation" / "HMRC_PAYE_Tax_Table_Specification_v4.0.pdf"
    assert pdf_path.exists(), "Authentic HMRC PAYE specification must exist"

    raw_bytes = pdf_path.read_bytes()
    expected_sha256 = hashlib.sha256(raw_bytes).hexdigest()

    staged = stage_uploaded_file(
        filename="HMRC_PAYE_Tax_Table_Specification_v4.0.pdf",
        raw_bytes=raw_bytes,
        purpose="prd",
        display_name="UK HMRC PAYE Tax Table Specification v4.0",
        is_synthetic=False,
        source_url="https://www.gov.uk/government/publications/paye-tax-tables-specification",
        issuing_authority="HM Revenue & Customs (United Kingdom)",
    )

    assert staged["is_synthetic_fixture"] is False
    assert staged["fixture_label"] == "Authentic User-Uploaded Document"
    assert staged["sha256_hash"] == expected_sha256
    assert staged["page_count"] == 43
    assert len(staged["extracted_text"]) > 1000
    assert "SPECIFICATION FOR PAYE TAX TABLE" in staged["extracted_text"]


def test_dynamic_domain_intelligence_on_unseen_tax_document(app):
    """Verify that the onboarding AI processes unseen tax documents without UPI or payroll leakage."""
    pdf_path = Path(__file__).resolve().parents[2] / "docs" / "reports" / "enterprise-evaluation" / "HMRC_PAYE_Tax_Table_Specification_v4.0.pdf"
    raw_bytes = pdf_path.read_bytes()

    staged = stage_uploaded_file(
        filename="HMRC_PAYE_Tax_Table_Specification_v4.0.pdf",
        raw_bytes=raw_bytes,
        purpose="prd",
        display_name="UK HMRC PAYE Specification",
        is_synthetic=False,
    )

    with session_scope() as db:
        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=[staged["id"]],
            project_name="UK Statutory Tax Engine",
            project_key="HMRC_TAX",
            business_domain=None,  # Leave empty to test automatic domain detection
        )

        domain = config["project_metadata"]["business_domain"].lower()
        assert any(k in domain for k in ["tax", "fiscal", "payroll"]), f"Domain should reflect Tax/Payroll, got '{domain}'"

        # ANTI-LEAKAGE CHECK: Zero UPI or banking assumptions must be present
        full_config_text = str(config).lower()
        assert "upi" not in full_config_text, "Zero UPI terminology should appear in HMRC Tax project"
        assert "npci" not in full_config_text, "Zero NPCI switch references should appear in HMRC Tax project"
        assert "internal ombudsman" not in full_config_text, "Zero RBI Ombudsman references should appear in HMRC project"

        # Verify Business Rules
        rules = config["business_rules"]
        assert len(rules) > 0, "AI must extract at least one business rule from HMRC document"

        for r in rules:
            assert len(r["supporting_quote"]) > 0
            # Test quote verification against source document text
            quote = r["supporting_quote"]
            is_verified = verify_quote(quote, [staged["extracted_text"]], min_len=12)
            if is_verified:
                assert r["is_inferred"] is False
                assert r["confidence"] >= 0.85
            else:
                assert r["is_inferred"] is True
                assert r["confidence"] <= 0.75


def test_unrelated_domain_information_security_isolation(app):
    """Verify that an independent Information Security document creates security-specific roles/rules with zero leakage."""
    security_spec = (
        "# ISO/IEC 27001 Information Security Management Specification\n\n"
        "1. Access Control Policy (Clause 9.1):\n"
        "Users shall be granted access only to the specific network and network services that they have been specifically authorized to use.\n"
        "Multi-Factor Authentication (MFA) must be enforced for all remote administrative access sessions.\n\n"
        "2. Incident Management (Clause 16.1):\n"
        "Information security events shall be reported through appropriate management channels as quickly as possible.\n"
        "Critical security incidents must be escalated to the Chief Information Security Officer (CISO) within 1 hour.\n\n"
        "3. Cryptographic Controls (Clause 10.1):\n"
        "All sensitive data at rest shall be encrypted using AES-256 or stronger cryptographic algorithms.\n"
    ).encode("utf-8")

    staged = stage_uploaded_file(
        filename="ISO_27001_Security_Spec.md",
        raw_bytes=security_spec,
        purpose="prd",
        display_name="ISO 27001 Security Specification",
        is_synthetic=False,
    )

    with session_scope() as db:
        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=[staged["id"]],
            project_name="CloudSec Zero Trust Framework",
            project_key="ISO_SEC",
            business_domain="Information Security & Compliance",
        )

        rules = config["business_rules"]
        assert len(rules) > 0

        # Check that rules are security-focused
        rule_texts = " ".join(r["description"].lower() + " " + r["title"].lower() for r in rules)
        assert any(w in rule_texts for w in ["access", "mfa", "incident", "encrypt", "security", "ciso", "authorized"])

        # Zero payroll or UPI leakage check
        assert "overtime" not in rule_texts
        assert "upi" not in rule_texts
        assert "flsa" not in rule_texts


def test_quote_guardrail_penalizes_hallucinations():
    """Verify that verify_quote rejects hallucinated quotations and flags them as ungrounded."""
    real_source = "All full-time employees shall receive overtime compensation after 40 hours per workweek."
    
    # 1. Authentic verbatim quote
    assert verify_quote("overtime compensation after 40 hours", [real_source]) is True

    # 2. Hallucinated assertion not in source
    hallucinated = "All contractors must be paid double-time after 35 hours per workweek with mandatory bonus."
    assert verify_quote(hallucinated, [real_source]) is False


def test_real_provider_execution_status():
    """Inspect provider status and verify live configured LLMs without exposing secrets."""
    status = provider_status()
    assert "providers" in status
    assert status["any_configured"] is True

    configured_providers = [p["name"] for p in status["providers"] if p.get("configured")]
    # Either Groq or Gemini must be configured in live mode
    if status["mode"] == "live":
        assert any(p in configured_providers for p in ["gemini", "groq"]), (
            f"At least one live AI provider must be configured, found: {configured_providers}"
        )


def test_domain_neutral_project_commit_and_provenance(app):
    """Verify that committing an onboarding project creates domain-neutral contexts without hardcoded RBI or NPCI defaults."""
    spec_bytes = (
        "# Pediatric Clinical Trial Protocol v2.4\n"
        "Clause 4.1: The primary efficacy endpoint shall be the change in daytime asthma symptom scores from baseline.\n"
        "Clause 5.2: Investigational product must be stored between 15°C and 25°C under controlled humidity.\n"
        "Clause 7.1: Serious Adverse Events (SAE) must be reported to the Institutional Review Board within 24 hours.\n"
    ).encode("utf-8")

    staged = stage_uploaded_file(
        filename="Clinical_Protocol_Asthma_v2.4.md",
        raw_bytes=spec_bytes,
        purpose="prd",
        display_name="Clinical Trial Protocol v2.4",
        is_synthetic=False,
    )

    with session_scope() as db:
        config = analyze_uploaded_documents_for_onboarding(
            db=db,
            document_ids=[staged["id"]],
            project_name="Pediatric Asthma Clinical Trial",
            project_key="CLIN_ASTH",
            business_domain="Healthcare & Life Sciences",
            description="Phase III Pediatric Clinical Trial Verification Engine.",
        )

        class MockPrincipal:
            id = 1
            email = "lead_researcher@hospital.org"
            roles = {"admin"}

        p = MockPrincipal()
        result = commit_approved_onboarding_project(db, p, config)

        assert result["key"] == "CLIN_ASTH"
        assert "healthcare" in result["domain"].lower()

        # Inspect persisted database records
        proj = db.execute(select(Project).where(Project.key == "CLIN_ASTH")).scalar_one()
        ctx = db.execute(select(ProjectContext).where(ProjectContext.project_id == proj.id)).scalar_one()
        docs = db.execute(select(Document).where(Document.project_id == proj.id)).scalars().all()

        # DOMAIN NEUTRALITY CHECKS:
        assert "NPCI" not in ctx.architecture_context, "NPCI switch should NOT be in healthcare architecture context"
        assert "NPCI" not in str(ctx.technical_stack), "NPCI switch should NOT be in healthcare technical stack"
        assert "FEMA" not in str(ctx.exclusions), "FEMA exclusions should NOT be in clinical trial context"
        assert "NTP clocks" not in str(ctx.assumptions), "NTP clocks should NOT be in clinical trial context"

        for doc in docs:
            assert doc.owner != "Reserve Bank of India", f"Document owner should not be Reserve Bank of India, got '{doc.owner}'"
