# TODO

- [ ] **Threshold tuning** — enroll more colleagues, then watch `similarity` values
      on the Live page (and the `closest` field in `/api/recognize` responses for
      near-misses) to decide whether `SIMILARITY_THRESHOLD=0.40` in `backend/.env`
      is right: too loose = misidentification, too strict = constant "unknown".

- [ ] **Auth** — protect the backend with at least a simple API key before anyone
      else on the network can reach it (enroll/delete are currently open to anyone
      who can hit the API).

- [ ] **VPS deployment** — Linux + `docker compose` for pgvector Postgres + Caddy
      (or nginx) with Let's Encrypt for real HTTPS, so phones get no certificate
      warning. Set a real database password in `docker-compose.yml` / `backend/.env`,
      and move existing data over with `pg_dump` from the local container.
