# Starts the whole demo: pgvector database, backend, frontend.
#
# Usage: right-click -> Run with PowerShell, or from a terminal:
#     powershell -ExecutionPolicy Bypass -File start-demo.ps1
#
# The -ExecutionPolicy flag is needed because Windows defaults to Restricted,
# which refuses to load any .ps1. It applies to that one invocation only. To
# stop needing it, run once:  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#
# Keep this file ASCII-only: Windows PowerShell 5.1 reads a BOM-less UTF-8
# script as ANSI, which mangles any non-ASCII character (an em dash decodes to
# a stray double quote and breaks parsing).

$root = $PSScriptRoot

# 1. Database only (needs Docker Desktop running).
#    docker-compose.yml also defines backend/frontend services for a full
#    containerized run (see README) - not used here since this script runs
#    them locally instead, on the same ports.
#    Check $LASTEXITCODE, not $?: docker writes warnings to stderr, and
#    PowerShell 5.1 turns those into ErrorRecords that make $? false even when
#    the command succeeded.
docker info > $null 2> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker isn't responding - start Docker Desktop and run this again." -ForegroundColor Red
    exit 1
}

# --wait blocks until the pg_isready healthcheck passes, so the backend below
# doesn't start against a database that isn't accepting connections yet.
docker compose --project-directory $root up -d --wait db
if ($LASTEXITCODE -ne 0) {
    Write-Host "The database container failed to come up." -ForegroundColor Red
    exit 1
}

# 2. Backend - own window. No backend\.env is needed: app\config.py defaults to
#    the same DSN docker-compose.yml exposes. Copy backend\.env.example to
#    backend\.env only to override something.
#
#    Check the venv has the heavy deps first. Without this the window below
#    just opens, dies on ModuleNotFoundError and closes the traceback with it.
& "$root\backend\.venv\Scripts\python.exe" -c "import cv2, onnxruntime, insightface" 2> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "backend\.venv is missing dependencies. Install them with:" -ForegroundColor Red
    Write-Host "  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
    exit 1
}

# Start-Process spawns a *fresh* PowerShell at the machine default policy, so an
# -ExecutionPolicy passed to this script does not reach the child. Pass it again,
# or the frontend window below dies on npm.ps1 being blocked.
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
    "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

# 3. Frontend (HTTPS on all interfaces, for phone access) - own window.
#    The dev server proxies /api to the backend above, and /scale-ws to the
#    ESP32 scale (frontend\proxy.conf.js). The scale proxy exists because this
#    server is HTTPS and an HTTPS page hard-blocks a direct ws:// to the ESP32.
#    If the scale moved, set $env:SCALE_WS before running this script.
#    npm.cmd rather than npm: bare `npm` resolves to npm.ps1 first, which a
#    Restricted policy refuses to load. npm.cmd is an executable and always runs.
Start-Process powershell -ArgumentList @(
    "-NoExit", "-ExecutionPolicy", "Bypass", "-Command",
    "Set-Location '$root\frontend'; npm.cmd run start:lan"
)

# The IP the phone should use is the one on whichever interface owns the
# default route. Picking the first address instead would hand back Docker's
# WSL vEthernet adapter (172.20.x.x), which the phone can't reach.
$routeIdx = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric | Select-Object -First 1).InterfaceIndex
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $routeIdx -ErrorAction SilentlyContinue |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Demo starting:"
Write-Host "  PC:      https://localhost:4200"
if ($lanIp) {
    Write-Host "  Phone:   https://${lanIp}:4200  (accept the certificate warning)"
}
Write-Host "  Station screens at /, old scale/live experiments at /debug"
Write-Host "Close the two PowerShell windows to stop."
