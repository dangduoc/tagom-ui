"""Shared bits for the backend tests."""

import os

DEFAULT_DSN = "postgresql://face:face@localhost:5433/facedb"
TEST_DB_NAME = "facedb_test"
MIGRATION_DB_NAME = "facedb_migration_test"


def dsn_for(database: str) -> str:
    """Same server as DATABASE_URL, different database — so the tests never
    touch the development one."""
    base = os.environ.get("DATABASE_URL", DEFAULT_DSN)
    return base.rsplit("/", 1)[0] + "/" + database
