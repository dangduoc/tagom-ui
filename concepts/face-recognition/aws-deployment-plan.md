# AWS deployment plan — Tagom Recycling Station

## Context

The station app currently runs entirely on a developer machine: Angular dev server,
FastAPI backend, and a pgvector Postgres container from `docker-compose.yml`. It needs
to run for real at a physical collection station.

Three things about the current code shape the whole plan:

1. **The backend has no authentication.** `backend/app/main.py` has no dependency, no
   key check, nothing. `POST /api/enroll` writes face embeddings, `DELETE /api/people/{code}`
   erases a person, and `GET /api/people/{code}` returns full name, phone, age, citizen ID
   and address. This cannot be exposed to the internet as-is.
2. **The data is sensitive.** Face embeddings are biometric data and the profile carries
   citizen ID and address. That raises the bar on encryption, backups and retention, and
   is worth a look against Vietnam's Decree 13/2023 (PDPD) before going live — not
   something to settle in this plan, but don't skip it.
3. **The scale is plaintext `ws://` on the LAN** (`frontend/src/app/scale/scale.service.ts`,
   default `ws://192.168.83.103:81`; the ESP32 firmware lives in the sibling
   `concepts/esp32-rs232` repo and runs a WebSocket *server*).

Decisions taken: tablet kiosk with the app served from AWS; single EC2 running the
existing compose stack (~$15–20/mo); per-station API key with the origin not publicly
exposed.

---

## ⚠️ Read this first: the scale will not work unaltered

`getUserMedia` requires a secure context, so the kiosk page must be HTTPS. Browsers
**hard-block `ws://` from an HTTPS page** as mixed content — there is no override, no
user prompt, no flag you can ship. Serving the SPA from CloudFront therefore gives you a
working camera and a dead scale.

Since you want the app served from AWS, the fix is to **invert the scale connection**:

- The ESP32 stops being a WebSocket server on the LAN and becomes an **outbound WSS
  client** to the API. Outbound TLS client is well-supported on ESP32 and needs no port
  forwarding, no inbound firewall rule, and no certificate on the device to renew.
- The backend relays readings from the station's ESP32 socket to the kiosk's socket.
- The tablet connects to `wss://station.tagom.vn/ws/kiosk/<station-id>` — same origin,
  same certificate, no mixed content.

**The trade-off, stated plainly:** weighing becomes internet-dependent. Today the scale
is on the LAN and would keep working through an outage; after this it will not, which
contradicts the offline copy on the error card ("weighing still works"). Latency is a
non-issue (~30–60ms each way to Singapore, against a 10Hz display).

