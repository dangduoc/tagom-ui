# ESP32 RS232 Scale Bridge

ESP32 firmware that reads weight from an RS232 weighing indicator and streams it
to web/mobile clients over WebSocket. Currently running with **simulated**
readings (scale hardware not yet arrived).

```
Scale (RS232) → MAX3232 module → ESP32 UART2 → WiFi/WebSocket → Angular app
                 (not yet wired)                 ws://<esp32-ip>:81
```

## Documentation

| File | Read it when… |
|---|---|
| [docs/01-toolchain.md](docs/01-toolchain.md) | You need to (re)install tools, or set up on a new machine |
| [docs/02-firmware-explained.md](docs/02-firmware-explained.md) | You want to understand every line of the firmware |
| [docs/03-edit-and-flash.md](docs/03-edit-and-flash.md) | **You want to change the code and upload it** (the daily workflow) |
| [docs/04-frontend.md](docs/04-frontend.md) | You're working on the Angular scale page |
| [docs/05-real-scale.md](docs/05-real-scale.md) | The RS232 module + real scale arrive |
| [CONTEXT.md](CONTEXT.md) | Project background, hardware decisions, scale protocol |
| [todo.md](todo.md) | Current task list |

## Quick reference

- **Firmware**: `esp32-rs232-bridge/esp32-rs232-bridge.ino`
- **WiFi credentials**: `esp32-rs232-bridge/secrets.h` (git-ignored; copy `secrets.example.h`)
- **WebSocket**: `ws://<esp32-ip>:81/`, sends `{"weight": 12.5, "stable": true, "unit": "kg"}` every 1 s
- **Quick browser test**: serve `ws-test.html` from localhost (see docs/03, step 6)
- **Board**: ESP32 DevKitC, FQBN `esp32:esp32:esp32`, shows up as COM port via CP2102
