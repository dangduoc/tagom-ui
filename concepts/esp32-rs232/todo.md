# TODO

## Done 2026-07-08 — flashed and verified
- [x] Plug ESP32 DevKitC into PC — needed CP210x driver install (pnputil); board on **COM5**
- [x] Fill in `WIFI_SSID` / `WIFI_PASSWORD` in `esp32-rs232-bridge/esp32-rs232-bridge.ino`
- [x] `arduino-cli board list` → COM5
- [x] `arduino-cli upload -p COM5 --fqbn esp32:esp32:esp32 esp32-rs232-bridge`
- [x] Serial monitor: WiFi connects, IP printed, simulated readings logging at 1 Hz
      (note: `arduino-cli monitor` produced no output from non-interactive shells —
      used .NET `System.IO.Ports.SerialPort` instead; discard input buffer first)
- [x] WebSocket verified end-to-end from PC at `ws://192.168.83.103:81/` (IP is DHCP — may change)

Note: arduino-cli lives in `.tools\` (project-local, not on PATH). Prefix commands with:
`$env:Path = "$PWD\.tools;$env:Path"; $env:ARDUINO_CONFIG_FILE = "$PWD\.tools\arduino-cli.yaml"`

## Later (portability — before deploying to a real site)
- [ ] WiFi provisioning via captive portal (WiFiManager lib): on boot, if saved WiFi
      unreachable → ESP32 opens `Scale-Setup` AP with config page; pick SSID/password
      from phone, saved to NVS. Removes secrets.h/re-flash per location.
- [ ] mDNS (`ws://scale.local:81/`) so the app survives DHCP IP changes
- [ ] Fallback option if site WiFi is unusable: permanent AP mode (client connects
      directly to ESP32, always 192.168.4.1) — config flag, kiosk-style deployments

## Done 2026-07-30 — real scale live end-to-end
- [x] Scale is a **DIGI/Teraoka DS-166SS** (NOT the old "MK231" assumption — discarded).
- [x] Confirmed protocol via USB-RS232 dongle: `US,GS,+  13.87kg\r\n` — space-padded,
      right-aligned weight, `kg` concatenated directly (no space/comma). 9600 8N1.
- [x] Implemented real `getScaleReading()` in the .ino (non-blocking line buffer).
      NB: `atof(line+6)` does NOT work — after the '+' come pad spaces; parse from
      just past the sign (`atof(rest+1)`) and apply the sign manually.
- [x] `USE_SIMULATED_SCALE 0`, flashed COM5, verified live: real JSON tracks weight
      and the stable/unstable flag, e.g. `{"weight": 1.1, "stable": true, "unit": "kg"}`.

### Root cause of the earlier "no signal" blocker (2026-07-08 session)
It was **RS232 wiring/ground into the MAX3232**, not the ESP32 and not the scale.
- Correct TTL wiring (this module is labeled host-side → **STRAIGHT, not crossed**):
  ESP32 GPIO16 (RX2) → module **RXD**, GPIO17 (TX2) → module **TXD**, GND↔GND, VCC↔3.3V.
  Wiring it crossed gave a meaningless `<00><FF>` toggle — RXD→GPIO16 is the right one.
- Before the fix: scale-*synchronized* garbage (correct `\r\n` cadence but mangled bytes,
  idle stuck LOW) at every baud AND both polarities → classic bad-ground / marginal-level
  signature. Re-doing the ground/DB9 connection cleared it instantly.
- Genuine MAX3232 chip (checked marking) → 3.3V power was fine; not a MAX232 mislabel.

Note: `scale-probe/` holds throwaway diagnostics (baud scanner / passthrough) — kept for
future bring-up. Serial reads: `arduino-cli monitor` gives no output from non-interactive
shells — use .NET `System.IO.Ports.SerialPort` from PowerShell (DtrEnable/RtsEnable=$false
to avoid resetting the board mid-read), and DiscardInBuffer() first.
COM5 sometimes locks briefly after rapid open/close — a PS open+close frees it.

## Done — Angular client
- [x] Angular scale page (Cân tab) — live weight over WebSocket, in face-recognition/frontend
