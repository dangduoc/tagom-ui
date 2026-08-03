# Tagom Recycling Station — Angular Implementation Context

Handoff spec for rebuilding the self-service tablet kiosk app (currently a working
HTML prototype in `Station Tablet.dc.html`) as an **Angular web app**. This document
describes the product, every screen, the state machine, the data model, and the
brand/styling rules. Build against this; the prototype is the visual source of truth.

---

## 1. What this is

A self-service web app on a wall/stand-mounted **tablet** at a community recycling
collection station. A person brings recyclables, identifies themselves (QR / face /
anonymous), weighs several categories one after another, and ends on a gratitude
summary that saves to their account.

**Non-negotiable product principles** (they shape every screen):

1. **Fully self-service.** Staff are nearby but hands-off. Assume the user got no
   instructions, may be elderly, may be first-time. Every screen must make the next
   action obvious with minimal reading. A low-key **"Cần trợ giúp? / Need help?"**
   affordance is reachable on every in-flow screen.
2. **No money, no points.** Free community initiative. Nothing is earned/redeemed.
   The summary carries the entire reward on **meaning**: the person's cumulative
   personal contribution + the station's community total, so a small amount visibly
   adds into something bigger. Tone = **gratitude, not receipt**.
3. **The weight readout is the emotional centre.** Large, confident, readable from
   two metres. The transition from *still settling* → *locked* must be unmistakable.
4. **Speed.** There may be a queue. Minimise taps, avoid modal interruptions.
5. **Vietnamese primary, English secondary.** Bilingual toggle, VN default. Design
   for longer strings than English.
6. **High contrast** for possible outdoor light. Large touch targets (≥44px, we use
   much larger) for dirty/gloved hands.

---

## 2. Target platforms

- **Tablet** (primary): landscape, design canvas **1280 × 800**.
- **Mobile** (secondary): portrait, ~**402 × 874**. Same app, responsive. The
  prototype implements this with an override CSS layer keyed on a `data-device`
  attribute; in Angular, drive it with real CSS media queries / breakpoints
  (`@media (max-width: 600px)`), not a manual toggle.

---

## 3. Screen inventory & flow

The app is a **single-page state machine**, not a URL-routed multi-page site. One
`screen` value decides what's shown; overlays (`help`, `keypad`, `noface`) and error
banners layer on top. In Angular, model this with a **state service + `@if` switching**
inside a shell component (or child routes with a guard — but the prototype is a pure
state switch and that maps most cleanly).

### Screens (the `screen` enum)
| key | name | purpose |
|---|---|---|
| `idle` | Idle / attract | Two start CTAs + one-line explanation of the station. |
| `identify` | Identify | Live camera detecting QR + face at once; "can't scan?" keypad; Skip. |
| `confirmed` | Identity confirmed | Greeting by name, confirm masked phone, link to profile. |
| `unknown` | Unknown person | App-download QR + Register-here + continue-anonymously. |
| `register` | Register | Create account: main info + optional 5-image facial capture. |
| `profile` | Profile | View/edit info; weigh-session history + lifetime total. |
| `category` | Pick category | Colour-coded material tiles + persistent session rail. |
| `weigh` | Weigh (hero) | Dominant live weight; settling→stable→locked; + rail. |
| `summary` | Session summary | Itemised list, session total, personal + community totals, app pointer. |

### Overlays (the `overlay` enum: `null | 'help' | 'keypad' | 'noface'`)
- **help** — two states: *not called* (call-staff / dismiss) and *called* (staff-notified confirmation).
- **keypad** — numeric phone entry (fallback identification).
- **noface** — face-not-recognised dialog with 3 routes (see §5).

### Error banner (the `error` enum: `null | 'scale' | 'network' | 'camera'`)
Modal card with title/sub + Call-staff / Dismiss. Content per kind in §6.

### Two session modes (the `mode` enum: `'sorted' | 'quick'`)
- **sorted** — the full flow *with* the category picker. "Weigh another" returns to the tile grid.
- **quick** — skip the category step; everything weighed as one **Chưa phân loại /
  Unsorted** bag. "Weigh another" loops straight back into another unsorted weigh.

Mode is chosen on the idle screen and remembered through identify/skip/register.

---

## 4. Flow diagram (happy paths)

