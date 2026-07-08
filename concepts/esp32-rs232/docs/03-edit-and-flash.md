# 03 — Daily workflow: edit code → compile → upload → verify

This is the loop you'll repeat every time you change the firmware.

## Step 0 — one-time per terminal

Open PowerShell in `concepts/esp32-rs232/` and put arduino-cli on the PATH:

```powershell
$env:Path = "$PWD\.tools;$env:Path"
$env:ARDUINO_CONFIG_FILE = "$PWD\.tools\arduino-cli.yaml"
```

## Step 1 — edit the code

Open `esp32-rs232-bridge/esp32-rs232-bridge.ino` in any editor (VS Code works
great — it's just C++). Common edits:

- **Change WiFi network** → edit `esp32-rs232-bridge/secrets.h`
- **Change push rate** → `READING_INTERVAL_MS`
- **Change port** → `WEBSOCKET_PORT` (also update the URL in the app)
- **Switch to the real scale** → `USE_SIMULATED_SCALE 0` (see doc 05 first)

> Rule of thumb: the ESP32 runs whatever was flashed last. Editing the file on
> your PC changes nothing on the device until you compile **and** upload again.

## Step 2 — compile

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 esp32-rs232-bridge
```

- `--fqbn` (fully qualified board name) tells it which chip/board to build for.
  Ours is always `esp32:esp32:esp32` (package : platform : board).
- The last argument is the **sketch folder** (not the .ino file).
  Note: the .ino filename must always match its folder name — Arduino rule.
- Success looks like: `Sketch uses 926495 bytes (70%) of program storage space.`
- Errors look like normal GCC errors with file/line numbers. Fix, re-run.
  Nothing is uploaded when compilation fails, so the device keeps running the
  old firmware.

## Step 3 — find the board

Plug the ESP32 in (micro-USB, must be a **data** cable) and:

```powershell
arduino-cli board list
```

Expected: a `COMx` line (e.g. `COM5 serial Serial Port (USB)`). "Unknown" as
the board name is normal. If **no boards found**, see Troubleshooting below.

## Step 4 — upload (flash)

```powershell
arduino-cli upload -p COM5 --fqbn esp32:esp32:esp32 esp32-rs232-bridge
```

(replace `COM5` with your port from step 3)

You'll see esptool connect, write several `.bin` files with progress bars, then
`Hard resetting via RTS pin...` — that means success, and the board reboots
straight into your new firmware. Takes ~15 seconds.

Compile + upload in one command:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 -u -p COM5 esp32-rs232-bridge
```

## Step 5 — watch it boot (serial monitor)

```powershell
arduino-cli monitor -p COM5 -c baudrate=115200
```

(Ctrl+C to exit.) You should see:

```
Connecting to WiFi "yourssid"....
WiFi connected, IP: 192.168.x.x
WebSocket server: ws://192.168.x.x:81/
{"weight": 4.9, "stable": false, "unit": "kg"}
...
```

**Note the IP address** — that's what the app connects to. It can change when
the router reboots (DHCP).

> The monitor holds the COM port. You can't upload while it's open — close it
> first (Ctrl+C).

## Step 6 — test the WebSocket without any app

Pick one:

- **Test page**: `python -m http.server 8137` in this folder, then open
  `http://localhost:8137/ws-test.html`, enter the IP, Connect.
- **wscat**: `npx wscat -c ws://192.168.x.x:81/`
- **Postman**: New → WebSocket Request → `ws://192.168.x.x:81/`

> Why not paste `new WebSocket(...)` into any browser tab's console? Chrome's
> *Local Network Access* policy blocks pages from public origins from reaching
> `192.168.*` addresses. Pages served from `localhost` are allowed (you get a
> permission prompt — click Allow). This is a browser rule, not a bug in the
> firmware.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `board list` empty, power LED on | Charge-only USB cable → use a data cable |
| `board list` empty, Device Manager shows CP2102 with error | Driver missing → install "CP210x Universal Windows Driver" from silabs.com (`pnputil /add-driver silabser.inf /install` as admin) |
| Upload fails with "could not connect / timed out" | Another program holds the port (serial monitor open?) → close it. Rarely: hold the BOOT button on the board while esptool says "Connecting..." |
| Monitor shows endless dots after "Connecting to WiFi" | Wrong SSID/password in `secrets.h`, or the network is 5 GHz-only (ESP32 needs 2.4 GHz) |
| Monitor shows garbage characters | Wrong baud rate → must be 115200; also normal for one line right at reset (boot ROM noise) |
| App can't connect but monitor shows readings | IP changed (DHCP) → read the new IP from the monitor or the router's client list |
| Changed the code but behavior is the same | You compiled but forgot to upload, or uploaded a different sketch folder |

## Where things live

```
esp32-rs232/
├── .tools/                        arduino-cli + config (git-ignored)
├── esp32-rs232-bridge/
│   ├── esp32-rs232-bridge.ino    the firmware (folder name = file name, required)
│   ├── secrets.h                  your real WiFi credentials (git-ignored)
│   └── secrets.example.h          template for secrets.h (committed)
├── ws-test.html                   browser test dashboard
├── docs/                          these guides
├── CONTEXT.md                     project background + scale protocol
└── todo.md                        task list
```