If that regression is unacceptable, the alternative is a small box per station serving
the SPA from `http://localhost` — camera works (localhost is a secure context), `ws://`
works (page isn't HTTPS), no firmware change, offline weighing preserved. That was the
recommended option and it remains the lower-risk path; this plan proceeds with your
choice.

---

## Target architecture

```
Tablet (Chromium kiosk)                     AWS ap-southeast-1 (Singapore)
  │                                          ┌──────────────────────────────┐
  │  https://station.tagom.vn                │  Route53 + ACM               │
  ├──── SPA ────────────────────────────────►│  CloudFront                  │
  │                                          │    default  → S3 (SPA)       │
  ├──── /api/*  (X-Station-Key) ────────────►│    /api/*   → EC2 origin     │
  └──── /ws/kiosk/<id> (WSS) ───────────────►│    /ws/*    → EC2 origin     │
                                             │                              │
ESP32 scale bridge                           │  EC2 t3.small                │
  └──── outbound WSS /ws/scale/<id> ────────►│    caddy  (TLS, origin cert) │
                                             │    backend (FastAPI+insight) │
                                             │    postgres+pgvector (EBS)   │
                                             │                              │
                                             │  S3 (SPA, pg_dump backups)   │
                                             │  ECR · SSM · CloudWatch      │
                                             └──────────────────────────────┘
```

Everything the browser touches is one origin, so there is no CORS to configure and the
frontend's relative `/api` base in `frontend/src/app/api.service.ts` works unchanged.

---

## Phase 0 — Code changes before anything is deployed

These are prerequisites, not follow-ups.

**Auth** (`backend/app/config.py`, `backend/app/main.py`)
- `STATION_API_KEY` from env. A FastAPI dependency checks an `X-Station-Key` header and
  returns 401 otherwise; apply it to every route except `/api/health`.
- Frontend sends it on every call. Add it to the `fetch` helpers in
  `frontend/src/app/api.service.ts` — there are already central helpers (`sendJson`, and
  the individual methods) so this is one header in a handful of places.
- **The key is provisioned per station, never bundled.** Store it like the scale URL
  already is — entered once on the `/debug` page, kept in `localStorage`. A key baked
  into a public SPA bundle is not a secret. Even provisioned this way, anyone with
  physical access to the tablet can read it, so treat it as a station credential to be
  rotated if a device is lost, not as a strong secret.
- Add basic rate limiting on `/api/enroll` and `/api/recognize` (per-key, in-process is
  fine at this scale).

**Bake the model into the image** (`backend/Dockerfile`)
- Today the ~30MB buffalo_s pack downloads on first start into a compose volume. Add a
  build step that runs the insightface download so the image is self-contained. Removes
  a startup network dependency and the `insightface_models` volume from production.

**Production compose file** (new `docker-compose.prod.yml`)
- Services: `caddy`, `backend`, `db`. No published ports on `backend`/`db` — only Caddy
  binds 80/443. `restart: unless-stopped` everywhere.
- Images pulled from ECR by tag, not built on the box (a t3.small will struggle to build
  the Angular bundle).
- Secrets from an env file rendered at deploy time from SSM Parameter Store, not literals.
- Drop the stale `DB_BACKEND: postgres` line from `docker-compose.yml` — it's been a
  no-op since SQLite was removed.

**Scale relay** (backend + frontend + ESP32 firmware)
- Backend: `/ws/scale/{station_id}` (ESP32, key-authenticated) and `/ws/kiosk/{station_id}`
  (tablet), with an in-memory station→socket map. Single uvicorn worker makes this
  simple; if you ever add workers this needs Redis pub/sub instead.
- Frontend: `ScaleService` gains a cloud mode alongside the existing LAN mode, chosen by
  the provisioned config. Keep the LAN path for local development.
- ESP32: switch to a WSS client with reconnect/backoff. This is real work in the
  `concepts/esp32-rs232` repo and should be scheduled as its own task.

---

## Phase 1 — AWS foundation

- Region **ap-southeast-1** (Singapore) — nearest full-service region to Vietnam.
- Route53 hosted zone for the domain; `station.tagom.vn` → CloudFront,
  `origin.tagom.vn` → the EC2 elastic IP.
- **ACM certificate in us-east-1** for CloudFront (it only reads certs from there).
  Caddy issues the origin's own cert via Let's Encrypt.
- Default VPC is fine at this size. One public subnet, one instance.
- Enable **EBS encryption by default** in the account before creating the instance —
  retrofitting encryption means recreating the volume.

## Phase 2 — The EC2 box

- **t3.small** (2 vCPU, 2GB) x86. Postgres plus onnxruntime inference in 2GB is tight but
  workable; add a 2GB swapfile and watch memory. t3.medium if recognition gets sluggish.
  t4g.small (Graviton) is ~30% cheaper and worth testing later, but onnxruntime/insightface
  on aarch64 is an unknown here — don't discover that during launch.
- **Elastic IP** so the origin DNS record is stable.
- **Security group**: inbound 443/80 restricted to the AWS-managed prefix list
  `com.amazonaws.global.cloudfront.origin-facing`. Nothing else inbound. This is what
  makes "not publicly exposed" true even though the stations have dynamic IPs.
- **No SSH port, no key pair.** Admin access via **SSM Session Manager** (attach
  `AmazonSSMManagedInstanceCore`). One less thing to secure and rotate.
- Also require a shared secret header injected by CloudFront and verified by Caddy, so a
  leaked origin hostname can't be hit directly from another CloudFront distribution.
- Docker + compose plugin via user-data on first boot.

## Phase 3 — Database

Postgres stays a container (your choice of the cheap path), which means backups are
yours to run:

- Dedicated **gp3 EBS volume** (20GB is ample — 512-float embeddings are ~2KB each)
  mounted at `/var/lib/postgresql/data`, separate from the root volume so the box can be
  rebuilt without touching data.
- Real password in **SSM Parameter Store** (SecureString). Never the `face:face` from
  the dev compose file.
- **Nightly `pg_dump` to S3**: versioned bucket, SSE, lifecycle to Glacier after 30 days,
  expire at 90. A systemd timer on the box is enough.
- **Daily EBS snapshots** via Data Lifecycle Manager, 7-day retention.
- **Do a restore drill before go-live.** An untested backup is not a backup — restore a
  dump into a scratch database and confirm `GET /api/people/{code}` returns a person with
  their history.
- `backend/db/schema.sql` applies itself on startup, migrations included, so there's no
  separate migration step. Note it runs `CREATE EXTENSION IF NOT EXISTS vector` — fine
  against the `pgvector/pgvector:pg16` image, and worth remembering if you ever move to
  RDS, where a non-superuser role can't create extensions.

## Phase 4 — Frontend

- `ng build` output (`frontend/dist/frontend/browser`) to a private S3 bucket, served via
  CloudFront with Origin Access Control. The `frontend/Dockerfile` and `nginx.conf` stay
  for local compose use.
- CloudFront behaviours:
  - `default` → S3, long cache, SPA fallback (403/404 → `/index.html`, 200).
  - `/api/*` → EC2 origin, **caching disabled**, forward `X-Station-Key` and
    `Content-Type`, all methods enabled.
  - `/ws/*` → EC2 origin, caching disabled (CloudFront supports WebSocket).
- Invalidate `/index.html` on each release; hashed assets take care of themselves.

## Phase 5 — Build and deploy

- **ECR** repository for the backend image.
- **GitHub Actions**: build the backend image → push to ECR by commit SHA; build the SPA
  → sync to S3 → CloudFront invalidation.
- Deploy to the box with an **SSM Run Command** doing `docker compose pull && docker compose up -d`.
  No inbound access needed, no secrets in CI beyond an OIDC role.
- Keep the previous image tag so a rollback is one command.

## Phase 6 — Operations

- **CloudWatch agent** for memory and disk (neither is a default metric).
- Alarms: disk >80%, memory >85%, and a **synthetic check on `/api/health`** — the one
  endpoint that stays unauthenticated, which is exactly what makes it usable for this.
- Ship container logs to CloudWatch Logs with the awslogs driver, 30-day retention.
- Budget alarm at ~$40/mo to catch surprises.

## Data protection

- Encryption at rest (EBS + S3) and in transit (CloudFront→origin over TLS, not just
  edge TLS) end to end.
- `DELETE /api/people/{code}` already implements erasure; write down a retention rule for
  inactive depositors and a consent notice on the register screen. Face embeddings and
  citizen IDs are the sensitive parts.
- Consider dropping `citizen_id` collection entirely if it isn't used — the cheapest way
  to reduce risk is not to hold the data.

## Cost estimate (ap-southeast-1, 24/7)

| Item | ~USD/mo |
|---|---|
| EC2 t3.small (on-demand, ~$0.0264/hr) | 19 |
| Public IPv4 address (charged since Feb 2024, even attached) | 3.60 |
| EBS 20GB gp3 data + 8GB root | 3 |
| S3 + CloudFront (kiosk traffic) | 1–2 |
| Route53 hosted zone | 0.50 |
| ECR, logs, snapshots | 1–2 |
| **Total** | **~$28–31** |

**Above the $15–20 you picked** — Singapore runs ~25% over US pricing and the IPv4
charge is new. Honest options to close the gap, in order of preference:

- **1-year Compute Savings Plan** on the instance: ~30% off, brings it to ~$23.
- **t4g.small (Graviton)** at ~$0.0212/hr saves ~$4/mo, but verify onnxruntime and
  insightface build on aarch64 first — test before committing.
- Dropping CloudFront saves ~$2 but re-exposes the origin publicly. Not worth it.

Stopping the instance outside opening hours is the other lever if stations aren't 24/7,
though it complicates the elastic IP and DNS story.

---

## Verification

Do these in order; each catches a different class of failure.

1. **Locally first** — `docker compose up --build` with the new auth in place:
   `curl` without the key returns 401, with it returns 200. Backend tests still pass
   (`docker compose up -d db && cd backend && .venv\Scripts\python -m pytest tests`).
2. **Origin isolation** — from your laptop, `curl https://origin.tagom.vn/api/health`
   must fail (blocked by the security group), while `https://station.tagom.vn/api/health`
   succeeds through CloudFront.
3. **Auth** — `/api/people/<code>` without `X-Station-Key` returns 401 through CloudFront.
   Confirm CloudFront is forwarding the header and not caching API responses (repeat a
   `POST /api/sessions` and check both landed).
4. **Full station flow on the real tablet** — register a person with 5 photos, confirm the
   face is recognised on a second visit, weigh two categories, finish, and check the
   summary totals. Then verify server-side with `GET /api/people/{code}` that the session
   and profile actually persisted.
5. **Scale relay** — with the ESP32 connected outbound, confirm the weigh screen goes
   settling → stable → locked from real readings, and that pulling the ESP32's power
   surfaces the scale-offline card.
6. **Restore drill** — take a nightly dump, restore into a scratch database, point a
   local backend at it, confirm a person and their history come back.
7. **Reboot the instance** — everything must come back on its own (`restart: unless-stopped`,
   EBS volume remounted via fstab). Cheapest possible test of the ops setup.

## Suggested order

1. Phase 0 auth + API key plumbing (blocks everything else)
2. Phase 1–2 foundation and box, verify origin isolation
3. Phase 3 database, secrets, backups, restore drill
4. Phase 4–5 frontend, CloudFront, CI
5. Scale relay (backend + firmware) — largest unknown, schedule deliberately
6. Phase 6 monitoring, then go live
