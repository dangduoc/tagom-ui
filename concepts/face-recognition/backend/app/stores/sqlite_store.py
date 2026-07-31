"""Zero-config local store: SQLite for records, numpy brute-force cosine search.

At department scale (hundreds of embeddings) exhaustive search is sub-millisecond,
so this behaves identically to the pgvector store. Embeddings are stored as
float32 blobs and are already L2-normalized, so cosine similarity = dot product.
"""

import aiosqlite
import numpy as np

from .base import Match, Person, Profile, SessionItem, Store, WeighSession

_SCHEMA = """
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS face_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS weigh_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS weigh_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES weigh_sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg >= 0)
);
CREATE INDEX IF NOT EXISTS weigh_sessions_person
    ON weigh_sessions (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weigh_items_session ON weigh_items (session_id);
"""

# Depositor columns added after the first release. SQLite has no
# "ADD COLUMN IF NOT EXISTS", so existing files are migrated by inspecting
# the table (see _migrate).
_PROFILE_COLUMNS = ("phone", "age", "city", "ward", "address", "citizen_id")

_PERSON_COLUMNS = """
    p.id, p.code, p.full_name, p.department, p.created_at,
    p.phone, p.age, p.city, p.ward, p.address, p.citizen_id
"""


def _to_person(row, embedding_count: int = 0) -> Person:
    return Person(
        id=row[0],
        code=row[1],
        full_name=row[2],
        department=row[3],
        created_at=row[4],
        embedding_count=embedding_count,
        profile=Profile(
            phone=row[5],
            age=row[6],
            city=row[7],
            ward=row[8],
            address=row[9],
            citizen_id=row[10],
        ),
    )


