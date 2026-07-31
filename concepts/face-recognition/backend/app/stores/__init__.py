from .. import config
from .base import Match, Person, Profile, SessionItem, Store, WeighSession
from .pg_store import PgVectorStore


def create_store() -> Store:
    """PostgreSQL + pgvector is the only backend. `Store` stays an interface so
    the API layer never reaches for pgvector-specific behaviour."""
    return PgVectorStore(config.DATABASE_URL)


__all__ = [
    "Match",
    "PgVectorStore",
    "Person",
    "Profile",
    "SessionItem",
    "Store",
    "WeighSession",
    "create_store",
]
