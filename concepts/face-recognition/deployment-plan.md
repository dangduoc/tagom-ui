# Deployment plan — station PCs + a small central VPS

Supersedes `aws-deployment-plan.md`, which assumed the whole system ran in the
cloud. That design is abandoned: a PC at each station runs the backend, the face
recognition and the vector database locally, and only what the network actually
needs is pushed to a central API.

## Why this shape wins

Three problems the cloud plans could not solve well disappear here.

**The scale works again.** `getUserMedia` needs a secure context, so a cloud-hosted
kiosk page has to be HTTPS — and an HTTPS page hard-blocks `ws://`, with no flag
or override. The AWS plan's answer was to rewrite the ESP32 as an outbound WSS
client and relay readings through the backend, which it called out as the largest
unknown in the project. Serving the SPA from `http://localhost` on the station PC
solves it outright: localhost *is* a secure context so the camera works, and the
page is not HTTPS so `ws://192.168.x.x:81` to the ESP32 is allowed. **The relay
and the firmware rewrite are deleted from the roadmap.**

**Weighing survives an outage for real.** Recognition, registration and weighing
all run locally. The error card's "weighing still works" copy becomes true again.

**Recognition costs nothing.** Measured on a single 2.6 GHz Skylake-family core:
detection 15 ms, embedding 5 ms, so `/api/recognize` is **~20 ms**. At 500
visitors/day with ~5 polls each that is 2,500 inferences ≈ **50 CPU-seconds per
day**. The station PC is 50–100× over-provisioned for inference; the real load on
it is Chromium running MediaPipe in WASM over a 720p stream.

Biometrics also never leave the building, which is a genuine benefit rather than a
compliance argument.

---

## Target architecture

```
   Station (×5, on-premise)                     Central (Nhan Hoa VPS)
 ┌─────────────────────────────────┐          ┌──────────────────────────┐
 │ Dell OptiPlex 7050 Micro        │          │  FastAPI (ROLE=central)  │
 │  Chromium --kiosk               │          │   POST /api/sync/sessions│
 │    └─ http://localhost          │          │   GET  /api/stats        │
 │  nginx (SPA)                    │  HTTPS   │   GET  /api/people/{code}│
 │  FastAPI (ROLE=station)         │ ───────► │                          │
 │    insightface buffalo_s        │  push    │  PostgreSQL (no pgvector)│
 │  PostgreSQL + pgvector          │          │   stations, people,      │
 │    people, embeddings, sessions │          │   weigh_sessions, items  │
 │  UPS                            │          └──────────────────────────┘
 └────────┬────────────────────────┘                     ▲
          │ ws:// LAN                          Tailscale  │ admin SSH
     ESP32 scale                                          │
```

Nothing at the station is reachable from the internet. The backend binds
`127.0.0.1`, the SPA is served on localhost, and the only outbound path is the
station pushing to central. **This removes the need for station-side API auth
entirely** — the API is not addressable from anywhere else.

---

## The identity decision this plan assumes

Face embeddings live only at the station where a person registered, so Ann is a
stranger at any other station. Of the four ways out (station-local only; QR/phone
as the shared identity; local-first with central fallback; replicate embeddings
everywhere), **this plan assumes QR/phone is the cross-station identity and face
recognition stays a local convenience.** Both paths already exist in the flow
(`identifiedByQr` and the keypad lookup), and no embedding ever syncs.

If you'd rather have face recognition work at every station, say so before Phase 3
— it changes the sync design substantially and puts biometrics on the VPS.

**Blocking prerequisite:** the QR codes in `tg-qr` are non-scannable placeholders.
They have to become real, scannable codes before this identity model works. Budget
it as its own task.

---

## Phase 0 — Code changes before any hardware is deployed

**Station identity in the schema** (`backend/db/schema.sql`)
- New `stations` table (`id`, `code`, `name`) on both station and central.
- `station_id` on `weigh_sessions`. You need this for per-station reporting
  regardless of any of the above.
- **`people.code` must be globally unique across stations.** Prefix it per
  station (`S01-000123`) so the central merge can never collide. This is easy now
  and painful after the first station is live.
- Keep the migration idempotent and in the same `DO $$` block style — it applies
  on backend startup, which is exactly the property a fleet of unattended PCs needs.

**Split station and central roles** (`backend/app/config.py`, `main.py`)
- One codebase, `ROLE=station|central`.
- `central` never imports insightface and disables `/api/recognize` and
  `/api/enroll` — that keeps its image small and its RAM tiny.
- `station` keeps everything, plus the sync worker below.
- Two Dockerfiles, or one with a build arg, so the central image doesn't carry the
  ~30 MB model or onnxruntime.

**Sync worker on the station backend** (new)
- A table `sync_outbox (session_id, attempts, last_error, created_at)`.
- A background task drains it to `POST /api/sync/sessions` on central, with
  backoff. Idempotent on `(station_code, station_session_id)` so a retry after a
  half-failed push cannot double-count.
