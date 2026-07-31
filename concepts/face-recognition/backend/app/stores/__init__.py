from .. import config
from .base import Match, Person, Profile, SessionItem, Store, WeighSession


def create_store() -> Store:
    if config.DB_BACKEND == "postgres":
        from .pg_store import PgVectorStore

        return PgVectorStore(config.DATABASE_URL)
    if config.DB_BACKEND == "sqlite":
        from .sqlite_store import SQLiteStore

        return SQLiteStore(config.SQLITE_PATH)
    raise ValueError(f"unknown DB_BACKEND: {config.DB_BACKEND!r}")


__all__ = [
    "Match",
    "Person",
    "Profile",
    "SessionItem",
    "Store",
    "WeighSession",
    "create_store",
]
