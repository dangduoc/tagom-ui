"""Production-like store: PostgreSQL + pgvector (HNSW, cosine distance).

Requires the pgvector extension (see docker-compose.yml / backend/db/schema.sql).
"""

from pathlib import Path

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

from .base import (
    Employee,
    Match,
    Person,
    Profile,
    SessionItem,
    Store,
    WeighSession,
)

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
        self,
        employee_code: str,
        full_name: str,
        department: str | None,
        profile: Profile | None = None,
    ) -> int:
        p = profile or Profile()
        return await self.pool.fetchval(
            """
            INSERT INTO employees (employee_code, full_name, department,
                                   phone, age, city, ward, address, citizen_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (employee_code) DO UPDATE
                SET full_name  = EXCLUDED.full_name,
                    department = COALESCE(EXCLUDED.department, employees.department),
                    phone      = COALESCE(EXCLUDED.phone, employees.phone),
                    age        = COALESCE(EXCLUDED.age, employees.age),
                    city       = COALESCE(EXCLUDED.city, employees.city),
                    ward       = COALESCE(EXCLUDED.ward, employees.ward),
                    address    = COALESCE(EXCLUDED.address, employees.address),
                    citizen_id = COALESCE(EXCLUDED.citizen_id, employees.citizen_id)
            RETURNING id
            """,
            employee_code,
            full_name,
            department,
            p.phone,
            p.age,
            p.city,
            p.ward,
            p.address,
            p.citizen_id,
        )

    async def get_person(self, employee_code: str) -> Person | None:
        row = await self.pool.fetchrow(
            """
            SELECT e.id, e.employee_code, e.full_name, e.department, e.created_at,
                   e.phone, e.age, e.city, e.ward, e.address, e.citizen_id,
                   COUNT(f.id) AS embedding_count
            FROM employees e
            LEFT JOIN face_embeddings f ON f.employee_id = e.id
            WHERE e.employee_code = $1
            GROUP BY e.id
            """,
            employee_code,
        )
        if row is None:
            return None
        return Person(
            id=row["id"],
            employee_code=row["employee_code"],
            full_name=row["full_name"],
            department=row["department"],
            profile=Profile(
                phone=row["phone"],
                age=row["age"],
                city=row["city"],
                ward=row["ward"],
                address=row["address"],
                citizen_id=row["citizen_id"],
            ),
            embedding_count=row["embedding_count"],
            created_at=str(row["created_at"]),
        )

    async def add_session(
        self, employee_code: str | None, items: list[SessionItem]
    ) -> int:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                employee_id = None
                if employee_code:
                    employee_id = await conn.fetchval(
                        "SELECT id FROM employees WHERE employee_code = $1",
                        employee_code,
                    )
                session_id = await conn.fetchval(
                    "INSERT INTO weigh_sessions (employee_id) VALUES ($1) RETURNING id",
                    employee_id,
                )
                await conn.executemany(
                    """
                    INSERT INTO weigh_items (session_id, category, weight_kg)
                    VALUES ($1, $2, $3)
                    """,
                    [(session_id, i.category, i.weight) for i in items],
                )
                return session_id

    async def sessions_for(self, employee_code: str) -> list[WeighSession]:
        rows = await self.pool.fetch(
            """
            SELECT s.id, s.created_at, i.category, i.weight_kg
            FROM weigh_sessions s
            JOIN employees e ON e.id = s.employee_id
            LEFT JOIN weigh_items i ON i.session_id = s.id
            WHERE e.employee_code = $1
            ORDER BY s.created_at DESC, s.id DESC, i.id
            """,
            employee_code,
        )
        sessions: dict[int, WeighSession] = {}
        for r in rows:
            session = sessions.get(r["id"])
            if session is None:
                session = WeighSession(
                    id=r["id"], created_at=str(r["created_at"]), items=[]
                )
                sessions[r["id"]] = session
            if r["category"] is not None:
                session.items.append(
                    SessionItem(category=r["category"], weight=float(r["weight_kg"]))
                )
        return list(sessions.values())

    async def community_total(self) -> float:
        total = await self.pool.fetchval(
            "SELECT COALESCE(SUM(weight_kg), 0) FROM weigh_items"
        )
        return float(total)

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
