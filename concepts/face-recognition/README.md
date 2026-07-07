# Department Face Recognition

Live face recognition for a known set of department members: the browser detects
faces on every video frame (MediaPipe, in-browser), tracks them across frames,
and asks the backend to identify each tracked face at most once every few
seconds (insightface embedding + vector search). See
`face-recognition-app-handover.md` for the original design notes.

## Stack

- **Frontend**: Angular 22 + Ionic 8 (mobile-friendly UI, bottom tabs) +
  `@mediapipe/tasks-vision` (BlazeFace short-range, WASM/GPU, runs fully
  client-side). Live overlay page + enrollment page with a guided photo-capture
  modal.
- **Backend**: FastAPI + insightface (`buffalo_s`, ONNX, CPU) on Python 3.11.
- **Storage**: two interchangeable backends behind one interface
  (`backend/app/stores/`):
  - `sqlite` (default) — zero-config local demo; SQLite + in-process
    brute-force cosine search (sub-millisecond at department scale).
  - `postgres` — PostgreSQL + pgvector (HNSW, cosine), the production target.
    `docker-compose.yml` provides it; `backend/db/schema.sql` is applied
    automatically on backend startup.

## Run the local demo

Backend (first start downloads the ~30 MB buffalo_s model):

```powershell
cd backend
python -m venv .venv          # once
.venv\Scripts\pip install -r requirements.txt   # once
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Frontend:

```powershell
cd frontend
npm install                   # once
npm start                     # ng serve on http://localhost:4200 (proxies /api to :8000)
```

Open http://localhost:4200 → **Enroll** tab → **Take photos** opens a guided
capture modal (5 shots: straight, slightly left, slightly right, chin up,
natural — capture is enabled only while exactly one face is in view; each shot
is reviewed with Confirm/Retake, and Finish unlocks once all 5 are taken),
enter code/name, enroll. Then the **Live** tab overlays names on the camera feed:
green = recognized, red = unknown, yellow = checking.

Or start everything (database + backend + frontend) in one go:

```powershell
powershell -File start-demo.ps1
```

## Switching to Postgres + pgvector

Settings live in `backend/.env` (copy `backend/.env.example`; gitignored).
With `DB_BACKEND=postgres` in that file, just make sure the database is up:

```powershell
docker compose up -d
```

To move existing SQLite enrollments over: `.venv\Scripts\python -m scripts.migrate_sqlite_to_pg`

## Configuration (backend/.env or env vars — env vars win)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DB_BACKEND` | `sqlite` | `sqlite` or `postgres` |
| `DATABASE_URL` | `postgresql://face:face@localhost:5433/facedb` | asyncpg DSN (postgres mode) |
| `SQLITE_PATH` | `backend/local_store.db` | SQLite file (sqlite mode) |
| `FACE_MODEL` | `buffalo_s` | insightface model pack (`buffalo_l` = more accurate, slower) |
| `SIMILARITY_THRESHOLD` | `0.40` | cosine similarity cutoff for a match — tune with real photos; `/api/recognize` returns the below-threshold `closest` candidate to help |
| `ALLOWED_ORIGINS` | `*` | CORS origins, comma-separated |

## API

- `POST /api/enroll` — multipart form: `employee_code`, `full_name`,
  `department?`, `files` (1–5 photos, exactly one face each; photos with
  zero or multiple faces are rejected per-file).
- `POST /api/recognize` — multipart `file` (padded face crop or any photo);
  picks the largest face; returns `match` (or `closest` + `below_threshold`).
- `GET /api/employees`, `DELETE /api/employees/{code}`, `GET /api/health`.

## Known limitations / next steps

- **Camera needs HTTPS off-localhost**: `getUserMedia` only works in a secure
  context. To open the app from a phone, serve the frontend over HTTPS (dev:
  `ng serve --ssl`; VPS: Caddy/nginx + Let's Encrypt).
- **Small faces are not detected client-side**: BlazeFace *short-range* is
  tuned for faces within ~2 m of the camera. People far from the camera won't
  get boxes. If room-scale coverage is needed, swap the client detector model.
- **Server detector needs context around a face**: tight crops fail SCRFD
  detection; the client pads crops by 75 % and the server retries with a
  neutral border as a fallback — keep both if you touch that code.
- **No auth yet**: add at least an API key before exposing the backend beyond
  localhost.
- Threshold 0.40 is a starting point — validate against real department photos.
