"""Test setup for the station API.

`app.main` pulls in the face pipeline at import time, which drags in
onnxruntime/opencv/insightface — hundreds of MB that say nothing about the
station endpoints under test. Stub those three modules before importing the
app so the API can be tested from a plain `pip install -r requirements-dev.txt`.
Recognition itself is covered by running the real backend.
"""

import sys
import types
from unittest.mock import MagicMock

import pytest


def _stub_vision_modules() -> None:
    if "cv2" not in sys.modules:
        sys.modules["cv2"] = MagicMock()
    if "insightface" not in sys.modules:
        insightface = types.ModuleType("insightface")
        insightface_app = types.ModuleType("insightface.app")
        insightface_app.FaceAnalysis = MagicMock()
        insightface.app = insightface_app
        sys.modules["insightface"] = insightface
        sys.modules["insightface.app"] = insightface_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """A TestClient backed by a throwaway SQLite database."""
    monkeypatch.setenv("DB_BACKEND", "sqlite")
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "test_store.db"))
    _stub_vision_modules()

    # config and the store are read at import time, so drop any cached copies.
    # The `app` package itself has to go too: it keeps submodule attributes, and
    # `from . import config` would hand back the previous test's module (and so
    # the previous test's database) rather than re-importing.
    for module in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[module]

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
