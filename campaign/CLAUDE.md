# CLAUDE.md — Tagom campaign site

Static Vietnamese campaign landing page ("Tắt NiLon - Bật Sự Sống", Trường Long Phát × TAGOM)
plus a tiny Node form backend. Deployed to **shared hosting**, which constrains most decisions
below.

## Layout

```
tagom-ui/
├── campaign/              ← this folder; the deployable web root
│   ├── index.html         production page (all frontend JS is inline, jQuery)
│   ├── index1.html        older design variant (style1.css) — not linked from index.html
│   ├── index2.html        older design variant (style2.css) — not linked from index.html
│   ├── app.js             the form backend + static server (see below)
│   ├── package.json       `npm start` → node app.js
│   └── assets/
│       ├── css/           *.scss are the source; *.css are compiled output
│       ├── images/  fonts/  icons/  plugins/
```

Submissions live in **PostgreSQL**, not in a file under this folder.

`index.html` loads `style.css` then `bottom.css`. The other two index files are historical.

## CSS: edit the `.scss`, never the `.css` by hand

`assets/css/*.css` is compiled from the matching `.scss` — but **the committed CSS carries
autoprefixer output** (`-o-object-fit`, `-moz-placeholder`, `-webkit-user-select`) that the
project's VS Code Live Sass Compiler adds.

Running plain `sass in.scss out.css` silently strips those prefixes. If you must update the
compiled CSS without Live Sass, hand-edit `bottom.css` as text to mirror your `.scss` change
rather than recompiling. Verify prefixes survived:

```bash
grep -c -- '-o-object-fit\|-moz-placeholder\|-webkit-user-select' assets/css/bottom.css   # expect 6
```

`bottom.css.map` goes stale when you hand-edit; the next Live Sass save fixes it.

## Frontend conventions

Three modals, named by **role** rather than number:

| Modal | Purpose | Opened by |
|---|---|---|
| `#modal-question` | Đặt câu hỏi | `#questionBtn` |
| `#modal-order` | Thông tin đặt hàng | any `.js-open-order` element (4 of them) |
| `#modal-thanks` | Cảm ơn | `#thanksBtn`, and the submit success path |

- The thank-you dialog is a Figma design implemented with `.thanks-*` classes and
  `.modal-overlay.dialog-thanks`. Its layout is expressed as **percentages of the 851px design
  width**, so the whole card scales proportionally; type uses
  `calc(min(851px, 100vw - 32px) * k)` to scale with it. Below 992px it stacks (artwork on top).
- The other two modals use the shared `.modal-box` / `.modal-field` styles, scoped by
  `.modal-overlay:not(.dialog-thanks)`.
- Multi-element behaviours use delegated handlers on `document` (`.js-open-order`,
  `.js-submit-to-thanks`, `.js-modal-close`) so markup added later is picked up automatically.
- Form fields are read by their `name` attribute — `name`, `phone`, `email`, `message`,
  `quantity` — which map 1:1 to the DB columns. Renaming an input's `name` breaks storage
  silently.

## app.js — the form backend