class SQLiteStore(Store):
    def __init__(self, path: str) -> None:
        self.path = path
        self.db: aiosqlite.Connection | None = None

    async def init(self) -> None:
        self.db = await aiosqlite.connect(self.path)
        await self.db.execute("PRAGMA foreign_keys = ON")
        # Rename before creating, so an older database is migrated rather than
        # left beside an empty new table.
        await self._rename_legacy_tables()
        await self.db.executescript(_SCHEMA)
        await self._add_missing_profile_columns()
        await self.db.commit()

    async def _table_exists(self, name: str) -> bool:
        cur = await self.db.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
        )
        return await cur.fetchone() is not None

    async def _columns(self, table: str) -> set[str]:
        cur = await self.db.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in await cur.fetchall()}

    async def _rename_legacy_tables(self) -> None:
        """`employees`/`employee_code`/`employee_id` from when this was a
        department face-recognition experiment. Idempotent — runs on startup."""
        if await self._table_exists("employees") and not await self._table_exists("people"):
            await self.db.execute("ALTER TABLE employees RENAME TO people")

        if await self._table_exists("people") and "employee_code" in await self._columns("people"):
            await self.db.execute("ALTER TABLE people RENAME COLUMN employee_code TO code")

        for table in ("face_embeddings", "weigh_sessions"):
            if await self._table_exists(table) and "employee_id" in await self._columns(table):
                await self.db.execute(
                    f"ALTER TABLE {table} RENAME COLUMN employee_id TO person_id"
                )

    async def _add_missing_profile_columns(self) -> None:
        existing = await self._columns("people")
        for column in _PROFILE_COLUMNS:
            if column not in existing:
                await self.db.execute(f"ALTER TABLE people ADD COLUMN {column} TEXT")

    async def close(self) -> None:
        if self.db:
            await self.db.close()

    async def upsert_person(
        self,
        code: str,
        full_name: str,
        department: str | None,
        profile: Profile | None = None,
    ) -> int:
        p = profile or Profile()
        cur = await self.db.execute(
            """
            INSERT INTO people (code, full_name, department,
                                phone, age, city, ward, address, citizen_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (code) DO UPDATE
                SET full_name  = excluded.full_name,
                    department = COALESCE(excluded.department, people.department),
                    phone      = COALESCE(excluded.phone, people.phone),
                    age        = COALESCE(excluded.age, people.age),
                    city       = COALESCE(excluded.city, people.city),
                    ward       = COALESCE(excluded.ward, people.ward),
                    address    = COALESCE(excluded.address, people.address),
                    citizen_id = COALESCE(excluded.citizen_id, people.citizen_id)
            RETURNING id
            """,
            (
                code,
                full_name,
                department,
                p.phone,
                p.age,
                p.city,
                p.ward,
                p.address,
                p.citizen_id,
            ),
        )
        row = await cur.fetchone()
        await self.db.commit()
        return row[0]

    async def get_person(self, code: str) -> Person | None:
        cur = await self.db.execute(
            f"""
            SELECT {_PERSON_COLUMNS}, COUNT(f.id)
            FROM people p
            LEFT JOIN face_embeddings f ON f.person_id = p.id
            WHERE p.code = ?
            GROUP BY p.id
            """,
            (code,),
        )
        row = await cur.fetchone()
        return _to_person(row, row[11]) if row else None

    async def list_people(self) -> list[Person]:
        cur = await self.db.execute(
            f"""
            SELECT {_PERSON_COLUMNS}, COUNT(f.id)
            FROM people p
            LEFT JOIN face_embeddings f ON f.person_id = p.id
            GROUP BY p.id
            ORDER BY p.full_name
            """
        )
        return [_to_person(row, row[11]) for row in await cur.fetchall()]

    async def delete_person(self, code: str) -> bool:
        cur = await self.db.execute("DELETE FROM people WHERE code = ?", (code,))
        await self.db.commit()
        return cur.rowcount > 0

    async def add_session(self, code: str | None, items: list[SessionItem]) -> int:
        person_id = None
        if code:
            cur = await self.db.execute("SELECT id FROM people WHERE code = ?", (code,))
            row = await cur.fetchone()
            person_id = row[0] if row else None

        cur = await self.db.execute(
            "INSERT INTO weigh_sessions (person_id) VALUES (?) RETURNING id",
            (person_id,),
        )
        session_id = (await cur.fetchone())[0]
        await self.db.executemany(
            "INSERT INTO weigh_items (session_id, category, weight_kg) VALUES (?, ?, ?)",
            [(session_id, i.category, i.weight) for i in items],
        )
        await self.db.commit()
        return session_id

    async def sessions_for(self, code: str) -> list[WeighSession]:
        cur = await self.db.execute(
            """
            SELECT s.id, s.created_at, i.category, i.weight_kg
            FROM weigh_sessions s
            JOIN people p ON p.id = s.person_id
            LEFT JOIN weigh_items i ON i.session_id = s.id
            WHERE p.code = ?
            ORDER BY s.created_at DESC, s.id DESC, i.id
            """,
            (code,),
        )
        sessions: dict[int, WeighSession] = {}
        for session_id, created_at, category, weight in await cur.fetchall():
            session = sessions.get(session_id)
            if session is None:
                session = WeighSession(id=session_id, created_at=created_at, items=[])
                sessions[session_id] = session
            if category is not None:
                session.items.append(
                    SessionItem(category=category, weight=float(weight))
                )
        return list(sessions.values())

    async def community_total(self) -> float:
        cur = await self.db.execute(
            "SELECT COALESCE(SUM(weight_kg), 0) FROM weigh_items"
        )
        return float((await cur.fetchone())[0])

    async def add_embedding(self, person_id: int, embedding: np.ndarray) -> None:
        await self.db.execute(
            "INSERT INTO face_embeddings (person_id, embedding) VALUES (?, ?)",
            (person_id, embedding.astype(np.float32).tobytes()),
        )
        await self.db.commit()

    async def best_match(self, embedding: np.ndarray) -> Match | None:
        cur = await self.db.execute(
            """
            SELECT f.embedding, p.code, p.full_name, p.department
            FROM face_embeddings f
            JOIN people p ON p.id = f.person_id
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
            code=code,
            full_name=name,
            department=department,
            similarity=float(similarities[best]),
        )
