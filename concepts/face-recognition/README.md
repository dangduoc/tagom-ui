# Tagom Community Recycling Station

A self-service kiosk for a community recycling collection point. Someone brings
recyclables, identifies themselves (QR / face / anonymous), weighs several
material categories one after another, and finishes on a gratitude summary.
Built to the design handoff in `design_handoff_recycling_station/`
(`context.md` is the implementation spec; the HTML prototype there is the
visual source of truth).

Two experiments feed it, both now wired into the real flow: in-browser face
detection + server-side recognition (identify / register), and a DS-166SS
digital scale bridged over WebSocket (weigh). The original design notes for the
recognition half are in `face-recognition-app-handover.md`.

## Screens

Single state machine, not URL-routed: **idle → identify → confirmed / unknown →
register → category → weigh → summary**, plus a profile screen, help / keypad /
no-face overlays, and scale / network / camera error cards. Two session modes —
*sorted* (pick a material each time) and *quick* (one unsorted bag). Vietnamese
first, English toggle. Tablet landscape (1280×800) with a real mobile layout at
≤600px.

## Stack

- **Frontend**: Angular 22 (zoneless, signals) styled with the Tagom design
  tokens in `frontend/src/styles/tokens/` — never hardcode brand hexes.
  `@mediapipe/tasks-vision` (BlazeFace short-range, WASM/GPU) detects faces
  client-side; `BarcodeDetector` reads QR where the browser supports it.
  Ionic remains only for the `/debug` hardware pages.
- **Backend**: FastAPI + insightface (`buffalo_s`, ONNX, CPU) on Python 3.11.
  Holds depositor records, weigh sessions and the station total as well as the
  face embeddings. If a session can't be uploaded the frontend queues it in
  `localStorage` and retries on reconnect, so a weigh is never lost.
- **Storage**: two interchangeable backends behind one interface
  (`backend/app/stores/`):
  - `sqlite` (default) — zero-config local demo; SQLite + in-process
    brute-force cosine search (sub-millisecond at department scale).
  - `postgres` — PostgreSQL + pgvector (HNSW, cosine), the production target.
    `docker-compose.yml` provides it; `backend/db/schema.sql` is applied
    automatically on backend startup.

## Run everything with Docker Compose

No local Python/Node setup needed — builds and runs the database, backend, and
frontend together:

```powershell
docker compose up --build -d
```

- Frontend: http://localhost:4200
- Backend: http://localhost:8000/api/health
- Database (host access, e.g. `psql`): `postgresql://face:face@localhost:5433/facedb`

First backend start downloads the ~30 MB buffalo_s model into the
`insightface_models` volume (cached across rebuilds/restarts). Enrolled
data lives in the `pgdata` volume. Tear down with `docker compose down`
(add `-v` to also wipe both volumes).

To run only the database in a container while iterating on backend/frontend
locally with `uvicorn`/`ng serve`, use `docker compose up -d db` and follow the
local-dev instructions below.

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

Open http://localhost:4200 for the station itself. To enrol the first person,
start a session and pick **Đăng ký tại đây** on the unknown screen — name and
phone are required, and the five face photos become the embedding the identify
screen matches against.

### `/debug` — hardware setup pages

The original experiment pages are still there at http://localhost:4200/debug:

- **Cân** — set the scale bridge's WebSocket URL (stored in `localStorage` under
  `scale-ws-url`; the station reads the same value). Set this before weighing on
  a new device.
- **Trực tiếp** — raw recognition overlay, for checking the camera and threshold.
- **Đăng ký** — the original code/name enrollment form.

Or start everything (database + backend + frontend) in one go:

```powershell
powershell -File start-demo.ps1
```

## Switching to Postgres + pgvector

Settings live in `backend/.env` (copy `backend/.env.example`; gitignored).
With `DB_BACKEND=postgres` in that file, just make sure the database is up:

```powershell
docker compose up -d db
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
| `COMMUNITY_BASE_KG` | `12480.5` | kg the station had gathered before it started recording sessions here; added to the summary's community total |
| `COMMUNITY_GOAL_KG` | `15000` | what the summary's community bar fills against |
| `MAX_ITEM_WEIGHT_KG` | `500` | rejects implausible scale readings on `POST /api/sessions` |

## API

Face recognition:

- `POST /api/enroll` — multipart form: `employee_code`, `full_name`,
  `department?`, the optional depositor fields (`phone`, `age`, `city`, `ward`,
  `address`, `citizen_id`), and `files` (1–5 photos, exactly one face each;
  photos with zero or multiple faces are rejected per-file).
- `POST /api/recognize` — multipart `file` (padded face crop or any photo);
  picks the largest face; returns `match` (or `closest` + `below_threshold`).
- `GET /api/employees`, `DELETE /api/employees/{code}`, `GET /api/health`.

Station:

- `GET /api/people/{code}` — profile + weigh history (newest first) +
  `personal_total` / `session_count`. 404 when the code is unknown.
- `POST /api/people` — register without face photos (`enroll` covers the
  with-photos case). `PUT /api/people/{code}` updates a profile.
  On both, an omitted field is left alone and `""` clears it, so enrolling
  photos never wipes details captured earlier and vice versa.
- `POST /api/sessions` — `{code, items: [{category, weight}]}`. `code: null`
  is an anonymous visit: counted for the station, attributed to nobody.
  Unknown categories and out-of-range weights are rejected.
- `GET /api/stats` — `community_total` (base + everything recorded here),
  `community_base`, `community_goal`.

## Backend tests

```powershell
cd backend
.venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest tests
```

The station API tests stub `cv2`/`insightface` (see `tests/conftest.py`), so
they run without the multi-hundred-MB vision stack. Recognition itself is only
exercised by running the real backend.

## Known limitations / next steps

- **`employees` is the depositor table.** The recycling columns and weigh
  sessions hang off the table the face experiment created, so the name is a
  leftover — one code identifies one person either way. Renaming it to `people`
  would touch the recognition endpoints and the frontend's `ApiService`; it
  hasn't been done.
- **QR codes are placeholders.** `tg-qr` draws a deterministic QR-looking grid,
  not a scannable code (as flagged in the handoff). Add a real encoder when the
  app-download link and account payload are settled.
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
