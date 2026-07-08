# 05 — When the real scale arrives

Everything below is future work; nothing here is needed while simulating.

## 1. Wire the hardware

**Power everything off first.**

```
ESP32 DevKitC          MAX3232 module           Scale (DB9)
GPIO17 (TX2)  ───────► RXD (TTL side)
GPIO16 (RX2)  ◄─────── TXD (TTL side)
GND           ───────  GND
3V3 or VIN*   ───────  VCC (check your module's rating)

MAX3232 DB9 side ────► scale's RS232 port
                       (scale: PIN2=TXD, PIN3=RXD, PIN5=GND)
```

\* Most MAX3232 boards accept 3.3 V — use the ESP32's 3V3 pin. If yours is
5 V-only, use VIN (USB 5V), the MAX3232 chip still outputs safe RS232 levels
and its TTL side follows its VCC — prefer 3.3 V to be kind to the ESP32's
RX pin.

TX/RX crossing: our TX goes to their RX and vice versa. If nothing arrives
during testing, swapped TX/RX wires is the #1 suspect — safe to just swap and
retry.

## 2. Configure the scale

In the indicator's setup menu (see USERMANUAL-MK231OIML180416.md §4.4):

- `C18 = 4` — continuous sending mode (the firmware expects a stream)
- `C19 = 3` — 9600 baud (firmware default; must match `SCALE_BAUD`)

## 3. Verify raw data before touching code

Flash a tiny throwaway test first — it just forwards scale bytes to the USB
console. Temporarily replace `loop()` (or make a separate sketch folder):

```cpp
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
}
void loop() {
  while (Serial2.available()) Serial.write(Serial2.read());
}
```

Open the monitor. Expected with weight on the scale, e.g.:

```
ST,GS,+0012.5 kg
US,GS,+0009.8 kg
```

- Clean lines → protocol confirmed, continue.
- Garbage → wrong baud (try C19 vs SCALE_BAUD) or frame format (manual doesn't
  guarantee 8-N-1 — try `SERIAL_7E1` etc. if needed).
- Nothing → swap TX/RX, check GND, check C18=4, check the DB9 is the RS232 port.

## 4. Implement `getScaleReading()`

The frame, per the manual (§5.1) and CONTEXT.md:

```
S1,S2,S3Data S4\r\n        e.g.  "ST,GS,+0012.5 kg\r\n"
 │   │  │ │      └ unit: "kg" | "lb"
 │   │  │ └ weight incl. decimal point, may have leading zeros
 │   │  └ sign: '+' | '-'
 │   └ mode: GS=gross | NT=net
 └ status: ST=stable | US=unstable | OL=overload
```

Reference implementation (line-buffered, non-blocking — drop into the .ino,
replacing the stub):

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
      // strip trailing \r
      if (lineLen && line[lineLen - 1] == '\r') line[--lineLen] = '\0';

      // "ST,GS,+0012.5 kg" — minimum sanity: status + 2 commas
      if (lineLen < 8 || line[2] != ',' || line[5] != ',') continue;
      if (line[0] == 'O' && line[1] == 'L') continue;      // overload → skip

      r.stable = (line[0] == 'S' && line[1] == 'T');
      r.weight = atof(line + 6);                            // handles sign + decimals
      r.unit   = (strstr(line + 6, "lb") != nullptr) ? "lb" : "kg";
      r.valid  = true;
      // keep draining the buffer; the LAST complete line wins
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
