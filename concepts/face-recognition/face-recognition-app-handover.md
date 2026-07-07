# Department Face Recognition App — Project Handover

## Goal

Build an app that opens a camera (mobile phone or external webcam) and, from a live
video stream, detects faces and identifies who they are among a known set of
department members. Live overlay of bounding box + name on the video feed.

## Decisions made so far

- **Client platform**: Web app (not Flutter/native). Chosen for faster iteration
  given existing Angular/TS experience, no app-store friction for an internal tool,
  and browser camera APIs are sufficient for this use case. Can be revisited if
  background camera access on mobile becomes a hard requirement (browsers restrict
  camera use to foregrounded tabs, especially iOS Safari).
- **Backend language**: Python (not .NET Core), using FastAPI.
- **Face recognition library**: `insightface` (ONNX-based, actively maintained).
  Do **not** use the `face-recognition` PyPI package — it's unmaintained since 2020,
  dlib-based, and painful to build on a VPS.
- **Storage**: PostgreSQL with the `pgvector` extension. This is *not* a separate
  vector database — pgvector is a Postgres extension, so relational data (employee
  records) and vector search (face embeddings) live in one database.
- **Detection strategy**: split "detection" (every frame, cheap, client-side) from
  "recognition" (expensive, server-side, throttled per tracked face) — see pipeline
  below. Do not call the recognition API on every video frame.

## Architecture

```
Browser (Angular)                          VPS (Python / FastAPI)
------------------                          -----------------------
getUserMedia() video stream
  -> face-api.js or MediaPipe               PostgreSQL + pgvector
     Face Detection (every frame,             - employees table
     client-side, WASM/WebGL)                 - face_embeddings table
  -> simple track ID matching                 - HNSW index, cosine distance
     (IoU across frames) to avoid
     re-recognizing the same face           FastAPI endpoints:
     every frame                              POST /api/enroll
  -> draw bounding box + cached name            (photo -> insightface embedding
     on every frame (no network call)            -> store against employee)
  -> only when a face-track is NEW or          POST /api/recognize
     STALE (e.g. > 3s since last check):        (face crop -> insightface embedding
     POST cropped face image to                 -> pgvector nearest-neighbor query
     /api/recognize                             -> return name + confidence,
  -> cache returned name/confidence              or "unknown" below threshold)
     against that track ID
```

## Database schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE face_embeddings (
    id SERIAL PRIMARY KEY,
    employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
    embedding vector(512),  -- match insightface model output dimension
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON face_embeddings USING hnsw (embedding vector_cosine_ops);
```

Matching query (cosine distance via `<=>` operator):

```sql
SELECT e.full_name, e.employee_code, 1 - (f.embedding <=> $1) AS similarity
FROM face_embeddings f
JOIN employees e ON e.id = f.employee_id
ORDER BY f.embedding <=> $1
LIMIT 1;
```

## FastAPI backend sketch

```python
from fastapi import FastAPI, UploadFile
import insightface
import asyncpg

app = FastAPI()
face_model = insightface.app.FaceAnalysis(name="buffalo_s")
face_model.prepare(ctx_id=0)

DATABASE_URL = "postgresql://user:pass@localhost/facedb"
SIMILARITY_THRESHOLD = 0.5  # tune against real test data

@app.post("/api/recognize")
async def recognize(file: UploadFile):
    img = decode_image(await file.read())  # cv2/PIL -> numpy array
    faces = face_model.get(img)
    if not faces:
        return {"match": None}

    embedding = faces[0].embedding.tolist()  # 512-d vector
    conn = await asyncpg.connect(DATABASE_URL)
    row = await conn.fetchrow(
        """
        SELECT e.full_name, e.employee_code,
               1 - (f.embedding <=> $1) AS similarity
        FROM face_embeddings f
        JOIN employees e ON e.id = f.employee_id
        ORDER BY f.embedding <=> $1
        LIMIT 1
        """,
        embedding,
    )
    await conn.close()

    if row and row["similarity"] > SIMILARITY_THRESHOLD:
        return {"match": row["full_name"], "confidence": row["similarity"]}
    return {"match": None}


@app.post("/api/enroll")
async def enroll(employee_code: str, full_name: str, file: UploadFile):
    img = decode_image(await file.read())
    faces = face_model.get(img)
    if not faces:
        return {"error": "no face detected"}

    embedding = faces[0].embedding.tolist()
    conn = await asyncpg.connect(DATABASE_URL)
    employee_id = await conn.fetchval(
        """
        INSERT INTO employees (employee_code, full_name)
        VALUES ($1, $2)
        ON CONFLICT (employee_code) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
        """,
        employee_code, full_name,
    )
    await conn.execute(
        "INSERT INTO face_embeddings (employee_id, embedding) VALUES ($1, $2)",
        employee_id, embedding,
    )
    await conn.close()
    return {"employee_id": employee_id}
```

Recommend enrolling 3-5 photos per person (different angles/lighting) for better
match reliability — store each as a separate row in `face_embeddings`, all linked
to the same `employee_id`; the nearest-neighbor query naturally picks the best one.

## Client-side (Angular) pipeline sketch

- `getUserMedia()` for camera/webcam access.
- `face-api.js` or `@mediapipe/tasks-vision` Face Detection for per-frame detection
  (runs in-browser, no network call).
- Lightweight track-matching (IoU between consecutive frames' bounding boxes) to
  give each face a stable track ID across frames, so recognition isn't re-run
  every frame for the same person.
- Recognition call fires only when a track is new or its cached result is older
  than a few seconds:

```ts
interface FaceTrack {
  box: DOMRect;
  cachedName?: string;
  confidence?: number;
  lastRecognized?: number; // timestamp
}

const tracks = new Map<number, FaceTrack>();
const STALE_MS = 3000;

function onFrame(detectedFaces: DetectedFace[]) {
  for (const face of detectedFaces) {
    const trackId = matchToExistingTrack(face.box, tracks); // IoU match
    const track = tracks.get(trackId) ?? { box: face.box };
    track.box = face.box;

    const isStale = !track.lastRecognized || (Date.now() - track.lastRecognized) > STALE_MS;
    if (isStale) {
      recognizeAsync(face, trackId); // fire-and-forget, updates cache on response
    }
    tracks.set(trackId, track);
  }
  drawOverlay(tracks); // every frame, using whatever's currently cached
}
```

## Open items / things to decide next

- [ ] Confirm similarity threshold empirically against real department photos
      (too loose = misidentification, too strict = constant "unknown").
- [ ] Decide on video recording requirement: is saving footage to a file (for
      playback/audit) needed in addition to live recognition, or is live-only
      sufficient? (Browser `MediaRecorder` API can run in parallel with the live
      detection loop if recording is needed.)
- [ ] VPS sizing / GPU vs CPU inference for insightface (CPU is fine for occasional
      throttled recognition calls at department scale; no GPU needed unless volume
      grows significantly).
- [ ] Authentication/authorization for the API endpoints (internal tool, but still
      needs access control before deployment).
- [ ] Decide on HTTPS/TLS setup for the VPS API.
