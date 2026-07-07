"""Production-like store: PostgreSQL + pgvector (HNSW, cosine distance).

Requires the pgvector extension (see docker-compose.yml / backend/db/schema.sql).
"""

from pathlib import Path

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

from .base import Employee, Match, Store

_SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "db" / "schema.sql"


class PgVectorStore(Store):
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.pool: asyncpg.Pool | None = None

    async def init(self) -> None:
        async def setup_connection(conn: asyncpg.Connection) -> None:
            await register_vector(conn)

        # Apply schema (idempotent) before the pool registers the vector codec,
        # since the codec requires the extension to already exist.
        conn = await asyncpg.connect(self.dsn)
        try:
            await conn.execute(_SCHEMA_PATH.read_text())
        finally:
            await conn.close()

        self.pool = await asyncpg.create_pool(
            self.dsn, init=setup_connection, min_size=1, max_size=5
        )

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def upsert_employee(
        self, employee_code: str, full_name: str, department: str | None
    ) -> int:
        return await self.pool.fetchval(
            """
            INSERT INTO employees (employee_code, full_name, department)
            VALUES ($1, $2, $3)
            ON CONFLICT (employee_code) DO UPDATE
                SET full_name = EXCLUDED.full_name,
                    department = EXCLUDED.department
            RETURNING id
            """,
            employee_code,
            full_name,
            department,
        )

    async def add_embedding(self, employee_id: int, embedding: np.ndarray) -> None:
        await self.pool.execute(
            "INSERT INTO face_embeddings (employee_id, embedding) VALUES ($1, $2)",
            employee_id,
            embedding.astype(np.float32),
        )

    async def best_match(self, embedding: np.ndarray) -> Match | None:
        row = await self.pool.fetchrow(
            """
            SELECT e.employee_code, e.full_name, e.department,
                   1 - (f.embedding <=> $1) AS similarity
            FROM face_embeddings f
            JOIN employees e ON e.id = f.employee_id
            ORDER BY f.embedding <=> $1
            LIMIT 1
            """,
            embedding.astype(np.float32),
        )
        if row is None:
            return None
        return Match(
            employee_code=row["employee_code"],
            full_name=row["full_name"],
            department=row["department"],
            similarity=float(row["similarity"]),
        )

    async def list_employees(self) -> list[Employee]:
        rows = await self.pool.fetch(
            """
            SELECT e.id, e.employee_code, e.full_name, e.department,
                   COUNT(f.id) AS embedding_count, e.created_at
            FROM employees e
            LEFT JOIN face_embeddings f ON f.employee_id = e.id
            GROUP BY e.id
            ORDER BY e.full_name
            """
        )
        return [
            Employee(
                id=r["id"],
                employee_code=r["employee_code"],
                full_name=r["full_name"],
                department=r["department"],
                embedding_count=r["embedding_count"],
                created_at=str(r["created_at"]),
            )
            for r in rows
        ]

    async def delete_employee(self, employee_code: str) -> bool:
        result = await self.pool.execute(
            "DELETE FROM employees WHERE employee_code = $1", employee_code
        )
        return result != "DELETE 0"
