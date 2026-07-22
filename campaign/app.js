'use strict';

// Tiny form backend for the campaign site.
// Serves this folder as static files and stores modal submissions in PostgreSQL.
//
// cPanel → Setup Node.js App:
//   Application root        : the folder containing this file
//   Application startup file: app.js
//   Environment variables   : ADMIN_PASSWORD, PGUSER, PGPASSWORD, PGDATABASE
//   then press "Run NPM Install" so the `pg` driver is available.
//
// The submissions live in PostgreSQL rather than in a file, so there is nothing
// under the web root that could be downloaded even if the Node app is stopped
// and Apache falls back to serving this folder statically.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

// ── Config ─────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set. Set it in cPanel → Setup Node.js App → Environment variables,');
    console.error('or run locally with:  ADMIN_PASSWORD=your-password node app.js');
    process.exit(1);
}

// Credentials come from the environment — never commit them to this file.
// Either one DATABASE_URL, or the individual PG* variables cPanel gives you.
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL && !((process.env.PGUSER || '').trim() && (process.env.PGDATABASE || '').trim())) {
    console.error('No database configured. Set DATABASE_URL, or PGUSER + PGPASSWORD + PGDATABASE');
    console.error('(cPanel → PostgreSQL Databases creates all three for you).');
    process.exit(1);
}

const WEB_ROOT = __dirname;

// Never serve these over HTTP, even though they sit in the web root.
const BLOCKED = ['/app.js', '/package.json', '/package-lock.json'];
const BLOCKED_PREFIXES = ['/node_modules/', '/data/'];

