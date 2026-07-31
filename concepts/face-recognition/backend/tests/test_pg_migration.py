"""A pgvector database created before the rename must come across intact.

schema.sql runs on every backend start, so the rename has to be idempotent as
well as correct. This builds a database with the pre-rename schema, points the
real store at it, and checks the data survived.
"""

import asyncio

import asyncpg
import numpy as np
import pytest

from .helpers import MIGRATION_DB_NAME as MIGRATION_DB, dsn_for

# Exactly the schema shipped before the rename.
LEGACY_SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE face_embeddings (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    embedding vector(512),
    created_at TIMESTAMPTZ DEFAULT now()
);
"""


async def _recreate_legacy_database(embedding: np.ndarray) -> str:
    admin = await asyncpg.connect(dsn_for("postgres"))
    try:
        await admin.execute(
            f'DROP DATABASE IF EXISTS "{MIGRATION_DB}" WITH (FORCE)'
        )
        await admin.execute(f'CREATE DATABASE "{MIGRATION_DB}"')
    finally:
        await admin.close()

    dsn = dsn_for(MIGRATION_DB)
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(LEGACY_SCHEMA)
        await conn.execute(
            "INSERT INTO employees (employee_code, full_name, department)"
            " VALUES ($1, $2, $3)",
            "0901234567",
            "Chị Lan Nguyễn",
            "Kho",
        )
        # The vector codec isn't registered on this bare connection, so hand
        # pgvector its own text form.
        await conn.execute(
            "INSERT INTO face_embeddings (employee_id, embedding) VALUES (1, $1::vector)",
            "[" + ",".join(str(float(v)) for v in embedding) + "]",
        )
    finally:
        await conn.close()
    return dsn


async def _drop_migration_database() -> None:
    admin = await asyncpg.connect(dsn_for("postgres"))
    try:
        await admin.execute(f'DROP DATABASE IF EXISTS "{MIGRATION_DB}" WITH (FORCE)')
    finally:
        await admin.close()


@pytest.fixture()
def legacy_dsn(postgres_dsn):
    embedding = np.ones(512, dtype=np.float32) / np.sqrt(512)
    dsn = asyncio.run(_recreate_legacy_database(embedding))
    yield dsn, embedding
    asyncio.run(_drop_migration_database())


async def test_legacy_database_is_renamed_in_place(legacy_dsn):
    from app.stores.pg_store import PgVectorStore

    dsn, embedding = legacy_dsn
    store = PgVectorStore(dsn)
    await store.init()  # applies schema.sql, which performs the rename

    person = await store.get_person("0901234567")
    assert person is not None
    assert person.full_name == "Chị Lan Nguyễn"
    assert person.department == "Kho"
    assert person.embedding_count == 1

    # Their face data still matches, so nobody has to re-enrol.
    match = await store.best_match(embedding)
    assert match is not None
    assert match.code == "0901234567"
    assert match.similarity == pytest.approx(1.0, abs=1e-5)

    # The new tables are usable straight away.
    from app.stores.base import Profile, SessionItem

    await store.upsert_person(
        "0901234567", "Chị Lan Nguyễn", None, Profile(phone="090 ••• 67", age="58")
    )
    await store.add_session("0901234567", [SessionItem(category="nhua", weight=3.24)])
    assert (await store.get_person("0901234567")).profile.age == "58"
    assert await store.community_total() == pytest.approx(3.24)

    await store.close()

    # The old names are gone, not merely shadowed by empty new tables.
    conn = await asyncpg.connect(dsn)
    try:
        tables = {
            r["table_name"]
            for r in await conn.fetch(
                "SELECT table_name FROM information_schema.tables"
                " WHERE table_schema = 'public'"
            )
        }
        assert "people" in tables
        assert "employees" not in tables
        columns = {
            r["column_name"]
            for r in await conn.fetch(
                "SELECT column_name FROM information_schema.columns"
                " WHERE table_name = 'face_embeddings'"
            )
        }
        assert "person_id" in columns
        assert "employee_id" not in columns
    finally:
        await conn.close()


async def test_migration_is_idempotent(legacy_dsn):
    """schema.sql runs on every startup, so applying it repeatedly must be safe."""
    from app.stores.pg_store import PgVectorStore

    dsn, _ = legacy_dsn
    for _ in range(3):
        store = PgVectorStore(dsn)
        await store.init()
        assert (await store.get_person("0901234567")) is not None
        await store.close()
