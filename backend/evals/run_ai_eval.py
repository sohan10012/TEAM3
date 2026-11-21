#!/usr/bin/env python3
"""CLI wrapper to run AI evaluation benchmark."""
from __future__ import annotations

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.services.run_ai_eval import main

if __name__ == "__main__":
    main()

