# Project Context: RS232 Digital Scale → Mobile App

## Goal
Read weight data from a digital weighing indicator (RS232 output) using an ESP32,
then expose that weight to a mobile/web app in real time over BLE (and possibly
WiFi later). The app displays live weight when an object is placed on the scale.

## Hardware
- **MCU**: ESP32 DevKitC (ESP32-WROOM-32 module, 30-pin DevKit V1 layout, CP2102
  USB-to-serial chip for flashing).
- **Level shifter**: RS232 ↔ TTL module (MAX3232-based) wired to ESP32 UART2.
  - ESP32 `TX2` (GPIO17) → module `RXD`
  - ESP32 `RX2` (GPIO16) → module `TXD`
  - Shared `GND`
  - Module's DB9 side connects to the scale's RS232 port.
- **Scale**: Weighing indicator, model per `USERMANUAL-MK231OIML180416.md`.
  - DB9 pinout: PIN2 = TXD, PIN3 = RXD, PIN5 = GND.
  - Baud rate: configurable (1200/2400/4800/9600), **default 9600** (param `C19=3`).
  - Frame format: 8-N-1 (standard default, not explicitly stated in manual — verify
    on first real test).

## Confirmed Scale Output Protocol
Continuous ASCII line sent once per reading, terminated `\r\n`:

```
S1,S2,S3Data S4\r\n
```

Example: `ST,GS,+0012.5 kg\r\n`

| Field | Meaning | Values |
|---|---|---|
| S1 | Weight status | `ST` = stable, `US` = unstable, `OL` = overload |
| S2 | Weight mode | `GS` = gross, `NT` = net |
| S3 | Sign | `+` or `-` |
| Data | Weight value | includes decimal point |
| S4 | Unit | `kg` or `lb` |

The scale also accepts single-ASCII-character commands sent to it over the same
line (only needed if we switch from continuous mode to on-demand polling):

| Command | Function |
|---|---|
| `T` | Tare off — save and clear tare |
| `Z` | Zero the gross weight |
| `P` | Print the weight |
| `R` | Read gross/net weight (request one reading) |

## Development Status
- ESP32 board is in hand. RS232-to-TTL module and real scale have **not** arrived
  yet — firmware must be developed and tested first against **simulated/fake
  weight values**, then switched to real UART parsing once hardware arrives.
- Toolchain: **Arduino CLI** (not the Arduino IDE GUI). Board package
  `esp32:esp32` should already be installed via:
  ```
  arduino-cli core update-index
  arduino-cli core install esp32:esp32
  ```
- Target board FQBN: `esp32:esp32:esp32`

## Planned Architecture
```
Scale (RS232) → MAX3232 module → ESP32 UART2 → parse ASCII line
  → WiFi (WebSocket server on ESP32) → mobile/web app (Angular/Ionic)
```
WiFi + WebSocket was chosen over BLE for the first pass: simpler, uniform client
code across web/iOS/Android (no native BLE plugin, no Safari restrictions, no
Android BLE-scan location-permission requirement), and easy to debug directly
with a browser tab or Postman before any app code exists. BLE remains a fallback
option later if the deployment location can't guarantee reliable WiFi. WiFi/MQTT
(possibly via AWS IoT Core) may be added later if the scale needs to report to a
backend rather than just a phone.

## Client App Stack
- Primary stack: **Angular** (web) and **Ionic** (mobile wrapper, Capacitor)
  — developer is also comfortable with Flutter and plain HTML/JS if a quick
  standalone test page is faster for validation.
- Client connects to the ESP32's WebSocket server using the standard
  `WebSocket` API — identical code on web, Ionic web view, and (via
  `web_socket_channel`) Flutter. No native plugin required.
- ESP32 will run in WiFi **station mode** (joins the existing local network) so
  it's reachable at a normal LAN IP; if that's inconvenient later, **AP mode**
  (ESP32 hosts its own WiFi network) is a fallback for a fully offline setup.

## Developer Background
Senior fullstack .NET developer, also proficient in Angular, Ionic, Flutter, and
HTML/CSS/JS, with AWS cloud experience. Prefers concise, direct communication and
minimal, functional code comments.

## Immediate Next Step
Build and flash ESP32 firmware that:
1. Connects to local WiFi (station mode) and starts a WebSocket server.
2. Pushes **simulated** weight values (matching the real data shape: weight,
   stable/unstable, unit) to any connected WebSocket client on a timer, since
   real hardware isn't connected yet.
3. Compiles and uploads cleanly via `arduino-cli`.
4. Is structured so the simulated-weight line can be swapped for real UART2
   parsing (using the protocol above) with minimal changes once the RS232
   module and scale arrive.