```
idle
 ├─(Cân theo loại / Weigh by type)──► mode=sorted ─► identify
 └─(Cân nhanh / Quick weigh)─────────► mode=quick  ─► identify

identify ─(auto-detect ~2.8s)─► confirmed        (known face/QR)
         ─(Không quét được → keypad → Tìm)─► enter()
         ─(Bỏ qua / Skip)─► identity=anon ─► enter()
         ─(Camera không nhận ra → noface dialog)

confirmed ─(Đúng rồi / Yes)─► enter()
          ─(Không phải tôi / Not me)─► unknown
          ─(Xem hồ sơ / View profile)─► profile

unknown ─(Đăng ký tại đây / Register here)─► register
        ─(Tiếp tục không cần tài khoản)─► identity=anon ─► enter()

register ─(submit, name+valid phone)─► identity=account ─► enter()

enter():  mode=quick → weigh (category=chuaphanloai)
          mode=sorted → category

category ─(tap a tile)─► weigh
weigh (settling → stable → locked) ─► item added
      ├─(Cân lại / Reweigh)──────────► re-run scale
      ├─(Cân loại khác / Weigh another)► pickAgain() (category or new unsorted weigh)
      └─(Xong / Finish)──────────────► summary

summary ─(Hoàn tất / Done)─► reset() ─► idle
```

`enter()` is the single router that respects `mode`. Reuse this concept in Angular
(a `StationService.enter()` method).

---

## 5. Screen-by-screen spec

### 5.1 Idle / attract
- Corner-pinned `tagom` wordmark (top-left), VN/EN pill toggle (top-right), help link (bottom-right).
- Left: uppercase brand tag, wide H1 (`font-variation-settings: 'wdth' 125`), one-line sub, **two stacked CTAs**:
  - Primary (green pill/card): **Cân theo loại / Weigh by type** → `startSorted()`.
  - Secondary (white bordered): **Cân nhanh / Quick weigh** → `startQuick()`.
  - Camera-use reassurance line under the CTAs.
- Right: `assets/object.png` telescope illustration (hide on mobile), gentle float animation.

### 5.2 Identify
- Big camera viewport (dark green field, animated scan line, corner brackets, blinking "Đang tìm…/Looking…" chip). This is a **simulated** camera in the prototype — wire a real `getUserMedia` stream + QR/face detection in Angular.
- On mount, a **2.8s auto-detect timer** simulates a successful match → `confirmed`. Replace with real detection events.
- Right column: title, sub, and fallbacks:
  - **Không quét được? Nhập số điện thoại / Can't scan? Enter phone number** → opens keypad (cancels auto-detect).
  - **Bỏ qua, cân ẩn danh / Skip, weigh anonymously** → `skip()`.
  - **Camera không nhận ra bạn? / Camera not recognising you?** link → `noface` dialog.
- **Critical:** opening any overlay here must **cancel the auto-detect timer** or the screen jumps away underneath the user (this was a real bug — see §8).

### 5.3 Identity confirmed
- Centered white card: avatar, "Chào bạn / Hello," + **name**, masked phone chip, "Đúng là bạn chứ? / Is this you?".
- **Đúng rồi / Yes** → `start()` (routes via `enter()`), **Không phải tôi / Not me** → `unknown`.
- **Xem hồ sơ của tôi / View my profile** link → `profile`.

### 5.4 Unknown / onboarding
- Left: welcome H1 + sub, two actions: **Đăng ký tại đây / Register here** (green) → `register`; **Tiếp tục không cần tài khoản / Continue without an account** (bordered) → `skip()`. Skipping must feel welcoming, not punished — reassurance line beneath.
- Right: white card with app-download QR (App Store / Google Play).

### 5.5 Register
Two cards side-by-side (stack on mobile):
- **Thông tin chính / Main information**
  - Full name — **required**
  - Phone number — **required** (valid = ≥8 digits)
  - Age — optional
  - Citizen ID — optional
  - Address: City/Province · Ward · Street — optional
  - Fields are 60px tall, big type.
- **Dữ liệu khuôn mặt / Facial data** — marked *optional but highly recommended*
  - Camera viewport with oval face guide.
  - **Capture photo** button fills a **5-slot** progress row one at a time (`faceCount` 0→5).
  - When all 5 captured: "Đã đủ 5 ảnh / All 5 captured" + Retake.
  - The 5 images are meant to be turned into a **face-embedding vector** server-side.
