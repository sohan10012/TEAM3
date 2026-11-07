"""Shared helper for idempotent project seeding from verified reference datasets."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AcceptanceCriterion,
    Clause,
    Defect,
    Document,
    Environment,
    Execution,
    ExecutionResult,
    Integration,
    Module,
    Project,
    ProjectContext,
    ProjectMember,
    ProjectRole,
    Requirement,
    RequirementClarification,
    RequirementVersion,
    SimulationModel,
    TestCase,
    TestStep,
)

log = logging.getLogger("tracetest.seed.helper")


def parse_val(v: Any, key: str = "") -> Any:
    if isinstance(v, str):
        if len(v) >= 19 and len(v) <= 35 and v[10] in ("T", " "):
            try:
                return datetime.fromisoformat(v.replace("Z", "").replace("T", " "))
            except Exception:
                pass
        # Do not parse raw string/text columns into dicts
        text_cols = {"stdout", "stack_trace", "script", "text", "description", "title", "content", "evidence_excerpt", "message", "expected_result", "actual_result", "notes"}
        if key not in text_cols and ((v.startswith("{") and v.endswith("}")) or (v.startswith("[") and v.endswith("]"))):
            try:
                return json.loads(v)
            except Exception:
                pass
    return v


def clean_dict(d: dict[str, Any], exclude: tuple[str, ...]) -> dict[str, Any]:
    return {k: parse_val(v, k) for k, v in d.items() if k not in exclude}


def seed_project_from_data(
    db: Session,
    data: dict[str, Any],
    default_id: int,
    user_id: int,
    org_id: int,
) -> Project:
    """Idempotently seed a project and all associated entities from a structured dictionary."""
    p = data["project"]
    proj = db.execute(select(Project).where(Project.key == p["key"])).scalar_one_or_none()
    if not proj:
        id_free = db.execute(select(Project).where(Project.id == default_id)).scalar_one_or_none() is None
        p_kwargs = {
            "key": p["key"],
            "name": p["name"],
            "description": p["description"],
            "organisation_id": org_id,
            "owner_id": user_id,
            "project_type": p.get("project_type", "requirements_based"),
            "status": p.get("status", "active"),
        }
        if id_free:
            p_kwargs["id"] = default_id
        proj = Project(**p_kwargs)
        db.add(proj)
        db.flush()

    if not db.execute(select(ProjectMember).where(ProjectMember.project_id == proj.id, ProjectMember.user_id == user_id)).scalar_one_or_none():
        db.add(ProjectMember(project_id=proj.id, user_id=user_id, project_role="owner"))
        db.flush()

    # 1. Environments
    env_map: dict[int, int] = {}
    for e in data.get("environments", []):
        existing_env = db.execute(select(Environment).where(Environment.project_id == proj.id, Environment.name == e["name"])).scalar_one_or_none()
        if not existing_env:
            env = Environment(project_id=proj.id, **clean_dict(e, ("id", "project_id", "created_at")))
            db.add(env)
            db.flush()
            env_map[e["id"]] = env.id
        else:
            env_map[e["id"]] = existing_env.id

    # 2. Integrations
    for ig in data.get("integrations", []):
        existing_ig = db.execute(select(Integration).where(Integration.project_id == proj.id, Integration.kind == ig["kind"])).scalar_one_or_none()
        if not existing_ig:
            db.add(Integration(project_id=proj.id, **clean_dict(ig, ("id", "project_id", "created_at", "last_checked_at"))))
            db.flush()

    # 3. Documents
    doc_map: dict[int, int] = {}
    for d in data.get("documents", []):
        existing_doc = db.execute(select(Document).where(Document.project_id == proj.id, Document.filename == d["filename"])).scalar_one_or_none()
        if not existing_doc:
            doc = Document(project_id=proj.id, **clean_dict(d, ("id", "project_id", "created_at", "updated_at")))
            db.add(doc)
            db.flush()
            doc_map[d["id"]] = doc.id
        else:
            doc_map[d["id"]] = existing_doc.id

    # 4. Modules
    mod_map: dict[int, int] = {}
    for m in data.get("modules", []):
        existing_mod = db.execute(select(Module).where(Module.project_id == proj.id, Module.code == m["code"])).scalar_one_or_none()
        if not existing_mod:
            mod = Module(project_id=proj.id, **clean_dict(m, ("id", "project_id", "created_at")))
            db.add(mod)
            db.flush()
            mod_map[m["id"]] = mod.id
        else:
            mod_map[m["id"]] = existing_mod.id

    # 5. Requirements
    req_map: dict[int, int] = {}
    for r in data.get("requirements", []):
        existing_req = db.execute(select(Requirement).where(Requirement.project_id == proj.id, Requirement.key == r["key"])).scalar_one_or_none()
        if not existing_req:
            r_d = clean_dict(r, ("id", "project_id", "module_id", "document_id"))
            if r.get("module_id"):
                r_d["module_id"] = mod_map.get(r["module_id"])
            if r.get("document_id"):
                r_d["document_id"] = doc_map.get(r["document_id"])
            req = Requirement(project_id=proj.id, **r_d)
            db.add(req)
            db.flush()
            req_map[r["id"]] = req.id
        else:
            req_map[r["id"]] = existing_req.id

    # 6. Requirement Versions
    rv_map: dict[int, int] = {}
    for rv in data.get("requirement_versions", []):
        new_req_id = req_map.get(rv["requirement_id"])
        if not new_req_id:
            continue
        existing_rv = db.execute(select(RequirementVersion).where(RequirementVersion.requirement_id == new_req_id, RequirementVersion.version == rv["version"])).scalar_one_or_none()
        if not existing_rv:
            rv_obj = RequirementVersion(requirement_id=new_req_id, **clean_dict(rv, ("id", "requirement_id")))
            db.add(rv_obj)
            db.flush()
            rv_map[rv["id"]] = rv_obj.id
        else:
            rv_map[rv["id"]] = existing_rv.id

    # 7. Clauses
    for c in data.get("clauses", []):
        new_req_id = req_map.get(c["requirement_id"])
        new_ver_id = rv_map.get(c["version_id"])
        if not new_req_id or not new_ver_id:
            continue
        existing_c = db.execute(select(Clause).where(Clause.version_id == new_ver_id, Clause.clause_key == c["clause_key"])).scalar_one_or_none()
        if not existing_c:
            c_d = clean_dict(c, ("id", "requirement_id", "version_id"))
            db.add(Clause(requirement_id=new_req_id, version_id=new_ver_id, **c_d))
    db.flush()

    # 8. Acceptance Criteria
    for a in data.get("acceptance_criteria", []):
        new_req_id = req_map.get(a["requirement_id"])
        if not new_req_id:
            continue
        existing_ac = db.execute(select(AcceptanceCriterion).where(AcceptanceCriterion.key == a["key"])).scalar_one_or_none()
        if not existing_ac:
            db.add(AcceptanceCriterion(requirement_id=new_req_id, **clean_dict(a, ("id", "requirement_id"))))
            db.flush()

    # 9. Test Cases
    tc_map: dict[int, int] = {}
    for tc_d in data.get("test_cases", []):
        existing_tc = db.execute(select(TestCase).where(TestCase.project_id == proj.id, TestCase.key == tc_d["key"])).scalar_one_or_none()
        if not existing_tc:
            t_d = clean_dict(tc_d, ("id", "project_id", "requirement_id"))
            if tc_d.get("requirement_id"):
                t_d["requirement_id"] = req_map.get(tc_d["requirement_id"])
            tc = TestCase(project_id=proj.id, **t_d)
            db.add(tc)
            db.flush()
            tc_map[tc_d["id"]] = tc.id
        else:
            tc_map[tc_d["id"]] = existing_tc.id

    # 10. Test Steps
    for s in data.get("test_steps", []):
        new_tc_id = tc_map.get(s["test_case_id"])
        if not new_tc_id:
            continue
        existing_s = db.execute(select(TestStep).where(TestStep.test_case_id == new_tc_id, TestStep.position == s["position"])).scalar_one_or_none()
        if not existing_s:
            db.add(TestStep(test_case_id=new_tc_id, **clean_dict(s, ("id", "test_case_id"))))
    db.flush()

    # 11. Simulation Models
    model_map: dict[int, int] = {}
    for sm in data.get("simulation_models", []):
        existing_sm = db.execute(select(SimulationModel).where(SimulationModel.project_id == proj.id, SimulationModel.name == sm["name"])).scalar_one_or_none()
        if not existing_sm:
            sm_d = clean_dict(sm, ("id", "project_id"))
            sm_obj = SimulationModel(project_id=proj.id, **sm_d)
            db.add(sm_obj)
            db.flush()
            model_map[sm["id"]] = sm_obj.id
        else:
            model_map[sm["id"]] = existing_sm.id

    # 12. Executions
    ex_map: dict[int, int] = {}
    for ex_d in data.get("executions", []):
        target_key = ex_d["key"]
        existing_ex = db.execute(select(Execution).where(Execution.key == target_key)).scalar_one_or_none()
        if existing_ex:
            if existing_ex.project_id == proj.id:
                ex_map[ex_d["id"]] = existing_ex.id
                continue
            # Collision with another project (e.g. legacy seed in test environments)
            target_key = f"{target_key}-{proj.key}"
            alt_ex = db.execute(select(Execution).where(Execution.key == target_key)).scalar_one_or_none()
            if alt_ex:
                ex_map[ex_d["id"]] = alt_ex.id
                continue

        e_d = clean_dict(ex_d, ("id", "project_id", "environment_id", "model_id", "key"))
        if ex_d.get("environment_id"):
            e_d["environment_id"] = env_map.get(ex_d["environment_id"])
        if ex_d.get("model_id"):
            e_d["model_id"] = model_map.get(ex_d["model_id"])
        else:
            e_d["model_id"] = None
        e_d["triggered_by"] = user_id
        ex = Execution(project_id=proj.id, key=target_key, **e_d)
        db.add(ex)
        db.flush()
        ex_map[ex_d["id"]] = ex.id

    # 13. Execution Results
    er_map: dict[int, int] = {}
    for er in data.get("execution_results", []):
        new_ex_id = ex_map.get(er["execution_id"])
        new_tc_id = tc_map.get(er["test_case_id"])
        if not new_ex_id or not new_tc_id:
            continue
        existing_er = db.execute(select(ExecutionResult).where(ExecutionResult.execution_id == new_ex_id, ExecutionResult.test_case_id == new_tc_id)).scalar_one_or_none()
        if not existing_er:
            er_obj = ExecutionResult(execution_id=new_ex_id, test_case_id=new_tc_id, **clean_dict(er, ("id", "execution_id", "test_case_id")))
            db.add(er_obj)
            db.flush()
            er_map[er["id"]] = er_obj.id
        else:
            er_map[er["id"]] = existing_er.id
    db.flush()

    # 14. Defects
    for df in data.get("defects", []):
        target_key = df["key"]
        existing_df = db.execute(select(Defect).where(Defect.key == target_key)).scalar_one_or_none()
        if existing_df:
            continue
        df_d = clean_dict(df, ("id", "project_id", "execution_id", "verified_execution_id", "requirement_id", "test_case_id", "execution_result_id"))
        if df.get("execution_id"):
            df_d["execution_id"] = ex_map.get(df["execution_id"])
        if df.get("verified_execution_id"):
            df_d["verified_execution_id"] = ex_map.get(df["verified_execution_id"])
        if df.get("requirement_id"):
            df_d["requirement_id"] = req_map.get(df["requirement_id"])
        if df.get("test_case_id"):
            df_d["test_case_id"] = tc_map.get(df["test_case_id"])
        if df.get("execution_result_id"):
            df_d["execution_result_id"] = er_map.get(df["execution_result_id"])
        db.add(Defect(project_id=proj.id, **df_d))
    db.flush()

    # 14. Requirement Clarifications
    for rc in data.get("requirement_clarifications", []):
        new_req_id = req_map.get(rc["requirement_id"])
        existing_rc = db.execute(select(RequirementClarification).where(RequirementClarification.project_id == proj.id, RequirementClarification.question == rc["question"])).scalar_one_or_none()
        if not existing_rc:
            rc_d = clean_dict(rc, ("id", "project_id", "requirement_id"))
            db.add(RequirementClarification(project_id=proj.id, requirement_id=new_req_id, **rc_d))

    # 15. Project Context
    for pc in data.get("project_contexts", []):
        existing_pc = db.execute(select(ProjectContext).where(ProjectContext.project_id == proj.id)).scalar_one_or_none()
        if not existing_pc:
            db.add(ProjectContext(project_id=proj.id, **clean_dict(pc, ("id", "project_id", "created_at", "updated_at"))))

    # 16. Project Roles
    for pr in data.get("project_roles", []):
        existing_pr = db.execute(select(ProjectRole).where(ProjectRole.project_id == proj.id, ProjectRole.role_name == pr["role_name"])).scalar_one_or_none()
        if not existing_pr:
            db.add(ProjectRole(project_id=proj.id, **clean_dict(pr, ("id", "project_id", "created_at"))))

    db.commit()
    return proj
