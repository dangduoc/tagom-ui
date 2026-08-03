# Handoff: Tagom Community Recycling Station — Tablet/Mobile App

## Overview
A self-service kiosk web app for a community recycling collection station. A person
brings recyclables, identifies themselves (QR / face / anonymous), weighs several
material categories one after another, and finishes on a gratitude summary that saves
to their account. Target: wall/stand-mounted **tablet** (landscape, 1280×800), with a
responsive **mobile** layout (portrait, ~402×874). Vietnamese-first, bilingual VN/EN.

The intended production stack is **Angular** (the user's choice). A full,
implementation-oriented spec is in **`context.md`** — read it alongside this README;
it contains the state machine, per-screen behaviour, data model, and Angular structure.

## About the Design Files
The files under `prototype/` are a **design reference created in HTML** — a working
prototype showing the intended look, flow, and interactions. **They are not production
code to copy.** The task is to **recreate these designs in Angular** using the project's
established patterns (components, services, signals/RxJS, i18n), not to embed the HTML.
`Station Tablet.standalone.html` is a self-contained build — open it in any browser and
use the dark **"Screens"** dock pinned at the bottom to jump to every screen and state
(idle, identify, confirmed, unknown, register, profile, category, weigh, summary, plus
help/keypad/no-face overlays, the three error banners, and a Tablet⇄Mobile toggle).
**That dev dock and the device toggle are prototype scaffolding — do not port them;**
production uses real detection events and CSS media queries.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, layout, and interaction states
are intentional. Recreate the UI faithfully using the Tagom design tokens
(`design-tokens/`). The weigh screen's settling→stable→locked transition and the
gratitude summary are the emotional centre — match them precisely.

## Screens / Views
Every screen is documented in detail in **`context.md` §5** (layout, components, copy,
routes) and **§3** (inventory). Summary:

| Screen | Purpose |
|---|---|
| **Idle / attract** | Two start CTAs (Weigh by type / Quick weigh) + one-line explanation. |
| **Identify** | Live camera detecting QR + face at once; "can't scan?" keypad; Skip; "camera not recognising you?" dialog. |
| **Identity confirmed** | Greeting by name, confirm masked phone, link to profile. |
| **Unknown** | App-download QR + Register-here + continue-anonymously (welcoming, not punished). |
| **Register** | Main info (name/phone required; age/citizen ID/address optional) + optional 5-image facial capture → embedding vector. |
| **Profile** | View/edit account info; weigh-session history + lifetime total. |
| **Pick category** *(sorted mode)* | 6 colour-coded material tiles + persistent session rail. |
| **Weigh** *(hero)* | Dominant live weight with 3 visually distinct phases; + rail. |
| **Session summary** | Itemised list, session total, personal + community cumulative totals, app pointer. Gratitude tone. |

Two **session modes**: *sorted* (with category picker) and *quick* (skip categories,
everything weighed as one "Chưa phân loại / Unsorted" bag). See `context.md` §3–§4.

## Interactions & Behavior
Full flow diagram and per-route triggers are in **`context.md` §4** and **§5**. The
**weigh phases** (`context.md` §5.8):
- **settling** — big muted grey-green number, jittering; amber "Settling…" chip.
- **stable** — number snaps to solid green; "keep it still" + ~2s hold progress bar.
- **locked** — panel flips to a green field, lime number + check badge, "Recorded".
  This flip is the payoff; keep it unmistakable.

Overlays and error states (help / keypad / no-face / scale-offline / network-offline /
camera-unavailable) are specified in **`context.md` §6**. **Gotchas that are easy to get
wrong** (auto-detect timer cancellation, don't lock inside a state-updater, no timed undo,
shared rail, quick-mode return paths, anonymous is first-class) are in **§8** — read these.

Responsive: real media queries at ~600px for the mobile layout (rail docks to a compact
bottom bar; two-column screens stack; category grid → 2 columns; header buttons → icons).

## State Management
The app is a **single state machine** (not URL-routed). Enums, transitions, and the
`enter()` router are in **`context.md` §3, §4, §7**. Key state: `screen`, `overlay`,
`error`, `mode`, `phase`, `lang`, `identity` (Person | 'anon' | null), `items[]`,
`form`, `faceCount`. Model with a `StationService` (signals or a small store) plus
`scale.service` and `identify.service` wrapping hardware/detection.

## Design Tokens
The authoritative Tagom tokens are in **`design-tokens/`** (`colors.css`,
`typography.css`, `fonts.css`, `spacing.css`, `radii.css`, `shadows.css`, `motion.css`).
Import them into Angular global styles and use the CSS variables — **do not hardcode**.
Headline signature: Anek Latin with `font-variation-settings: 'wdth' 125`. Brand is
two-colour: lime `#dee84e` (`--tagom-lime`) + deep green `#004d43` (`--tagom-green`),
light theme (lime field / green ink).

**Category colours** are a deliberate exception to the two-colour brand (materials must
be distinguishable). Use these exact values consistently across tile, rail dot, weigh
chip, and summary (also in `context.md` §7):
`Nhựa/Plastic #2f6f92` · `Giấy/Paper #c07d1e` · `Kim loại/Metal #5f7078` ·
`Thủy tinh/Glass #2c7a7b` · `Vải/Fabric #a85c4b` · `Chưa phân loại/Unsorted #6b6f52`.

## Assets
- `assets/object.png` — telescope character illustration (idle screen). Tagom brand asset.
- `assets/aa.svg` — hand-drawn star / help mark. The one real Tagom iconographic motif.
- Other UI glyphs in the prototype are **Lucide-style stroke SVGs used as a substitution**
  (Tagom has no icon font) — keep or swap for hand-drawn marks later.
- **QR codes are procedurally-drawn placeholders** — replace with real generated QR
  (app-download link / account payload).
- Font: **Anek Latin** from Google Fonts (see `design-tokens/fonts.css`).

## Files
- `context.md` — **primary implementation spec** (flow, screens, state, data model, Angular structure). Start here.
- `prototype/Station Tablet.standalone.html` — self-contained, browsable prototype (visual source of truth; use the bottom dock to see all states).
- `design-tokens/*.css` — Tagom design tokens to import into the Angular app.
- `assets/` — brand illustration + star mark to bring across.
- `README.md` — this file.
