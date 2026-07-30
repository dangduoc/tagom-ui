# 05 — The real scale (DIGI/Teraoka DS-166SS)

> **Status: DONE and verified 2026-07-30.** The firmware ships with
> `USE_SIMULATED_SCALE 0` and the real parser below. This doc is now a
> reference for how it works / how to re-bring-up on new hardware.
>
> **Scale model:** DIGI/Teraoka **DS-166SS** (not the old "MK231" — that
> assumption was wrong and has been discarded).

## 1. Wire the hardware

**Power everything off first.**

This module's TTL pins are labeled **host-side**, so wire it **STRAIGHT
(not crossed)**: RX→RXD, TX→TXD.

```
ESP32 DevKitC          MAX3232 module           Scale (DB9)
GPIO16 (RX2)  ◄─────── RXD (TTL side)
GPIO17 (TX2)  ───────► TXD (TTL side)
GND           ───────  GND
3V3 or VIN*   ───────  VCC (check your module's rating)

MAX3232 DB9 side ────► scale's RS232 port
                       (DS-166SS: PIN3=TXD out, PIN5=GND — only these two used)
```

\* Most MAX3232 boards accept 3.3 V — use the ESP32's 3V3 pin. If yours is
5 V-only, use VIN (USB 5V), the MAX3232 chip still outputs safe RS232 levels
and its TTL side follows its VCC — prefer 3.3 V to be kind to the ESP32's
RX pin.

Only the **module RXD → GPIO16** wire actually matters for passive reading —
we never transmit to the scale. This module is labeled host-side, so it's
STRAIGHT: module **RXD** → GPIO16 (RX2). (Wiring it crossed gives a meaningless
`<00><FF>` toggle — that's how you know you're on the wrong pin.)

The DS-166SS console has a **male** DB9; it plugs straight into the MAX3232
module's **female** DB9. Only two pins are used: **pin 3 = TXD** (scale output,
what we read) and **pin 5 = GND**.

## 2. Scale config

The DS-166SS streams continuously at **9600 8N1** out of the box — no menu
change was needed to get the output below. If a unit is silent, check its
serial/print menu for a "continuous send" mode and 9600 baud.

## 3. Verify raw data before touching code

Flash a throwaway passthrough first — it forwards scale bytes to the USB
console. See `scale-probe/scale-probe.ino` (kept in the repo); the core is:

```cpp
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
}
void loop() {
  while (Serial2.available()) Serial.write(Serial2.read());
}
```

**VERIFIED real output** (space-padded, right-aligned, `kg` concatenated with
NO separating space or comma):

```
US,GS,+  13.87kg
ST,GS,+   0.17kg
```

- Clean lines → protocol confirmed, continue.
- **Scale-synchronised garbage** (correct `\r\n` cadence but mangled bytes,
  long `0x00` runs, idle stuck LOW) at *every* baud and *both* polarities →
  **bad ground / marginal RS232 levels into the MAX3232.** This actually
  happened during bring-up; re-seating the GND/DB9 connection fixed it. It is
  NOT a baud or code problem — don't chase software settings.
- Nothing at all → swap TXD/RXD, check GND continuity (ESP32 GND ↔ scale shell
  should read ~0 Ω), confirm the DB9 is the scale's RS232 port.
- `scale-probe/` also has a baud-scanner variant if you ever suspect the rate.

## 4. `getScaleReading()` — the real parser

The **verified** DS-166SS frame (captured from hardware — see CONTEXT.md):

```
S1,S2,S3<data><unit>\r\n   e.g.  "US,GS,+  13.87kg\r\n"
 │   │  │  │      └ unit: "kg" — concatenated, NO space/comma before it
 │   │  │  └ weight: space-padded, right-aligned, always 2 decimals
 │   │  └ sign: '+' | '-'
 │   └ mode: GS=gross (only mode seen)
 └ status: ST=stable | US=unstable | OL=overload
```

> ⚠️ **The old MK231 format `"ST,GS,+0012.5 kg"` (space *before* the unit,
> zero-padded) is WRONG for this scale.** And a naive `atof(line + 6)` returns
> **0**, because on the real format the sign `+` is immediately followed by
> padding spaces, which `atof` can't parse. Parse the number from *just past
> the sign* (where it's spaces+digits — `atof` skips leading spaces) and apply
> the sign yourself.

This is what actually ships in `esp32-rs232-bridge.ino` (line-buffered,
non-blocking):

```cpp
ScaleReading getScaleReading() {
  static char line[48];
  static size_t len = 0;

  ScaleReading r = { 0.0, false, false, "kg" };

  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      line[len] = '\0';
      size_t lineLen = len;
      len = 0;
      if (lineLen && line[lineLen - 1] == '\r') line[--lineLen] = '\0';

      // "US,GS,+  13.87kg" — need status + two commas at fixed positions
      if (lineLen < 8 || line[2] != ',' || line[5] != ',') continue;
      if (line[0] == 'O' && line[1] == 'L') continue;      // overload → skip

      const char* rest = line + 6;                          // "+  13.87kg"
      char sign = rest[0];
      float weight = atof(rest + 1);                        // atof skips the spaces
      if (sign == '-') weight = -weight;

      r.stable = (line[0] == 'S' && line[1] == 'T');
      r.weight = weight;
      r.unit   = (strstr(rest, "lb") != nullptr) ? "lb" : "kg";
      r.valid  = true;
      // keep draining; the LAST complete line wins
    } else if (len < sizeof(line) - 1) {
      line[len++] = c;
    } else {
      len = 0;                                              // overflow → resync
    }
  }
  return r;
}
```

Notes:

- The scale sends ~several lines/sec; the firmware pushes at most 1/sec. This
  function drains everything available and returns the newest complete line —
  intermediate readings are deliberately dropped.
- `r.valid = false` (nothing parsed this cycle) simply means "send nothing" —
  the app's 5-second stale guard will blank the display if the scale goes
  silent for long.
- Overload (`OL`) is currently skipped. If you want the app to show "OVERLOAD",
  add a field to the JSON instead (and to `ScaleReading` on both sides).

## 5. Flip the switch and flash

```cpp
#define USE_SIMULATED_SCALE 0
```

Compile + upload (doc 03). The monitor should now echo *real* weights, and the
Angular app needs no changes at all — same JSON, same endpoint.

## 6. Optional: send commands to the scale

The scale accepts single ASCII characters (manual §5.3): `Z` zero, `T` tare,
`P` print, `R` read once. To expose these, handle `WStype_TEXT` in
`webSocketEvent()` and forward to the scale:

```cpp
case WStype_TEXT:
  if (length == 1 && strchr("ZTPR", payload[0])) Serial2.write(payload[0]);
  break;
```

Then from the app: `ws.send('Z')`. (Requires C18=3 command mode *or* works
alongside continuous mode — verify against the real device.)