- Pushes profile changes too (name, phone, code — **never embeddings**).
- **Why the backend and not the browser:** `station-data.ts` currently queues
  failed uploads in `localStorage`. On a station PC the browser→backend hop is
  localhost and essentially never fails, while the station→central hop is the one
  that actually drops. Keep the existing browser outbox (it's built and tested,
  and still covers a backend restart mid-session), but the real queue belongs in
  the always-on backend, not in a kiosk tab that can be closed or refreshed.

**Community total becomes a network number**
- `/api/stats` on the station currently sums its own database. It should return
  the last value pulled from central, cached, falling back to the local sum when
  central has never been reached. `loadStats()` already keeps the last value it saw
  on failure, so the frontend needs no change.

**Central API auth**
- `X-Station-Key` per station, checked on every route except `/api/health`. The
  key lives in the station's env file, never in the SPA bundle — the SPA only ever
  talks to localhost, so it never needs a key at all.
- Rate-limit the sync endpoint per key.

**Station-side backstop** — *done, `TRUSTED_CLIENT_CIDRS`*

The argument above ("nothing at the station is reachable, so no station auth is
needed") is sound but rests entirely on one bind address being right, with
nothing in the code to notice if it isn't. No route is authenticated, and they
include `GET /api/people`, `GET /api/people/{code}` (phone, citizen ID, address)
and `DELETE /api/people/{code}` — so a single wrong flag is the whole distance
between "unreachable" and "anyone on the WiFi can delete depositors".

- The backend refuses any client outside `TRUSTED_CLIENT_CIDRS`
  (default `127.0.0.0/8,::1`) with a 403, and logs it. This makes the bind
  address *irrelevant*: bound to `0.0.0.0`, a LAN request is still refused.
- `docker-compose.yml` widens it to `172.16.0.0/12` so the frontend container
  can proxy `/api`; that admits containers without admitting the LAN.
- **This is a backstop, not the boundary.** A reverse proxy that forwards LAN
  traffic launders the source address — during development the tablet reaches
  `/api` through `ng serve` and is allowed, which is intended. At a station,
  publish the SPA's port on `127.0.0.1` so there is no such path.

Still to do here:
- Bind published ports to `127.0.0.1` in the station's compose file (the dev
  file deliberately still publishes on all interfaces).
- Decide whether the kiosk display is attached to the station PC or is a
  separate wireless tablet. Attached is what this plan assumes and needs no
  further work; a wireless tablet means the SPA must be served over the LAN,
  and then it needs its own VLAN/SSID plus an nginx allowlist, because the
  guard cannot distinguish the tablet from a visitor behind the same proxy.

**Housekeeping**
- Drop the stale `DB_BACKEND: postgres` line from `docker-compose.yml`; it has been
  a no-op since SQLite was removed.

---

## Phase 1 — Station hardware

Per station:

| Item | ₫ |
|---|---|
| Dell OptiPlex 7050 Micro (i5-6500T, 8 GB, 256 GB NVMe), 12-month warranty | 4,290,000 |
| Small line-interactive UPS | ~800,000 |
| **Total, one-off** | **~5,100,000** |

- **8 GB is enough.** Working set is roughly 1 GB Chromium + 700 MB backend +
  300 MB Postgres + 400 MB OS ≈ 2.5 GB.
- **Enable "Power On after AC Loss" in BIOS.** Otherwise a power cut leaves the
  station dark until someone drives out to press the button. Test it.
- **Disable Intel AMT** unless you deliberately provision it. The 7050's Q270
  chipset likely has it, it is genuinely useful for remote power-cycling, and it
  has a poor CVE history if left unmanaged.
- **Plan for dust.** A recycling station is dusty and these have intake fans.
  Enclose with a filter, or commit to blowing it out quarterly.
- Buy **one** first and use OnlyLap's 15-day return window to validate the real
  kiosk load before ordering the other four. Chromium + the MediaPipe loop on a
  35 W Skylake part is the one thing in this plan that is not yet measured.

---

## Phase 2 — Station software

- **Ubuntu Server 24.04 LTS + Docker.** Your existing `docker-compose.yml` is
  already almost the station deployment — db, backend, frontend, all three.
- Production compose overlay: no published ports except nginx on `127.0.0.1:80`,
  `restart: unless-stopped` everywhere, real DB credentials from an env file,
  images pulled by tag from **ghcr.io** rather than built on the box.
- **Kiosk:** Chromium in `--kiosk --app=http://localhost`, autostarted. Grant the
  camera with a managed policy (`VideoCaptureAllowedUrls`) rather than relying on
  a click — `http://localhost` is a secure context so Chromium persists grants
  normally, and the `CameraService` fix means a failure now degrades to the phone
  keypad instead of a permission-prompt loop.
