"""Idempotent seed service for the permanent default Dayforce Requirements-Based project.

Initializes:
1. DAYFORCE Project ("Dayforce — Enterprise HR & Workforce Management")
2. Deep ProjectContext, 7 Modules, 5 ProjectRoles, and 10 BusinessScenarios
3. 4 Real Ingested Documents (PDF, DOCX, XLSX, MD) with ExtractedContent persistence
4. 56 Extracted Requirements (42 Functional, 8 Non-Functional, 6 Business Rules)
5. 4 Ambiguities and 1 Contradiction (Overtime multiplier 1.5x vs 2.0x)
6. 56 Given/When/Then Acceptance Criteria
7. 126 Test Cases (98 Approved, 18 Pending Review, 8 Changes Requested, 2 Failed)
8. 24 Executions (10 Validation, 12 Simulation, 2 External) -> 19 Passed, 3 Failed, 2 Blocked
9. 3 Production Defects linked to failed simulation/validation runs
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.base import session_scope, utcnow
from app.db.models import (
    AcceptanceCriterion,
    BusinessScenario,
    Defect,
    Document,
    DocumentProcessingJob,
    Environment,
    Execution,
    ExecutionResult,
    ExtractedContent,
    Module,
    Organisation,
    Project,
    ProjectContext,
    ProjectMember,
    ProjectRole,
    Requirement,
    RequirementClarification,
    RequirementVersion,
    TestCase,
    User,
)
from app.services.document_processor import process_document, save_document_file, validate_file_upload

log = logging.getLogger("tracetest.seed.dayforce")


def ensure_dayforce_project(db: Session, force_reseed: bool = False) -> Project:
    """Ensure the DAYFORCE requirements-based project is fully initialized and persisted.

    Idempotent: if DAYFORCE already exists and has documents, requirements, tests, and executions,
    it returns the existing project without duplicating records.
    """
    settings = get_settings()

    # Step 1: Find or create Organisation and Admin User
    org = db.execute(select(Organisation)).scalars().first()
    if not org:
        org = Organisation(name="TraceTest Quality Engineering", slug="tracetest-qe")
        db.add(org)
        db.flush()

    admin = db.execute(select(User).where(User.email == settings.admin_email)).scalars().first()
    if not admin:
        admin = db.execute(select(User)).scalars().first()
    admin_id = admin.id if admin else None

    # Step 2: Check if DAYFORCE project already exists
    proj = db.execute(select(Project).where(Project.key == "DAYFORCE")).scalars().first()

    if proj and not force_reseed:
        # Check if project already has complete data
        doc_count = db.execute(select(Document).where(Document.project_id == proj.id)).scalars().all()
        req_count = db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()
        test_count = db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars().all()
        exec_count = db.execute(select(Execution).where(Execution.project_id == proj.id)).scalars().all()

        if len(doc_count) >= 3 and len(req_count) >= 50 and len(test_count) >= 100 and len(exec_count) >= 20:
            log.info("Dayforce project already fully initialized (ID: %d, Req: %d, Tests: %d, Exec: %d).",
                     proj.id, len(req_count), len(test_count), len(exec_count))
            return proj
        else:
            log.info("Dayforce project exists (ID: %d) but has incomplete data. Re-hydrating...", proj.id)
    elif not proj:
        desired_id = 9
        id_free = db.execute(select(Project).where(Project.id == desired_id)).scalar_one_or_none() is None
        p_kwargs: dict[str, Any] = {
            "key": "DAYFORCE",
            "name": "Dayforce — Enterprise HR & Workforce Management",
            "description": "Enterprise HR and workforce management platform for employee lifecycle, time, attendance and payroll.",
            "organisation_id": org.id,
            "project_type": "requirements_based",
            "status": "active",
        }
        if id_free:
            p_kwargs["id"] = desired_id
        proj = Project(**p_kwargs)
        db.add(proj)
        db.flush()

    # Populate Project Attributes
    proj.name = "Dayforce — Enterprise HR & Workforce Management"
    proj.description = "Enterprise HR and workforce management platform for employee lifecycle, time, attendance and payroll."
    proj.project_type = "requirements_based"
    proj.status = "active"
    proj.business_domain = "Enterprise SaaS"
    proj.product_type = "Web Application"
    proj.primary_goal = "Validate requirements and ensure test coverage"
    proj.target_audience = "Employees, HR Administrators, Managers, Payroll Administrators, System Administrators"
    proj.regulatory_standards = ["FLSA", "SOC 2 Type II", "GDPR", "CCPA"]
    proj.technical_assumptions = [
        "Distributed microservices backend running Python and PostgreSQL",
        "OAuth 2.0 with PKCE and Bearer JWT for all API sessions",
        "Sub-500ms p95 latency requirement for edge attendance kiosks",
    ]
    proj.business_scenarios = [
        "Employee onboarding and directory synchronization",
        "Employee clock-in and punch pairing with geolocation",
        "Employee clock-out and meal break compliance calculation",
        "Late arrival grace period evaluation",
        "Weekly overtime calculation according to FLSA rules",
        "Paid annual vacation request submission and probation check",
        "Manager leave approval and delegation workflow",
        "Gross-to-net payroll batch execution and tax deduction calculation",
        "Unauthorized administrative access attempt and account lockout",
        "Automated audit logging of timesheet manual adjustments",
    ]
    proj.functional_expectations = [
        "The system shall support high-throughput punch ingestion up to 5,000 punches per minute.",
        "The system must validate department codes and manager hierarchies on employee creation.",
        "The system shall enforce mandatory 15-minute inactivity logout for administrative sessions.",
    ]
    proj.created_at = datetime(2026, 11, 7, 10, 45, 0)
    proj.updated_at = datetime(2026, 11, 7, 10, 55, 0)
    db.flush()

    # Step 3: Populate ProjectContext
    ctx = db.execute(select(ProjectContext).where(ProjectContext.project_id == proj.id)).scalars().first()
    if not ctx:
        ctx = ProjectContext(project_id=proj.id)
        db.add(ctx)
    ctx.executive_summary = (
        "Dayforce Platform delivers unified enterprise human capital management covering employee lifecycle, "
        "time & attendance tracking, leave governance, and gross-to-net payroll calculations."
    )
    ctx.business_rules = [
        "Standard workweek is 40 hours across 5 days (Monday to Friday).",
        "Overtime is calculated at 1.5x regular pay after 40 hours worked in a week (FLSA compliance).",
        "Probationary period is 90 days before paid annual leave eligibility accrues.",
        "Managers can only approve leave requests for employees directly reporting to them.",
        "Session inactivity timeout is 15 minutes for administrative sessions.",
        "Clock-in punches within 5 minutes of scheduled shift are treated as on-time.",
    ]
    ctx.security_expectations = (
        "Multi-factor authentication (MFA) required for all administrative roles. "
        "Role-based access control (RBAC) enforced across all REST endpoints. "
        "Zero plaintext storage of sensitive PII (AES-256 encrypted at rest, TLS 1.3 in transit). "
        "Session tokens expire and are rejected after 15 minutes of inactivity with 401 Unauthorized."
    )
    ctx.privacy_expectations = "GDPR and CCPA compliant data handling with automated subject access request exports."
    ctx.performance_expectations = "99.9% uptime availability during core hours, p95 API response times under 500ms."
    ctx.constraints = ["Must integrate with existing corporate LDAP/SAML identity providers."]
    ctx.dependencies = ["Corporate Identity Provider (OAuth2/OIDC)", "Automated Clearing House (ACH) Banking API"]
    ctx.out_of_scope = ["Physical biometric hardware firmware updates", "Third-party pension asset investment management"]
    ctx.regulatory_standards = ["FLSA", "SOC 2 Type II", "GDPR", "CCPA"]

    # Step 4: Populate Modules
    existing_modules = {m.name: m for m in db.execute(select(Module).where(Module.project_id == proj.id)).scalars().all()}
    module_defs = [
        ("EMP", "Employee Management", "Centralized worker directory, onboarding, and compensation records."),
        ("TNA", "Time and Attendance", "Punch ingestion, punch pairing, meal breaks, and shift schedules."),
        ("LVE", "Leave Management", "Accrual rules, vacation balances, requests, and manager approvals."),
        ("PAY", "Payroll", "Gross-to-net pay calculation, overtime differentials, and tax deductions."),
        ("RBC", "Role-Based Access Control", "Permission matrices, role hierarchies, and session security."),
        ("ESS", "Employee Self-Service", "Worker portal for viewing timesheets, requesting leave, and downloading pay stubs."),
        ("APR", "Manager Approvals", "Manager dashboard for timesheet sign-off, leave approvals, and exception handling."),
    ]
    for m_code, m_name, m_desc in module_defs:
        if m_name not in existing_modules:
            mod = Module(project_id=proj.id, code=m_code, name=m_name, description=m_desc)
            db.add(mod)
            db.flush()
            existing_modules[m_name] = mod

    # Step 5: Populate ProjectRoles
    existing_roles = {r.role_name: r for r in db.execute(select(ProjectRole).where(ProjectRole.project_id == proj.id)).scalars().all()}
    role_defs = [
        ("HR Administrator", "Manages organization structures, employee records, and compliance policies.",
         ["employee.read", "employee.write", "leave.admin", "audit.read"],
         "Employee onboarding and master data accuracy.", "Cannot modify payroll payout bank accounts directly."),
        ("Manager", "Supervises team shifts, approves timesheets and validates leave requests.",
         ["attendance.read", "attendance.approve", "leave.read", "leave.approve", "schedule.write"],
         "Shift coverage and timely attendance approval.", "Restricted to direct and indirect team reports only."),
        ("Employee", "Records daily work hours, views timesheets, and submits time-off requests.",
         ["attendance.punch", "leave.submit", "timesheet.read_self", "profile.read_self"],
         "Timely punch recording and accurate time-off requests.", "Cannot view other employee records."),
        ("Payroll Administrator", "Executes gross-to-net payroll batches and verifies tax deductions.",
         ["payroll.calculate", "payroll.execute", "tax.calculate", "reports.export"],
         "Accurate wage disbursement and statutory tax compliance.", "Cannot alter employee base wage rates."),
        ("System Administrator", "Configures security parameters, integration endpoints, and audit retention.",
         ["system.admin", "security.configure", "audit.full", "integration.manage"],
         "Platform reliability and authentication security.", "Prohibited from viewing unmasked compensation data."),
    ]
    for r_name, r_desc, r_perms, r_resp, r_restr in role_defs:
        if r_name not in existing_roles:
            r = ProjectRole(
                project_id=proj.id,
                role_name=r_name,
                description=r_desc,
                permissions=r_perms,
                responsibilities=r_resp,
                restrictions=r_restr,
            )
            db.add(r)
            db.flush()
            existing_roles[r_name] = r

    # Step 6: Populate BusinessScenarios
    existing_scenarios = {s.title: s for s in db.execute(select(BusinessScenario).where(BusinessScenario.project_id == proj.id)).scalars().all()}
    scenario_defs = [
        ("Employee Onboarding", "HR Administrator", "Process new employee hire details and create directory record.",
         "Employee accepted formal offer and signed agreements.",
         "Active employee profile is created with unique employee ID and initial leave accrual balance.",
         "Tax identification number and legal name are mandatory.", "Employee Management"),
        ("Employee Clock-In", "Employee", "Record shift attendance punch at beginning of work shift.",
         "Employee is registered and active; kiosk device is authenticated.",
         "Punch is recorded with timestamp and geolocation; confirmation is shown to worker.",
         "Duplicate punches within 60 seconds are rejected.", "Time and Attendance"),
        ("Late Arrival Detection", "Employee", "Detect punch event submitted after scheduled shift start.",
         "Employee arrives more than 5 minutes past scheduled shift start.",
         "System tags punch as late arrival and dispatches alert notification to shift manager.",
         "Grace period is exactly 5 minutes.", "Time and Attendance"),
        ("Overtime Calculation", "Payroll Engine", "Calculate overtime hours exceeding standard workweek.",
         "Employee has completed 45 hours in a single Monday-Friday workweek.",
         "System allocates 40 regular hours and 5 overtime hours calculated at 1.5x regular pay.",
         "FLSA weekly threshold of 40 hours.", "Payroll"),
        ("Leave Request Submission", "Employee", "Submit planned paid time-off request.",
         "Employee has completed 90-day probationary period and has sufficient balance.",
         "Leave request is created in 'pending_approval' status and assigned to direct manager.",
         "Minimum increment is 0.5 days; balance must be non-negative.", "Leave Management"),
        ("Leave Approval", "Manager", "Review and authorize team member leave request.",
         "Pending leave request exists from a direct report.",
         "Request status transitions to 'approved'; employee vacation balance is debited.",
         "Only direct manager or authorized delegate can approve.", "Manager Approvals"),
        ("Unauthorized Profile Access", "Unauthorized User", "Detect and reject unauthorized employee profile access.",
         "Employee tries to access another worker's compensation stubs.",
         "System denies access with HTTP 403 Forbidden and records high-severity security audit event.",
         "Strict RBAC data boundary enforcement.", "Role-Based Access Control"),
        ("Missed Punch Exception", "Manager", "Resolve unclosed shift punches with manager timesheet adjustment.",
         "Employee forgot to clock out at shift conclusion.",
         "System holds timesheet from final payroll batch until manager supplies punch adjustment and reason code.",
         "Audit trail mandatory for all timesheet modifications.", "Time and Attendance"),
        ("Payroll Batch Execution", "Payroll Administrator", "Execute gross-to-net payroll calculation batch.",
         "All department timesheets for the period are signed off.",
         "Gross-to-net pay is computed, tax deductions applied, and encrypted pay statements generated.",
         "Cutoff deadline strictly enforced.", "Payroll"),
        ("Session Inactivity Timeout", "System Security", "Terminate idle user sessions after 15 minutes of inactivity.",
         "Authenticated administrative user is idle for 15 minutes.",
         "Session token is invalidated; user is redirected to login prompt with session timeout message.",
         "15 minutes inactivity threshold.", "Role-Based Access Control"),
    ]
    for s_title, s_actor, s_desc, s_pre, s_out, s_rules, s_mod in scenario_defs:
        if s_title not in existing_scenarios:
            sc = BusinessScenario(
                project_id=proj.id,
                title=s_title,
                actor=s_actor,
                description=s_desc,
                preconditions=s_pre,
                expected_outcome=s_out,
                business_rules=s_rules,
                module=s_mod,
            )
            db.add(sc)
            db.flush()
            existing_scenarios[s_title] = sc

    # Step 7: Ingest Demonstration Documents from data/dayforce_sample_docs/
    doc_specs = [
        ("Dayforce_PRD_v1.2.pdf", "Dayforce Product Requirements Document", "prd", "1.2",
         "Product Requirements Document (PRD)", "Product Management", datetime(2026, 11, 5),
         "Employee Lifecycle, Time & Attendance", "high"),
        ("Dayforce_SRS_v1.0.docx", "Dayforce Software Requirements Specification", "srs", "1.0",
         "Software Requirements Specification (SRS)", "Architecture Team", datetime(2026, 11, 5),
         "Core Architecture & Governance", "high"),
        ("Business_Rules.xlsx", "Business Rules & Configurations", "brd", "1.0",
         "Business Rules & Configurations", "Compliance Team", datetime(2026, 11, 5),
         "Attendance & Payroll Policy", "high"),
        ("Dayforce_API_Integration.md", "Dayforce REST API & Integration Specification", "api_spec", "1.0",
         "API Specification", "Integration Engineering", datetime(2026, 11, 6),
         "API & Integration Gateway", "medium"),
    ]

    sample_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "dayforce_sample_docs"
    existing_docs = {d.filename: d for d in db.execute(select(Document).where(Document.project_id == proj.id)).scalars().all()}

    ingested_docs = []
    for fname, disp_name, purpose, ver, d_type, owner, d_date, rel_mod, prio in doc_specs:
        src_path = sample_dir / fname
        if not src_path.exists():
            log.warning("Sample document %s not found on disk at %s", fname, src_path)
            continue

        raw_bytes = src_path.read_bytes()
        safe_name, file_type, size = validate_file_upload(fname, raw_bytes)
        checksum = hashlib.sha256(raw_bytes).hexdigest()

        # Save file to project storage location
        from app.services.document_processor import get_documents_storage_dir
        storage_dir = get_documents_storage_dir(proj.id)
        target_path = storage_dir / f"dayforce_{fname}"
        target_path.write_bytes(raw_bytes)

        doc = existing_docs.get(fname)
        if not doc:
            doc = Document(
                project_id=proj.id,
                display_name=disp_name,
                filename=fname,
                file_path=str(target_path),
                file_type=file_type,
                file_size_bytes=size,
                purpose=purpose,
                document_type=purpose,
                version=ver,
                owner=owner,
                document_date=d_date.strftime("%b %d, %Y"),
                related_module=rel_mod,
                priority=prio,
                status="completed",
                upload_status="completed",
                extraction_status="completed",
                checksum=checksum,
                created_at=datetime(2026, 11, 7, 10, 48, 0),
                updated_at=datetime(2026, 11, 7, 10, 50, 0),
            )
            db.add(doc)
            db.flush()
            existing_docs[fname] = doc
        else:
            doc.file_path = str(target_path)
            db.flush()

        # Run process_document so ExtractedContent and sections are created
        doc = process_document(db, doc.id)
        doc.status = "completed"
        doc.extraction_status = "completed"
        ingested_docs.append(doc)

    db.commit()

    # Step 8: Populate 56 Requirements (42 Functional, 8 Non-Functional, 6 Business Rules)
    # Check if requirements already populated
    existing_reqs = db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()
    if len(existing_reqs) < 56:
        # Clear any partial requirements to ensure clean, accurate counts
        for r in existing_reqs:
            db.execute(delete(AcceptanceCriterion).where(AcceptanceCriterion.requirement_id == r.id))
            db.execute(delete(TestCase).where(TestCase.requirement_id == r.id))
            db.execute(delete(RequirementVersion).where(RequirementVersion.requirement_id == r.id))
            db.execute(delete(RequirementClarification).where(RequirementClarification.requirement_id == r.id))
            db.delete(r)
        db.commit()

        # Definitions for 56 precise Dayforce requirements matching Screenshot 2:
        # 42 Functional, 8 Non-Functional, 6 Business Rules
        prd_doc = existing_docs.get("Dayforce_PRD_v1.2.pdf")
        srs_doc = existing_docs.get("Dayforce_SRS_v1.0.docx")
        br_doc = existing_docs.get("Business_Rules.xlsx")
        api_doc = existing_docs.get("Dayforce_API_Integration.md")

        req_defs = [
            # 1..42: Functional Requirements
            ("Employee Onboarding Registration", "The system shall record new employee hires with mandatory legal name, tax identification number, date of birth, and assigned work location.", "functional", "high", prd_doc, "2.1 Onboarding and Profile Maintenance", "Page 1"),
            ("Employee Email Uniqueness", "The system must validate that employee email addresses are unique across the active organization directory.", "functional", "high", prd_doc, "2.1 Onboarding and Profile Maintenance", "Page 1"),
            ("Tax Identification Masking", "The system shall enforce role-based permissions prohibiting non-administrative personnel from viewing unmasked tax identification numbers.", "functional", "critical", prd_doc, "2.1 Onboarding and Profile Maintenance", "Page 1"),
            ("Employee Document Upload & Scanning", "The system will support asynchronous employee document upload with virus scanning and automated audit logging.", "functional", "medium", prd_doc, "2.1 Onboarding and Profile Maintenance", "Page 1"),
            ("Digital Clock-In via Web & Mobile", "The system shall allow registered employees to record digital clock-in and clock-out punches via web portal and mobile clients.", "functional", "high", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Punch Geolocation & Timestamp Capture", "The system must capture geolocation coordinates and server timestamps for every clock event.", "functional", "high", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Late Arrival Grace Period", "The system shall enforce a 5-minute grace period before tagging an arrival as late relative to scheduled shift start time.", "functional", "medium", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Duplicate Punch Event Suppression", "The system rejects duplicate punch events submitted within 60 seconds of a previous event to prevent accidental double-tap recording.", "functional", "medium", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Shift Manager Absence Notification", "The system shall notify shift managers automatically when an employee fails to clock in within 15 minutes of shift start.", "functional", "medium", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Manager Punch Adjustment Audit Trail", "The system must maintain immutable historical audit logs of all manager punch adjustments and reason codes.", "functional", "high", prd_doc, "3.1 Clock In and Clock Out Workflows", "Page 1"),
            ("Standard Weekly Overtime Calculation", "The system shall calculate overtime at 1.5x regular pay after 40 hours worked in a single workweek.", "functional", "critical", prd_doc, "4.1 Regular and Overtime Hours Determination", "Page 2"),
            ("Mandatory Rest Break Threshold Alert", "The system must track non-exempt employee daily hours and flag daily shifts exceeding 12 hours for mandatory rest break review.", "functional", "high", prd_doc, "4.1 Regular and Overtime Hours Determination", "Page 2"),
            ("Jurisdiction Overtime Rate Configuration", "The system shall allow payroll administrators to configure jurisdiction-specific overtime thresholds at the legal entity level.", "functional", "high", prd_doc, "4.1 Regular and Overtime Hours Determination", "Page 2"),
            ("Timesheet Overtime Pre-Commit Validation", "The system validates that calculated overtime hours match approved timesheet records before committing to payroll batch.", "functional", "critical", prd_doc, "4.1 Regular and Overtime Hours Determination", "Page 2"),
            ("Paid Annual Leave Probationary Period", "The system shall enforce a mandatory 90-day probationary period before newly hired employees become eligible for paid annual leave accrual.", "functional", "high", prd_doc, "5.1 Leave Eligibility and Approvals", "Page 2"),
            ("Employee Time-Off Request Submission", "The system must allow employees to submit planned time-off requests with date ranges and leave type classifications.", "functional", "high", prd_doc, "5.1 Leave Eligibility and Approvals", "Page 2"),
            ("Extended Leave Manager Routing", "The system shall route leave requests exceeding 3 consecutive days to department managers for formal approval.", "functional", "medium", prd_doc, "5.1 Leave Eligibility and Approvals", "Page 2"),
            ("Negative Leave Balance Prohibition", "The system prohibits negative leave balances unless explicit overdraft authorization is configured for the employee group.", "functional", "high", prd_doc, "5.1 Leave Eligibility and Approvals", "Page 2"),
            ("Statutory Leave Workflows", "The system will support automated bereavement, jury duty, and parental leave workflows according to statutory policies.", "functional", "medium", prd_doc, "5.1 Leave Eligibility and Approvals", "Page 2"),
            ("Gross Pay Aggregation Engine", "The system shall compute gross pay by aggregating regular hours, overtime hours, and approved premium differentials.", "functional", "critical", prd_doc, "6.1 Gross-to-Net Engine", "Page 2"),
            ("Statutory Tax Withholding Execution", "The system must apply statutory tax withholdings including federal, state, and social security deductions prior to net pay disbursement.", "functional", "critical", prd_doc, "6.1 Gross-to-Net Engine", "Page 2"),
            ("Timesheet Approval Cutoff Enforcement", "The system shall enforce cutoff deadlines for timesheet approvals prior to executing final payroll generation.", "functional", "high", prd_doc, "6.1 Gross-to-Net Engine", "Page 2"),
            ("Encrypted Pay Statement Storage", "The system stores final pay statements in encrypted PDF format accessible through employee self-service.", "functional", "high", prd_doc, "6.1 Gross-to-Net Engine", "Page 2"),
            ("OAuth2 PKCE Identity Validation", "The system shall validate user credentials against the corporate identity provider using OAuth2 with PKCE.", "functional", "critical", prd_doc, "1.1 Identity & Authentication Gateway", "Section 1"),
            ("Account Lockout on Failed Attempts", "The system shall lock user accounts after 5 consecutive failed authentication attempts for a lockout duration of 30 minutes.", "functional", "high", srs_doc, "1.1 Identity & Authentication Gateway", "Section 1"),
            ("Mandatory Employee Field Verification", "The system shall enforce mandatory employee fields including Employee ID, Legal First Name, Legal Last Name, Hire Date, and Department Code.", "functional", "high", srs_doc, "2. Employee Data Governance", "Section 2"),
            ("Department Code Referential Integrity", "The system rejects employee record creation when Department Code does not map to an active organizational department.", "functional", "high", srs_doc, "2. Employee Data Governance", "Section 2"),
            ("Compensation Modification Event Publishing", "The system must publish audit events to the centralized event bus whenever employee compensation or bank details are modified.", "functional", "critical", srs_doc, "2. Employee Data Governance", "Section 2"),
            ("Standard Tenure-Based Leave Policies", "The system shall enforce standard leave policies based on tenure and job grade.", "functional", "medium", srs_doc, "3. Leave Policy Rules and Probationary Constraints", "Section 3"),
            ("Standard Staff Probationary Period", "The system requires a standard probationary period of 30 days before full-time staff can request paid vacation days.", "functional", "high", srs_doc, "3. Leave Policy Rules and Probationary Constraints", "Section 3"),
            ("Pro-rated Mid-Cycle Leave Accruals", "The system must calculate pro-rated leave accruals for employees joining mid-accrual cycle.", "functional", "medium", srs_doc, "3. Leave Policy Rules and Probationary Constraints", "Section 3"),
            ("Manager Approval Delegation Authority", "The system allows managers to delegate approval authority to designated delegates during planned manager absence.", "functional", "medium", srs_doc, "3. Leave Policy Rules and Probationary Constraints", "Section 3"),
            ("Vacation Accrual Rate Calculation", "The system shall accrue 15 paid annual vacation days per year for full-time professional employees.", "functional", "medium", srs_doc, "4. Leave Entitlement Specifications", "Table 1"),
            ("Sick Leave Accrual & Immediate Availability", "The system shall allocate 10 paid medical sick leave days annually with immediate availability from hire date.", "functional", "medium", srs_doc, "4. Leave Entitlement Specifications", "Table 1"),
            ("Personal Floating Holiday Allocation", "The system shall grant 3 personal floating holidays with a 60-day eligibility waiting threshold.", "functional", "low", srs_doc, "4. Leave Entitlement Specifications", "Table 1"),
            ("Immediate Bereavement Leave Grant", "The system shall grant up to 5 days immediate bereavement leave upon notification without waiting period.", "functional", "medium", srs_doc, "4. Leave Entitlement Specifications", "Table 1"),
            ("Bearer JWT Authentication for REST Endpoints", "The system shall require valid Bearer JWT tokens on all REST API invocations under /api/v1/*.", "functional", "critical", api_doc, "1. Authentication & Security Expectations", "Section 1"),
            ("Employee Profile Lookup API", "The system shall provide endpoint GET /api/v1/employees/{employee_id} returning structured profile data for authorized callers.", "functional", "high", api_doc, "2.1 Retrieve Employee Profile", "Section 2"),
            ("Clock-In Event Ingestion API", "The system shall provide endpoint POST /api/v1/attendance/clock-in returning 201 Created and punch confirmation payload.", "functional", "high", api_doc, "2.2 Register Clock In Event", "Section 2"),
            ("Duplicate Clock-In API Conflict Handling", "The system rejects duplicate punch events via API returning HTTP 409 Conflict when submitted within 60 seconds.", "functional", "medium", api_doc, "2.2 Register Clock In Event", "Section 2"),
            ("Leave Request Submission API", "The system shall provide endpoint POST /api/v1/leave/requests accepting date ranges and returning 202 Accepted.", "functional", "high", api_doc, "3.1 Submit Leave Request", "Section 3"),
            ("Leave Date Range Chronological Validation", "The system shall validate that start date occurs before or equal to end date on all leave requests.", "functional", "medium", api_doc, "3.1 Submit Leave Request", "Section 3"),

            # 43..50: Non-Functional Requirements (8)
            ("Administrative MFA Enforcement", "The system shall enforce multi-factor authentication for all users possessing HR Administrator or Payroll Administrator roles.", "non_functional", "critical", prd_doc, "7. Role-Based Security & Non-Functional Specifications", "Page 2"),
            ("AES-256 and TLS 1.3 Cryptographic Standards", "The system must encrypt all sensitive employee PII at rest using AES-256 and in transit using TLS 1.3.", "non_functional", "critical", prd_doc, "7. Role-Based Security & Non-Functional Specifications", "Page 2"),
            ("Core Hours 99.9% Platform Availability", "The system shall maintain 99.9% platform availability during core business hours (06:00 to 22:00 local time).", "non_functional", "high", prd_doc, "7. Role-Based Security & Non-Functional Specifications", "Page 2"),
            ("Attendance Kiosk Concurrency & Latency Budget", "The system will support concurrent attendance clock events up to 5,000 requests per minute with p95 latency under 500ms.", "non_functional", "high", srs_doc, "5. Performance & Reliability Non-Functional Requirements", "Section 5"),
            ("Idle Session Inactivity Termination (15 min)", "The system must reject session authentication tokens after 15 minutes of user inactivity and terminate active sessions.", "non_functional", "high", srs_doc, "1.1 Identity & Authentication Gateway", "Section 1"),
            ("High-Scale Timesheet Batch Throughput", "The system shall complete timesheet batch calculation for 10,000 employees within 300 seconds.", "non_functional", "high", srs_doc, "5. Performance & Reliability Non-Functional Requirements", "Section 5"),
            ("7-Year Audit Trail Immutability Retention", "The system must retain employee audit trails in compliant immutable storage for a minimum period of 7 years.", "non_functional", "high", srs_doc, "5. Performance & Reliability Non-Functional Requirements", "Section 5"),
            ("Disaster Recovery RPO and RTO Thresholds", "The system shall achieve Recovery Point Objective (RPO) under 5 minutes and Recovery Time Objective (RTO) under 60 minutes.", "non_functional", "high", srs_doc, "5. Performance & Reliability Non-Functional Requirements", "Section 5"),

            # 51..56: Business Rules (6)
            ("Clock-In 5-Minute Grace Period Rule", "Employees must record attendance within 5 minutes of scheduled shift start (ATT-001).", "business_rule", "high", prd_doc, "3. Time and Attendance Tracking", "Page 1"),
            ("Early Departure Authorization Rule", "Employees shall not clock out earlier than 5 minutes before scheduled shift end without manager approval (ATT-002).", "business_rule", "high", br_doc, "Sheet: Attendance_Policies", "ATT-002"),
            ("Mandatory 30-Minute Meal Break Rule", "Employees working shifts exceeding 6 hours must record a meal break of at least 30 consecutive minutes (ATT-003).", "business_rule", "high", br_doc, "Sheet: Attendance_Policies", "ATT-003"),
            ("Daily California Overtime Rule", "Daily overtime paid at 1.5x for hours worked beyond 8 up to 12 in a single day (OT-002).", "business_rule", "high", br_doc, "Sheet: Overtime_Rules", "OT-002"),
            ("Sunday & Holiday Premium Overtime (2.0x)", "Overtime paid at 2.0x regular pay for Sunday and recognized statutory holiday shifts (OT-003).", "business_rule", "critical", br_doc, "Sheet: Overtime_Rules", "OT-003"),
            ("Annual Vacation Carryover Limit (5 days)", "Employees are permitted to carry forward a maximum of 5 unused vacation days into subsequent calendar year (VAC-STD).", "business_rule", "medium", br_doc, "Sheet: Leave_Entitlements", "VAC-STD"),
        ]

        created_reqs = []
        for idx, (title, desc, cat, prio, src_doc, sec, page) in enumerate(req_defs, start=1):
            key = f"DAY-REQ-{idx:03d}"
            # Check review status: 48 approved, 8 pending_review
            review_status = "approved" if idx <= 48 else "pending_review"
            req = Requirement(
                project_id=proj.id,
                key=key,
                title=title,
                category=cat,
                priority=prio,
                document_id=src_doc.id if src_doc else None,
                source_section=sec,
                source_page=page,
                evidence_excerpt=desc[:300],
                extraction_provenance="explicit_documented" if src_doc else "user_provided",
                review_status=review_status,
                confidence=0.96 if src_doc else 1.0,
                status="approved" if review_status == "approved" else "analysed",
                current_version=1,
                author_id=admin_id,
                created_at=datetime(2026, 11, 7, 10, 50, 0),
                updated_at=datetime(2026, 11, 7, 10, 52, 0),
            )
            db.add(req)
            db.flush()

            # Add RequirementVersion
            content_hash = hashlib.sha256(desc.encode("utf-8")).hexdigest()
            rv = RequirementVersion(
                requirement_id=req.id,
                version=1,
                title=title,
                description=desc,
                business_objective=f"Grounded from {src_doc.display_name if src_doc else 'Project Context'}",
                content_hash=content_hash,
                author_id=admin_id,
                created_at=datetime(2026, 11, 7, 10, 50, 0),
            )
            db.add(rv)
            created_reqs.append(req)

        db.commit()
        log.info("Persisted %d Dayforce requirements (42 Functional, 8 Non-Functional, 6 Business Rules).", len(created_reqs))

    # Step 9: Populate 4 Ambiguities and 1 Contradiction (matching Screenshot 2)
    # Clear existing clarifications for Dayforce
    db.execute(delete(RequirementClarification).where(RequirementClarification.project_id == proj.id))
    db.commit()

    day_reqs = {r.title: r for r in db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()}

    # 4 Ambiguities
    ambiguity_defs = [
        ("Employee Document Upload & Scanning", "ambiguity",
         "What specific file formats and maximum upload size limits are enforced during employee document upload?",
         "Found in section '2.1 Onboarding and Profile Maintenance': \"asynchronous employee document upload with virus scanning...\"",
         "Unbounded upload specifications may permit unsupported binary attachments or resource exhaustion.",
         "Specify allowed MIME types (e.g. PDF, PNG, JPG) and explicit max size limit of 10MB per file."),
        ("Mandatory Rest Break Threshold Alert", "missing_boundary",
         "What is the required rest break duration and paid/unpaid status when shifts exceed 12 hours?",
         "Found in section '4.1 Regular and Overtime Hours Determination': \"mandatory rest break review...\"",
         "Ambiguous break intervals can cause labor regulation non-compliance and erroneous timesheet deductions.",
         "Mandate a second 30-minute unpaid meal break and an additional 15-minute paid rest interval."),
        ("Shift Manager Absence Notification", "unquantified_metric",
         "Through which communication channels (email, SMS, in-app push) should manager absence alerts be dispatched?",
         "Found in section '3.1 Clock In and Clock Out Workflows': \"notify shift managers automatically...\"",
         "Undefined alerting channels risk missed absence notifications during busy shift transitions.",
         "Configure multi-channel notification: high-priority mobile push and in-app dashboard badge."),
        ("Jurisdiction Overtime Rate Configuration", "missing_error_handling",
         "What fallback calculation rules apply if an employee is assigned to a jurisdiction without configured overtime rates?",
         "Found in section '4.1 Regular and Overtime Hours Determination': \"jurisdiction-specific overtime thresholds...\"",
         "Missing fallback leads to unhandled runtime calculation errors during payroll batch runs.",
         "Enforce standard federal FLSA threshold (40 hours weekly at 1.5x regular pay) as fallback."),
    ]
    for r_title, c_type, q, ctx_str, imp, res in ambiguity_defs:
        linked_r = day_reqs.get(r_title)
        c = RequirementClarification(
            project_id=proj.id,
            requirement_id=linked_r.id if linked_r else None,
            type=c_type,
            question=q,
            context=ctx_str,
            impact=imp,
            suggested_resolution=res,
            status="open",
            created_at=datetime(2026, 11, 7, 10, 51, 0),
        )
        db.add(c)

    # 1 Contradiction: Overtime Multiplier Rate (1.5x vs 2.0x)
    r_standard = day_reqs.get("Standard Weekly Overtime Calculation")
    r_sunday = day_reqs.get("Sunday & Holiday Premium Overtime (2.0x)")
    contra = RequirementClarification(
        project_id=proj.id,
        requirement_id=r_standard.id if r_standard else None,
        type="contradiction",
        question="Document contradiction on Overtime Rate: 'DAY-REQ-011' specifies 1.5x regular pay whereas 'DAY-REQ-055' specifies 2.0x regular pay. Which multiplier should the payroll calculation engine enforce?",
        context="Discrepancy detected between PRD standard overtime clause (citing 1.5x) and Business Rules holiday policy (citing 2.0x).",
        impact="Contradicting multiplier rates lead to erroneous gross pay calculation and non-compliant audit runs.",
        suggested_resolution="Confirm authoritative overtime multiplier (1.5x FLSA standard vs 2.0x statutory holiday shift rate) with payroll stakeholders.",
        status="open",
        created_at=datetime(2026, 11, 7, 10, 52, 0),
    )
    db.add(contra)
    db.commit()
    log.info("Persisted 4 ambiguities and 1 contradiction for Dayforce.")

    # Step 10: Populate 56 Acceptance Criteria
    existing_acs = db.execute(select(AcceptanceCriterion).where(
        AcceptanceCriterion.requirement_id.in_([r.id for r in day_reqs.values()])
    )).scalars().all()
    if len(existing_acs) < 56:
        for r_idx, (r_title, r_obj) in enumerate(day_reqs.items(), start=1):
            key = f"DAY-AC-{r_idx:03d}"
            ac = AcceptanceCriterion(
                key=key,
                requirement_id=r_obj.id,
                requirement_version=1,
                clause_keys=[f"{r_obj.key}.C1"],
                description=f"Given an active Dayforce environment, when '{r_title}' is exercised with valid parameters, then system behaviour strictly complies with specification {r_obj.key}.",
                preconditions="Employee and system credentials are authenticated.",
                expected_behaviour=f"System validates input and commits state complying with {r_obj.key}.",
                source_quote=r_obj.evidence_excerpt or r_obj.title,
                confidence=0.98,
                review_status="approved",
                created_at=datetime(2026, 11, 7, 10, 53, 0),
            )
            db.add(ac)
        db.commit()
        log.info("Persisted 56 Acceptance Criteria for Dayforce.")

    # Step 11: Populate 126 Test Cases (matching Screenshot 3)
    # Total Tests: 126, Approved: 98, Acceptance Criteria: 56, Coverage: 92.1%, Pending Review: 18, Failed: 2
    existing_tests = db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars().all()
    if len(existing_tests) < 126 or force_reseed:
        # Clear any existing test cases to populate exact 126
        for t in existing_tests:
            db.execute(delete(ExecutionResult).where(ExecutionResult.test_case_id == t.id))
            db.delete(t)
        db.commit()

        # Build 126 test cases with realistic test specification details
        categories = ["positive", "negative", "boundary", "permission", "validation", "error_handling", "business_rule"]
        priorities = ["high", "medium", "low", "critical"]

        all_reqs_list = list(day_reqs.values())

        # First 8 exact test cases shown in Screenshot 3:
        # TC-001 | Verify employee can clock in successfully | Positive | High | REQ-001 | Approved
        # TC-002 | Validate clock-in with invalid employee ID | Negative | High | REQ-001 | Approved
        # TC-003 | Verify time entry at boundary (00:00 and 23:59) | Boundary | Medium | REQ-002 | Approved
        # TC-004 | Verify restricted access for non-admin user | Permission | High | REQ-003 | Under Review
        # TC-005 | Validate input for overtime hours | Validation | Medium | REQ-004 | Approved
        # TC-006 | Verify system behaviour when network fails | Error Handling | Medium | REQ-005 | Under Review
        # TC-007 | Verify time-off request submission | Business Rule | High | REQ-006 | Approved
        # TC-008 | Validate maximum overtime limit | Business Rule | Medium | REQ-007 | Approved

        test_specs_top = [
            (1, "Verify employee can clock in successfully", "positive", "high", "DAY-REQ-001", "approved",
             "Verify successful clock-in for a valid employee.",
             "Employee is registered and active. User is authenticated in the system.",
             [{"action": "Navigate to the Attendance (Clock In) page.", "expected": "Page loads with current server date and time."},
              {"action": "Click the \"Clock In\" button.", "expected": "System records punch event and dispatches API request."},
              {"action": "Verify the confirmation message and recorded time.", "expected": "System records clock-in successfully and displays confirmation."}],
             {"employee_id": "EMP1001", "location": "HQ_Building_A"},
             "The system records the clock-in successfully and displays a confirmation message with the current date and time."),

            (2, "Validate clock-in with invalid employee ID", "negative", "high", "DAY-REQ-001", "approved",
             "Validate system rejection when clocking in with nonexistent employee ID.",
             "Kiosk is online and operational.",
             [{"action": "Enter invalid employee ID 'EMP9999'.", "expected": "System validates input format."},
              {"action": "Click Clock In.", "expected": "System rejects punch."}],
             {"employee_id": "EMP9999"},
             "System displays error 'Employee ID not found' and rejects the punch event with HTTP 404."),

            (3, "Verify time entry at boundary (00:00 and 23:59)", "boundary", "medium", "DAY-REQ-002", "approved",
             "Verify attendance punch handling at midnight day-transition boundaries.",
             "Shift spans midnight transition.",
             [{"action": "Submit punch event at timestamp 23:59:59.", "expected": "Punch recorded on correct shift date."},
              {"action": "Submit punch event at timestamp 00:00:01.", "expected": "Punch recognized on following day."}],
             {"timestamps": ["23:59:59", "00:00:01"]},
             "System correctly records punch without date calculation error."),

            (4, "Verify restricted access for non-admin user", "permission", "high", "DAY-REQ-003", "under_review",
             "Verify non-admin users cannot access unmasked tax identifiers.",
             "User logged in with standard Employee role.",
             [{"action": "Attempt to view profile tax identification field.", "expected": "System applies masking mask 'XXX-XX-XXXX'."}],
             {"role": "Employee"},
             "System enforces data masking and prohibits access to sensitive tax identification."),

            (5, "Validate input for overtime hours", "validation", "medium", "DAY-REQ-004", "approved",
             "Verify validation of manual overtime hour input on timesheet adjustments.",
             "Timesheet adjustment modal is open.",
             [{"action": "Enter negative overtime hours '-5'.", "expected": "Validation error displayed."},
              {"action": "Enter overtime hours '28'.", "expected": "System rejects value exceeding 24 hours per day."}],
             {"invalid_hours": [-5, 28]},
             "System rejects invalid overtime hour values with clear validation feedback."),

            (6, "Verify system behaviour when network fails", "error_handling", "medium", "DAY-REQ-005", "under_review",
             "Verify offline punch caching and automatic sync when network connectivity is lost.",
             "Kiosk client loses connection to backend server.",
             [{"action": "Record clock-in while offline.", "expected": "Punch is cached securely in local storage."},
              {"action": "Restore network connection.", "expected": "Kiosk automatically synchronizes queued punches."}],
             {"network_status": "offline_then_restored"},
             "All offline punches are synchronized without data loss and chronological order is preserved."),

            (7, "Verify time-off request submission", "business_rule", "high", "DAY-REQ-006", "approved",
             "Verify standard employee leave request submission with valid accrual balance.",
             "Employee has completed 90-day probationary period with 15 days accrued vacation.",
             [{"action": "Select leave dates Nov 20 to Nov 22.", "expected": "System calculates 3 days requested."},
              {"action": "Submit leave request.", "expected": "Status transitions to 'pending_manager_approval'."}],
             {"days_requested": 3, "leave_type": "VAC"},
             "Leave request is created in pending status and notification is routed to direct manager."),

            (8, "Validate maximum overtime limit", "business_rule", "medium", "DAY-REQ-007", "approved",
             "Verify system alerts and caps weekly overtime hours beyond statutory threshold.",
             "Employee timesheet records 65 total hours in week.",
             [{"action": "Submit timesheet with 25 overtime hours.", "expected": "System flags mandatory executive review."}],
             {"weekly_hours": 65, "overtime_hours": 25},
             "System requires secondary executive sign-off for excessive overtime hours."),
        ]

        created_tests = []
        # Populate top 8
        for num, t_title, t_cat, t_prio, req_key, rev_stat, obj, prec, steps, t_data, exp in test_specs_top:
            r_linked = next((r for r in all_reqs_list if r.key == req_key), all_reqs_list[0])
            tc_stat = "approved" if rev_stat == "approved" else "pending_review"
            tc_appr = "approved" if rev_stat == "approved" else "pending_approval"
            tc = TestCase(
                project_id=proj.id,
                requirement_id=r_linked.id,
                requirement_version=1,
                key=f"TC-{num:03d}",
                title=t_title,
                description=obj,
                test_type=t_cat,
                test_category=t_cat,
                priority=t_prio,
                status=tc_stat,
                approval_status=tc_appr,
                execution_capability="simulation",
                automation="pytest",
                confidence=0.98,
                clause_keys=[f"{r_linked.key}.C1"],
                preconditions=prec,
                steps_json=steps,
                test_data=t_data,
                expected_result=exp,
                created_at=datetime(2026, 11, 7, 10, 54, 0),
                updated_at=datetime(2026, 11, 7, 10, 54, 0),
            )
            db.add(tc)
            created_tests.append(tc)

        # Populate remaining test cases up to 126
        # Counts breakdown: Exactly 98 approved, 18 pending_review, 8 changes_requested, 2 failed
        for num in range(9, 127):
            r_idx = (num - 1) % len(all_reqs_list)
            r_linked = all_reqs_list[r_idx]
            cat = categories[(num - 1) % len(categories)]
            prio = priorities[(num - 1) % len(priorities)]

            # 6 from top 8 are approved -> need 92 more approved (num 9..100) -> 98 approved total
            # 2 from top 8 are pending_review -> need 16 more pending (num 101..116) -> 18 pending review total
            # 8 changes_requested (num 117..124)
            # 2 failed (num 125..126)
            if num <= 100:
                stat = "approved"
            elif num <= 116:
                stat = "pending_review"
            elif num <= 124:
                stat = "changes_requested"
            else:
                stat = "failed"

            t_title = f"Verify {r_linked.title} — Scenario #{num}"
            obj = f"Validate that {r_linked.title} enforces all business constraints specified in {r_linked.key}."
            prec = "Target environment is online and initialized with sample enterprise data."
            steps = [
                {"action": f"Initialize test context for {r_linked.key}.", "expected": "Context loaded successfully."},
                {"action": f"Execute test scenario for {cat} verification.", "expected": "Operation returns status code 200/201."},
                {"action": "Verify database state and audit trail record.", "expected": "State matches expected specification."},
            ]
            exp = f"System executes scenario conforming to {r_linked.key} requirements."
            tc = TestCase(
                project_id=proj.id,
                requirement_id=r_linked.id,
                requirement_version=1,
                key=f"TC-{num:03d}",
                title=t_title,
                description=obj,
                test_type=cat,
                test_category=cat,
                priority=prio,
                status=stat,
                approval_status="approved" if stat == "approved" else "pending_approval",
                execution_capability="simulation",
                automation="pytest",
                confidence=0.95,
                clause_keys=[f"{r_linked.key}.C1"],
                preconditions=prec,
                steps_json=steps,
                test_data={"scenario_id": f"SCEN-{num}", "module": r_linked.category},
                expected_result=exp,
                created_at=datetime(2026, 11, 7, 10, 55, 0),
                updated_at=datetime(2026, 11, 7, 10, 55, 0),
            )
            db.add(tc)
            created_tests.append(tc)

        db.commit()
        log.info("Persisted 126 Test Cases for Dayforce (98 Approved, 18 Pending Review, 8 Changes Requested, 2 Failed).")

    # Step 12: Populate 24 Executions (matching Screenshot 4)
    # Total Runs: 24, Passed: 19, Failed: 3, Blocked: 2, Execution Types: Validation • Simulation (and external)
    existing_execs = db.execute(select(Execution).where(Execution.project_id == proj.id)).scalars().all()
    if len(existing_execs) < 24 or force_reseed:
        for ex in existing_execs:
            db.execute(delete(ExecutionResult).where(ExecutionResult.execution_id == ex.id))
            db.delete(ex)
        db.commit()

        # Target 24 runs:
        # RUN-024 | Employee Attendance - Simulation | Simulation | 32 | 30 | 2 | 0 | Completed | Nov 7, 11:24 AM
        # RUN-023 | Test Spec Validation - v2 | Validation | 56 | 56 | 0 | 0 | Completed | Nov 7, 10:02 AM
        # RUN-022 | Employee API Tests (Staging) | External | 18 | 16 | 1 | 1 | Completed | Nov 6, 05:40 PM
        # RUN-021 | Leave Management - Simulation | Simulation | 28 | 26 | 2 | 0 | Completed | Nov 6, 03:18 PM
        # RUN-020 | Specification Validation - v1 | Validation | 41 | 40 | 1 | 0 | Completed | Nov 5, 04:11 PM
        # RUN-019 | Payroll Rules - Simulation | Simulation | 36 | 33 | 3 | 0 | Completed | Nov 5, 11:20 AM
        # RUN-018 | Shift & Schedule - Simulation | Simulation | 24 | 24 | 0 | 0 | Completed | Nov 4, 05:03 PM
        # RUN-017 | User Management (Staging) | External | 20 | 18 | 0 | 2 | Blocked | Nov 4, 02:15 PM
        # and runs 16 down to 1...
        # Overall totals: 19 Passed, 3 Failed, 2 Blocked (sum = 24 runs)
        # Types: 10 Validation, 12 Simulation, 2 External

        run_specs = [
            (24, "Employee Attendance - Simulation", "simulation", 32, 30, 2, 0, "failed", datetime(2026, 11, 7, 11, 24, 0), 266000),
            (23, "Test Spec Validation - v2", "validation", 56, 56, 0, 0, "passed", datetime(2026, 11, 7, 10, 2, 0), 125000),
            (22, "Employee API Tests (Staging)", "external", 18, 16, 1, 1, "passed", datetime(2026, 11, 6, 17, 40, 0), 340000),
            (21, "Leave Management - Simulation", "simulation", 28, 26, 2, 0, "failed", datetime(2026, 11, 6, 15, 18, 0), 245000),
            (20, "Specification Validation - v1", "validation", 41, 40, 1, 0, "passed", datetime(2026, 11, 5, 16, 11, 0), 110000),
            (19, "Payroll Rules - Simulation", "simulation", 36, 33, 3, 0, "failed", datetime(2026, 11, 5, 11, 20, 0), 312000),
            (18, "Shift & Schedule - Simulation", "simulation", 24, 24, 0, 0, "passed", datetime(2026, 11, 4, 17, 3, 0), 180000),
            (17, "User Management (Staging)", "external", 20, 18, 0, 2, "blocked", datetime(2026, 11, 4, 14, 15, 0), 290000),
            (16, "Core HR Regression - Simulation", "simulation", 30, 30, 0, 0, "passed", datetime(2026, 11, 4, 10, 0, 0), 210000),
            (15, "Timesheet Audit Spec Validation", "validation", 45, 45, 0, 0, "passed", datetime(2026, 11, 3, 16, 30, 0), 95000),
            (14, "Attendance Kiosk Behaviour Simulation", "simulation", 28, 26, 0, 2, "blocked", datetime(2026, 11, 3, 14, 10, 0), 230000),
            (13, "Payroll Tax Deduction Validation", "validation", 50, 50, 0, 0, "passed", datetime(2026, 11, 3, 11, 0, 0), 140000),
            (12, "Leave Accrual Matrix - Simulation", "simulation", 25, 25, 0, 0, "passed", datetime(2026, 11, 2, 17, 45, 0), 195000),
            (11, "Manager Approval Routing Validation", "validation", 38, 38, 0, 0, "passed", datetime(2026, 11, 2, 15, 20, 0), 115000),
            (10, "Employee Lifecycle - Simulation", "simulation", 35, 35, 0, 0, "passed", datetime(2026, 11, 2, 11, 30, 0), 280000),
            (9, "Security Boundary Spec Validation", "validation", 42, 42, 0, 0, "passed", datetime(2026, 11, 1, 16, 0, 0), 105000),
            (8, "Punch Pairing Logic - Simulation", "simulation", 26, 26, 0, 0, "passed", datetime(2026, 11, 1, 14, 0, 0), 175000),
            (7, "FLSA Overtime Spec Validation", "validation", 48, 48, 0, 0, "passed", datetime(2026, 11, 1, 10, 15, 0), 130000),
            (6, "Holiday Calendar Behaviour Simulation", "simulation", 22, 22, 0, 0, "passed", datetime(2026, 10, 31, 16, 50, 0), 160000),
            (5, "Role Matrix Spec Validation", "validation", 36, 36, 0, 0, "passed", datetime(2026, 10, 31, 14, 10, 0), 98000),
            (4, "Overtime Rate Spec Validation", "validation", 40, 40, 0, 0, "passed", datetime(2026, 10, 30, 16, 30, 0), 112000),
            (3, "Meal Break Compliance Simulation", "simulation", 30, 30, 0, 0, "passed", datetime(2026, 10, 30, 11, 0, 0), 220000),
            (2, "Department Referential Integrity Validation", "validation", 35, 35, 0, 0, "passed", datetime(2026, 10, 29, 15, 20, 0), 85000),
            (1, "Initial Baseline Spec Validation", "validation", 30, 30, 0, 0, "passed", datetime(2026, 10, 28, 10, 0, 0), 75000),
        ]

        # Ensure environment exists
        env = db.execute(select(Environment).where(Environment.project_id == proj.id)).scalars().first()
        if not env:
            env = Environment(
                project_id=proj.id,
                name="Simulation (Sandbox)",
                kind="simulation",
                base_url="https://sim.dayforce.local",
                is_default=True,
            )
            db.add(env)
            db.flush()

        day_tests_list = db.execute(select(TestCase).where(TestCase.project_id == proj.id)).scalars().all()

        created_execs = []
        for r_num, r_name, r_type, total, passed, failed, blocked, stat, start_dt, dur_ms in run_specs:
            key = f"RUN-{r_num:03d}"
            exec_type_mapped = "specification_validation" if r_type == "validation" else r_type
            exec_status = "passed" if stat == "passed" else ("failed" if stat == "failed" else "cancelled")
            ex = Execution(
                project_id=proj.id,
                key=key,
                suite_id=None,
                environment_id=env.id,
                triggered_by=admin_id,
                execution_type=exec_type_mapped,
                source="platform_run",
                status=exec_status,
                started_at=start_dt,
                finished_at=start_dt + timedelta(milliseconds=dur_ms),
                duration_ms=dur_ms,
                total=total,
                passed=passed,
                failed=failed,
                errored=0,
                skipped=blocked,
                isolation_level="bwrap+rlimits" if r_type != "external" else "none",
                log_excerpt=f"Execution {key} ({r_name}) completed with {passed} passed, {failed} failed, {blocked} blocked.",
            )
            db.add(ex)
            db.flush()
            created_execs.append(ex)

            # Add ExecutionResults for this run
            sample_tests = day_tests_list[:total] if day_tests_list else []
            for t_idx, t_case in enumerate(sample_tests):
                if t_idx < passed:
                    t_status = "passed"
                    outcome_msg = "Passed as per expected business behavior."
                elif t_idx < passed + failed:
                    t_status = "failed"
                    outcome_msg = "Failed: discrepancy detected in overtime multiplier calculation."
                else:
                    t_status = "skipped"
                    outcome_msg = "Blocked: environment staging endpoint returned connection timeout."

                er = ExecutionResult(
                    execution_id=ex.id,
                    test_case_id=t_case.id,
                    test_case_version=1,
                    status=t_status,
                    duration_ms=dur_ms // max(1, total),
                    message=outcome_msg if t_status != "passed" else "",
                    stdout=f"Test {t_case.key} outcome: {t_status}",
                    started_at=start_dt,
                    finished_at=start_dt + timedelta(milliseconds=dur_ms // max(1, total)),
                )
                db.add(er)

        db.commit()
        log.info("Persisted 24 Executions for Dayforce (19 Passed, 3 Failed, 2 Blocked).")

    # Step 13: Populate 3 Production Defects linked to the 3 failed runs
    existing_defects = db.execute(select(Defect).where(Defect.project_id == proj.id)).scalars().all()
    if len(existing_defects) < 3:
        for d in existing_defects:
            db.delete(d)
        db.commit()

        defect_defs = [
            ("DEF-DAYFORCE-001", "Invalid overtime calculation on statutory holiday attendance punches",
             "critical", "open", "RUN-024", "DAY-REQ-011",
             "Simulation RUN-024 failed on overtime calculation: Holiday shifts computed at 1.5x regular pay instead of mandatory 2.0x premium rate specified in Business Rules (OT-003)."),
            ("DEF-DAYFORCE-002", "Missing exception rule for split shifts exceeding daily threshold",
             "high", "open", "RUN-021", "DAY-REQ-007",
             "Simulation RUN-021 detected missing boundary logic for split shifts with non-contiguous rest intervals exceeding 4 hours."),
            ("DEF-DAYFORCE-003", "Session token unauthorized renewal on expired state",
             "high", "open", "RUN-019", "DAY-REQ-047",
             "Validation RUN-019 revealed session token refresh succeeded at minute 16 of inactivity, violating the 15-minute hard timeout constraint."),
        ]

        day_reqs = {r.key: r for r in db.execute(select(Requirement).where(Requirement.project_id == proj.id)).scalars().all()}
        day_runs = {e.key: e for e in db.execute(select(Execution).where(Execution.project_id == proj.id)).scalars().all()}

        for d_key, d_title, d_sev, d_stat, run_k, req_k, d_desc in defect_defs:
            d_req = day_reqs.get(req_k)
            d_run = day_runs.get(run_k)
            df = Defect(
                project_id=proj.id,
                key=d_key,
                title=d_title,
                severity=d_sev,
                priority="p1" if d_sev == "critical" else "p2",
                status=d_stat,
                description=d_desc,
                requirement_id=d_req.id if d_req else None,
                execution_id=d_run.id if d_run else None,
                reporter_id=admin_id,
                owner_id=admin_id,
                created_at=datetime(2026, 11, 7, 11, 25, 0),
                updated_at=datetime(2026, 11, 7, 11, 25, 0),
            )
            db.add(df)

        db.commit()
        log.info("Persisted 3 Defects for Dayforce.")

    log.info("Dayforce project initialization completed successfully.")
    return proj
