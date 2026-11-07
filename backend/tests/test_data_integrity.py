import sqlite3

from app.core.config import get_settings


def _q(sql):
    con = sqlite3.connect(str(get_settings().db_path))
    try:
        return con.execute(sql).fetchall()
    finally:
        con.close()


def test_seed_counts_come_from_sqlite(app, admin):
    k = admin.get("/analytics/dashboard").json()["kpis"]
    assert k["total_projects"] == _q("select count(*) from projects")[0][0] >= 5
    assert _q("select count(*) from modules")[0][0] >= 12
    assert 60 <= _q("select count(*) from requirements")[0][0] <= 300
    assert _q("select count(*) from requirement_versions")[0][0] >= 100
    assert _q("select count(*) from test_steps")[0][0] >= 1000
    assert _q("select count(*) from test_suites")[0][0] >= 30
    assert 80 <= _q("select count(*) from executions where source='historical_import'")[0][0] <= 120
    assert _q("select count(*) from execution_results")[0][0] >= 1000
    assert _q("select count(*) from audit_log")[0][0] >= 150
    assert _q("select count(*) from requirements where status='draft' and analysed_at is null")[0][0] >= 4


def test_foreign_keys_and_integrity(app):
    assert _q("pragma integrity_check")[0][0] == "ok"
    assert _q("pragma foreign_key_check") == []
    assert _q("pragma journal_mode")[0][0] == "wal"


def test_results_match_approved_script_hashes(app):
    bad = _q("""select count(*) from execution_results r join test_cases t on t.id=r.test_case_id
                where r.script_hash != t.script_hash and t.version = r.test_case_version""")
    assert bad[0][0] == 0


def test_defects_reference_real_failures(app):
    rows = _q("""select d.key, r.status from defects d join execution_results r on r.id=d.execution_result_id
                 where d.execution_result_id is not null""")
    assert rows and all(status in ("failed", "error", "timed_out") for _, status in rows)
    assert _q("select count(*) from defects where execution_result_id is null and approval_status='approved' "
              "and reporter_id is null")[0][0] == 0


def test_no_fabricated_ai_traces(app):
    providers = {p for (p,) in _q("select distinct provider from test_cases")}
    assert providers <= {"seed_import", "manual", "mock", "repo_import"}
    assert _q("select count(*) from provider_traces where provider in ('groq','gemini')")[0][0] == 0
    assert _q("select count(*) from eval_runs where provider in ('groq','gemini')")[0][0] == 0


def test_historical_and_platform_runs_distinguished(app):
    sources = {s for (s,) in _q("select distinct source from executions")}
    assert "historical_import" in sources


def test_reinitialisation_is_idempotent(app):
    from app.db.init_db import initialise
    before = _q("select (select count(*) from requirements), (select count(*) from executions), (select count(*) from users)")
    out = initialise()
    after = _q("select (select count(*) from requirements), (select count(*) from executions), (select count(*) from users)")
    assert out["seed"] == {"status": "already_seeded"} and before == after


def test_v10_faults_fail_and_v11_fixes_pass(app):
    rows = _q("""select e.hcm_version, r.status, count(*) from execution_results r join executions e on e.id=r.execution_id
                 where e.source='historical_import' group by 1,2""")
    by = {(v, s): n for v, s, n in rows}
    assert by.get(("1.0", "failed"), 0) > 0
    rate10 = by.get(("1.0", "passed"), 0) / sum(n for (v, _), n in by.items() if v == "1.0")
    rate11 = by.get(("1.1", "passed"), 0) / sum(n for (v, _), n in by.items() if v == "1.1")
    assert rate11 > rate10


def test_backup_and_integrity(admin, app):
    r = admin.post("/admin/backup")
    assert r.status_code == 200
    from app.db.maintenance import integrity_report
    path = get_settings().backups_dir / r.json()["backup"]
    assert integrity_report(path)["ok"]
