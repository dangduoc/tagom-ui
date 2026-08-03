"""Test setup for the station API.

Two bits of scaffolding:

1. `app.main` pulls in the face pipeline at import time, which drags in
   onnxruntime/opencv/insightface — hundreds of MB that say nothing about the
   endpoints under test. Those three are stubbed so the API can be tested from
   a plain `pip install -r requirements-dev.txt`. Recognition itself is only
   exercised by running the real backend.

2. PostgreSQL + pgvector is the only storage backend, so the tests need a real
   database. They use their own (`facedb_test`), created on the same server as
   DATABASE_URL, and never touch the development database. If no server is
   reachable the whole suite skips with an explanation rather than failing.
"""

import asyncio
import sys
import types
from unittest.mock import MagicMock

import asyncpg
import pytest

from .helpers import TEST_DB_NAME, dsn_for

TABLES = ("weigh_items", "weigh_sessions", "face_embeddings", "people")


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


async def _ensure_test_database() -> None:
    """Creates facedb_test if it isn't there yet. Raises if no server answers."""
    admin = await asyncpg.connect(dsn_for("postgres"))
    try:
        exists = await admin.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME
        )
        if not exists:
            await admin.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    finally:
        await admin.close()


async def _truncate() -> None:
    conn = await asyncpg.connect(dsn_for(TEST_DB_NAME))
    try:
        await conn.execute(
            f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"
        )
    finally:
        await conn.close()


@pytest.fixture(scope="session")
def postgres_dsn() -> str:
    """DSN of the test database, or skip the suite if there's no server."""
    try:
        asyncio.run(_ensure_test_database())
    except (OSError, asyncpg.PostgresError) as exc:
        pytest.skip(
            "no PostgreSQL reachable at "
            f"{dsn_for('postgres')} ({exc.__class__.__name__}). "
            "Start it with: docker compose up -d db",
            allow_module_level=True,
        )
    return dsn_for(TEST_DB_NAME)


@pytest.fixture()
def client(postgres_dsn, monkeypatch):
    """A TestClient on an empty test database."""
    monkeypatch.setenv("DATABASE_URL", postgres_dsn)
    # TestClient reports its peer as the literal string "testclient", which is
    # not an address the trusted-client guard can match, so every request would
    # come back 403. Switch the guard off for the endpoint tests; it has its own
    # tests in test_client_guard.py that check the matching directly.
    monkeypatch.setenv("TRUSTED_CLIENT_CIDRS", "*")
    _stub_vision_modules()

    # config and the store are read at import time, so drop any cached copies.
    # The `app` package itself has to go too: it keeps submodule attributes, and
    # `from . import config` would hand back the previous test's module (and so
    # the previous test's settings) rather than re-importing.
    for module in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[module]

    from fastapi.testclient import TestClient

    from app.main import app

    # Entering the client applies schema.sql; truncate after so each test starts
    # from empty regardless of what ran before it.
    with TestClient(app) as test_client:
        asyncio.run(_truncate())
        yield test_client
