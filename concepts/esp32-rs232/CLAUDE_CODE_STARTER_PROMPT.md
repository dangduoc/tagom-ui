I'm building an ESP32-based bridge between an RS232 digital scale and a mobile
app. Full background is in CONTEXT.md in this folder — please read it first.

For this first session, I want to:

1. Set up an Arduino-CLI-based project (no PlatformIO, no Arduino IDE GUI) for
   an ESP32 DevKitC board (FQBN `esp32:esp32:esp32`).
2. Write firmware that:
   - Connects to WiFi in station mode (use placeholder `WIFI_SSID` /
     `WIFI_PASSWORD` `#define`s at the top of the file for me to fill in).
   - Starts a WebSocket server (e.g. using the `arduinoWebSockets` library or
     similar — pick whatever's easiest to install via `arduino-cli lib
     install`) on a fixed port.
   - Every ~1 second, pushes a **simulated** weight reading to any connected
     client, in the same shape the real scale will eventually produce: a
     numeric weight, a stable/unstable flag, and a unit (kg) — send it as a
     small JSON payload, e.g. `{"weight": 12.5, "stable": true, "unit": "kg"}`.
   - Structure the code so the fake-data source is clearly isolated (e.g. a
     single function like `getSimulatedReading()`) and easy to swap out later
     for real UART2 parsing — don't hardcode the fake logic inline all over
     the file.
   - Leaves a clearly separated function stub for where the real RS232
     parsing (via `Serial2`, 9600 baud, format documented in CONTEXT.md) will
     go once the hardware arrives.
   - Also `Serial.println()`s each reading for local debugging over USB,
     independent of the WebSocket push.
3. Compile the sketch using `arduino-cli compile --fqbn esp32:esp32:esp32`
   and fix any errors until it builds cleanly.
4. If the ESP32 is plugged in and `arduino-cli board list` shows it, upload it
   with `arduino-cli upload`, then use `arduino-cli monitor` to confirm it
   connects to WiFi, prints its IP address, and starts logging simulated
   readings.

Please walk through this step by step, showing me the compile/upload output as
you go rather than assuming success silently. Also tell me the ESP32's IP
address and WebSocket port once it's running, so I can test the connection
directly from a browser or a simple wscat/Postman WebSocket call before any
app code exists.

Once this is working, I'll want to build the Angular client (plain
WebSocket API) to receive and display the live weight — but let's get the
firmware solid first.
