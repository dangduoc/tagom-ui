import ipaddress
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from . import config
from .face import BadImageError, FaceService, MultipleFacesError, NoFaceError
from .stores import Person, Profile, SessionItem, WeighSession, create_store

log = logging.getLogger("uvicorn.error")

face_service: FaceService | None = None
store = create_store()


def _parse_trusted(spec: str):
    """Networks whose clients may use the API. None means everyone."""
    if spec.strip() == "*":
        return None
    return [
        ipaddress.ip_network(part.strip(), strict=False)
        for part in spec.split(",")
        if part.strip()
    ]


TRUSTED_NETWORKS = _parse_trusted(config.TRUSTED_CLIENT_CIDRS)


def _is_trusted(host: str | None) -> bool:
    if TRUSTED_NETWORKS is None:
        return True
    if host is None:
        return False
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    # A v4 client on a dual-stack socket arrives as ::ffff:127.0.0.1, which is
    # not in 127.0.0.0/8 unless it is unwrapped first.
    if addr.version == 6 and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped
    return any(addr in net for net in TRUSTED_NETWORKS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global face_service
    if TRUSTED_NETWORKS is None:
        log.warning(
            "TRUSTED_CLIENT_CIDRS=* - this API will answer any client that can "
            "reach it, and no route requires authentication."
        )
    else:
        log.info(
            "Answering clients in %s; all others get 403.",
            config.TRUSTED_CLIENT_CIDRS,
        )
    await store.init()
    # Model load downloads ~30MB to ~/.insightface on first run
    face_service = await run_in_threadpool(FaceService)
    yield
    await store.close()


app = FastAPI(title="Tagom Recycling Station", lifespan=lifespan)


# Registered before CORS so CORS ends up the outer layer (Starlette runs the
# last-added middleware first) and a rejection still carries the headers a
# browser needs to surface the 403 rather than an opaque network error.
#
# /api/health is guarded too: a stranger has no business fingerprinting the
# model and threshold either. Container and Tailscale health checks come from
# inside the trusted range, so nothing legitimate loses its probe.
@app.middleware("http")
async def restrict_clients(request: Request, call_next):
    client = request.client.host if request.client else None
    if not _is_trusted(client):
        log.warning("Refused %s %s from %s", request.method, request.url.path, client)
        return JSONResponse(
            status_code=403,
            content={"detail": "This API answers local clients only."},
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["*"]
        if config.ALLOWED_ORIGINS == "*"
        else [o.strip() for o in config.ALLOWED_ORIGINS.split(",")]
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "db_backend": "postgres",
        "model": config.MODEL_NAME,
        "similarity_threshold": config.SIMILARITY_THRESHOLD,
    }


@app.post("/api/recognize")
async def recognize(file: UploadFile = File(...)):
    data = await file.read()
    try:
        extracted = await run_in_threadpool(face_service.extract, data)
    except BadImageError:
        raise HTTPException(status_code=400, detail="could not decode image")
    except NoFaceError:
        return {"match": None, "reason": "no_face"}

    match = await store.best_match(extracted.embedding)
    if match is None:
        return {"match": None, "reason": "no_enrolled_faces"}

    matched = match.similarity >= config.SIMILARITY_THRESHOLD
    return {
        "match": (
            {
                "code": match.code,
                "full_name": match.full_name,
                "department": match.department,
                "similarity": round(match.similarity, 4),
            }
            if matched
            else None
        ),
        # Best candidate below threshold — useful for tuning SIMILARITY_THRESHOLD
        "closest": (
            None
            if matched
            else {
                "code": match.code,
                "similarity": round(match.similarity, 4),
            }
        ),
        "reason": None if matched else "below_threshold",
        "det_score": round(extracted.det_score, 3),
    }


@app.post("/api/enroll")
async def enroll(
    code: str = Form(...),
    full_name: str = Form(...),
    department: str | None = Form(None),
    # Depositor details from the station's register screen. All optional, and
    # omitted fields never overwrite what's already stored.
    phone: str | None = Form(None),
    age: str | None = Form(None),
    city: str | None = Form(None),
    ward: str | None = Form(None),
    address: str | None = Form(None),
    citizen_id: str | None = Form(None),
    files: list[UploadFile] = File(...),
):
    embeddings = []
    results = []
    for f in files:
        data = await f.read()
        try:
            extracted = await run_in_threadpool(
                face_service.extract, data, require_single=True
            )
        except BadImageError:
            results.append({"file": f.filename, "ok": False, "error": "bad_image"})
            continue
        except NoFaceError:
            results.append({"file": f.filename, "ok": False, "error": "no_face"})
            continue
        except MultipleFacesError:
            results.append(
                {"file": f.filename, "ok": False, "error": "multiple_faces"}
            )
            continue
        embeddings.append(extracted.embedding)
        results.append(
            {"file": f.filename, "ok": True, "det_score": round(extracted.det_score, 3)}
        )

    if not embeddings:
        raise HTTPException(
            status_code=422,
            detail={"message": "no usable face photo", "files": results},
        )

    person_id = await store.upsert_person(
        code,
        full_name,
        department,
        Profile(
            phone=phone,
            age=age,
            city=city,
            ward=ward,
            address=address,
            citizen_id=citizen_id,
        ),
    )
    for emb in embeddings:
        await store.add_embedding(person_id, emb)

    return {
        "person_id": person_id,
        "code": code,
        "enrolled_photos": len(embeddings),
        "files": results,
    }


# ── People: depositor profiles, weigh sessions, station totals ──


class ProfileIn(BaseModel):
    """Only the fields present in the request are written — omit a field to
    leave it alone, send "" to clear it."""

    full_name: str | None = None
    phone: str | None = None
    age: str | None = None
    city: str | None = None
    ward: str | None = None
    address: str | None = None
    citizen_id: str | None = None


class PersonIn(ProfileIn):
    code: str = Field(min_length=1, max_length=32)
    full_name: str = Field(min_length=1, max_length=200)


class SessionItemIn(BaseModel):
    category: str
    weight: float

    @field_validator("category")
    @classmethod
    def known_category(cls, v: str) -> str:
        if v not in config.CATEGORY_KEYS:
            raise ValueError(f"unknown category: {v!r}")
        return v

    @field_validator("weight")
    @classmethod
    def sane_weight(cls, v: float) -> float:
        if not 0 <= v <= config.MAX_ITEM_WEIGHT_KG:
            raise ValueError(f"weight out of range: {v}")
        return round(v, 2)


class SessionIn(BaseModel):
    """`code` is None for an anonymous visit — still counted, just not attributed."""

    code: str | None = None
    items: list[SessionItemIn] = Field(min_length=1)


def _person_json(person: Person) -> dict:
    return {
        "code": person.code,
        "full_name": person.full_name,
        "phone": person.profile.phone,
        "age": person.profile.age,
        "city": person.profile.city,
        "ward": person.profile.ward,
        "address": person.profile.address,
        "citizen_id": person.profile.citizen_id,
        "member_since": person.created_at,
        "has_face_data": person.embedding_count > 0,
    }


def _session_json(session: WeighSession) -> dict:
    return {
        "id": session.id,
        "date": session.created_at,
        "total": session.total,
        "items": [{"category": i.category, "weight": i.weight} for i in session.items],
    }


@app.get("/api/people")
async def list_people():
    """Roster for the /debug enrollment page."""
    return [
        {
            **_person_json(p),
            "id": p.id,
            "department": p.department,
            "embedding_count": p.embedding_count,
        }
        for p in await store.list_people()
    ]


@app.delete("/api/people/{code}")
async def delete_person(code: str):
    if not await store.delete_person(code):
        raise HTTPException(status_code=404, detail="person not found")
    return {"deleted": code}


@app.get("/api/people/{code}")
async def get_person(code: str):
    person = await store.get_person(code)
    if person is None:
        raise HTTPException(status_code=404, detail="person not found")
    sessions = await store.sessions_for(code)
    return {
        "person": _person_json(person),
        "sessions": [_session_json(s) for s in sessions],
        "personal_total": round(sum(s.total for s in sessions), 2),
        "session_count": len(sessions),
    }


@app.post("/api/people")
async def create_person(body: PersonIn):
    """Register without face photos. With photos, /api/enroll does both."""
    await store.upsert_person(
        body.code,
        body.full_name,
        None,
        Profile(
            phone=body.phone,
            age=body.age,
            city=body.city,
            ward=body.ward,
            address=body.address,
            citizen_id=body.citizen_id,
        ),
    )
    person = await store.get_person(body.code)
    return {"person": _person_json(person)}


@app.put("/api/people/{code}")
async def update_person(code: str, body: ProfileIn):
    existing = await store.get_person(code)
    if existing is None:
        raise HTTPException(status_code=404, detail="person not found")
    await store.upsert_person(
        code,
        body.full_name or existing.full_name,
        None,
        Profile(
            phone=body.phone,
            age=body.age,
            city=body.city,
            ward=body.ward,
            address=body.address,
            citizen_id=body.citizen_id,
        ),
    )
    return {"person": _person_json(await store.get_person(code))}


@app.post("/api/sessions")
async def record_session(body: SessionIn):
    if body.code and await store.get_person(body.code) is None:
        raise HTTPException(status_code=404, detail="person not found")
    session_id = await store.add_session(
        body.code,
        [SessionItem(category=i.category, weight=i.weight) for i in body.items],
    )
    total = round(sum(i.weight for i in body.items), 2)
    return {
        "session_id": session_id,
        "total": total,
        "community_total": await _community_total(),
    }


@app.get("/api/stats")
async def stats():
    return {
        "community_total": await _community_total(),
        "community_base": config.COMMUNITY_BASE_KG,
        "community_goal": config.COMMUNITY_GOAL_KG,
    }


async def _community_total() -> float:
    """Everything recorded here, on top of what the station gathered before."""
    return round(config.COMMUNITY_BASE_KG + await store.community_total(), 2)
