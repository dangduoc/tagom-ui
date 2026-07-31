"""An existing local_store.db from the face-recognition experiment must survive
the rename to `people` with its data intact."""

import sqlite3

import numpy as np
import pytest

from app.stores.base import Profile, SessionItem
from app.stores.sqlite_store import SQLiteStore

# Exactly the schema shipped before the rename.
LEGACY_SCHEMA = """
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE face_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


def make_legacy_db(path, embedding: np.ndarray) -> None:
    db = sqlite3.connect(path)
    db.executescript(LEGACY_SCHEMA)
    db.execute(
        "INSERT INTO employees (employee_code, full_name, department) VALUES (?, ?, ?)",
        ("0901234567", "Chị Lan Nguyễn", "Kho"),
    )
    db.execute(
        "INSERT INTO face_embeddings (employee_id, embedding) VALUES (1, ?)",
        (embedding.tobytes(),),
    )
    db.commit()
    db.close()


@pytest.mark.asyncio
async def test_legacy_database_is_renamed_in_place(tmp_path):
    path = tmp_path / "local_store.db"
    embedding = np.ones(512, dtype=np.float32) / np.sqrt(512)
    make_legacy_db(path, embedding)

    store = SQLiteStore(str(path))
    await store.init()

    # The person came across, code and all.
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

    # The new columns and tables are usable straight away.
    await store.upsert_person(
        "0901234567", "Chị Lan Nguyễn", None, Profile(phone="090 ••• 67", age="58")
    )
    await store.add_session("0901234567", [SessionItem(category="nhua", weight=3.24)])
    assert (await store.get_person("0901234567")).profile.age == "58"
    assert await store.community_total() == pytest.approx(3.24)

    await store.close()

    # The old names are gone, not merely shadowed by empty new tables.
    db = sqlite3.connect(path)
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "people" in tables
    assert "employees" not in tables
    columns = {r[1] for r in db.execute("PRAGMA table_info(face_embeddings)")}
    assert "person_id" in columns
    assert "employee_id" not in columns
    db.close()


@pytest.mark.asyncio
async def test_migration_is_idempotent(tmp_path):
    path = tmp_path / "local_store.db"
    make_legacy_db(path, np.ones(512, dtype=np.float32) / np.sqrt(512))

    for _ in range(3):
        store = SQLiteStore(str(path))
        await store.init()
        assert (await store.get_person("0901234567")) is not None
        await store.close()
