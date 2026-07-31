"""One-way copy of people, embeddings and weigh sessions from SQLite to Postgres.

Usage (from backend/):
    .venv\\Scripts\\python -m scripts.migrate_sqlite_to_pg

Reads SQLITE_PATH and DATABASE_URL from app.config (env-overridable).
Idempotent for people (upsert by code). Embeddings and sessions are only
copied when the person has none in Postgres yet, to avoid duplicates.

The source database is opened through SQLiteStore first, so an older file
still using `employees`/`employee_code`/`employee_id` is renamed in place
before anything is read.
"""

import asyncio
import sqlite3

import numpy as np

from app import config
from app.stores.base import Profile, SessionItem
from app.stores.pg_store import PgVectorStore
from app.stores.sqlite_store import SQLiteStore


async def main() -> None:
    # Applies the rename/column migrations, so the reads below can assume
    # the current column names.
    source_store = SQLiteStore(config.SQLITE_PATH)
    await source_store.init()
    await source_store.close()

    src = sqlite3.connect(config.SQLITE_PATH)
    people = src.execute(
        """
        SELECT id, code, full_name, department,
               phone, age, city, ward, address, citizen_id
        FROM people
        """
    ).fetchall()

    store = PgVectorStore(config.DATABASE_URL)
    await store.init()
    existing = {p.code: p for p in await store.list_people()}

    for row in people:
        old_id, code, name, department = row[0], row[1], row[2], row[3]
        phone, age, city, ward, address, citizen_id = row[4:]

        pg_id = await store.upsert_person(
            code,
            name,
            department,
            Profile(
                phone=phone,
                age=age,
                city=city,
                ward=ward,
                address=address,
                citizen_id=citizen_id,
            ),
        )

        if code in existing and existing[code].embedding_count > 0:
            print(f"{code} ({name}): already has embeddings in Postgres, skipped")
        else:
            embeddings = src.execute(
                "SELECT embedding FROM face_embeddings WHERE person_id = ?", (old_id,)
            ).fetchall()
            for (blob,) in embeddings:
                await store.add_embedding(pg_id, np.frombuffer(blob, dtype=np.float32))
            print(f"{code} ({name}): copied {len(embeddings)} embeddings")

        if await store.sessions_for(code):
            print(f"{code} ({name}): already has sessions in Postgres, skipped")
            continue
        copied = await _copy_sessions(src, store, old_id, code)
        print(f"{code} ({name}): copied {copied} weigh sessions")

    anon = await _copy_sessions(src, store, None, None)
    if anon:
        print(f"copied {anon} anonymous weigh sessions")

    await store.close()
    src.close()


async def _copy_sessions(
    src: sqlite3.Connection, store: PgVectorStore, old_id: int | None, code: str | None
) -> int:
    """Anonymous sessions (old_id None) still count towards the station total."""
    where = "person_id = ?" if old_id is not None else "person_id IS NULL"
    params = (old_id,) if old_id is not None else ()
    sessions = src.execute(
        f"SELECT id FROM weigh_sessions WHERE {where}", params
    ).fetchall()

    for (session_id,) in sessions:
        items = src.execute(
            "SELECT category, weight_kg FROM weigh_items WHERE session_id = ?",
            (session_id,),
        ).fetchall()
        if items:
            await store.add_session(
                code, [SessionItem(category=c, weight=float(w)) for c, w in items]
            )
    return len(sessions)


if __name__ == "__main__":
    asyncio.run(main())