- **Auto-update:** a systemd timer running `docker compose pull && docker compose up -d`
  on a schedule, pinned to a tag you move deliberately. Keep the previous tag so
  rollback is one command.
- **Remote access: Tailscale** on every station (free at this scale). No port
  forwarding at five different sites, no inbound firewall rules, SSH over the tailnet.

---

## Phase 3 — Central VPS

- **Nhan Hoa SSD Cloud VPS Plan A** (1 core, 1 GB, 15 GB) at **86,000₫/mo** is
  genuinely sufficient: no insightface, no pgvector, and 5 stations × 500
  sessions/day is 2,500 writes a day. Move to Plan B (180,000₫) if it feels tight.
  - Confirm **KVM, not OpenVZ**, before paying — Docker needs a real kernel.
  - Confirm the **year-2 renewal price**; the 90%-off first year almost certainly
    renews at list.
- Postgres in a container, plain — pgvector is not needed centrally under this
  identity model.
- **Cloudflare free plan in front**: DNS, TLS, and proxying, at no cost. Origin
  locked to Cloudflare IPs, or reached over a Cloudflare Tunnel so the VPS needs
  no inbound ports at all.
- Nightly `pg_dump` off the VPS to Cloudflare R2 (10 GB free, zero egress).

---

## Phase 4 — Backups and data safety

This is where an on-premise fleet is genuinely worse than cloud, so do not skip it.

- **Station nightly `pg_dump`, encrypted with `age`, pushed to central.** Encrypting
  before it leaves preserves "biometrics never leave the station" in practice —
  central holds ciphertext it cannot read. Keep the private key off the stations.
- Central keeps 30 days per station; lifecycle older copies to R2.
- **Do a restore drill before go-live.** Restore one station's dump into a scratch
  database, point a local backend at it, and confirm a person and their history
  come back. An untested backup is not a backup.
- The UPS is the other half of this: Postgres on consumer hardware losing power
  mid-write is the single most likely way you lose a station's records.

---

## Phase 5 — Operations

- Health telemetry: each station posts to central on a timer; central alerts when a
  station goes quiet for >30 min. That one signal covers power loss, network loss,
  crashed containers and a dead PC.
- Also watch: disk >80%, `sync_outbox` depth (a growing queue means the station has
  been offline for a while), and free RAM.
- Ship container logs to a file with rotation. Do not build a logging pipeline for
  five machines.
- Keep one **cold spare PC** imaged and ready. At 4.29M it is cheap insurance, and
  it turns a dead station from a multi-day outage into a swap.

---

## Cost summary

| | |
|---|---|
| Station PC + UPS, one-off | ~5,100,000₫ each (~$195) |
| Five stations, one-off | ~25,500,000₫ |
| Cold spare | ~4,300,000₫ |
| Central VPS | **86,000₫/mo** |
| Cloudflare (DNS, TLS, R2 backups) | 0₫ |
| **Recurring total** | **~86,000₫/mo (~$3.30)** |

For comparison, the AWS build was ~$25–31/mo and the single-VPS build ~$21/mo,
neither of which included a working scale.

---

## Verification

In order; each catches a different class of failure.

1. **Local first** — `docker compose up --build` with the role split in place.
   Station role serves `/api/recognize`; central role returns 404 for it and 401
   without `X-Station-Key`. Backend tests still pass.
2. **One real station PC, offline** — unplug the network. Register a person with
   5 photos, recognise them on a second visit, weigh two categories, finish. All of
   it must work. Confirm the session lands in `sync_outbox`.
3. **Reconnect** — the outbox drains, central shows the session exactly once, and
   the community total on the summary screen updates.
4. **Double-push** — replay the same sync payload and confirm the total does not
   move. Idempotency is the thing most likely to be quietly wrong.
5. **The scale** — with the ESP32 on the LAN, confirm weigh goes settling → stable
   → locked from real readings, and that cutting the ESP32's power raises the
   scale-offline card. This is the payoff for the whole architecture; test it early.
6. **Cross-station identity** — register at station 1, then identify by QR and by
   phone at station 2.
7. **Pull the plug.** Literally. The UPS should hold, and on a real power cut the
   PC must come back on its own with all containers up and the kiosk on screen.
8. **Restore drill** (Phase 4).
9. **Try to be a visitor.** From a phone on the station's WiFi, hit the station
   PC's LAN address on every published port. `GET /api/people` and
   `DELETE /api/people/{code}` must both come back 403, and the refusals must
   appear in the backend log. Do this from an actual second device — curl from
   the station PC itself is loopback and proves nothing.

## Suggested order

1. Phase 0 schema + role split + globally-unique codes (blocks everything)
2. Real QR codes (blocks cross-station identity)
3. One station PC end to end, offline-first, with the scale — the payoff, and the
   biggest unknown
4. Central VPS + sync worker + idempotency
5. Backups, restore drill, UPS and power-cut test
6. Roll out stations 2–5, then monitoring
