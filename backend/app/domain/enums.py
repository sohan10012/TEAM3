"""Domain enumerations and state machines (deterministic)."""
from __future__ import annotations

ROLES = {
    "admin": "Full administrative access to all projects and settings",
    "qa_engineer": "Author requirements and tests, execute suites, manage defects",
    "reviewer": "Review and approve generated tests and defect recommendations",
}

# role -> permissions
PERMISSIONS: dict[str, set[str]] = {
    "admin": {"*"},
    "qa_engineer": {"project.read", "requirement.write", "requirement.analyse", "test.write", "suite.write",
                    "suite.execute", "execution.read", "defect.write", "defect.transition", "export.read",
                    "eval.run", "integration.read", "audit.read"},
    "reviewer": {"project.read", "test.review", "defect.approve", "defect.transition", "execution.read",
                 "export.read", "integration.read", "audit.read"},
}

TEST_TYPES = ("functional", "positive", "negative", "boundary", "regression", "security", "compliance", "integration")
ALL_TEST_CATEGORIES = (
    "positive",
    "negative",
    "boundary_value",
    "edge_case",
    "input_validation",
    "business_rule",
    "permission_role",
    "security",
    "error_handling",
    "integration",
)
PRIORITIES = ("critical", "high", "medium", "low")
SEVERITIES = ("critical", "high", "medium", "low")
DEFECT_PRIORITIES = ("p1", "p2", "p3", "p4")
DEFECT_PRIORITY_MAP: dict[str, str] = {
    "p1": "p1",
    "p2": "p2",
    "p3": "p3",
    "p4": "p4",
    "critical": "p1",
    "high": "p2",
    "medium": "p3",
    "low": "p4",
}
DEFECT_PRIORITY_REVERSE_MAP: dict[str, str] = {
    "p1": "critical",
    "p2": "high",
    "p3": "medium",
    "p4": "low",
}
ALL_ACCEPTABLE_DEFECT_PRIORITIES = tuple(DEFECT_PRIORITY_MAP.keys())


def normalize_defect_priority(val: str | None) -> str:
    """Normalize defect priority from either standard (critical/high/medium/low) or legacy (p1-p4) representation."""
    if not val:
        return "p3"
    cleaned = str(val).strip().lower()
    if cleaned in DEFECT_PRIORITY_MAP:
        return DEFECT_PRIORITY_MAP[cleaned]
    raise ValueError(f"Invalid defect priority '{val}'. Must be one of: {', '.join(ALL_ACCEPTABLE_DEFECT_PRIORITIES)}")

FAILURE_CATEGORIES = ("application_defect", "test_automation_defect", "configuration_issue", "environment_failure",
                      "data_validation_failure", "permission_issue", "timeout", "unknown")

DEFECT_TRANSITIONS: dict[str, set[str]] = {
    "open": {"triaged", "closed"},
    "triaged": {"assigned", "closed"},
    "assigned": {"in_progress", "triaged"},
    "in_progress": {"fixed", "assigned"},
    "fixed": {"ready_for_retest", "reopened"},
    "ready_for_retest": {"verified", "reopened"},
    "verified": {"closed", "reopened"},
    "closed": {"reopened"},
    "reopened": {"triaged", "assigned", "in_progress"},
}

TEST_REVIEW_DECISIONS = ("approve", "reject", "request_changes")
EXECUTABLE_TEST_STATUS = "approved"


def can_transition_defect(current: str, target: str) -> bool:
    return target in DEFECT_TRANSITIONS.get(current, set())


def has_permission(roles: set[str], perm: str) -> bool:
    for r in roles:
        perms = PERMISSIONS.get(r, set())
        if "*" in perms or perm in perms:
            return True
    return False
