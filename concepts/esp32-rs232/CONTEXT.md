# Project Context: RS232 Digital Scale → Mobile App

## Goal
Read weight data from a digital weighing indicator (RS232 output) using an ESP32,
then expose that weight to a mobile/web app in real time over WiFi. The app
displays live weight when an object is placed on the scale.

## IMPORTANT: scale model correction
An earlier version of this project was based on a different scale's manual
(model "MK231"). That model is **not** what's actually being used and its
protocol details (different string format, different DB9 pin usage) should be
**discarded**. The real scale in use, and its verified protocol, are below.

## Hardware
- **MCU**: ESP32 DevKitC (ESP32-WROOM-32 module, 30-pin DevKit V1 layout, CP2102
  USB-to-serial chip for flashing).
- **Level shifter**: RS232 ↔ TTL module (MAX3232-based), 3V–5V DC operating
  range (safe to power directly from ESP32 3.3V). Module's DB9 connector is
  **female**.
- **Scale**: **DIGI/Teraoka DS-166SS** (uses the same console/protocol family as
  the DI-166SS — confirmed via manufacturer documentation, which states the
  DI-166/DI-166SS console manual also covers the DS-166 and DS-166SS models).
  - Console DB9 port is **male**.
  - **Only 2 of the 5 possible signal pins are used** for reading scale output:
    - **PIN3 = TXD** (scale's outgoing data — this is what we read)
    - **PIN5 = GND**
    - PIN2 (RXD) is for sending commands *to* the scale (tare/zero/print
      requests) — not used, since we only need to passively read the
      continuous output stream.
    - RTS/CTS (pins 7/8 on some variants, or pins 2/4 on the 5-pin Bulgin
      cable variant) exist on this console family but are **not needed and
      not wired** for this passive-read use case.
  - **Confirmed working wiring**: scale DB9 pin 3 → MAX3232 DB9 pin 3, scale
    DB9 pin 5 → MAX3232 DB9 pin 5. No adapter/gender-changer needed since
    scale (male) plugs directly into MAX3232 module (female).

## ESP32 ↔ MAX3232 wiring (TTL side) — confirmed working
This module's TTL pins are labeled **host-side**, so wiring is **STRAIGHT, not
crossed** (RXD→RX, TXD→TX). Getting this backwards yields a meaningless
`<00><FF>` toggle on the RX pin.
| MAX3232 module pin | ESP32 pin | Note |
|---|---|---|
| RXD | RX2 (GPIO16) | straight |
| TXD | TX2 (GPIO17) | straight |
| GND | GND | |
| VCC | 3.3V | |

For passive reading only the **RXD → GPIO16** wire matters (we never transmit
to the scale).

`Serial2.begin(9600, SERIAL_8N1, 16, 17); // RX=16, TX=17`

## CONFIRMED Scale Output Protocol (captured via USB-to-RS232 + terminal,
## real hardware, real data — not vendor-described, actually verified)

Continuous ASCII line sent automatically (no request/print command needed),
terminated `\r\n`:

```
S1,S2,S3Data unit
```

Real captured examples:
```
ST,GS,+   0.00kg
US,GS,+  13.88kg
ST,GS,+  13.05kg
```

| Field | Meaning | Values |
|---|---|---|
| S1 | Weight status | `ST` = stable, `US` = unstable (still settling) |
| S2 | Weight mode | `GS` = gross (only mode observed so far) |
| S3 | Sign | `+` (only sign observed so far; presumably `-` for negative) |
| Data | Weight value | **fixed-width, space-padded, right-aligned**, always 2 decimal places, e.g. `   0.00`, `  13.88` |
| unit | Unit | `kg` — **directly concatenated to the number, no separating comma or space** |

## Confirmed working parsing logic (Arduino/C++)
```cpp
void loop() {
  if (Serial2.available()) {
    String line = Serial2.readStringUntil('\n');
    line.trim();

    int comma1 = line.indexOf(',');
    int comma2 = line.indexOf(',', comma1 + 1);

    String status = line.substring(0, comma1);          // "ST" or "US"
    String mode   = line.substring(comma1 + 1, comma2);  // "GS"
    String rest   = line.substring(comma2 + 1);          // "+   13.88kg"

    char sign = rest.charAt(0);
    int kgIndex = rest.indexOf("kg");
    String weightStr = rest.substring(1, kgIndex);
    weightStr.trim();
    float weight = weightStr.toFloat();
    if (sign == '-') weight = -weight;

    bool isStable = (status == "ST");

    // push weight + isStable to the app here
  }
}
```
This has been validated against real captured serial output showing a full
weigh-cycle (0 → rising unstable → stabilizing ~13kg → fluctuating → settling
~8.5kg → back to stable 0), so the parsing logic above is trustworthy — not
speculative.

## Development Status
- ESP32 board, MAX3232 module, and the real DS-166SS scale are all in hand and
  wired together — **confirmed working**, real data has been captured directly
  from the scale via a USB-to-RS232 adapter + PC terminal program (PuTTY/
  RealTerm), independent of the ESP32, to validate the protocol before writing
  firmware against it.
- ESP32 UART2 wiring to the MAX3232 module has also been debugged and
  confirmed (an earlier floating-GPIO16 issue from a loose/incorrect jumper
  connection was found and fixed).
- **Not yet done**: wiring the confirmed-working UART2 parsing logic (above)
  into the ESP32 firmware itself, and testing Serial2 reading live from the
  scale through the MAX3232 (previous testing of real data was done via a
  separate USB-to-RS232 dongle direct to a laptop, not yet through the ESP32).
- Toolchain: **Arduino CLI** (not the Arduino IDE GUI). Board package
  `esp32:esp32` should already be installed via:
  ```
  arduino-cli core update-index
  arduino-cli core install esp32:esp32
  ```
- Target board FQBN: `esp32:esp32:esp32`
- A previous Claude Code session already built ESP32 WiFi + WebSocket
  firmware using **simulated** weight data (fake `getSimulatedReading()`
  function). That part is believed working. The next step is replacing the
  simulated data source with the real UART2 parsing logic above.

## Planned Architecture
```
DS-166SS scale (RS232) → MAX3232 module → ESP32 UART2 (parses real protocol above)
  → WiFi (WebSocket server on ESP32) → mobile/web app (Angular/Ionic)
```
WiFi + WebSocket was chosen over BLE: simpler, uniform client code across
web/iOS/Android (no native BLE plugin, no Safari restrictions, no Android
BLE-scan location-permission requirement), and easy to debug directly with a
browser tab or Postman before any app code exists.

An RS232-to-Ethernet device server (Moxa NPort 5110) was considered and
explicitly rejected — cost (~$200-300) is significant overkill for this single-
scale use case versus the ESP32+MAX3232 approach (~$10 total), given the
protocol is now fully understood and verified.

## Client App Stack
- Primary stack: **Angular** (web) and **Ionic** (mobile wrapper, Capacitor)
  — developer is also comfortable with Flutter and plain HTML/JS if a quick
  standalone test page is faster for validation.
- Client connects to the ESP32's WebSocket server using the standard
  `WebSocket` API — identical code on web, Ionic web view, and (via
  `web_socket_channel`) Flutter. No native plugin required.
- ESP32 runs in WiFi **station mode** (joins the existing local network).

## Developer Background
Senior fullstack .NET developer, also proficient in Angular, Ionic, Flutter, and
HTML/CSS/JS, with AWS cloud experience. Prefers concise, direct communication and
minimal, functional code comments.

## Immediate Next Step
Update the existing ESP32 firmware (currently using simulated weight data) to:
1. Replace `getSimulatedReading()` with real `Serial2` reading + the confirmed
   parsing logic above.
2. Keep sending the same JSON shape over the existing WebSocket server
   (`{"weight": ..., "stable": ..., "unit": "kg"}`) so the client side doesn't
   need to change at all — only the data source changes.
3. Compile and upload via `arduino-cli`, then verify with `arduino-cli monitor`
   that real scale readings (not fake ones) are now being logged and pushed
   over the WebSocket, matching what was captured via the standalone USB-to-
   RS232 test.
