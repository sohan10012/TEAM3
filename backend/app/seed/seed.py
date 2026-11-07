"""Deterministic, idempotent initialisation of the Dayforce Quality Engineering workspace.

Every historical execution result comes from genuinely running the approved pytest scripts against the
Reference HCM Engine (once per engine version — the engine is deterministic, so each historical
execution record reuses the real outcome for the exact script hash it lists).
"""
from __future__ import annotations

import logging
import os
import random
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.db.base import session_scope, utcnow
from app.db.models import (
    AcceptanceCriterion,
    AuditLog,
    Defect,
    DefectComment,
    DefectLink,
    Environment,
    Execution,
    ExecutionResult,
    Integration,
    Module,
    Notification,
    Organisation,
    Project,
    ProjectMember,
    Requirement,
    Role,
    SuiteTestCase,
    TestCase,
    TestSuite,
    User,
    UserRole,
)
from app.domain.enums import ROLES
from app.execution.sandbox import SandboxResult, ScriptSpec, TestOutcome, run_pytest
from app.graph.execution_graph import classify_deterministic
from app.seed.catalog import build_catalog, slug
from app.services import audit
from app.services import defects as defect_svc
from app.services.executions import persist_results
from app.services.requirements import clauses_for, create_requirement, current_version, update_requirement
from app.services.tests import create_test, review_test

log = logging.getLogger("tracetest.seed")
SEED = 20261105
ORG = "TraceTest Quality Engineering"
ORG_SLUG = "tracetest-qe"

PROJECTS = [
    ("PAY", "Payroll Management", "Gross-to-net payroll rules, overtime, differentials, adjustments and cut-off.",
     [("OVT", "Overtime & Differentials"), ("ADJ", "Adjustments & Cut-off"), ("CMP", "Payroll Compliance")]),
    ("TNA", "Time and Attendance", "Clock events, punch pairing, breaks and attendance compliance.",
     [("PCH", "Punches & Timesheets"), ("BRK", "Breaks & Rest Compliance")]),
    ("LVE", "Employee Leave Management", "Leave accrual, carry-forward, approval and payout.",
     [("ACR", "Accrual & Requests"), ("CFW", "Carry-forward & Payout")]),
    ("WFS", "Workforce Scheduling", "Shift rules, holiday calendars, approval authority and permissions.",
     [("SHF", "Shift Rules"), ("APR", "Approvals & Permissions"), ("HOL", "Holiday Calendars")]),
    ("BEN", "Benefits and Eligibility", "Benefit eligibility, enrolment and termination rules.",
     [("ELG", "Eligibility Rules"), ("ENR", "Enrolment")]),
]

PEOPLE = [  # colleagues without sign-in access
    ("sam.okafor@dayforce-qa.local", "Sam Okafor", "Dayforce Business Analyst", "qa_engineer"),
    ("taylor.nguyen@dayforce-qa.local", "Taylor Nguyen", "Dayforce Payroll Specialist", "qa_engineer"),
    ("casey.ramirez@dayforce-qa.local", "Casey Ramirez", "Dayforce WFM Engineer", "qa_engineer"),
    ("alex.kowalski@dayforce-qa.local", "Alex Kowalski", "Dayforce QA Engineer", "qa_engineer"),
    ("jamie.fischer@dayforce-qa.local", "Jamie Fischer", "Dayforce Quality Lead", "reviewer"),
    ("drew.haddad@dayforce-qa.local", "Drew Haddad", "Dayforce Benefits Consultant", "qa_engineer"),
    ("kai.mensah@dayforce-qa.local", "Kai Mensah", "Dayforce Platform Engineer", "qa_engineer"),
    ("robin.sato@dayforce-qa.local", "Robin Sato", "Dayforce Automation Specialist", "qa_engineer"),
]
OWNERS = {"PAY": "taylor.nguyen", "TNA": "casey.ramirez", "LVE": "alex.kowalski", "WFS": "kai.mensah",
          "BEN": "drew.haddad"}
