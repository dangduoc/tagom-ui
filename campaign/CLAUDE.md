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
└── campaign-data/         ← SQLite DB lives HERE, outside the web root. Gitignored.
```

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

Zero npm dependencies. A single `node:http` server that does three jobs:

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
opens the Vietnamese text correctly.

**Storage.** `node:sqlite` (`DatabaseSync`), single `submissions` table, written via a prepared
statement. The DB path is `DATA_DIR` (default `../campaign-data/submissions.db`) — deliberately
a **sibling of the web root**, so that even if the Node app stops and the host falls back to
serving this folder statically, the customer data is still not reachable over HTTP. Keep it that
way. `campaign-data/` and `campaign/data/` are gitignored; the DB holds real personal data and
must never be committed.

**Startup.** Exits immediately with a message if `ADMIN_PASSWORD` is unset. Reads `PORT` from
the environment (Passenger sets this).

Run locally:
```bash
ADMIN_PASSWORD=whatever node app.js     # → http://localhost:3000/ and /admin
```

## Deploying to shared hosting

### The blocker to check first: Node version

`app.js` uses the built-in `node:sqlite`, which is **not available on older Node**:

- **Node 24** — works unflagged. Verified locally on v24.16.0.
- **Node 22.x** — the module exists but requires `--experimental-sqlite`. On cPanel you often
  cannot add CLI flags, in which case the app will crash on startup.
- **Below 22.5** — `node:sqlite` does not exist at all.

Check the host's available Node versions **before** anything else. If the host caps out below
24, the options are: pass the flag via `NODE_OPTIONS=--experimental-sqlite` if the panel allows
env vars (untested here), or swap storage for append-only JSON/CSV files under `DATA_DIR`.

### cPanel → Setup Node.js App (Passenger)

| Field | Value |
|---|---|
| Application root | the folder containing `app.js` |
| Application startup file | `app.js` |
| Application URL | your domain |
| Environment variables | `ADMIN_PASSWORD` = a strong password (required) |
|  | `ADMIN_USER` = optional, defaults to `admin` |
|  | `DATA_DIR` = optional, defaults to `../campaign-data` |

Passenger assigns the port itself; `app.js` already reads `process.env.PORT`.

### Things that bite on shared hosting

- **`DATA_DIR` must be writable and outside the web root.** If the panel puts your app root
  *inside* `public_html`, the default `../campaign-data` may land somewhere web-accessible —
  set `DATA_DIR` explicitly to a path outside `public_html` and confirm the DB is not fetchable
  over HTTP.
- **HTTPS is required in practice.** `/admin` uses Basic auth, which is base64, not encryption.
  Over plain HTTP the admin password is readable in transit. Enable SSL before using `/admin`.
- **SQLite dislikes network filesystems.** If the host stores your home directory on NFS, file
  locking can misbehave under concurrent writes. Traffic here is low so this is unlikely to
  bite, but it's the first thing to suspect if writes fail intermittently.
- **Passenger restarts the process freely.** Both rate limiters are in-memory and reset on
  restart — by design, but it means the limits are softer in production than they look.
- **If the host is PHP-only**, `app.js` cannot run. The static page still works, but every form
  POSTs to `/api/submit` and would 404. The forms would need a PHP endpoint writing to the same
  schema.

### After deploying, verify

```bash
curl -sI  https://YOURDOMAIN/                       # 200
curl -sI  https://YOURDOMAIN/app.js                 # must be 404, not the source
curl -sI  https://YOURDOMAIN/campaign-data/submissions.db   # must be 404
curl -sI  https://YOURDOMAIN/admin                  # 401 without credentials
curl -s -X POST https://YOURDOMAIN/api/submit \
     -H 'Content-Type: application/json' \
     -d '{"form":"question","email":"t@example.com"}'       # {"ok":true}
```

Then click through all four `.js-open-order` buttons and both modal submits in a real browser —
the inline jQuery is not covered by any test.

## Notes for future work

- There is no test suite and no build step beyond Sass. Changes are verified by loading the page.
- `#order-btn-top`, `#orderBtn`, `#btnOrder`, `#faqOrderBtn` are four ids for the same action,
  kept only in case external analytics (GTM etc.) targets them. Nothing in this repo uses them —
  the behaviour comes from the shared `.js-open-order` class.
