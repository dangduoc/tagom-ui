"""Zero-config local store: SQLite for records, numpy brute-force cosine search.

At department scale (hundreds of embeddings) exhaustive search is sub-millisecond,
so this behaves identically to the pgvector store. Embeddings are stored as
float32 blobs and are already L2-normalized, so cosine similarity = dot product.
"""

import aiosqlite
import numpy as np

from .base import (
    Employee,
    Match,
    Person,
    Profile,
    SessionItem,
    Store,
    WeighSession,
)

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
CREATE TABLE IF NOT EXISTS weigh_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS weigh_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES weigh_sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    weight_kg REAL NOT NULL CHECK (weight_kg >= 0)
);
CREATE INDEX IF NOT EXISTS weigh_sessions_employee
    ON weigh_sessions (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS weigh_items_session ON weigh_items (session_id);
"""

# Depositor columns added after the first release. SQLite has no
# "ADD COLUMN IF NOT EXISTS", so existing local_store.db files are migrated
# by inspecting the table (see _migrate).
_PROFILE_COLUMNS = ("phone", "age", "city", "ward", "address", "citizen_id")


class SQLiteStore(Store):
    def __init__(self, path: str) -> None:
        self.path = path
        self.db: aiosqlite.Connection | None = None

    async def init(self) -> None:
        self.db = await aiosqlite.connect(self.path)
        await self.db.execute("PRAGMA foreign_keys = ON")
        await self.db.executescript(_SCHEMA)
        await self._migrate()
        await self.db.commit()

    async def _migrate(self) -> None:
        cur = await self.db.execute("PRAGMA table_info(employees)")
        existing = {row[1] for row in await cur.fetchall()}
        for column in _PROFILE_COLUMNS:
            if column not in existing:
                await self.db.execute(
                    f"ALTER TABLE employees ADD COLUMN {column} TEXT"
                )

    async def close(self) -> None:
        if self.db:
            await self.db.close()

    async def upsert_employee(
        self,
        employee_code: str,
        full_name: str,
        department: str | None,
        profile: Profile | None = None,
    ) -> int:
        p = profile or Profile()
        cur = await self.db.execute(
            """
            INSERT INTO employees (employee_code, full_name, department,
                                   phone, age, city, ward, address, citizen_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (employee_code) DO UPDATE
                SET full_name  = excluded.full_name,
                    department = COALESCE(excluded.department, employees.department),
                    phone      = COALESCE(excluded.phone, employees.phone),
                    age        = COALESCE(excluded.age, employees.age),
                    city       = COALESCE(excluded.city, employees.city),
                    ward       = COALESCE(excluded.ward, employees.ward),
                    address    = COALESCE(excluded.address, employees.address),
                    citizen_id = COALESCE(excluded.citizen_id, employees.citizen_id)
            RETURNING id
            """,
            (
                employee_code,
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

    async def get_person(self, employee_code: str) -> Person | None:
        cur = await self.db.execute(
            """
            SELECT e.id, e.employee_code, e.full_name, e.department, e.created_at,
                   e.phone, e.age, e.city, e.ward, e.address, e.citizen_id,
                   COUNT(f.id)
            FROM employees e
            LEFT JOIN face_embeddings f ON f.employee_id = e.id
            WHERE e.employee_code = ?
            GROUP BY e.id
            """,
            (employee_code,),
        )
        row = await cur.fetchone()
        if row is None:
            return None
        return Person(
            id=row[0],
            employee_code=row[1],
            full_name=row[2],
            department=row[3],
            created_at=row[4],
            profile=Profile(
                phone=row[5],
                age=row[6],
                city=row[7],
                ward=row[8],
                address=row[9],
                citizen_id=row[10],
            ),
            embedding_count=row[11],
        )

    async def add_session(
        self, employee_code: str | None, items: list[SessionItem]
    ) -> int:
        employee_id = None
        if employee_code:
            cur = await self.db.execute(
                "SELECT id FROM employees WHERE employee_code = ?", (employee_code,)
            )
            row = await cur.fetchone()
            employee_id = row[0] if row else None

        cur = await self.db.execute(
            "INSERT INTO weigh_sessions (employee_id) VALUES (?) RETURNING id",
            (employee_id,),
        )
        session_id = (await cur.fetchone())[0]
        await self.db.executemany(
            "INSERT INTO weigh_items (session_id, category, weight_kg) VALUES (?, ?, ?)",
            [(session_id, i.category, i.weight) for i in items],
        )
        await self.db.commit()
        return session_id

    async def sessions_for(self, employee_code: str) -> list[WeighSession]:
        cur = await self.db.execute(
            """
            SELECT s.id, s.created_at, i.category, i.weight_kg
            FROM weigh_sessions s
            JOIN employees e ON e.id = s.employee_id
            LEFT JOIN weigh_items i ON i.session_id = s.id
            WHERE e.employee_code = ?
            ORDER BY s.created_at DESC, s.id DESC, i.id
            """,
            (employee_code,),
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
