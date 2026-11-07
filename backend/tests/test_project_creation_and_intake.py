"""Comprehensive test suite for Phase 1: Project Creation, Requirements Intake & Backend.

Covers:
1. Key validation endpoint (GET /api/v1/projects/validate-key)
2. Full multi-step project creation with ProjectContext, ProjectRoles, and BusinessScenarios
3. Document uploads with enriched metadata (display_name, version, owner, priority, checksum)
4. Document processing jobs tracking (GET /api/v1/documents/{id}/jobs)
5. Document metadata update (PATCH /api/v1/documents/{id})
6. Document retry mechanism (POST /api/v1/documents/{id}/retry)
7. Project Context CRUD (GET, PUT /api/v1/projects/{id}/context)
8. Project Roles CRUD (GET, POST, DELETE /api/v1/projects/{id}/roles)
9. Business Scenarios CRUD (GET, POST, DELETE /api/v1/projects/{id}/scenarios)
10. Preservation of legacy projects (ECHO, CUREON) during intake operations
"""
from __future__ import annotations


def test_validate_project_key(admin):
    # Test valid key
    r = admin.c.get("/api/v1/projects/validate-key?key=VALID1")
    assert r.status_code == 200
    assert r.json()["valid"] is True

    # Test invalid format
    r = admin.c.get("/api/v1/projects/validate-key?key=X")
    assert r.status_code == 200
    assert r.json()["valid"] is False

    # Test already existing key (PAY exists in seeded test db)
    r = admin.c.get("/api/v1/projects/validate-key?key=PAY")
    assert r.status_code == 200
    assert r.json()["valid"] is False
    assert "already in use" in r.json()["message"]