One npm dependency (`pg`). A single `node:http` server. Every route it answers:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/submit` | none (public) | Store one submission |
| `GET` | `/admin`, `/admin/` | Basic | HTML table of all submissions, newest first |
| `GET` | `/admin/export.csv` | Basic | Download every submission as CSV |
| `GET`/`HEAD` | anything else | none | Static files from this folder |

That is the whole surface — there is **no** endpoint to edit or delete a record, and no
pagination or search. Deleting test rows means `psql` (see below). `POST` to anything other than
`/api/submit` is a 404, as is every other method.

The three jobs in detail:

**1. Serves this folder as static files.** Guards, in `serveStatic()`: refuses `/app.js`,
`/package.json`, `/package-lock.json`, anything under `/node_modules/` or `/data/`, any path
segment starting with `.`, and any `..` escape (it resolves the path first, then checks the
result is still inside the web root).

**2. `POST /api/submit`** — accepts JSON `{form, name, phone, email, message, quantity, terms}`.
- `form` must be one of `question` | `order` | `subscribe`; anything else is a 400.
- Requires **phone or email** — a row with neither is unreachable, so it's rejected.
- Fields are trimmed and length-capped (`message` 2000, others 500).
- Rate limit: 10 submissions per IP per 10 min. In-memory, resets on restart.
- Body capped at 64 KB.

**3. `GET /admin` and `GET /admin/export.csv`** — HTTP Basic auth (`ADMIN_USER`, default
`admin`, plus `ADMIN_PASSWORD`). An HTML table of all submissions and a CSV export. Failed auth
is rate-limited to 20 tries per IP per 10 min. The CSV is written with a UTF-8 BOM so Excel
opens the Vietnamese text correctly. Both send `Cache-Control: no-store`.

Because there is no delete route, remove test rows from the shell:

```bash
psql -U nhtampc1_tagom -d nhtampc1_tlp -c "DELETE FROM submissions WHERE email = 'probe@example.com';"
psql -U nhtampc1_tagom -d nhtampc1_tlp -c "SELECT count(*) FROM submissions;"
```

**Storage.** PostgreSQL via `pg`, single `submissions` table created at startup with
`CREATE TABLE IF NOT EXISTS`. All queries are parameterised (`$1, $2, …`).

- Credentials come **only** from the environment: either `DATABASE_URL`, or
  `PGUSER` + `PGPASSWORD` + `PGDATABASE` (+ optional `PGHOST`, `PGPORT`). Never hard-code them.
- `created_at` is `TIMESTAMPTZ DEFAULT now()` and `terms` is `BOOLEAN` — `pg` hands both back as
  native JS types, so the admin view calls `row.created_at.toLocaleString('vi-VN')` directly.
  A driver change that returns strings instead would break that line.
- The pool caps at 4 connections (shared hosting limits concurrent connections per user) and
  has a `pool.on('error')` handler — **keep it**. The host drops idle connections, and without
  the listener that surfaces as an uncaught exception that kills the process.

**Startup.** Exits with a message if `ADMIN_PASSWORD` is unset, or if no database is configured.
Creates the table before `listen()`, so the first visitor can't race a missing schema; if the DB
is unreachable the app exits rather than serving a page whose forms would all fail. Reads `PORT`
from the environment (Passenger sets this).

Run locally against any Postgres:
```bash
ADMIN_PASSWORD=whatever DATABASE_URL=postgres://user:pass@localhost:5432/tagom node app.js
# → http://localhost:3000/ and /admin
```

## Deploying to shared hosting

Live at **https://tlp.tamer.vn/** — cPanel + CloudLinux Passenger on **LiteSpeed**, Node **18**,
PostgreSQL. App root and web root are the same folder: `/home/nhtampc1/tlp.tamer.vn`.

The app is mounted at the **root of its own subdomain**, with the Application URL path left
empty. `index.html` posts to the absolute path `/api/submit`, so mounting it under a subpath
would silently 404 every form while the page still rendered fine.

Any Node ≥ 18 works: storage is PostgreSQL over `pg`, which is pure JavaScript and needs no
native compilation. (An earlier version used the built-in `node:sqlite`, which requires Node 24 —
that is why the version dropdown used to matter. It no longer does.)

### LiteSpeed serves existing files itself — read this before trusting `serveStatic()`

**This host does not send every request to Node.** LiteSpeed serves any path that exists on disk
directly and only forwards *unmatched* paths to the app. So:

- `serveStatic()`'s blocklist in `app.js` never runs for `/app.js` or `/package.json` on this
  host — LiteSpeed answers first. Those files are protected **only** by `.htaccess` (step 3).
  Treat that file as load-bearing, not as belt-and-braces.
- Anything you leave lying in the folder is public. Deploy zips, backups, `*.sql` dumps, editor
  swap files — all downloadable. Upload the deploy archive, extract it, then **delete it**.
- Conversely `/.well-known/` is served by LiteSpeed, so AutoSSL renewal never reaches Node and
  the dot-segment rule in `serveStatic()` cannot break certificate renewal. Nothing to do.

### 1. cPanel → PostgreSQL Databases

Create a database and a user, then **grant the user ALL PRIVILEGES on the database** — the app
runs `CREATE TABLE IF NOT EXISTS` at startup, so it needs create rights, not just insert.
cPanel prefixes both names with your account (`cpuser_tagom`). Note the password; it is shown
once.

### 2. cPanel → Setup Node.js App (Passenger)

| Field | Value |
|---|---|
| Application root | `tlp.tamer.vn` (i.e. `/home/nhtampc1/tlp.tamer.vn`) — the subdomain's own folder, a sibling of `public_html` |
| Application startup file | `app.js` |
| Application URL | `tlp.tamer.vn`, path box empty |
| Environment variables | `ADMIN_PASSWORD` = a strong password (required) |
|  | `PGDATABASE`, `PGUSER`, `PGPASSWORD` = from step 1 (required) |
|  | `PGHOST` = optional, defaults to `localhost` |
|  | `PGPORT` = optional, defaults to `5432` |
|  | `ADMIN_USER` = optional, defaults to `admin` |

Upload the contents of `campaign/` into that folder, **without `node_modules/`**, then delete
the archive afterwards (LiteSpeed will happily serve it — see above). Set the environment
variables *before* starting: the app exits on startup if any are missing, so an omission shows
up as "application failed to start" rather than as a broken form discovered later.

The panel stores those variables as `SetEnv` lines inside the `CLOUDLINUX ENV VARS` block of
`.htaccess`. That file is not web-readable (LiteSpeed returns 403), but it does mean the
database and admin passwords sit in plaintext in the web root. Never `chmod` it readable, never
copy it into the repo.

**Paste carefully — a leading space in `PGUSER` costs an hour.** Postgres reports it as
`no pg_hba.conf entry for host "127.0.0.1", user " nhtampc1_tagom"`, which reads like a
permissions or network problem and sends you to the wrong place entirely; the giveaway is the
space inside the quotes. `app.js` now trims `PGUSER`/`PGDATABASE`/`PGHOST` defensively, but the
panel value should still be clean. The password is deliberately not trimmed — spaces can be
legitimate in one.

#### npm is broken on this host

`Run NPM Install` fails, and so does `npm` inside the venv shell, on **both** Node 18 and 20:

```
/opt/alt/alt-nodejs18/root/usr/bin/npm: No such file or directory
```

CloudLinux's `alt-nodejs` packages are installed without their npm binary. This is the host's
bug to fix — worth a support ticket — but it does not block deploying, because `pg` and its
whole dependency tree are **pure JavaScript**: build `node_modules/` locally and upload it.
Verify on the host with:

```bash
source /home/nhtampc1/nodevenv/tlp.tamer.vn/18/bin/activate && cd /home/nhtampc1/tlp.tamer.vn
node -e "console.log(require('pg/package.json').version)"   # expect 8.x
```

Restart from the shell with `touch tmp/restart.txt` (Passenger watches its mtime; the file
already existing is normal) or use the panel's Restart button.

### 3. `.htaccess` — the only thing hiding the source

Because LiteSpeed serves real files itself, these rules are what actually block `/app.js`.
Append them **after** both CloudLinux blocks, at the end of `/home/nhtampc1/tlp.tamer.vn/.htaccess`:

```apache
<FilesMatch "^(app\.js|package\.json|package-lock\.json)$">
    Require all denied
