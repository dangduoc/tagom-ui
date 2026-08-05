"""Store-level tests for clearing a person's face embeddings — the operation
behind re-taking face photos from the profile screen. Uses the real test
database (no insightface needed; embeddings are just vectors here)."""

import numpy as np

from app.stores import SessionItem
from app.stores.pg_store import PgVectorStore


async def _fresh_store(dsn: str) -> PgVectorStore:
    store = PgVectorStore(dsn)
    await store.init()
    async with store.pool.acquire() as conn:
        await conn.execute(
            "TRUNCATE weigh_items, weigh_sessions, face_embeddings, people "
            "RESTART IDENTITY CASCADE"
        )
    return store


def _unit_vector(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(512).astype(np.float32)
    return v / np.linalg.norm(v)


async def test_clear_embeddings_keeps_person_and_history(postgres_dsn):
    store = await _fresh_store(postgres_dsn)
    try:
        code = "0900000001"
        person_id = await store.upsert_person(code, "Test Person", None)
        await store.add_embedding(person_id, _unit_vector(1))
        await store.add_embedding(person_id, _unit_vector(2))
        await store.add_session(code, [SessionItem(category="nhua", weight=1.5)])

        # A face matches before clearing.
        assert await store.best_match(_unit_vector(1)) is not None

        removed = await store.clear_embeddings(person_id)
        assert removed == 2

        # Faces are gone...
        assert await store.best_match(_unit_vector(1)) is None
        person = await store.get_person(code)
        assert person is not None
        assert person.embedding_count == 0

        # ...but the person and their weigh history survive.
        sessions = await store.sessions_for(code)
        assert len(sessions) == 1
        assert sessions[0].total == 1.5
    finally:
        await store.close()


async def test_clear_embeddings_on_a_faceless_person_is_a_noop(postgres_dsn):
    store = await _fresh_store(postgres_dsn)
    try:
        person_id = await store.upsert_person("0900000002", "No Face", None)
        assert await store.clear_embeddings(person_id) == 0
    finally:
        await store.close()
