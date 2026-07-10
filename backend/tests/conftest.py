"""Pytest config: make the ``backend`` directory importable as a package root.

The tests live in ``backend/tests`` and need to import the application
modules (``server``, ``database``, ``auth``) that sit next to them. We
inject the backend directory onto ``sys.path`` so absolute imports work
whether pytest is invoked from the repo root or from ``backend/``.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
