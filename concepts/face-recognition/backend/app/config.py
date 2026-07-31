import os
from pathlib import Path

from dotenv import load_dotenv

# Settings come from backend/.env (see .env.example); real environment
# variables take precedence over the file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# "sqlite" (zero-config local demo) or "postgres" (pgvector, production-like)
DB_BACKEND = os.environ.get("DB_BACKEND", "sqlite").lower()

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://face:face@localhost:5433/facedb"
)

SQLITE_PATH = os.environ.get(
    "SQLITE_PATH", str(Path(__file__).resolve().parent.parent / "local_store.db")
)

# insightface model pack; buffalo_s is small and CPU-friendly, buffalo_l is more accurate
MODEL_NAME = os.environ.get("FACE_MODEL", "buffalo_s")
DET_SIZE = int(os.environ.get("DET_SIZE", "640"))

# Cosine similarity threshold for a positive match. ArcFace genuine pairs usually
# score well above 0.4, impostors below 0.3 — tune against real department photos.
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.40"))

# Comma-separated list of allowed CORS origins, or "*"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

EMBEDDING_DIM = 512

# Kilograms this station had already gathered before it started recording
# sessions here. Added to the recorded total on the summary screen so the
# community number reflects the station's real history.
COMMUNITY_BASE_KG = float(os.environ.get("COMMUNITY_BASE_KG", "12480.5"))

# What the community bar on the summary screen fills against.
COMMUNITY_GOAL_KG = float(os.environ.get("COMMUNITY_GOAL_KG", "15000"))

# Material categories the station can weigh. Kept in sync with
# frontend/src/app/station/core/models.ts.
CATEGORY_KEYS = frozenset(
    {"nhua", "giay", "kimloai", "thuytinh", "vai", "chuaphanloai"}
)

# Sanity bound for a single weighing — rejects obviously bad scale frames.
MAX_ITEM_WEIGHT_KG = float(os.environ.get("MAX_ITEM_WEIGHT_KG", "500"))
