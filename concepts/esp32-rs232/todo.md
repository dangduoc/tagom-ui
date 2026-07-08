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

## Later (when RS232 module + scale arrive)
- [ ] Wire MAX3232 module: ESP32 GPIO16 (RX2) ← module TXD, GPIO17 (TX2) → module RXD, shared GND; DB9 to scale
- [ ] Implement `getScaleReading()` (parse `ST,GS,+0012.5 kg\r\n` lines from Serial2, 9600 8N1)
- [ ] Set `USE_SIMULATED_SCALE` to `0`, rebuild, verify 8-N-1 frame format against real scale
- [ ] Build Angular client (plain WebSocket API) for live weight display
