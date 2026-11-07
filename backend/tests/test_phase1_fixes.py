"""Comprehensive unit and regression tests for Phase 1 Fixes (BK-01 and BK-02).

Verifies:
- BK-01: Test Category Persistence across all creation and patch pathways.
- BK-02: Defect Priority Contract Normalization across legacy (p1-p4) and standard (critical-low).
"""
import pytest

from app.core.errors import AppError
from app.db.base import session_scope
from app.db.models import Clause, Defect, Organisation, Project, Requirement, RequirementVersion, TestCase, User
from app.domain.enums import (
    DEFECT_PRIORITIES,
    normalize_defect_priority,
)
from app.services import defects as defect_svc
from app.services.tests import create_test, edit_test


@pytest.fixture
def db(app):
    with session_scope() as session:
        yield session


@pytest.fixture
def test_setup(db):
    """Seed test project and requirement for BK-01/BK-02 tests."""
    org = db.query(Organisation).first()
    if not org:
        org = Organisation(name="Test Org", slug="test-org")
        db.add(org)
        db.flush()

    user = db.query(User).first()

    proj = db.query(Project).filter_by(key="BK1").first()
    if not proj:
        proj = Project(
            key="BK1",
            name="BK Phase 1 Verification Project",
            description="Testing BK fixes",
            organisation_id=org.id,
            owner_id=user.id if user else None,
        )
        db.add(proj)
        db.flush()

    req = db.query(Requirement).filter_by(key="BK1-REQ-001").first()
    if not req:
        req = Requirement(
            key="BK1-REQ-001",
            project_id=proj.id,
            title="Overtime Premium Payment Specification",
            category="functional",
            priority="high",
            current_version=1,
            status="approved",
            evidence_excerpt="All overtime past 40 hours must be compensated at 1.5x regular pay rate.",
        )
        db.add(req)
        db.flush()

        v = RequirementVersion(
            requirement_id=req.id,
            version=1,
            title=req.title,
            description="All overtime past 40 hours must be compensated at 1.5x regular pay rate.",
            business_objective="Ensure accurate overtime pay",
            content_hash="test_content_hash_1",
            change_summary="Initial",
            author_id=user.id if user else None,
        )
        db.add(v)
        db.flush()

        cl = Clause(
            requirement_id=req.id,
            version_id=v.id,
            clause_key="BK1-REQ-001.C1",
            position=1,
            text="All overtime past 40 hours must be compensated at 1.5x regular pay rate.",
            normalized_hash="test_norm_hash_1",
        )
        db.add(cl)
        db.flush()
    db.commit()
    return proj, req


# ---------------------------------------------------------------------------
# BK-01: Test Category Persistence Tests
# ---------------------------------------------------------------------------

