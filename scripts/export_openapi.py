"""Export the OpenAPI specification to docs/openapi.json (no database required)."""
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("TRACETEST_DATA_DIR", tempfile.mkdtemp(prefix="tt-openapi-"))

from app.main import app  # noqa: E402

(ROOT / "docs" / "openapi.json").write_text(json.dumps(app.openapi(), indent=2))
print("wrote docs/openapi.json with", len(app.openapi()["paths"]), "paths")
