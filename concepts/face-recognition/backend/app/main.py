from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from . import config
from .face import BadImageError, FaceService, MultipleFacesError, NoFaceError
from .stores import create_store

face_service: FaceService | None = None
store = create_store()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global face_service
    await store.init()
    # Model load downloads ~30MB to ~/.insightface on first run
    face_service = await run_in_threadpool(FaceService)
    yield
    await store.close()


app = FastAPI(title="Department Face Recognition", lifespan=lifespan)

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
        "db_backend": config.DB_BACKEND,
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
                "employee_code": match.employee_code,
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
                "employee_code": match.employee_code,
                "similarity": round(match.similarity, 4),
            }
        ),
        "reason": None if matched else "below_threshold",
        "det_score": round(extracted.det_score, 3),
    }


@app.post("/api/enroll")
async def enroll(
    employee_code: str = Form(...),
    full_name: str = Form(...),
    department: str | None = Form(None),
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

    employee_id = await store.upsert_employee(employee_code, full_name, department)
    for emb in embeddings:
        await store.add_embedding(employee_id, emb)

    return {
        "employee_id": employee_id,
        "employee_code": employee_code,
        "enrolled_photos": len(embeddings),
        "files": results,
    }


@app.get("/api/employees")
async def list_employees():
    employees = await store.list_employees()
    return [
        {
            "id": e.id,
            "employee_code": e.employee_code,
            "full_name": e.full_name,
            "department": e.department,
            "embedding_count": e.embedding_count,
            "created_at": e.created_at,
        }
        for e in employees
    ]


@app.delete("/api/employees/{employee_code}")
async def delete_employee(employee_code: str):
    deleted = await store.delete_employee(employee_code)
    if not deleted:
        raise HTTPException(status_code=404, detail="employee not found")
    return {"deleted": employee_code}