def test_full_project_creation_wizard_intake(admin):
    # 1. First upload a document that will be linked during project creation
    doc_res = admin.c.post(
        "/api/v1/documents",
        data={
            "display_name": "Core Banking Architecture Spec",
            "document_type": "technical_spec",
            "purpose": "technical_spec",
            "description": "High-level architecture and interfaces",
            "version": "2.1.0",
            "owner": "Sarah Jenkins",
            "document_date": "2026-11-01",
            "related_module": "Ledger & Settlement",
            "priority": "critical",
            "processing_instructions": "Focus on idempotency and double-entry book-keeping guarantees.",
            "auto_process": "false",
        },
        files={
            "file": (
                "banking_arch.md",
                b"# Banking Architecture\nEvery transaction shall be recorded with an idempotent transaction key.\nAccount balances must never fall below zero.",
                "text/markdown",
            )
        },
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert doc_res.status_code == 201, doc_res.text
    uploaded_doc = doc_res.json()
    assert uploaded_doc["display_name"] == "Core Banking Architecture Spec"
    assert uploaded_doc["document_type"] == "technical_spec"
    assert uploaded_doc["priority"] == "critical"
    assert uploaded_doc["checksum"] is not None
    assert len(uploaded_doc["checksum"]) == 64  # SHA-256
    doc_id = uploaded_doc["id"]

    # 2. Create project using the 5-stage creation payload
    create_payload = {
        "key": "BANKCORE",
        "name": "NextGen Core Banking Engine",
        "description": "High-throughput distributed ledger and payment engine",
        "project_type": "requirements_based",
        "business_domain": "Fintech & Banking",
        "product_type": "Distributed Backend & Core Ledger",
        "business_goal": "Achieve 50,000 TPS settlement with sub-5ms latency and zero financial drift.",
        "owner_name": "Devin Reynolds",
        "team": "Ledger Core Engineering",
        "version": "1.0.0",
        "environment_name": "Staging Simulation Core",
        "context": {
            "product_overview": "NextGen Core Banking platform powering multi-currency retail and commercial transactions.",
            "problem_statement": "Legacy mainframes cannot scale beyond 2,000 TPS or support real-time cross-border settlements.",
            "target_users": ["Retail Customer", "Treasury Operator", "Compliance Officer", "System Auditor"],
            "product_modules": ["Ledger Core", "Card Processing", "Real-Time Gross Settlement", "Fraud Prevention"],
            "architecture_context": "Microservices event-sourced architecture with CockroachDB and Kafka.",
            "technical_stack": {"language": "Go / Python", "database": "SQLite / CockroachDB", "queue": "Kafka"},
            "external_integrations": ["SWIFT Network", "FedNow", "Mastercard Send", "Experian KYC"],
            "business_rules": [
                "Every transaction debit must equal credit",
                "Transactions exceeding $10,000 require secondary AML validation",
            ],
            "security_expectations": "PCI-DSS Level 1 compliant, HSM hardware-backed key storage, TLS 1.3 enforced.",
            "privacy_requirements": "PII tokenization and field-level AES-GCM encryption for all cardholder data.",
            "performance_expectations": "P99 latency under 15ms at 50,000 sustained operations per second.",
            "availability_expectations": "99.999% availability with multi-region active-active disaster recovery.",
            "regulatory_standards": ["PCI-DSS", "SOC 2 Type II", "ISO 20022", "GDPR"],
            "assumptions": ["Underlying payment gateways maintain 99.9% uptime"],
            "exclusions": ["Cash handling and physical ATM hardware maintenance"],
            "dependencies": ["Core HSM key service and real-time AML scoring engine"],
            "additional_context": "Designed for zero-downtime blue/green schema migrations.",
        },
        "roles": [
            {
                "role_name": "Treasury Operator",
                "description": "Manages liquidity, daily settlement, and reserves balance.",
                "permissions": ["treasury.reconcile", "ledger.read", "transfers.approve_large"],
                "responsibilities": "Ensures central bank accounts maintain adequate reserve balances.",
                "restrictions": "Cannot create individual accounts or modify ledger history.",
            },
            {
                "role_name": "Compliance Auditor",
                "description": "Performs AML checks and generates regulatory reports.",
                "permissions": ["compliance.read", "audit.export"],
                "responsibilities": "Verifies all flagged transactions are investigated within 24 hours.",
                "restrictions": "Read-only access across all transaction data.",
            },
        ],
        "scenarios": [
            {
                "title": "Real-time High Value Wire Transfer",
                "description": "Corporate client executes a $250,000 wire transfer to an overseas correspondent bank.",
                "actor": "Corporate Treasury Officer",
                "preconditions": "Account balance >= $250,000 and two-factor approval completed.",
                "expected_outcome": "Funds debited from sender, reserved in escrow, AML passed, and ISO 20022 pacs.008 dispatched.",
                "business_rules": "Requires dual authorization and real-time OFAC sanction screening.",
                "module": "Real-Time Gross Settlement",
            }
        ],
        "document_ids": [doc_id],
        "auto_extract": False,
    }

    p_resp = admin.c.post("/api/v1/projects", json=create_payload, headers={"X-CSRF-Token": admin.csrf})
    assert p_resp.status_code == 201, p_resp.text
    p_data = p_resp.json()
    project_id = p_data["id"]
    assert p_data["key"] == "BANKCORE"
    assert p_data["business_goal"] == "Achieve 50,000 TPS settlement with sub-5ms latency and zero financial drift."
    assert p_data["owner_name"] == "Devin Reynolds"
    assert p_data["team"] == "Ledger Core Engineering"

    # 3. Verify Document was linked to the project
    docs_r = admin.c.get(f"/api/v1/projects/{project_id}/documents")
    assert docs_r.status_code == 200
    p_docs = docs_r.json()
    assert len(p_docs) == 1
    assert p_docs[0]["id"] == doc_id
    assert p_docs[0]["display_name"] == "Core Banking Architecture Spec"
    assert p_docs[0]["project_id"] == project_id

    # 4. Check Project Context endpoint
    ctx_r = admin.c.get(f"/api/v1/projects/{project_id}/context")
    assert ctx_r.status_code == 200
    ctx_data = ctx_r.json()
    assert "PCI-DSS" in ctx_data["regulatory_standards"]
    assert ctx_data["security_expectations"].startswith("PCI-DSS Level 1")
    assert len(ctx_data["business_rules"]) == 2

    # Update context
    ctx_update_r = admin.c.put(
        f"/api/v1/projects/{project_id}/context",
        json={
            **ctx_data,
            "security_expectations": "PCI-DSS Level 1 compliant with Quantum-Resistant key derivation.",
        },
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert ctx_update_r.status_code == 200
    assert "Quantum-Resistant" in ctx_update_r.json()["security_expectations"]

    # 5. Check Project Roles CRUD
    roles_r = admin.c.get(f"/api/v1/projects/{project_id}/roles")
    assert roles_r.status_code == 200
    roles = roles_r.json()
    assert len(roles) == 2
    role_names = [r["role_name"] for r in roles]
    assert "Treasury Operator" in role_names
    assert "Compliance Auditor" in role_names

    # Add a new role
    new_role_r = admin.c.post(
        f"/api/v1/projects/{project_id}/roles",
        json={
            "role_name": "Security Officer",
            "description": "Administers security keys and encryption policies.",
            "permissions": ["keys.manage", "policies.write"],
            "responsibilities": "Rotate HSM master keys annually.",
            "restrictions": "Cannot execute financial transactions.",
        },
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert new_role_r.status_code == 201
    sec_role_id = new_role_r.json()["id"]

    # Delete the newly added role
    del_role_r = admin.c.delete(f"/api/v1/projects/{project_id}/roles/{sec_role_id}", headers={"X-CSRF-Token": admin.csrf})
    assert del_role_r.status_code == 204

    # 6. Check Business Scenarios CRUD
    scenarios_r = admin.c.get(f"/api/v1/projects/{project_id}/scenarios")
    assert scenarios_r.status_code == 200
    scenarios = scenarios_r.json()
    assert len(scenarios) == 1
    assert scenarios[0]["title"] == "Real-time High Value Wire Transfer"

    # Add a new scenario
    new_sc_r = admin.c.post(
        f"/api/v1/projects/{project_id}/scenarios",
        json={
            "title": "Account Balance Freeze on Sanctions Hit",
            "description": "Trigger instant automated freeze if account matches OFAC SDN list.",
            "actor": "Real-time AML Gateway",
            "preconditions": "Account is active.",
            "expected_outcome": "Debit and credit permissions revoked; incident ticket dispatched.",
            "business_rules": "Freeze must complete in < 50ms.",
            "module": "Fraud Prevention",
        },
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert new_sc_r.status_code == 201
    sec_sc_id = new_sc_r.json()["id"]

    # Delete the newly added scenario
    del_sc_r = admin.c.delete(f"/api/v1/projects/{project_id}/scenarios/{sec_sc_id}", headers={"X-CSRF-Token": admin.csrf})
    assert del_sc_r.status_code == 204

    # 7. Test Document Processing and Job Tracking
    proc_r = admin.c.post(f"/api/v1/documents/{doc_id}/process", headers={"X-CSRF-Token": admin.csrf})
    assert proc_r.status_code == 200
    proc_data = proc_r.json()
    assert proc_data["status"] == "completed"
    assert proc_data["extraction_status"] == "extracted"

    jobs_r = admin.c.get(f"/api/v1/documents/{doc_id}/jobs")
    assert jobs_r.status_code == 200
    jobs = jobs_r.json()
    assert len(jobs) >= 1
    assert jobs[0]["status"] == "completed"

    # Test Document Patch Metadata
    patch_r = admin.c.patch(
        f"/api/v1/documents/{doc_id}",
        json={"display_name": "Updated Core Banking Spec v2.1", "version": "2.1.1"},
        headers={"X-CSRF-Token": admin.csrf},
    )
    assert patch_r.status_code == 200
    assert patch_r.json()["display_name"] == "Updated Core Banking Spec v2.1"
    assert patch_r.json()["version"] == "2.1.1"

    # Test Document Retry
    retry_r = admin.c.post(f"/api/v1/documents/{doc_id}/retry", headers={"X-CSRF-Token": admin.csrf})
    assert retry_r.status_code == 200
    assert retry_r.json()["status"] == "completed"

    # 8. Test Requirement Extraction on BANKCORE
    analyze_r = admin.c.post(f"/api/v1/projects/{project_id}/analyze-requirements", headers={"X-CSRF-Token": admin.csrf})
    assert analyze_r.status_code == 200
    analyzed = analyze_r.json()
    assert analyzed["total_extracted"] >= 4

    # 9. Verify Existing Projects remain untouched and intact
    proj_list = admin.c.get("/api/v1/projects").json()
    keys = [p["key"] for p in proj_list["items"]]
    assert "PAY" in keys
    assert "BEN" in keys
    assert "BANKCORE" in keys
