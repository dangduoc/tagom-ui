"""One-way copy of employees + embeddings from the SQLite store to Postgres.

Usage (from backend/):
    .venv\\Scripts\\python -m scripts.migrate_sqlite_to_pg

Reads SQLITE_PATH and DATABASE_URL from app.config (env-overridable).
Idempotent for employees (upsert by employee_code); embeddings are only
copied when the employee has none in Postgres yet, to avoid duplicates.
"""

import asyncio
import sqlite3

import numpy as np

from app import config
from app.stores.pg_store import PgVectorStore


async def main() -> None:
    src = sqlite3.connect(config.SQLITE_PATH)
    employees = src.execute(
        "SELECT id, employee_code, full_name, department FROM employees"
    ).fetchall()

    store = PgVectorStore(config.DATABASE_URL)
    await store.init()

    existing = {e.employee_code: e for e in await store.list_employees()}

    for old_id, code, name, department in employees:
        pg_id = await store.upsert_employee(code, name, department)
        if code in existing and existing[code].embedding_count > 0:
            print(f"{code} ({name}): already has embeddings in Postgres, skipped")
            continue
        rows = src.execute(
            "SELECT embedding FROM face_embeddings WHERE employee_id = ?", (old_id,)
        ).fetchall()
        for (blob,) in rows:
            await store.add_embedding(pg_id, np.frombuffer(blob, dtype=np.float32))
        print(f"{code} ({name}): copied {len(rows)} embeddings")

    await store.close()
    src.close()


if __name__ == "__main__":
    asyncio.run(main())