// ── Database ───────────────────────────────────────────────────────────────
const pool = new Pool({
    ...(DATABASE_URL
        ? { connectionString: DATABASE_URL }
        : {
            // Trimmed: pasting credentials into the cPanel form picks up stray
            // spaces, and a leading space in the user name surfaces as the very
            // misleading "no pg_hba.conf entry for host ..." rather than as a
            // bad-credentials error. The password is deliberately NOT trimmed —
            // spaces can be legitimate there.
            host: (process.env.PGHOST || 'localhost').trim(),
            port: Number(process.env.PGPORT) || 5432,
            user: (process.env.PGUSER || '').trim(),
            password: process.env.PGPASSWORD,
            database: (process.env.PGDATABASE || '').trim(),
        }),
    // Shared hosting caps how many connections a user may hold open, and this
    // site's traffic is low, so keep the pool small.
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

// The host drops idle connections. Without this listener that arrives as an
// uncaught exception on a pooled client and takes the whole process down.
pool.on('error', (err) => {
    console.error('Postgres pool error:', err.message);
});

const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS submissions (
        id         SERIAL PRIMARY KEY,
        form       TEXT NOT NULL,
        name       TEXT,
        phone      TEXT,
        email      TEXT,
        message    TEXT,
        quantity   TEXT,
        terms      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
`;

const INSERT_SQL = `
    INSERT INTO submissions (form, name, phone, email, message, quantity, terms)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
`;
const SELECT_ALL_SQL = 'SELECT * FROM submissions ORDER BY id DESC';

// Only these three forms are accepted; anything else is rejected.
const FORM_LABELS = {
    question: 'Đặt câu hỏi',
    order: 'Đặt hàng',
    subscribe: 'Theo dõi email',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function clean(value, max) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim().slice(0, max);
    return text === '' ? null : text;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Behind Passenger/Apache every request arrives from 127.0.0.1, so without
// X-Forwarded-For all visitors would share one rate-limit bucket.
function clientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
}

// In-memory rate limit. Enough to stop a public endpoint becoming a spam
// firehose; resets whenever the process restarts, which is fine.
const hits = new Map();

function rateLimited(key, max, windowMs) {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
        hits.set(key, recent);
        return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
}

function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > limit) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function isAuthorised(req) {
    const match = /^Basic (.+)$/.exec(req.headers.authorization || '');
    if (!match) return false;
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return false;
    return decoded.slice(0, separator) === ADMIN_USER && decoded.slice(separator + 1) === ADMIN_PASSWORD;
}

function requireAuth(req, res) {
    if (isAuthorised(req)) return true;
    // Rate limit failed attempts so the password can't be brute forced.
    if (rateLimited('auth:' + clientIp(req), 20, 10 * 60 * 1000)) {
        res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Too many attempts. Try again later.');
        return false;
    }
    res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Tagom admin", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Authentication required.');
    return false;
}

// ── POST /api/submit ───────────────────────────────────────────────────────
async function handleSubmit(req, res) {
    if (rateLimited('submit:' + clientIp(req), 10, 10 * 60 * 1000)) {
        sendJson(res, 429, { ok: false, error: 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.' });
        return;
    }

    let payload;
    try {
        payload = JSON.parse(await readBody(req));
    } catch {
        sendJson(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' });
        return;
    }

    const form = String(payload.form || '');
    if (!Object.prototype.hasOwnProperty.call(FORM_LABELS, form)) {
        sendJson(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' });
        return;
    }

    const row = {
        name: clean(payload.name, 500),
        phone: clean(payload.phone, 500),
        email: clean(payload.email, 500),
        message: clean(payload.message, 2000),
        quantity: clean(payload.quantity, 500),
        terms: Boolean(payload.terms),
    };

    // Without a way to reach the person the row is worthless.
    if (!row.phone && !row.email) {
        sendJson(res, 400, { ok: false, error: 'Vui lòng nhập số điện thoại hoặc email.' });
        return;
    }

    try {
        await pool.query(INSERT_SQL, [
            form,
            row.name,
            row.phone,
            row.email,
            row.message,
            row.quantity,
            row.terms,
        ]);
    } catch (err) {
        // A database outage is our fault, not the visitor's — say so plainly
        // rather than telling them their data was invalid.
        console.error('Insert failed:', err.message);
        sendJson(res, 500, { ok: false, error: 'Hệ thống đang bận, vui lòng thử lại sau.' });
        return;
    }

    sendJson(res, 200, { ok: true });
}

// ── GET /admin ─────────────────────────────────────────────────────────────
async function renderAdmin(res) {
    const { rows } = await pool.query(SELECT_ALL_SQL);

    const body = rows
        .map(
            (row) => `
            <tr>
                <td>${row.id}</td>
                <td class="nowrap">${escapeHtml(row.created_at.toLocaleString('vi-VN'))}</td>
                <td><span class="tag tag-${escapeHtml(row.form)}">${escapeHtml(FORM_LABELS[row.form] || row.form)}</span></td>
                <td>${escapeHtml(row.name)}</td>
                <td class="nowrap">${escapeHtml(row.phone)}</td>
                <td>${escapeHtml(row.email)}</td>
                <td>${escapeHtml(row.quantity)}</td>
                <td class="message">${escapeHtml(row.message)}</td>
                <td>${row.terms ? '✓' : ''}</td>
            </tr>`
        )
        .join('');

    const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tagom — Đăng ký (${rows.length})</title>
<style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #f6f7f5; color: #1c1c1c; }
    header { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    h1 { font-size: 20px; margin: 0; }
    .count { color: #666; font-size: 14px; }
    a.export { margin-left: auto; background: #699d36; color: #fff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; }
    .scroll { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { background: #fafafa; font-weight: 600; white-space: nowrap; position: sticky; top: 0; }
    tr:hover td { background: #fcfdfb; }
    .nowrap { white-space: nowrap; }
    .message { max-width: 380px; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 12px; white-space: nowrap; background: #eee; }
    .tag-question { background: #fde8d4; }
    .tag-order { background: #d9f0cd; }
    .tag-subscribe { background: #dce8f7; }
    .empty { padding: 40px; text-align: center; color: #888; }
</style>
</head>
<body>
<header>
    <h1>Đăng ký từ website</h1>
    <span class="count">${rows.length} bản ghi</span>
    <a class="export" href="/admin/export.csv">Tải CSV</a>
</header>
<div class="scroll">
${rows.length === 0
            ? '<p class="empty">Chưa có bản ghi nào.</p>'
            : `<table>
    <thead>
        <tr>
            <th>#</th><th>Thời gian</th><th>Biểu mẫu</th><th>Tên</th>
            <th>Điện thoại</th><th>Email</th><th>Số lượng</th><th>Nội dung</th><th>Đồng ý</th>
        </tr>
    </thead>
    <tbody>${body}
    </tbody>
</table>`}
</div>
</body>
</html>`;

    res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(html);
}

// ── GET /admin/export.csv ──────────────────────────────────────────────────
async function exportCsv(res) {
    const cell = (value) => {
        const text = value === null || value === undefined ? '' : String(value);
        return '"' + text.replace(/"/g, '""') + '"';
    };

    const lines = [
        ['id', 'thoi_gian', 'bieu_mau', 'ten', 'dien_thoai', 'email', 'so_luong', 'noi_dung', 'dong_y'].join(','),
    ];

    const { rows } = await pool.query(SELECT_ALL_SQL);

    for (const row of rows) {
        lines.push(
            [
                row.id,
                row.created_at.toISOString(),
                FORM_LABELS[row.form] || row.form,
                row.name,
                row.phone,
                row.email,
                row.quantity,
                row.message,
                row.terms ? 1 : 0,
            ]
                .map(cell)
                .join(',')
        );
    }

    // BOM so Excel opens the Vietnamese text as UTF-8.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tagom-submissions.csv"',
        'Content-Length': Buffer.byteLength(csv),
    });
    res.end(csv);
}

// ── Static files ───────────────────────────────────────────────────────────
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
}

