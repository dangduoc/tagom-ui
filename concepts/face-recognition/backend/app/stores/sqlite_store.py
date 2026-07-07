"""Zero-config local store: SQLite for records, numpy brute-force cosine search.

At department scale (hundreds of embeddings) exhaustive search is sub-millisecond,
so this behaves identically to the pgvector store. Embeddings are stored as
float32 blobs and are already L2-normalized, so cosine similarity = dot product.
"""

import aiosqlite
import numpy as np

from .base import Employee, Match, Store

_SCHEMA = """
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS face_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


class SQLiteStore(Store):
    def __init__(self, path: str) -> None:
        self.path = path
        self.db: aiosqlite.Connection | None = None

    async def init(self) -> None:
        self.db = await aiosqlite.connect(self.path)
        await self.db.execute("PRAGMA foreign_keys = ON")
        await self.db.executescript(_SCHEMA)
        await self.db.commit()

    async def close(self) -> None:
        if self.db:
            await self.db.close()

    async def upsert_employee(
        self, employee_code: str, full_name: str, department: str | None
    ) -> int:
        cur = await self.db.execute(
            """
            INSERT INTO employees (employee_code, full_name, department)
            VALUES (?, ?, ?)
            ON CONFLICT (employee_code) DO UPDATE
                SET full_name = excluded.full_name,
                    department = excluded.department
            RETURNING id
            """,
            (employee_code, full_name, department),
        )
        row = await cur.fetchone()
        await self.db.commit()
        return row[0]

    async def add_embedding(self, employee_id: int, embedding: np.ndarray) -> None:
        await self.db.execute(
            "INSERT INTO face_embeddings (employee_id, embedding) VALUES (?, ?)",
            (employee_id, embedding.astype(np.float32).tobytes()),
        )
        await self.db.commit()

    async def best_match(self, embedding: np.ndarray) -> Match | None:
        cur = await self.db.execute(
            """
            SELECT f.embedding, e.employee_code, e.full_name, e.department
            FROM face_embeddings f
            JOIN employees e ON e.id = f.employee_id
            """
        )
        rows = await cur.fetchall()
        if not rows:
            return None

        matrix = np.stack([np.frombuffer(r[0], dtype=np.float32) for r in rows])
        similarities = matrix @ embedding.astype(np.float32)
        best = int(np.argmax(similarities))
        _, code, name, department = rows[best]
        return Match(
            employee_code=code,
            full_name=name,
            department=department,
            similarity=float(similarities[best]),
        )

    async def list_employees(self) -> list[Employee]:
        cur = await self.db.execute(
            """
            SELECT e.id, e.employee_code, e.full_name, e.department,
                   COUNT(f.id), e.created_at
            FROM employees e
            LEFT JOIN face_embeddings f ON f.employee_id = e.id
            GROUP BY e.id
            ORDER BY e.full_name
            """
        )
        rows = await cur.fetchall()
        return [
            Employee(
                id=r[0],
                employee_code=r[1],
                full_name=r[2],
                department=r[3],
                embedding_count=r[4],
                created_at=r[5],
            )
            for r in rows
        ]

    async def delete_employee(self, employee_code: str) -> bool:
        cur = await self.db.execute(
            "DELETE FROM employees WHERE employee_code = ?", (employee_code,)
        )
        await self.db.commit()
        return cur.rowcount > 0
