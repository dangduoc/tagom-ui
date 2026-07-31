"""Production-like store: PostgreSQL + pgvector (HNSW, cosine distance).

Requires the pgvector extension (see docker-compose.yml / backend/db/schema.sql).
"""

from pathlib import Path

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector

from .base import Match, Person, Profile, SessionItem, Store, WeighSession

_SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "db" / "schema.sql"

_PERSON_COLUMNS = """
    p.id, p.code, p.full_name, p.department, p.created_at,
    p.phone, p.age, p.city, p.ward, p.address, p.citizen_id
"""


def _to_person(row, embedding_count: int = 0) -> Person:
    return Person(
        id=row["id"],
        code=row["code"],
        full_name=row["full_name"],
        department=row["department"],
        created_at=str(row["created_at"]),
        embedding_count=embedding_count,
        profile=Profile(
            phone=row["phone"],
            age=row["age"],
            city=row["city"],
            ward=row["ward"],
            address=row["address"],
            citizen_id=row["citizen_id"],
        ),
    )


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

    async def upsert_person(
        self,
        code: str,
        full_name: str,
        department: str | None,
        profile: Profile | None = None,
    ) -> int:
        p = profile or Profile()
        return await self.pool.fetchval(
            """
            INSERT INTO people (code, full_name, department,
                                phone, age, city, ward, address, citizen_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (code) DO UPDATE
                SET full_name  = EXCLUDED.full_name,
                    department = COALESCE(EXCLUDED.department, people.department),
                    phone      = COALESCE(EXCLUDED.phone, people.phone),
                    age        = COALESCE(EXCLUDED.age, people.age),
                    city       = COALESCE(EXCLUDED.city, people.city),
                    ward       = COALESCE(EXCLUDED.ward, people.ward),
                    address    = COALESCE(EXCLUDED.address, people.address),
                    citizen_id = COALESCE(EXCLUDED.citizen_id, people.citizen_id)
            RETURNING id
            """,
            code,
            full_name,
            department,
            p.phone,
            p.age,
            p.city,
            p.ward,
            p.address,
            p.citizen_id,
        )

    async def get_person(self, code: str) -> Person | None:
        row = await self.pool.fetchrow(
            f"""
            SELECT {_PERSON_COLUMNS}, COUNT(f.id) AS embedding_count
            FROM people p
            LEFT JOIN face_embeddings f ON f.person_id = p.id
            WHERE p.code = $1
            GROUP BY p.id
            """,
            code,
        )
        return _to_person(row, row["embedding_count"]) if row else None

    async def list_people(self) -> list[Person]:
        rows = await self.pool.fetch(
            f"""
            SELECT {_PERSON_COLUMNS}, COUNT(f.id) AS embedding_count
            FROM people p
            LEFT JOIN face_embeddings f ON f.person_id = p.id
            GROUP BY p.id
            ORDER BY p.full_name
            """
        )
        return [_to_person(r, r["embedding_count"]) for r in rows]

    async def delete_person(self, code: str) -> bool:
        result = await self.pool.execute("DELETE FROM people WHERE code = $1", code)
        return result != "DELETE 0"

    async def add_session(self, code: str | None, items: list[SessionItem]) -> int:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                person_id = None
                if code:
                    person_id = await conn.fetchval(
                        "SELECT id FROM people WHERE code = $1", code
                    )
                session_id = await conn.fetchval(
                    "INSERT INTO weigh_sessions (person_id) VALUES ($1) RETURNING id",
                    person_id,
                )
                await conn.executemany(
                    """
                    INSERT INTO weigh_items (session_id, category, weight_kg)
                    VALUES ($1, $2, $3)
                    """,
                    [(session_id, i.category, i.weight) for i in items],
                )
                return session_id

    async def sessions_for(self, code: str) -> list[WeighSession]:
        rows = await self.pool.fetch(
            """
            SELECT s.id, s.created_at, i.category, i.weight_kg
            FROM weigh_sessions s
            JOIN people p ON p.id = s.person_id
            LEFT JOIN weigh_items i ON i.session_id = s.id
            WHERE p.code = $1
            ORDER BY s.created_at DESC, s.id DESC, i.id
            """,
            code,
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

    async def add_embedding(self, person_id: int, embedding: np.ndarray) -> None:
        await self.pool.execute(
            "INSERT INTO face_embeddings (person_id, embedding) VALUES ($1, $2)",
            person_id,
            embedding.astype(np.float32),
        )

    async def best_match(self, embedding: np.ndarray) -> Match | None:
        row = await self.pool.fetchrow(
            """
            SELECT p.code, p.full_name, p.department,
                   1 - (f.embedding <=> $1) AS similarity
            FROM face_embeddings f
            JOIN people p ON p.id = f.person_id
            ORDER BY f.embedding <=> $1
            LIMIT 1
            """,
            embedding.astype(np.float32),
        )
        if row is None:
            return None
        return Match(
            code=row["code"],
            full_name=row["full_name"],
            department=row["department"],
            similarity=float(row["similarity"]),
        )