_FN = re.compile(r"(?:payroll|attendance|leave|eligibility|approvals)\.(\w+)\(")


def ensure_identity() -> None:
    """Roles, organisation, and local development actor identity."""
    s = get_settings()
    with session_scope() as db:
        for name, desc in ROLES.items():
            if not db.execute(select(Role).where(Role.name == name)).scalar_one_or_none():
                db.add(Role(name=name, description=desc))
        db.flush()

        org = db.execute(select(Organisation)).scalars().first()
        if not org:
            org = Organisation(name=ORG, slug=ORG_SLUG)
            db.add(org)
            db.flush()
        elif org.name == "Northwind Workforce Solutions":
            org.name = ORG
            org.slug = ORG_SLUG

        # Ensure local development actor exists
        dev_email = s.dev_email.lower()
        dev_user = db.execute(select(User).where(User.email == dev_email)).scalar_one_or_none()
        if dev_user is None:
            dev_user = User(email=dev_email, full_name="Staff QA Engineer", title="Quality Engineering Lead")
            db.add(dev_user)
            db.flush()
            for rname in ("admin", "qa_engineer", "reviewer"):
                rid = db.execute(select(Role.id).where(Role.name == rname)).scalar_one_or_none()
                if rid:
                    db.add(UserRole(user_id=dev_user.id, role_id=rid))
        elif dev_user.full_name in ("Dayforce QA Engineer (Local Dev)", "Dayforce QA Engineer"):
            dev_user.full_name = "Staff QA Engineer"
        dev_user.is_active = True
        dev_user.can_login = True

        # In test mode, use deterministic test credentials so test fixtures connect cleanly;
        # in development/production, generate per-install random credentials on first run.
        creds_file = s.data_dir / "initial_credentials.txt"
        generated_creds: dict[str, str] = {}
        if s.app_env == "test":
            generated_creds = {
                "admin": "test-admin-password-1",
                "qa": "test-qa-password-12",
                "reviewer": "test-reviewer-password",
            }
        elif not creds_file.exists():
            import secrets
            for role_name in ("admin", "qa", "reviewer"):
                generated_creds[role_name] = secrets.token_urlsafe(16)
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            fd = os.open(str(creds_file), flags, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write("# TraceTest AI Per-Install Initial Credentials\n")
                f.write("# File mode: 0600. Keep outside git.\n\n")
                f.write(f"admin={s.admin_email}:{generated_creds['admin']}\n")
                f.write(f"qa={s.qa_email}:{generated_creds['qa']}\n")
                f.write(f"reviewer={s.reviewer_email}:{generated_creds['reviewer']}\n")
            print(f"[TraceTest AI] Initial operator credentials generated at {creds_file} (mode 0600).")
        else:
            try:
                for line in creds_file.read_text().splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        r_name, cred = line.split("=", 1)
                        if ":" in cred:
                            _, p_val = cred.split(":", 1)
                            generated_creds[r_name.strip()] = p_val.strip()
            except Exception:
                pass

        accounts = [
            (s.admin_email, "Morgan Ellis", "Platform Administrator", "admin", generated_creds.get("admin")),
            (s.qa_email, "Jordan Patel", "Senior QA Engineer", "qa_engineer", generated_creds.get("qa")),
            (s.reviewer_email, "Riley Chen", "QA Lead", "reviewer", generated_creds.get("reviewer")),
        ]
        for email, name, title, role, pwd in accounts:
            u = db.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
            if u is None:
                u = User(email=email.lower(), full_name=name, title=title)
                db.add(u)
                db.flush()
                db.add(UserRole(user_id=u.id, role_id=db.execute(select(Role.id).where(Role.name == role)).scalar_one()))
            if pwd:
                if not verify_password(pwd, u.password_hash):
                    u.password_hash = hash_password(pwd)
                u.can_login = True
            elif u.password_hash is None:
                u.can_login = False


def _seeded(db) -> bool:
    return db.execute(select(AuditLog).where(AuditLog.action == "seed.completed")).scalars().first() is not None


def seed_dataset() -> dict:
    with session_scope() as db:
        if _seeded(db):
            return {"status": "already_seeded"}
    t0 = time.monotonic()
    rng = random.Random(SEED)
    now = utcnow().replace(microsecond=0)
    day0 = (now - timedelta(days=150)).replace(hour=9, minute=0, second=0)
    with session_scope() as db:
        summary = _build(db, rng, now, day0)
        audit.record(db, None, "seed.completed", "system", None, "dayforce-qe", None,
                     {**summary, "seed": SEED, "seconds": round(time.monotonic() - t0, 1)}, source="seed_import")
    summary["seconds"] = round(time.monotonic() - t0, 1)
    log.info("Seed completed: %s", summary)
    return summary


def _at(day0: datetime, days: float, rng: random.Random) -> datetime:
    return day0 + timedelta(days=days, minutes=rng.randint(0, 480))


def _build(db, rng: random.Random, now: datetime, day0: datetime) -> dict:
    s = get_settings()
    org = db.execute(select(Organisation)).scalars().first()
    users = {u.email.split("@")[0]: u for u in db.execute(select(User)).scalars()}
    admin = db.execute(select(User).where(User.email == s.admin_email.lower())).scalar_one()
    qa = db.execute(select(User).where(User.email == s.qa_email.lower())).scalar_one()
    reviewer = db.execute(select(User).where(User.email == s.reviewer_email.lower())).scalar_one()
    role_id = {r.name: r.id for r in db.execute(select(Role)).scalars()}
    for email, name, title, role in PEOPLE:
        if email.split("@")[0] not in users:
            u = User(email=email, full_name=name, title=title, can_login=False, created_at=day0)
            db.add(u)
            db.flush()
            db.add(UserRole(user_id=u.id, role_id=role_id[role]))
            users[email.split("@")[0]] = u
    authors = [qa, users["sam.okafor"], users["alex.kowalski"], users["robin.sato"]]
    reviewers = [reviewer, users["jamie.fischer"]]

    # ---- projects, modules, environments, members
    projects, modules, envs = {}, {}, {}
    for key, name, desc, mods in PROJECTS:
        p = Project(key=key, name=name, description=desc, organisation_id=org.id, owner_id=admin.id,
                    created_at=day0, updated_at=day0)
        db.add(p)
        db.flush()
        projects[key] = p
        for code, mname in mods:
            m = Module(project_id=p.id, code=code, name=mname, description=f"{mname} rules for {name}.")
            db.add(m)
            db.flush()
            modules[(key, code)] = m
        e10 = Environment(project_id=p.id, name="QA — Reference HCM 1.0", kind="reference_hcm", hcm_version="1.0",
                          is_default=True, created_at=day0)
        e11 = Environment(project_id=p.id, name="Fix candidate — Reference HCM 1.1", kind="reference_hcm",
                          hcm_version="1.1", created_at=day0 + timedelta(days=125))
        db.add_all([e10, e11])
        db.flush()
        envs[key] = (e10, e11)
        members = [admin, qa] + ([reviewer] if key != "BEN" else []) + [users[OWNERS[key]], users["jamie.fischer"],
                                                                         users["sam.okafor"], users["robin.sato"]]
        for u in {m.id: m for m in members}.values():
            db.add(ProjectMember(project_id=p.id, user_id=u.id, project_role="owner" if u is admin else "member"))
        db.add(Integration(project_id=p.id, kind="github", config={}, status="not_configured"))
        audit.record(db, admin.id, "project.created", "project", p.id, p.key, p.id, source="seed_import",
                     created_at=day0)
    db.flush()

    # ---- requirements, versions, clauses, acceptance criteria, tests, reviews
    catalog = build_catalog()
    tests_by_project: dict[str, list[TestCase]] = defaultdict(list)
    seed_tests: dict[str, object] = {}
    req_rows: dict[str, Requirement] = {}
    broken: set[tuple[str, str]] = set()
    for idx, sr in enumerate(catalog):
        proj = projects[sr.project]
        created = _at(day0, idx * 0.7, rng)
        author = authors[idx % len(authors)]
        first = sr.prior_versions[0][0] if sr.prior_versions else sr.clauses
        req = create_requirement(db, proj, title=sr.title, description=" ".join(first), business_objective=sr.objective,
                                 priority=sr.priority, category=sr.category, module_id=modules[(sr.project, sr.module)].id,
                                 author_id=author.id, created_at=created, audit_source="seed_import")
        if sr.prior_versions:
            update_requirement(db, req, actor_id=author.id, description=" ".join(sr.clauses),
                               change_summary=sr.prior_versions[0][1], created_at=created + timedelta(days=6),
                               audit_source="seed_import")
        if sr.analysed and idx % 2 == 0:
            update_requirement(db, req, actor_id=users["sam.okafor"].id,
                               business_objective=sr.objective + " Reviewed with the process owner for the "
                               f"{proj.name} release plan.", change_summary="Business objective clarified",
                               created_at=created + timedelta(days=7), audit_source="seed_import")
        req_rows[sr.title] = req
        if not sr.analysed:
            continue
        version = current_version(db, req)
        clauses = clauses_for(db, version)
        assert len(clauses) == len(sr.clauses), sr.title
        keys = [c.clause_key for c in clauses]
        analysed_at = created + timedelta(days=8)
        for c in clauses:
            c.analysis = {"source_fact": c.text, "deterministic_flags": c.ambiguity_flags, "provider": "seed_import",
                          "missing_information": [], "conflicts_with": []}
        if sr.title == "Supervisor overtime eligibility":
            clauses[0].analysis["conflicts_with"] = [keys[1]]
            clauses[1].analysis["conflicts_with"] = [keys[0]]
            clauses[2].analysis["missing_information"] = ["No criteria define which exceptions HR may approve"]
        if sr.title == "Carry-forward for long-service staff":
            clauses[1].analysis["missing_information"] = ["Cap value and tenure threshold are not specified"]
        req.status, req.analysed_at = "analysed", analysed_at
        acs = []
        for i, c in enumerate(clauses, start=1):
            ac = AcceptanceCriterion(
                key=f"{req.key}.AC{i}", requirement_id=req.id, requirement_version=version.version,
                clause_keys=[c.clause_key], description=f"The system satisfies {c.clause_key}: {c.text}",
                preconditions="Reference HCM environment selected", expected_behaviour=c.text.rstrip("."),
                validation_conditions=["Observed behaviour matches the clause"], source_quote=c.text.rstrip("."),
                quote_verified=True, confidence=0.95, rationale="Imported from the approved test plan",
                review_status="approved" if not c.ambiguity_flags else "pending", provider="seed_import",
                created_at=analysed_at)
            db.add(ac)
            acs.append(ac)
        audit.record(db, author.id, "requirement.analysed", "requirement", req.id, req.key, proj.id,
                     {"provider": "seed_import"}, source="seed_import", created_at=analysed_at)
        for j, st in enumerate(sr.tests):
            tcreated = analysed_at + timedelta(days=1, hours=j)
            clause_key = keys[st.clause - 1]
            script = st.script("test_" + slug(st.title)) if st.module else None
            if script and (sr.project, st.title.lower()) in broken:
                script = script.replace(f"{st.module}.", f"{st.module[:-1]}.", 1)  # genuine automation bug
            tsteps = ([{"action": "Select the Reference HCM environment under test", "expected": "Build version shown"},
                      {"action": f"Prepare test data {st.data or 'as specified in the clause'}", "expected": "Data valid"},
                      {"action": f"Invoke reference_hcm.{st.module} with the prepared inputs", "expected": "Call completes"},
                      {"action": "Compare the result with the requirement-derived expectation",
                       "expected": st.expected}] if st.module else
                     [{"action": "Sign in as a user with the required role", "expected": "Workspace loads"},
                      {"action": f"Perform the scenario: {st.title}", "expected": "Operation accepted"},
                      {"action": "Verify the outcome against the clause", "expected": st.expected}])
            t = create_test(db, req, {
                "title": st.title[0].upper() + st.title[1:], "description": f"Verifies {clause_key}.",
                "clause_keys": [clause_key], "ac_keys": [acs[st.clause - 1].key], "preconditions": "Approved build",
                "test_data": st.data, "steps": tsteps, "expected_result": st.expected, "priority": st.priority,
                "test_type": st.test_type, "confidence": 0.9, "source_quote": clauses[st.clause - 1].text.rstrip("."),
                "rationale": "Imported from the regression test plan", "automation": "pytest" if script else "manual",
                "script": script}, actor_id=author.id, provider="seed_import", created_at=tcreated,
                audit_source="seed_import", clauses=clauses)
            roll = rng.random()
            decision = ("approve" if roll < (0.9 if script else 0.72) else
                        "request_changes" if roll < 0.94 else "reject" if roll < 0.965 else None)
            if t.validation_status == "valid" and decision:
                rv = reviewers[(idx + j) % 2]
                review_test(db, t, decision, "" if decision == "approve" else
                            "Expected value needs confirmation with the business analyst" if decision == "request_changes"
                            else "Duplicate of an existing regression check", rv, False,
                            created_at=tcreated + timedelta(days=2), audit_source="seed_import")
            tests_by_project[sr.project].append(t)
            seed_tests[t.key] = st
    db.flush()

    # ---- suites
    suites: dict[str, list[tuple[TestSuite, list[TestCase]]]] = defaultdict(list)
    for key, _name, _d, mods in PROJECTS:
        proj = projects[key]
        allt = tests_by_project[key]
        auto = [t for t in allt if t.automation == "pytest"]

        def mk(name, desc, members, prio="medium", module=None, key=key, proj=proj):
            st = TestSuite(key=f"TS-{key}-{len(suites[key]) + 1:03d}", project_id=proj.id, name=name, description=desc,
                           priority=prio, module_id=module.id if module else None, created_by=qa.id,
                           created_at=day0 + timedelta(days=60), updated_at=day0 + timedelta(days=60))
            db.add(st)
            db.flush()
            for pos, t in enumerate(members, start=1):
                db.add(SuiteTestCase(suite_id=st.id, test_case_id=t.id, position=pos))
            suites[key].append((st, members))
        mk(f"{key} Full regression", "All automated regression checks for the project.", auto, "high")
        mk(f"{key} Smoke", "Critical-priority automated checks run on every build.",
           [t for t in auto if t.priority == "critical"] or auto[:5], "critical")
        mk(f"{key} Boundary conditions", "Boundary-value checks.", [t for t in auto if t.test_type == "boundary"])
        for code, mname in mods:
            mod = modules[(key, code)]
            reqs = {r.id for r in req_rows.values() if r.module_id == mod.id}
            mk(f"{key} {mname}", f"Tests for the {mname} module.", [t for t in allt if t.requirement_id in reqs],
               module=mod)
        while len(suites[key]) < 6:
            mk(f"{key} Manual acceptance", "Manual acceptance checks for UAT sign-off.",
               [t for t in allt if t.automation == "manual"], "low")
    db.flush()

    # ---- genuine execution of every approved automated script against both engine builds
    runnable = [t for ts in tests_by_project.values() for t in ts
                if t.status == "approved" and t.automation == "pytest" and t.validation_status == "valid"]
    specs = [ScriptSpec(t.key, t.script) for t in runnable]
    real: dict[str, SandboxResult] = {}
    for v in ("1.0", "1.1"):
        res = run_pytest(specs, v, timeout_s=300)
        if res.status != "completed":
            raise RuntimeError(f"Seed execution against Reference HCM {v} did not complete: {res.status}\n{res.log[-2000:]}")
        real[v] = res
    approved_ids = {t.id for t in runnable}

    # ---- historical executions (source = historical_import)
    exec_counter = 0
    executions: list[tuple[Execution, list[TestCase]]] = []

    def record(key, suite, members, env, start, branch="release/2026.10"):
        nonlocal exec_counter
        members = [t for t in members if t.id in approved_ids]
        if not members:
            return None
        exec_counter += 1
        version = env.hcm_version
        outs = {t.key: real[version].outcomes[t.key] for t in members}
        sub = SandboxResult("completed", {k: TestOutcome(**vars(o)) for k, o in outs.items()},
                            sum(o.duration_ms for o in outs.values()) + 900,
                            f"Historical import of genuine Reference HCM {version} results "
                            f"({sum(1 for o in outs.values() if o.status == 'passed')}/{len(outs)} passed)")
        ex = Execution(key=f"EX-{exec_counter:06d}", project_id=projects[key].id, suite_id=suite.id,
                       environment_id=env.id, source="historical_import", runner="pytest", status="running",
                       hcm_version=version, total=len(members), triggered_by=qa.id,
                       commit_sha=f"{(SEED * exec_counter) % (16 ** 12):012x}", branch=branch, created_at=start)
        db.add(ex)
        db.flush()
        finished = start + timedelta(milliseconds=sub.duration_ms)
        persist_results(db, ex, members, sub, start, finished)
        audit.record(db, qa.id, "execution.imported", "execution", ex.id, ex.key, projects[key].id,
                     {"status": ex.status, "hcm_version": version}, source="seed_import", created_at=finished)
        executions.append((ex, members))
        return ex

    first_exec = day0 + timedelta(days=62)
    for w in range(12):
        for pi, (key, *_r) in enumerate(PROJECTS):
            e10, e11 = envs[key]
            reg, smoke = suites[key][0], suites[key][1]
            start = first_exec + timedelta(days=7 * w, hours=pi * 2 + 1)
            record(key, reg[0], reg[1], e10, start)
            if w % 2 == 0:
                record(key, smoke[0], smoke[1], e10, start + timedelta(days=2))
            if w >= 9:
                record(key, reg[0], reg[1], e11, start + timedelta(days=3), branch="fix/hcm-1.1-candidate")
    db.flush()

    # ---- defects from genuine v1.0 failures (one per requirement + API function), lifecycle by timeline
    defects: list[Defect] = []
    seen_groups: dict[tuple, Defect] = {}
    owner_ids = {k: users[v].id for k, v in OWNERS.items()}
    v11_pass: dict[int, Execution] = {}
    for ex, _members in executions:
        if ex.hcm_version != "1.1":
            continue
        for r in db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == ex.id,
                                                          ExecutionResult.status == "passed")).scalars():
            v11_pass.setdefault(r.test_case_id, ex)
    first_by_project: dict[str, Execution] = {}
    for ex, _m in executions:
        pk = next(k for k, p in projects.items() if p.id == ex.project_id)
        if ex.hcm_version == "1.0" and pk not in first_by_project:
            first_by_project[pk] = ex
    dup_budget = 8
    for pk, ex in first_by_project.items():
        failures = db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == ex.id,
                                                            ExecutionResult.status.in_(["failed", "error"]))
                              .order_by(ExecutionResult.id)).scalars().all()
        for r in failures:
            t = db.get(TestCase, r.test_case_id)
            cat, facts = classify_deterministic(r.status, r.message, r.stack_trace)
            r.failure_analysis = {"deterministic_category": cat, "observed_facts": facts, "provider": "seed_import",
                                  "ai": {"status": "not_run"}, "confirmed": cat == "application_defect",
                                  "note": "Classified during historical import; no AI provider was used."}
            if cat != "application_defect":
                continue
            fn = (_FN.findall(t.script or "") or ["unknown"])[0]
            group = (t.requirement_id, fn)
            created = ex.finished_at + timedelta(hours=rng.randint(2, 30))
            sev = {"critical": "critical", "high": "high"}.get(t.priority, "medium")
            req = db.get(Requirement, t.requirement_id)
            if group in seen_groups:
                if dup_budget <= 0:
                    continue
                dup_budget -= 1
                primary = seen_groups[group]
                d = Defect(key=f"DEF-{pk}-{len([x for x in defects if x.project_id == ex.project_id]) + 1:04d}",
                           project_id=ex.project_id, title=f"{t.title} — fails on Reference HCM 1.0",
                           description=f"Logged independently; same root cause as {primary.key}.", severity=sev,
                           priority="p3", status="open", approval_status="approved", requirement_id=req.id,
                           test_case_id=t.id, execution_id=ex.id, execution_result_id=r.id,
                           expected_result=t.expected_result, actual_result=r.message[:2000],
                           reproduction_steps=f"Run {t.key} against QA — Reference HCM 1.0.", error_log=r.stdout,
                           stack_trace=r.stack_trace, ai_analysis=r.failure_analysis, reporter_id=users["robin.sato"].id,
                           created_at=created, updated_at=created)
                db.add(d)
                db.flush()
                db.add(DefectLink(defect_id=d.id, related_defect_id=primary.id, link_type="duplicate"))
                audit.record(db, users["robin.sato"].id, "defect.created", "defect", d.id, d.key, d.project_id,
                             {"from_execution": ex.key}, source="seed_import", created_at=created)
                defect_svc.transition(db, d, "closed", reviewer.id, f"Duplicate of {primary.key}",
                                      created_at=created + timedelta(days=1), audit_source="seed_import")
                defects.append(d)
                continue
            d = Defect(key=f"DEF-{pk}-{len([x for x in defects if x.project_id == ex.project_id]) + 1:04d}",
                       project_id=ex.project_id, title=f"{req.title}: {fn} violates {', '.join(t.clause_keys)}",
                       description=f"Approved test {t.key} fails against Reference HCM 1.0. {facts[0]}",
                       severity=sev, priority="p1" if sev == "critical" else "p2" if sev == "high" else "p3",
                       status="open", approval_status="approved", requirement_id=req.id, test_case_id=t.id,
                       execution_id=ex.id, execution_result_id=r.id, expected_result=t.expected_result,
                       actual_result=r.message[:2000],
                       reproduction_steps=(f"1. Select QA — Reference HCM 1.0.\n2. Execute approved test {t.key} "
                                           f"(sha256 {r.script_hash[:12]}…).\n3. Observe: {r.message[:160]}"),
                       error_log=r.stdout, stack_trace=r.stack_trace, ai_analysis=r.failure_analysis,
                       reporter_id=qa.id, created_at=created, updated_at=created)
            db.add(d)
            db.flush()
            audit.record(db, qa.id, "defect.created", "defect", d.id, d.key, d.project_id,
                         {"from_execution": ex.key}, source="seed_import", created_at=created)
            seen_groups[group] = d
            defects.append(d)
    db.flush()

    # lifecycle progression grounded in v1.1 retest evidence
    primaries = [d for d in defects if d.status == "open"]
    for i, d in enumerate(primaries):
        pk = next(k for k, p in projects.items() if p.id == d.project_id)
        t0 = d.created_at
        stage = i % 9
        steps: list[tuple[str, float]] = []
        if stage >= 1:
            steps.append(("triaged", 1))
        if stage >= 2:
            d.owner_id = owner_ids[pk]
            steps.append(("assigned", 2))
        if stage >= 3:
            steps.append(("in_progress", 4))
        if stage >= 4:
            steps.append(("fixed", 58))
        if stage >= 5:
            steps.append(("ready_for_retest", 66))
        ver = v11_pass.get(d.test_case_id)
        if stage >= 6 and ver:
            d.verified_execution_id = ver.id
            steps.append(("verified", (ver.finished_at - t0).days + 0.2))
            if stage >= 7:
                steps.append(("closed", (ver.finished_at - t0).days + 1))
        for status, offset in steps:
            when = min(t0 + timedelta(days=offset, hours=3), now - timedelta(hours=1))
            defect_svc.transition(db, d, status, (reviewer if status in ("verified", "closed") else qa).id,
                                  {"triaged": "Confirmed against requirement clause", "assigned": "Assigned to module owner",
                                   "in_progress": "Fix in development", "fixed": "Fix merged into HCM 1.1 candidate",
                                   "ready_for_retest": "Deployed to fix-candidate environment",
                                   "verified": f"Retest passed in {ver.key if ver else ''}",
                                   "closed": "Closed after verification"}[status],
                                  created_at=when, audit_source="seed_import")
        if stage == 8 and d.status == "open":
            d.owner_id = owner_ids[pk]
            db.add(DefectComment(defect_id=d.id, author_id=users["jamie.fischer"].id,
                                 body="Awaiting product decision on expected behaviour.", created_at=t0 + timedelta(days=3)))

    # two pending recommendations from recent 1.0 executions for reviewers to triage
    pending = 0
    with_defect = {d.test_case_id for d in defects}
    for latest10 in [ex for ex, _ in executions if ex.hcm_version == "1.0"][::-1]:
        if pending >= 2:
            break
        for r in db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == latest10.id,
                                                          ExecutionResult.status == "failed")).scalars():
            t = db.get(TestCase, r.test_case_id)
            if pending >= 2 or t.id in with_defect:
                continue
            cat, facts = classify_deterministic(r.status, r.message, r.stack_trace)
            if cat != "application_defect":
                continue
            r.failure_analysis = {"deterministic_category": cat, "observed_facts": facts, "provider": "seed_import",
                                  "ai": {"status": "not_run"}, "confirmed": False}
            pk = next(k for k, p in projects.items() if p.id == latest10.project_id)
            n = len([x for x in defects if x.project_id == latest10.project_id]) + 1
            d = Defect(key=f"DEF-{pk}-{n:04d}", project_id=latest10.project_id,
                       title=f"{t.title} fails on Reference HCM 1.0", description=facts[0], severity="high",
                       priority="p2", status="open", approval_status="recommended", requirement_id=t.requirement_id,
                       test_case_id=t.id, execution_id=latest10.id, execution_result_id=r.id,
                       expected_result=t.expected_result, actual_result=r.message[:2000],
                       reproduction_steps=f"Run {t.key} against QA — Reference HCM 1.0.", stack_trace=r.stack_trace,
                       ai_analysis=r.failure_analysis, reporter_id=qa.id, created_at=latest10.finished_at,
                       updated_at=latest10.finished_at)
            db.add(d)
            db.flush()
            defects.append(d)
            with_defect.add(t.id)
            audit.record(db, qa.id, "defect.recommended", "defect", d.id, d.key, d.project_id, {},
                         source="seed_import", created_at=latest10.finished_at)
            pending += 1

    # ---- requirement changes after approval: impact analysis marks tests for re-approval
    changed = 0
    for title in ("Payroll timesheet cut-off — 2-day lead", "Leave carry-forward cap — head-office employees",
                  "Meal-break compliance — Hourly employees", "Benefits eligibility — the India entity"):
        req = req_rows[title]
        cur = current_version(db, req)
        cl = clauses_for(db, cur)
        text = " ".join(c.text for c in cl)
        new = text.replace(cl[0].text, cl[0].text.rstrip(".") + ", including employees on secondment.")
        update_requirement(db, req, actor_id=users["sam.okafor"].id, description=new,
                           change_summary="Scope extended to seconded employees",
                           created_at=now - timedelta(days=6 - changed), audit_source="seed_import")
        changed += 1

    for u in (qa, reviewer):
        db.add(Notification(user_id=u.id, title="Reference HCM 1.1 fix candidate available",
                            body="The fix-candidate environment is ready for retesting open defects.",
                            link="/executions", created_at=day0 + timedelta(days=135)))
    db.flush()
    counts = {
        "projects": len(projects), "modules": len(modules), "requirements": len(req_rows),
        "test_cases": sum(len(v) for v in tests_by_project.values()),
        "approved_automated": len(runnable), "executions": len(executions),
        "defects": len(defects),
        "v1_0_failures": sum(1 for o in real["1.0"].outcomes.values() if o.status != "passed"),
        "v1_1_failures": sum(1 for o in real["1.1"].outcomes.values() if o.status != "passed"),
    }
    return counts
