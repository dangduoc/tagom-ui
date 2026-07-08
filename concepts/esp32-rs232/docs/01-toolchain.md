# 01 — Toolchain: what's installed and how to set it up again

## What was installed (and where)

Everything is **project-local** — nothing was added to your system PATH or
global config. If you delete the repo, no trace remains (except the CP210x
driver and the Node 22 copy, noted below).

| Thing | Where | What it is |
|---|---|---|
| `arduino-cli.exe` | `concepts/esp32-rs232/.tools/` | The whole build system: compiler driver, board manager, library manager, uploader. Arduino IDE 2.x is just a GUI over this exact tool. |
| `arduino-cli.yaml` | `concepts/esp32-rs232/.tools/` | Its config file. Only non-default: registers the ESP32 board index URL. |
| ESP32 board package | `%LOCALAPPDATA%\Arduino15\packages\esp32\` | Compilers (xtensa + riscv GCC), ESP32 core libraries, esptool (the flasher). ~2 GB. This is the one thing arduino-cli puts in a user-global location. |
| WebSockets library | `%USERPROFILE%\Documents\Arduino\libraries\` | Markus Sattler's arduinoWebSockets, used by the firmware. |
| CP210x driver | Windows driver store | USB-to-serial driver for the board's CP2102 chip. Installed once, system-wide, survives everything. |
| Node 22 (standalone) | `tagom/.tools/node22/` | Only needed for the Angular frontend (Angular 22 requires Node ≥ 22.22.3; your system node is 20). Git-ignored. |

## Using arduino-cli

`arduino-cli` is NOT on your PATH. In any new terminal, prefix it once:

**PowerShell** (from `concepts/esp32-rs232/`):
```powershell
$env:Path = "$PWD\.tools;$env:Path"
$env:ARDUINO_CONFIG_FILE = "$PWD\.tools\arduino-cli.yaml"
```

**Git Bash** (from `concepts/esp32-rs232/`):
```bash
export PATH="$PWD/.tools:$PATH"
export ARDUINO_CONFIG_FILE="$PWD/.tools/arduino-cli.yaml"
```

After that, `arduino-cli <anything>` works for the rest of that terminal session.

> Tip: if you get tired of this, copy `.tools\arduino-cli.exe` somewhere on your
> PATH — it's a single self-contained exe. The config file is optional
> (it only adds the ESP32 board index URL, which is also remembered globally
> once the core is installed).

## Setting up from scratch on a new machine

```powershell
# 1. Get arduino-cli (single exe, no installer)
#    https://arduino.github.io/arduino-cli/latest/installation/
#    or direct: https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip
#    Unzip anywhere, add to PATH or use the prefix trick above.

# 2. Register the ESP32 board index + download the toolchain (~2 GB, takes a while)
arduino-cli config init --additional-urls "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
arduino-cli core update-index
arduino-cli core install esp32:esp32

# 3. Install the WebSocket library
arduino-cli lib install WebSockets

# 4. CP210x driver (only if 'arduino-cli board list' shows nothing after plugging in)
#    Download "CP210x Universal Windows Driver" from silabs.com, unzip, then:
pnputil /add-driver silabser.inf /install   # (as admin)

# 5. WiFi credentials
#    Copy esp32-rs232-bridge/secrets.example.h to secrets.h, fill in SSID/password.
```

Verify with:
```powershell
arduino-cli version        # tool runs
arduino-cli core list      # esp32:esp32 listed
arduino-cli board list     # board appears as COMx when plugged in
```

## Useful commands

```powershell
arduino-cli board list                 # what's plugged in, which COM port
arduino-cli core list                  # installed board packages
arduino-cli lib list                   # installed libraries
arduino-cli lib search <name>          # find a library to install
arduino-cli core upgrade               # update ESP32 package (careful: test after)
```
