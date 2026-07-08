# 04 — The Angular scale page

Lives in the face-recognition app:
`concepts/face-recognition/frontend/src/app/scale/`

## Running the app

Angular 22 needs Node ≥ 22.22.3. Your system node is 20, so either use the
standalone copy that's already in the repo:

```powershell
cd concepts\face-recognition\frontend
$env:Path = "C:\Users\dangd\Documents\Code\tagom\.tools\node22;$env:Path"
npx ng serve
```

or make Node 22 your default once (in your own terminal, not scripted —
nvm-windows refuses to run non-interactively): `nvm install 22`, `nvm use 22`.

Then open `http://localhost:4200`, tab **Cân**. First connection triggers
Chrome's local-network permission prompt — Allow.

## The files

### `scale.service.ts` — WebSocket client (`ScaleService`)

State is exposed as **signals** (Angular's reactive primitives — think
observable properties that templates track automatically):

| Signal | Meaning |
|---|---|
| `status` | `'disconnected' \| 'connecting' \| 'connected'` |
| `reading` | Latest `{weight, stable, unit}`, or `null` when unknown/stale |
| `error` | Last connection error message, or `null` |

Behavior worth knowing before you edit it:

- **Auto-reconnect**: when the socket closes unexpectedly (ESP32 rebooted, WiFi
  blip), status goes to `'connecting'` and it retries every 2 s forever.
  `disconnect()` (the user clicking the button) stops that loop — the
  distinction is: user-initiated close detaches the `onclose` handler first.
- **Stale-reading guard**: if no frame arrives for 5 s while "connected",
  `reading` resets to `null` so the UI shows "waiting for data" instead of a
  frozen number that looks live. Every incoming frame re-arms this timer.
- **URL persistence**: the last-used URL is kept in `localStorage`
  (key `scale-ws-url`), because the ESP32's DHCP address changes now and then.

### `scale.page.ts` / `.html` / `.scss` — the UI

Thin component: an URL input, a Connect/Disconnect button, and a display that
switches on `scale.status()`:

- `connecting` → "Đang kết nối…"
- `connected` + reading → big weight number; amber + "Đang cân…" while
  `stable: false`, green + "ỔN ĐỊNH" when `stable: true`
- `connected` + no reading → "Đã kết nối — chờ dữ liệu…"

The page calls `scale.disconnect()` in `ngOnDestroy`, so leaving the tab drops
the socket. If you'd rather keep receiving while on other tabs (e.g. to show
weight in the tab bar), remove that line — the service is a root singleton and
will happily live on.

### Wiring into the app (what was touched)

- `app.routes.ts` — lazy route: `{ path: 'scale', loadComponent: ... }`
- `app.html` — third `<ion-tab-button tab="scale">` with label **Cân**
- `app.ts` — registered the `scale-outline` ionicon

## Changing things

| Want to… | Change |
|---|---|
| Different default URL | `DEFAULT_URL` in `scale.service.ts` (users can still override in the UI) |
| Different reconnect/stale timing | `RECONNECT_DELAY_MS` / `READING_TIMEOUT_MS` constants |
| New fields from the firmware (e.g. `mode`) | Extend `ScaleReading` interface here **and** the JSON in the firmware's `loop()` — the shapes must match |
| Use the weight elsewhere in the app | `inject(ScaleService)` anywhere; read `scale.reading()` in a template or `computed()` — it's a root-provided singleton |

## Production note

`ng build` output is static files served by nginx (see the app's Dockerfile).
The WebSocket connection goes **directly from the browser to the ESP32** — the
backend/nginx is not involved. That means the phone/PC running the app must be
on the same network as the ESP32 (or a network that routes to it).
