import os
from pathlib import Path

from dotenv import load_dotenv

# Settings come from backend/.env (see .env.example); real environment
# variables take precedence over the file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# PostgreSQL + pgvector, the only storage backend. Default DSN matches the
# database in docker-compose.yml (port 5433 to dodge a local Postgres).
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://face:face@localhost:5433/facedb"
)

# insightface model pack; buffalo_s is small and CPU-friendly, buffalo_l is more accurate
MODEL_NAME = os.environ.get("FACE_MODEL", "buffalo_s")
DET_SIZE = int(os.environ.get("DET_SIZE", "640"))

# Cosine similarity threshold for a positive match. ArcFace genuine pairs usually
# score well above 0.4, impostors below 0.3 — tune against real department photos.
SIMILARITY_THRESHOLD = float(os.environ.get("SIMILARITY_THRESHOLD", "0.40"))

# Comma-separated list of allowed CORS origins, or "*"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

# Which clients the API will answer at all, as comma-separated IPs or CIDRs.
#
# A station backend is meant to be reachable only from the machine it runs on:
# the kiosk browser talks to localhost, and every route is unauthenticated --
# including listing depositors, reading their citizen ID and address, and
# deleting them. The deployment plan protects those by making the API
# unaddressable, which is sound but rests entirely on one bind address being
# right. This is the backstop: get the bind wrong, or publish the port by
# accident, and strangers are still refused.
#
# "*" disables the check. Do that only where something else is doing the
# gatekeeping -- docker-compose.yml widens it to the bridge network, because
# there the SPA's nginx is a legitimate non-local client.
TRUSTED_CLIENT_CIDRS = os.environ.get("TRUSTED_CLIENT_CIDRS", "127.0.0.0/8,::1")

EMBEDDING_DIM = 512

# Kilograms this station had already gathered before it started recording
# sessions here. Added to the recorded total on the summary screen so the
# community number reflects the station's real history.
#
# Defaults to 0 so the summary shows only what was actually weighed. Set this
# per station, and only to a figure the station can stand behind -- the total
# and the progress bar are the entire reward on that screen, so a number that
# is mostly invented is worse than a small honest one.
COMMUNITY_BASE_KG = float(os.environ.get("COMMUNITY_BASE_KG", "0"))

# What the community bar on the summary screen fills against.
COMMUNITY_GOAL_KG = float(os.environ.get("COMMUNITY_GOAL_KG", "15000"))

# Material categories the station can weigh. Kept in sync with
# frontend/src/app/station/core/models.ts.
CATEGORY_KEYS = frozenset(
    {"nhua", "giay", "kimloai", "thuytinh", "vai", "chuaphanloai"}
)

# Sanity bound for a single weighing — rejects obviously bad scale frames.
MAX_ITEM_WEIGHT_KG = float(os.environ.get("MAX_ITEM_WEIGHT_KG", "500"))
