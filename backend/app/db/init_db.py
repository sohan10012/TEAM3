"""Idempotent initialisation: migrations -> roles/users -> seed dataset -> integrity validation."""
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.db.base import get_engine
from app.db.maintenance import integrity_report

log = logging.getLogger("tracetest.init")
BACKEND = Path(__file__).resolve().parents[2]


def alembic_config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{get_settings().db_path}")
    return cfg


def migrate() -> None:
    get_engine()
    command.upgrade(alembic_config(), "head")


def initialise(seed: bool | None = None) -> dict:
    s = get_settings()
    migrate()
    from app.seed.seed import ensure_identity, seed_dataset
    ensure_identity()
    summary = {}
    if s.seed_on_startup if seed is None else seed:
        summary = seed_dataset()

    # Ensure permanent default projects: EchoBox (code-based), Cureonix (code-based), Dayforce (requirements-based), WFMQ (requirements-based)
    from app.db.base import session_scope
    from app.seed.cureonix_seed import ensure_cureonix_project
    from app.seed.dayforce_seed import ensure_dayforce_project
    from app.seed.echobox_seed import ensure_echobox_project
    from app.seed.wfmq_seed import ensure_wfmq_project
    with session_scope() as db:
        ensure_echobox_project(db)
        ensure_cureonix_project(db)
        ensure_dayforce_project(db)
        ensure_wfmq_project(db)

    rep = integrity_report()
    if not rep["ok"]:
        raise RuntimeError(f"Database integrity validation failed: {rep}")
    from app.services.tasks import recover_interrupted
    recovered = recover_interrupted()
    log.info("Database ready at %s (seed=%s, recovered_runs=%s)", s.db_path, summary, recovered)
    return {"db": str(s.db_path), "seed": summary, "integrity": rep}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    res = initialise()
    print("Database initialisation complete:", res)