def test_bk01_category_persistence_positive(db, test_setup):
    """Positive test category remains positive."""
    proj, req = test_setup
    payload = {
        "title": "Nominal weekly 40h standard pay calculation",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Pay calculated at regular rate",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "positive",
        "steps": [{"action": "Record 40 hours worked", "expected": "Regular pay accrued"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "positive"
    fetched = db.get(TestCase, tc.id)
    assert fetched.test_category == "positive"


def test_bk01_category_persistence_negative(db, test_setup):
    """Negative test category remains negative."""
    proj, req = test_setup
    payload = {
        "title": "Verify negative hour punch is rejected",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Negative hours rejected with validation error",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "negative",
        "steps": [{"action": "Submit -5 hours worked", "expected": "Validation error"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "negative"
    fetched = db.get(TestCase, tc.id)
    assert fetched.test_category == "negative"


def test_bk01_category_persistence_boundary_value(db, test_setup):
    """Boundary-value test category remains boundary_value."""
    proj, req = test_setup
    payload = {
        "title": "Verify boundary at exact 40.0 hours threshold",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Exactly 40.0h receives zero overtime; 40.1h receives 0.1h overtime",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "boundary_value",
        "steps": [{"action": "Record 40.0 hours", "expected": "Zero overtime"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "boundary_value"
    fetched = db.get(TestCase, tc.id)
    assert fetched.test_category == "boundary_value"


def test_bk01_category_persistence_edge_case(db, test_setup):
    """Edge-case test category remains edge_case."""
    proj, req = test_setup
    payload = {
        "title": "Verify split midnight shift edge case during DST transition",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "23-hour DST clock change day calculates 7h regular, 1h overtime correctly",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "edge_case",
        "steps": [{"action": "Submit clock out across 2:00 AM DST shift", "expected": "Clock delta is 7 hours"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "edge_case"
    fetched = db.get(TestCase, tc.id)
    assert fetched.test_category == "edge_case"


def test_bk01_category_missing_defaults_to_positive(db, test_setup):
    """Missing test category receives the intended default 'positive'."""
    proj, req = test_setup
    payload = {
        "title": "Generic functional verification without category",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Calculation nominal",
        "source_quote": "All overtime past 40 hours must be compensated",
        # test_category omitted intentionally
        "steps": [{"action": "Execute calculation", "expected": "Success"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "positive"


def test_bk01_category_boundary_alias_normalized(db, test_setup):
    """'boundary' alias is normalized to 'boundary_value'."""
    proj, req = test_setup
    payload = {
        "title": "Threshold check using legacy alias",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Threshold evaluated",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "boundary",
        "steps": [{"action": "Check boundary", "expected": "Evaluated"}],
    }
    tc = create_test(db, req, payload, actor_id=1, validate=False)
    db.commit()
    assert tc.test_category == "boundary_value"


def test_bk01_category_invalid_rejected(db, test_setup):
    """Invalid test category raises descriptive BadRequest error."""
    proj, req = test_setup
    payload = {
        "title": "Invalid category test",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "N/A",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "non_existent_category",
        "steps": [{"action": "Test", "expected": "Test"}],
    }
    with pytest.raises(AppError) as exc_info:
        create_test(db, req, payload, actor_id=1, validate=False)
    assert "Invalid test category" in str(exc_info.value)


def test_bk01_category_update_via_edit_test(db, test_setup):
    """Test category can be updated via edit_test."""
    proj, req = test_setup
    user = db.query(User).first()
    payload = {
        "title": "Category editable test",
        "clause_keys": ["BK1-REQ-001.C1"],
        "expected_result": "Initial state",
        "source_quote": "All overtime past 40 hours must be compensated",
        "test_category": "positive",
        "steps": [{"action": "Initial step", "expected": "Pass"}],
    }
    tc = create_test(db, req, payload, actor_id=user.id, validate=False)
    db.commit()
    assert tc.test_category == "positive"

    # Edit test category to boundary_value
    edited = edit_test(db, tc, {"test_category": "boundary_value"}, actor=user, note="Changed category")
    db.commit()
    assert edited.test_category == "boundary_value"
    refreshed = db.get(TestCase, tc.id)
    assert refreshed.test_category == "boundary_value"


# ---------------------------------------------------------------------------
# BK-02: Defect Priority Contract Normalization Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("priority_input,expected_canonical", [
    ("p1", "p1"),
    ("P1", "p1"),
    ("critical", "p1"),
    ("CRITICAL", "p1"),
    ("p2", "p2"),
    ("P2", "p2"),
    ("high", "p2"),
    ("HIGH", "p2"),
    ("p3", "p3"),
    ("P3", "p3"),
    ("medium", "p3"),
    ("MEDIUM", "p3"),
    ("p4", "p4"),
    ("P4", "p4"),
    ("low", "p4"),
    ("LOW", "p4"),
])
def test_bk02_normalize_defect_priority_function(priority_input, expected_canonical):
    """normalize_defect_priority correctly normalizes both standard and legacy priority strings."""
    assert normalize_defect_priority(priority_input) == expected_canonical


def test_bk02_create_defect_standard_priorities(db, test_setup):
    """Create defects using standard priority strings (critical, high, medium, low)."""
    proj, req = test_setup
    priorities = [
        ("critical", "critical", "p1"),
        ("high", "high", "p2"),
        ("medium", "medium", "p3"),
        ("low", "low", "p4"),
    ]
    for pri_in, sev_in, expected_pri in priorities:
        defect_data = {
            "title": f"Test Defect created with priority {pri_in}",
            "description": f"Testing priority contract for {pri_in}",
            "severity": sev_in,
            "priority": pri_in,
            "reproduction_steps": "1. Run batch. 2. Observe mismatch.",
            "expected_result": "Calculation matches specification.",
            "actual_result": "Mismatch detected.",
        }
        d = defect_svc.create_manual(db, proj.id, proj.key, defect_data, actor_id=1)
        db.commit()
        assert d.priority == expected_pri
        assert d.severity == sev_in

        # Verify stored record in database
        stored = db.get(Defect, d.id)
        assert stored.priority == expected_pri


def test_bk02_create_defect_legacy_priorities(db, test_setup):
    """Create defects using legacy priority strings (p1, p2, p3, p4)."""
    proj, req = test_setup
    for pri_code in ("p1", "p2", "p3", "p4"):
        defect_data = {
            "title": f"Test Defect with legacy code {pri_code}",
            "description": f"Testing legacy priority {pri_code}",
            "severity": "medium",
            "priority": pri_code,
            "reproduction_steps": "1. Run batch.",
            "expected_result": "Matches.",
            "actual_result": "Diff.",
        }
        d = defect_svc.create_manual(db, proj.id, proj.key, defect_data, actor_id=1)
        db.commit()
        assert d.priority == pri_code


def test_bk02_invalid_defect_priority_rejected(db, test_setup):
    """Invalid defect priorities raise descriptive BadRequest error."""
    proj, req = test_setup
    defect_data = {
        "title": "Invalid Priority Defect",
        "description": "Invalid",
        "severity": "medium",
        "priority": "super_urgent_emergency",
        "reproduction_steps": "1. Error.",
    }
    with pytest.raises(AppError) as exc_info:
        defect_svc.create_manual(db, proj.id, proj.key, defect_data, actor_id=1)
    assert "Invalid defect priority" in str(exc_info.value)


def test_bk02_api_create_defect_with_standard_priority(admin, test_setup):
    """API endpoint accepts standard priority strings ('high', 'critical') without 400 rejection."""
    proj, req = test_setup
    payload = {
        "project_id": proj.id,
        "title": "API Defect with High Priority",
        "description": "Testing POST /api/v1/defects with priority='high'",
        "severity": "high",
        "priority": "high",
        "reproduction_steps": "1. Step 1. 2. Step 2.",
        "expected_result": "Success.",
        "actual_result": "Failure.",
    }
    res = admin.post("/defects", json=payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    body = res.json()
    assert body["priority"] == "p2"  # Canonical normalized representation
    assert body["severity"] == "high"


def test_bk02_api_patch_defect_priority(admin, test_setup):
    """API patch endpoint updates priority using either standard or legacy format."""
    proj, req = test_setup
    # Create defect with p3
    create_res = admin.post("/defects", json={
        "project_id": proj.id,
        "title": "Defect to be patched",
        "severity": "medium",
        "priority": "p3",
        "reproduction_steps": "1. Setup.",
    })
    assert create_res.status_code == 201
    defect_id = create_res.json()["id"]

    # Patch with standard priority "critical"
    patch_res = admin.patch(f"/defects/{defect_id}", json={"priority": "critical"})
    assert patch_res.status_code == 200
    assert patch_res.json()["priority"] == "p1"

    # Patch with legacy priority "p4"
    patch_res2 = admin.patch(f"/defects/{defect_id}", json={"priority": "p4"})
    assert patch_res2.status_code == 200
    assert patch_res2.json()["priority"] == "p4"


def test_bk02_api_filter_defects_by_both_representations(admin, test_setup):
    """API defect list endpoint supports filtering by both 'p1' and 'critical'."""
    proj, req = test_setup
    # Query with priority=p1
    res1 = admin.get(f"/defects?project_id={proj.id}&priority=p1")
    assert res1.status_code == 200

    # Query with priority=critical
    res2 = admin.get(f"/defects?project_id={proj.id}&priority=critical")
    assert res2.status_code == 200
    assert res1.json()["total"] == res2.json()["total"]


def test_bk02_legacy_database_records_readable(db):
    """All existing defect records in the database remain intact and readable."""
    defects = db.query(Defect).all()
    assert len(defects) >= 14, "Expected pre-existing defects to remain readable"
    for d in defects:
        assert d.priority in DEFECT_PRIORITIES, f"Defect {d.key} has non-canonical priority: {d.priority}"
        assert d.severity in ("critical", "high", "medium", "low")
