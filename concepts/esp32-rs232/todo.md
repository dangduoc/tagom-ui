# TODO

## Tomorrow (2026-07-08) — needs micro-USB *data* cable
- [ ] Plug ESP32 DevKitC into PC (check Device Manager → Ports for "Silicon Labs CP210x (COMx)")
- [ ] Fill in `WIFI_SSID` / `WIFI_PASSWORD` in `esp32-rs232-bridge/esp32-rs232-bridge.ino`
- [ ] `arduino-cli board list` → confirm COM port
- [ ] `arduino-cli upload -p COMx --fqbn esp32:esp32:esp32 esp32-rs232-bridge`
- [ ] `arduino-cli monitor -p COMx -c baudrate=115200` → confirm WiFi connect + IP printed + simulated readings logging
- [ ] Test WebSocket from PC: `ws://<esp32-ip>:81/` (wscat / Postman / browser console) — expect `{"weight": …, "stable": …, "unit": "kg"}` every ~1 s

Note: arduino-cli lives in `.tools\` (project-local, not on PATH). Prefix commands with:
`$env:Path = "$PWD\.tools;$env:Path"; $env:ARDUINO_CONFIG_FILE = "$PWD\.tools\arduino-cli.yaml"`

## Later (when RS232 module + scale arrive)
- [ ] Wire MAX3232 module: ESP32 GPIO16 (RX2) ← module TXD, GPIO17 (TX2) → module RXD, shared GND; DB9 to scale
- [ ] Implement `getScaleReading()` (parse `ST,GS,+0012.5 kg\r\n` lines from Serial2, 9600 8N1)
- [ ] Set `USE_SIMULATED_SCALE` to `0`, rebuild, verify 8-N-1 frame format against real scale
- [ ] Build Angular client (plain WebSocket API) for live weight display
