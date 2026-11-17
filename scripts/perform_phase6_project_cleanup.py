"""
Phase 6 Project Workspace Cleanup Script.
Safely removes projects CUREON (8), DAYFORCE (9), WFMQ (10), UPI_DISP (12), FLSA_PAY (13)
while strictly preserving ECHO (5) and EV_PAY (11) with 100% data integrity.
"""
import os
import shutil
import sqlite3
from pathlib import Path

REPO_ROOT = Path("/home/Sohan/PROJECTS/tracetest-ai")
DB_PATH = REPO_ROOT / "var" / "tracetest.db"
DOCS_DIR = REPO_ROOT / "var" / "documents"

PROJECTS_TO_PRESERVE = {
    5: "ECHO",
    11: "EV_PAY",
}

PROJECTS_TO_REMOVE = {
    8: "CUREON",
    9: "DAYFORCE",
    10: "WFMQ",
    12: "UPI_DISP",
    13: "FLSA_PAY",
}

def main():
    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()

    # 1. Verification of existing projects
    existing = dict(cur.execute("SELECT id, key FROM projects;").fetchall())
    print("Currently active projects in database:", existing)
    for pid, key in PROJECTS_TO_PRESERVE.items():
        assert pid in existing and existing[pid] == key, f"Preserve target {pid}:{key} not found!"
    targets_to_delete = [pid for pid in PROJECTS_TO_REMOVE if pid in existing]
    print(f"Projects to delete that are currently present: {targets_to_delete}")

    # 2. Capture Pre-Cleanup inventory for retained projects
    pre_counts = {}
    for pid in PROJECTS_TO_PRESERVE:
        pre_counts[pid] = {
            "reqs": cur.execute("SELECT COUNT(*) FROM requirements WHERE project_id = ?;", (pid,)).fetchone()[0],
            "clauses": cur.execute("SELECT COUNT(*) FROM clauses c JOIN requirements r ON c.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "acs": cur.execute("SELECT COUNT(*) FROM acceptance_criteria ac JOIN requirements r ON ac.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "tests": cur.execute("SELECT COUNT(*) FROM test_cases WHERE project_id = ?;", (pid,)).fetchone()[0],
            "execs": cur.execute("SELECT COUNT(*) FROM executions WHERE project_id = ?;", (pid,)).fetchone()[0],
            "defects": cur.execute("SELECT COUNT(*) FROM defects WHERE project_id = ?;", (pid,)).fetchone()[0],
            "docs": cur.execute("SELECT COUNT(*) FROM documents WHERE project_id = ?;", (pid,)).fetchone()[0],
            "environments": cur.execute("SELECT COUNT(*) FROM environments WHERE project_id = ?;", (pid,)).fetchone()[0],
            "modules": cur.execute("SELECT COUNT(*) FROM modules WHERE project_id = ?;", (pid,)).fetchone()[0],
            "members": cur.execute("SELECT COUNT(*) FROM project_members WHERE project_id = ?;", (pid,)).fetchone()[0],
        }

    # 3. Capture Pre-Cleanup inventory for removed projects
    removed_counts = {}
    for pid in PROJECTS_TO_REMOVE:
        removed_counts[pid] = {
            "reqs": cur.execute("SELECT COUNT(*) FROM requirements WHERE project_id = ?;", (pid,)).fetchone()[0],
            "clauses": cur.execute("SELECT COUNT(*) FROM clauses c JOIN requirements r ON c.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "acs": cur.execute("SELECT COUNT(*) FROM acceptance_criteria ac JOIN requirements r ON ac.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "tests": cur.execute("SELECT COUNT(*) FROM test_cases WHERE project_id = ?;", (pid,)).fetchone()[0],
            "execs": cur.execute("SELECT COUNT(*) FROM executions WHERE project_id = ?;", (pid,)).fetchone()[0],
            "defects": cur.execute("SELECT COUNT(*) FROM defects WHERE project_id = ?;", (pid,)).fetchone()[0],
            "docs": cur.execute("SELECT COUNT(*) FROM documents WHERE project_id = ?;", (pid,)).fetchone()[0],
        }

    print("\n--- REMOVING PROJECTS WITH FOREIGN KEY CASCADING ---")
    cur.execute("BEGIN TRANSACTION;")
    try:
        for pid, key in PROJECTS_TO_REMOVE.items():
            print(f"Deleting project {pid} ({key})...")
            cur.execute("DELETE FROM projects WHERE id = ?;", (pid,))
            
            # Remove document files on disk if any
            p_doc_dir = DOCS_DIR / str(pid)
            if p_doc_dir.exists():
                print(f"  Removing document directory {p_doc_dir}...")
                shutil.rmtree(p_doc_dir)

        # Integrity Check
        fk_check = cur.execute("PRAGMA foreign_key_check;").fetchall()
        if fk_check:
            raise RuntimeError(f"Foreign key violations detected after deletion: {fk_check}")
        
        conn.commit()
        print("Project deletion transaction committed successfully!")
    except Exception as e:
        conn.rollback()
        raise RuntimeError(f"Deletion failed, rolled back: {e}")

    # 4. Post-Cleanup Verification
    post_existing = dict(cur.execute("SELECT id, key FROM projects;").fetchall())
    print("\nRemaining projects in database:", post_existing)
    assert set(post_existing.keys()) == {5, 11}, f"Unexpected remaining projects: {post_existing}"
    assert post_existing[5] == "ECHO"
    assert post_existing[11] == "EV_PAY"

    for pid in PROJECTS_TO_PRESERVE:
        post = {
            "reqs": cur.execute("SELECT COUNT(*) FROM requirements WHERE project_id = ?;", (pid,)).fetchone()[0],
            "clauses": cur.execute("SELECT COUNT(*) FROM clauses c JOIN requirements r ON c.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "acs": cur.execute("SELECT COUNT(*) FROM acceptance_criteria ac JOIN requirements r ON ac.requirement_id = r.id WHERE r.project_id = ?;", (pid,)).fetchone()[0],
            "tests": cur.execute("SELECT COUNT(*) FROM test_cases WHERE project_id = ?;", (pid,)).fetchone()[0],
            "execs": cur.execute("SELECT COUNT(*) FROM executions WHERE project_id = ?;", (pid,)).fetchone()[0],
            "defects": cur.execute("SELECT COUNT(*) FROM defects WHERE project_id = ?;", (pid,)).fetchone()[0],
            "docs": cur.execute("SELECT COUNT(*) FROM documents WHERE project_id = ?;", (pid,)).fetchone()[0],
            "environments": cur.execute("SELECT COUNT(*) FROM environments WHERE project_id = ?;", (pid,)).fetchone()[0],
            "modules": cur.execute("SELECT COUNT(*) FROM modules WHERE project_id = ?;", (pid,)).fetchone()[0],
            "members": cur.execute("SELECT COUNT(*) FROM project_members WHERE project_id = ?;", (pid,)).fetchone()[0],
        }
        print(f"\nProject {pid} ({PROJECTS_TO_PRESERVE[pid]}):")
        print(f"  Pre-cleanup:  {pre_counts[pid]}")
        print(f"  Post-cleanup: {post}")
        assert pre_counts[pid] == post, f"Integrity check failed for retained project {pid}!"

    # Verify retained documents on disk for EV_PAY (11)
    ev_pay_docs = DOCS_DIR / "11"
    assert ev_pay_docs.exists(), "EV_PAY document directory missing!"
    doc_files = list(ev_pay_docs.glob("*"))
    print(f"\nRetained EV_PAY document binaries on disk ({len(doc_files)} files):")
    for f in doc_files:
        print(f"  - {f.name} ({f.stat().st_size} bytes)")

    # Vacuum database to optimize pages
    cur.execute("VACUUM;")
    conn.close()
    print("\nPhase 6 Project Cleanup Complete & 100% Verified!")

if __name__ == "__main__":
    main()
