# Starts the whole demo: pgvector database, backend, frontend.
# Usage: right-click -> Run with PowerShell, or: powershell -File start-demo.ps1

$root = $PSScriptRoot

# 1. Database only (needs Docker Desktop running; harmless if already up).
#    docker-compose.yml also defines backend/frontend services for a full
#    containerized run (see README) — not used here since this script runs
#    them locally instead, on the same ports.
docker compose --project-directory $root up -d db

# 2. Backend (reads backend\.env for DB settings) — own window
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
)

# 3. Frontend (HTTPS on all interfaces, for phone access) — own window
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\frontend'; npm run start:lan"
)

Write-Host ""
Write-Host "Demo starting:"
Write-Host "  PC:      https://localhost:4200"
Write-Host "  iPhone:  https://172.16.13.12:4200  (accept the certificate warning)"
Write-Host "Close the two PowerShell windows to stop."