</FilesMatch>

RedirectMatch 404 ^/node_modules/
```

Keep them **outside** the `# DO NOT REMOVE` markers — cPanel rewrites those block contents
whenever the app's settings or environment variables change, discarding anything inside. Re-check
the file after any panel change. There are no `RewriteRule`s in the generated config, so ordering
does not matter; appending is safe. No restart needed, `.htaccess` applies on the next request.

Verified in production: `/app.js`, `/package.json`, `/package-lock.json` → 403,
`/node_modules/*` → 404, while the page, assets, `/admin` and `/api/submit` keep working.

### Things that bite on shared hosting

- **HTTPS is required in practice.** `/admin` uses Basic auth, which is base64, not encryption.
  Over plain HTTP the admin password is readable in transit. AutoSSL issues and renews the
  certificate by itself — nothing to configure, and LiteSpeed serves `/.well-known/` without
  involving Node, so renewal cannot be broken by the app.
- **Idle connections get dropped.** Hence the pool's `error` listener and the small `max`. If
  the app dies after a quiet period, that listener is the first thing to check.
- **Passenger restarts the process freely.** Both rate limiters are in-memory and reset on
  restart — by design, but it means the limits are softer in production than they look.
- **`ADMIN_PASSWORD` guards real personal data** — names, phone numbers, emails of people who
  filled in the forms. The failed-auth limiter (20 tries per IP per 10 min) slows brute force
  but is no defence against a guessable password. Use a long random one, and make it *different*
  from `PGPASSWORD`.
- **Startup errors go to `~/tlp.tamer.vn/stderr.log`.** `app.js` prints a distinct message per
  failure ("ADMIN_PASSWORD is not set", "No database configured", "Cannot reach the database: …"),
  so read that file before guessing. A 503 on `/admin` means the app failed to boot; a 404 there
  means requests are not reaching Node at all.
- **If the host were PHP-only**, `app.js` could not run — the static page would still work but
  every form POSTs to `/api/submit` and would 404. Not the case here, but the fallback would be
  a PHP endpoint writing the same `submissions` schema.

### After deploying, verify

```bash
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/                  # 200
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/app.js            # 403 (.htaccess)
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/package.json      # 403
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/.htaccess         # 403
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/admin             # 401

# Reaches Node, validates, writes nothing — the safe liveness probe.
curl -s -X POST https://tlp.tamer.vn/api/submit \
     -H 'Content-Type: application/json' \
     -d '{"form":"question","name":"probe"}'
# → {"ok":false,"error":"Vui lòng nhập số điện thoại hoặc email."}
```

Prefer that last probe over a real submission: it proves routing, JSON parsing, validation and
UTF-8 all work without putting a fake lead in front of whoever reads `/admin`.

Then confirm nothing extra is exposed — LiteSpeed serves whatever is in the folder:

```bash
curl -so /dev/null -w '%{http_code}\n' https://tlp.tamer.vn/campaign.zip   # want 404
```

Finally click through all four `.js-open-order` buttons and both modal submits in a real
browser — the inline jQuery is not covered by any test — and check the rows land in `/admin`.

## Notes for future work

- There is no test suite and no build step beyond Sass. Changes are verified by loading the page.
- `#order-btn-top`, `#orderBtn`, `#btnOrder`, `#faqOrderBtn` are four ids for the same action,
  kept only in case external analytics (GTM etc.) targets them. Nothing in this repo uses them —
  the behaviour comes from the shared `.js-open-order` class.
