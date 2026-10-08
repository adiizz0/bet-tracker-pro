"""Pytest wrapper so `python -m pytest tests/test_pg_migration_smoke.py` runs the smoke script.

The smoke script itself (tests/pg_migration_smoke.py) is unchanged; it exits non-zero on any FAIL.
"""
import os
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parent / "pg_migration_smoke.py"


def test_pg_migration_smoke():
    env = dict(os.environ)
    env.setdefault("REACT_APP_BACKEND_URL", "http://localhost:8001")
    proc = subprocess.run([sys.executable, str(SCRIPT)], env=env, capture_output=True, text=True)
    print(proc.stdout)
    print(proc.stderr)
    assert proc.returncode == 0, "smoke test failed"