- Footer bar: required-field note; **Hủy / Cancel** (→ back to unknown); **Đăng ký / Register** (disabled/greyed until name + valid phone) → `submitRegister()`.

### 5.6 Profile
- Left column (white): avatar + name + phone; **view mode** = labelled read-only rows (name, phone, age, citizen ID, address) + **Chỉnh sửa / Edit**; **edit mode** = same fields as inputs + Cancel / Save (`pform` is the edit buffer; Save commits to `profile`).
- Right column: **Tổng đã đóng góp / Total contributed** big green stat card; sessions count + member-since; **Lịch sử cân / Weigh history** = scrollable list of past sessions, each with date, session total, and per-category chips (colour dot + name + kg).
- Reachable from: confirmed screen link, tapping the identity header in the session rail, (and the prototype's dev dock). Only for account users, not `anon`.

### 5.7 Pick category  *(sorted mode only)*
- Title + sub; **grid of tiles** (3×2 on tablet, 2-col on mobile). Six tiles, each a
  solid category colour, hand-ish line icon, big label. Tapping → `pick(key)` → weigh.
- The **persistent session rail** is docked on the right (see §5.9).

### 5.8 Weigh  *(the hero)*
- Top strip: category colour chip + name + "Đang cân / Weighing".
- **Dominant number panel** with three visually distinct phases (`phase`):
  - `settling` — big number in **muted grey-green**, jittering; amber "Đang ổn định… / Settling…" chip with animated dots. Number ~172px.
  - `stable` — number snaps to **solid green**; "Giữ yên vật trên cân / Keep it still" + a **hold progress bar** filling over ~2s.
  - `locked` — the **entire panel flips to a green field**, lime number (~150px), a lime check-circle badge, and "Đã ghi / Recorded · {category}". **This flip is the emotional payoff — keep it unmistakable.**
- Action row (only when `locked`): **Cân lại / Reweigh**, **Cân loại khác / Weigh another**, **Xong / Finish**. (There is intentionally **no** timed undo button here — deletion happens per-row in the rail; see §8.)
- While not locked: a subtle "Đã kết nối cân / Scale connected" indicator + Reweigh.
- The persistent rail is docked on the right.

### 5.9 Persistent session rail  *(shared by category + weigh)*
This is one component reused on both screens — keep it identical and in the same place.
- **Identity header** (tappable → profile): avatar, name, masked phone.
- **Phiên hiện tại / This session** list: each item = colour dot + category name + weight
  + a **trash button** that deletes just that row and recomputes the total.
- Empty state when no items.
- **Total** footer: big tabular-nums kg + a **Xong / Finish** button (shown once there's ≥1 item).
- **Mobile:** the rail docks to the **bottom** as a compact bar — identity + list collapse, total + Finish stay.

### 5.10 Session summary
- Left: "Cảm ơn bạn! / Thank you!" + save line ("Đã lưu cho {name}" or anonymous notice),
  itemised list (colour, name, kg), and **Phiên này / This visit** total.
- Right (green panel): **Bạn đã góp / You've brought** = personal cumulative total (big),
  "+{session} kg this visit"; divider; **Cả trạm đã gom / This station has gathered** =
  community total with a filling bar and a "every weigh joins the total" note; an app-pointer
  card with a small QR; **Hoàn tất / Done** → `reset()`.
- Anonymous sessions: personal total is not attributed (base 0), save line says not-saved.

---

## 6. Overlays & errors — exact behaviour

**Help** (`overlay='help'`)
- Not-called: star mark, "Cần nhân viên hỗ trợ? / Need a staff member?", **Gọi nhân viên đến / Call staff over** → sets `helpCalled=true`; **Tôi tự làm được / I'm okay** → close.
- Called: check badge, "Đã báo nhân viên / Staff notified", Dismiss.

**Keypad** (`overlay='keypad'`)
- Numeric 0-9 + delete, display of entered digits (max 11), **Tìm / Find** → `start()` (looks up account, routes via `enter()`), Dismiss.

**No-face dialog** (`overlay='noface'`) — face-not-recognised. Title:
*"Nhận diện khuôn mặt không thành công. Bạn đã từng đăng ký tài khoản tại TAGOM chưa?"*
- **Chưa, đây là lần đầu / No, first time** → `unknown` (onboarding).
- **Đã có, thử lại lần nữa / Yes, try again** → back to `identify` (re-scan).
- **Đã có, nhập số điện thoại cho dễ / Yes, enter phone** → `keypad`.

**Errors** (`error`):
| kind | title (VN) | note |
|---|---|---|
| `scale` | Mất kết nối với cân | Scale not responding → call staff. Danger accent. |
| `network` | Đang ngoại tuyến | Weighing still works; data saves when back online. Warning accent. |
| `camera` | Camera không khả dụng | Can still use phone number or skip. Info accent. |
Each: Call-staff + Dismiss.

---

## 7. Data model

```ts
type Lang = 'vn' | 'en';
type Screen = 'idle'|'identify'|'confirmed'|'unknown'|'register'|'profile'|'category'|'weigh'|'summary';
type Overlay = null | 'help' | 'keypad' | 'noface';
type ErrorKind = null | 'scale' | 'network' | 'camera';
type Mode = 'sorted' | 'quick';
type Phase = 'idle' | 'settling' | 'stable' | 'locked';

type CategoryKey = 'nhua'|'giay'|'kimloai'|'thuytinh'|'vai'|'chuaphanloai';

interface Category { key: CategoryKey; color: string; vn: string; en: string; }

// Category table (colours are deliberate, not from the 2-colour brand — see §9):
const CATEGORIES: Record<CategoryKey, {color:string; vn:string; en:string}> = {
  nhua:         { color:'#2f6f92', vn:'Nhựa',           en:'Plastic'  }, // blue
  giay:         { color:'#c07d1e', vn:'Giấy',           en:'Paper'    }, // amber
  kimloai:      { color:'#5f7078', vn:'Kim loại',       en:'Metal'    }, // steel
  thuytinh:     { color:'#2c7a7b', vn:'Thủy tinh',      en:'Glass'    }, // teal
  vai:          { color:'#a85c4b', vn:'Vải',            en:'Fabric'   }, // clay
  chuaphanloai: { color:'#6b6f52', vn:'Chưa phân loại', en:'Unsorted' }, // olive
};

interface LineItem { id: number; key: CategoryKey; weight: number; } // weight in kg

interface Person {
  fullName: string; phone: string;      // phone stored masked for display: "090 ••• 47"
  age?: string; city?: string; ward?: string; address?: string; citizenId?: string;
}

interface WeighSession { date: string; items: LineItem[]; } // for history

// identity is: Person (account) | 'anon' (skipped) | null (not yet identified)
```

**Totals & seed constants** (prototype demo values — replace with real API data):
- `COMMUNITY_BASE = 12480.5` kg (station lifetime, before this session).
- `PERSONAL_BASE = 42.6` kg (returning depositor's prior total; `0` for anon).
- `personalTotal = (isAnon ? 0 : PERSONAL_BASE) + sessionTotal`
- `communityTotal = COMMUNITY_BASE + sessionTotal`
- `sessionTotal = sum(items.weight)`
- Weights display with **2 decimals** (`toFixed(2)`); big cumulative totals use locale
  grouping (`vi-VN` / `en-US`, 1 decimal).

---

## 8. Behaviours that are easy to get wrong (learned while building)

1. **Cancel the identify auto-detect timer** whenever an overlay opens (keypad, noface)
   or you leave `identify`. Otherwise the 2.8s timer fires and yanks the user to
   `confirmed` while they're mid-typing. Every navigation/overlay method in the
   prototype calls a `clearAll()` that clears the interval + timeouts first.
2. **The scale simulation must not lock from inside a state-updater.** Drive it from a
   `setInterval` with a local `tick` counter; call the lock (a separate state write)
   from the timer body, not nested inside another update. In Angular use RxJS
   (`interval(100)`) or a signal + `setInterval`, and run change detection appropriately.
3. **No timed undo on the weigh screen.** Undo/delete is per-row in the rail (trash
   button). Don't reintroduce a confirmation dialog — it interrupts the queue.
4. **The rail is one shared component** across category + weigh, pinned in the same
   place. Don't duplicate/diverge it.
5. **Quick mode** must skip category on *every* return path: initial entry, "weigh
   another", and undo all loop back into an unsorted weigh, never the tile grid.
6. **Anonymous is first-class.** `identity='anon'` must weigh normally; only the
   account-saving and personal-attribution differ. Profile is hidden for anon.

---

## 9. Brand / styling — Tagom Design System (binding)

Full tokens live in `_ds/tagom-design-system-64d8269f-dc5c-4aa1-a70b-63c45d4d94d8/`.
Copy the token CSS (`tokens/*.css`) into the Angular app's global styles and use the
CSS variables — **do not hardcode hexes** except the category colours below.

- **Two brand colours:** lime `#dee84e` (`--tagom-lime`) and deep green `#004d43`
  (`--tagom-green`). The app uses the **light theme**: lime field, green ink (brightest,
  most sunlight-legible). Surfaces are flat, one background colour each — **no gradients**.
- **Type:** Anek Latin only. Headings bold (700) with `font-variation-settings: 'wdth' 125`
  (the signature wide look). Tabular-nums for all weights/totals.
- **Shape:** full-pill CTAs (`--radius-pill`), soft 12–20px rounding on cards/inputs.
- **Shadows:** minimal, green-tinted — never grey/black ambient.
- **Motion:** buoyant, 120–320ms; signature 2px hover-lift on interactive elements.
- **Icons:** no icon font in the brand. The prototype uses inline Lucide-style stroke
  SVGs as a **substitution** — fine to keep, or swap for hand-drawn Tagom marks later.
  The star `assets/aa.svg` is the one real brand motif (used as the help mark).
- **Category colours are an intentional exception** to the two-colour brand: recyclable
  categories need to be instantly distinguishable, so each tile has its own natural,
  desaturated hue (see §7). Keep them consistent between the tile, the rail dot, the
  weigh chip, and the summary.
- **Copy voice:** warm, second-person ("bạn"), VN-first. Display headings can be wide/caps;
  buttons uppercase. Gratitude over transaction.

**Assets to copy into the Angular app:** `assets/object.png` (telescope character, idle),
`assets/aa.svg` (star/help mark). QR codes in the prototype are procedurally-drawn
placeholders — replace with real generated QR (app-download link / account payload).

---

## 10. Suggested Angular structure

> The prototype is a single stateful component. In Angular, split for maintainability
> but keep the **one-state-machine** model — don't over-engineer into deep routing.

```
src/app/
  core/
    station.service.ts     // the state machine: screen/overlay/error/mode/phase,
                           // identity, items, form, faceCount, totals. Signals or a
                           // small store. Exposes enter(), start(), skip(), pick(),
                           // reweigh(), removeItem(), gotoSummary(), reset(), etc.
    scale.service.ts       // weight stream: settling→stable→locked. Wraps real scale
                           // hardware (WebSocket/serial bridge) or the simulator.
    identify.service.ts    // camera + QR/face detection; emits match | no-match.
    i18n.ts                // VN/EN string tables (mirror the prototype's STR object).
    models.ts              // the types in §7.
  shell/
    station-shell.component.ts   // hosts current screen via @if/@switch + overlays.
  screens/
    idle/ identify/ confirmed/ unknown/ register/ profile/ category/ weigh/ summary/
  shared/
    session-rail/          // the persistent rail (category + weigh)
    weight-readout/        // the hero number with its 3 phases
    lang-toggle/ help-overlay/ keypad-overlay/ noface-dialog/ error-banner/
    qr-code/ category-tile/
```

- Keep all copy in `i18n.ts` keyed identically for VN/EN; bind `lang` from the service.
- `weight-readout` should take `phase` + `value` inputs and own the settling/stable/locked
  visual states so the flip stays consistent.
- Replace the prototype's simulated timers with `scale.service` and `identify.service`
  observables; the **UI states and transitions stay exactly as specified**.
- Responsive: real media queries at ~600px for the mobile layout described in §5.

---

## 11. Reference

`Station Tablet.dc.html` is the working prototype and the visual source of truth —
open it, use the dev **Screens** dock at the bottom to jump to any screen/state
(including the error and overlay states and the Tablet⇄Mobile toggle), and match it.
The dev dock and the `data-device` toggle are prototype scaffolding — **do not port them**;
production uses real detection events and CSS media queries.
