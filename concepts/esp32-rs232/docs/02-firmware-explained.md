# 02 — The firmware, explained

File: `esp32-rs232-bridge/esp32-rs232-bridge.ino`

## Arduino mental model (for a .NET developer)

An Arduino "sketch" (`.ino`) is **C++**. The build system auto-includes
`Arduino.h` and wraps everything in a hidden `main()` that does:

```cpp
int main() {
  setup();              // your one-time init — think "Program.Main + Startup"
  while (true) loop();  // your update tick, called forever, as fast as possible
}
```

There is no OS process model, no GC, no async/await. One core runs your
`loop()` over and over (the ESP32's second core runs the WiFi stack for you).
"Blocking" anywhere in `loop()` means *everything* stalls — that's why the code
uses a `millis()` timer check instead of `delay(1000)` (more below).

Key vocabulary:

| Arduino | .NET equivalent (rough) |
|---|---|
| `#define WIFI_SSID "x"` | `const string`, but resolved by the preprocessor at compile time |
| `Serial` | `Console` over the USB cable (115200 baud) |
| `Serial2` | A second, hardware serial port (UART2) — will talk to the scale |
| `String`/`char[]` | We use `char[]` + `snprintf` = stack-allocated, no heap fragmentation |
| `static` local var | A private field that survives between calls |
| flashing | deploying — the program is burned into flash memory, runs on power-up |

## Walkthrough, top to bottom

### Config block

```cpp
#include "secrets.h"           // WIFI_SSID / WIFI_PASSWORD — git-ignored file

#define WEBSOCKET_PORT 81
#define READING_INTERVAL_MS 1000
#define USE_SIMULATED_SCALE 1  // 1 = fake data; 0 = read real scale on UART2

#define SCALE_BAUD 9600        // per scale manual, param C19=3
#define SCALE_RX_PIN 16        // GPIO16 = "RX2" pin on the DevKit silkscreen
#define SCALE_TX_PIN 17        // GPIO17 = "TX2"
```

`USE_SIMULATED_SCALE` is a **compile-time** switch (`#if`), not a runtime `if`.
Changing it requires recompiling and re-uploading — but the dead branch costs
zero bytes on the device.

### The data shape

```cpp
struct ScaleReading {
  float weight;
  bool stable;
  bool valid;        // false => don't send anything this cycle
  const char* unit;  // "kg" or "lb"
};
```

This struct is the seam between "where readings come from" and "where they go".
Both the fake and the real source return it; the send side doesn't know which
one produced it.

### `getSimulatedReading()` — the fake source

A tiny state machine using `static` locals to keep state between calls:

1. **Settling**: current weight moves 40% of the remaining distance toward a
   target each second, plus ±0.1 jitter → looks like a real scale settling,
   reports `stable: false`.
2. **Stable**: once within 0.05 of the target, snaps to it, reports
   `stable: true`.
3. After ~8 stable seconds: resets to 0 and picks a new random target
   (5.0–200.0 kg) → simulates removing the object and placing a new one.

Delete this entire function once the real scale works.

### `getScaleReading()` — the real source (stub)

Currently returns `valid: false` (so nothing is sent). When the hardware
arrives, this is where the UART parsing goes — the expected wire format and the
parsing plan are in the comment above it, and step-by-step instructions are in
[05-real-scale.md](05-real-scale.md).

### `getReading()` — the switch

```cpp
ScaleReading getReading() {
#if USE_SIMULATED_SCALE
  return getSimulatedReading();
#else
  return getScaleReading();
#endif
}
```

The only place that knows both sources exist.

### `webSocketEvent()` — connection logging

Called by the WebSockets library when a client connects/disconnects. Purely
for USB debug logging — broadcasting doesn't need it (the library tracks
clients internally). This is also where you'd handle **incoming** messages
(`WStype_TEXT`) if the app ever needs to send commands (tare, zero) to the
bridge.

### `setup()` — runs once at boot

1. `Serial.begin(115200)` — opens USB debug console.
2. (real-scale mode only) `Serial2.begin(9600, SERIAL_8N1, 16, 17)` — opens
   UART2 toward the scale: 9600 baud, 8 data bits, no parity, 1 stop bit.
3. WiFi station mode; **blocks** until connected (dots print every 500 ms —
   if you see endless dots, credentials are wrong or the network is 5 GHz-only;
   the ESP32 only does 2.4 GHz).
4. Prints the IP address — **this is where you learn the WebSocket URL.**
5. Starts the WebSocket server on port 81.

### `loop()` — runs forever

```cpp
void loop() {
  webSocket.loop();                                 // service WS clients — MUST run often

  static unsigned long lastPush = 0;
  if (millis() - lastPush >= READING_INTERVAL_MS) { // non-blocking 1 s timer
    lastPush = millis();
    ScaleReading r = getReading();
    if (r.valid) {
      char json[80];
      snprintf(json, sizeof(json), "{\"weight\": %.1f, ...}", ...);
      webSocket.broadcastTXT(json);                 // to every connected client
      Serial.println(json);                         // to USB debug console
    }
  }
}
```

Why not `delay(1000)`? Because `webSocket.loop()` must run thousands of times
per second to service TCP — a 1-second sleep would break connections. The
`millis()` pattern ("has 1000 ms passed since last time?") is the standard
Arduino idiom for "do X every N ms without blocking", equivalent in spirit to a
`System.Threading.PeriodicTimer` tick inside a busy message loop.

`millis()` = milliseconds since boot (like `Environment.TickCount`). It
overflows after ~49 days, but the subtraction idiom handles that correctly
thanks to unsigned arithmetic.

## The JSON contract

One text frame per second to every connected client:

```json
{"weight": 12.5, "stable": true, "unit": "kg"}
```

- `weight`: number, one decimal place
- `stable`: `true` when the scale reading has settled (`ST` from the real scale)
- `unit`: `"kg"` (or `"lb"` if the scale is ever configured that way)

If you change this shape, update `ScaleReading`/`snprintf` here **and**
`ScaleReading` in the Angular app
(`face-recognition/frontend/src/app/scale/scale.service.ts`).