function adminFailed(res, err) {
    console.error('Admin query failed:', err.message);
    if (res.headersSent) return res.end();
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Không đọc được dữ liệu. Kiểm tra kết nối cơ sở dữ liệu.');
}

function serveStatic(res, urlPath) {
    let relative;
    try {
        relative = decodeURIComponent(urlPath);
    } catch {
        return notFound(res);
    }
    if (relative.endsWith('/')) relative += 'index.html';

    // The app root is also the web root, so the server's own files and any
    // dotfile must be refused explicitly.
    const lower = relative.toLowerCase();
    if (BLOCKED.includes(lower) || BLOCKED_PREFIXES.some((p) => lower.startsWith(p))) return notFound(res);
    if (relative.split('/').some((segment) => segment.startsWith('.'))) return notFound(res);

    // Resolving first and checking the prefix after is what blocks `..`
    // escapes out of the web root.
    const full = path.resolve(WEB_ROOT, '.' + relative);
    if (full !== WEB_ROOT && !full.startsWith(WEB_ROOT + path.sep)) return notFound(res);

    fs.stat(full, (err, stats) => {
        if (err || !stats.isFile()) return notFound(res);
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
            'Content-Length': stats.size,
        });
        fs.createReadStream(full).pipe(res);
    });
}

// ── Router ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (req.method === 'POST' && urlPath === '/api/submit') {
        handleSubmit(req, res).catch(() => sendJson(res, 400, { ok: false, error: 'Dữ liệu không hợp lệ.' }));
        return;
    }

    if (urlPath === '/admin' || urlPath === '/admin/') {
        if (requireAuth(req, res)) renderAdmin(res).catch((err) => adminFailed(res, err));
        return;
    }

    if (urlPath === '/admin/export.csv') {
        if (requireAuth(req, res)) exportCsv(res).catch((err) => adminFailed(res, err));
        return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);

    serveStatic(res, urlPath);
});

// ── Startup ────────────────────────────────────────────────────────────────
// Create the table before accepting traffic, so the first visitor never races
// against a missing schema.
async function start() {
    await pool.query(CREATE_TABLE_SQL);

    server.listen(PORT, () => {
        const target = DATABASE_URL
            ? 'DATABASE_URL'
            : `${process.env.PGDATABASE} on ${process.env.PGHOST || 'localhost'}`;
        console.log(`Site   http://localhost:${PORT}/`);
        console.log(`Admin  http://localhost:${PORT}/admin  (user: ${ADMIN_USER})`);
        console.log(`DB     ${target}`);
    });
}

start().catch((err) => {
    console.error('Cannot reach the database:', err.message);
    console.error('Check PGUSER / PGPASSWORD / PGDATABASE (or DATABASE_URL) in the app environment,');
    console.error('and that the cPanel user has been granted access to the database.');
    process.exit(1);
});
