# =====================================================================
#  RAG Powered Knowledge System - one-shot launcher (Windows)
#
#  Brings up, in order: PostgreSQL -> Ollama -> backend -> frontend,
#  then opens the app in the default browser. Each server gets its own
#  window so its log stays readable; closing a window stops that server.
#
#  Paths are all relative to the repo root, so this works from wherever
#  the project is installed (including a copy restored from the CD).
# =====================================================================

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

function Test-Port([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

function Wait-Port([int]$Port, [int]$Seconds, [string]$What) {
    for ($i = 0; $i -lt $Seconds; $i++) {
        if (Test-Port $Port) { return $true }
        Start-Sleep -Seconds 1
        if ($i % 5 -eq 4) { Write-Host ("      still waiting for {0} ({1}s)" -f $What, ($i + 1)) -ForegroundColor DarkGray }
    }
    return $false
}

function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }

Clear-Host
Say "==============================================================" Cyan
Say "  RAG Powered Knowledge System" Cyan
Say "  $root" DarkGray
Say "==============================================================" Cyan
Write-Host ""

# ---- Sanity: has the project been installed? ------------------------
$venvPy = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPy)) {
    Say "  The Python virtual environment is missing." Red
    Say "  Run the one-time setup first - see INSTALL.md, section 3." Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}
if (-not (Test-Path (Join-Path $root 'frontend\node_modules'))) {
    Say "  Frontend dependencies are missing." Red
    Say "  Run 'npm install' in the frontend folder - see INSTALL.md, section 4." Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}
if (-not (Test-Path (Join-Path $root 'backend\.env'))) {
    Say "  backend\.env is missing - copy backend\.env.example to backend\.env" Red
    Say "  and fill in your database password. See INSTALL.md, section 2." Yellow
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 1
}

# ---- 1. PostgreSQL --------------------------------------------------
Say "[1/4] PostgreSQL (port 5432)" White
if (Test-Port 5432) {
    Say "      already running" Green
} else {
    $svc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) {
        Say "      starting service $($svc.Name) ..." DarkGray
        try {
            Start-Service $svc.Name -ErrorAction Stop
            if (Wait-Port 5432 20 'PostgreSQL') { Say "      started" Green }
            else { Say "      service started but port 5432 is not answering" Yellow }
        } catch {
            Say "      could not start it (needs Administrator)." Red
            Say "      Right-click start-app.bat > Run as administrator, or start" Yellow
            Say "      the '$($svc.Name)' service from services.msc, then re-run." Yellow
            Read-Host "  Press Enter to close"
            exit 1
        }
    } else {
        Say "      no PostgreSQL service found - is PostgreSQL 16 installed?" Red
        Read-Host "  Press Enter to close"
        exit 1
    }
}

# ---- 2. Ollama ------------------------------------------------------
Say "[2/4] Ollama (port 11434)" White
if (Test-Port 11434) {
    Say "      already running" Green
} else {
    $ollama = Get-Command ollama -ErrorAction SilentlyContinue
    if ($ollama) {
        Say "      starting ollama serve ..." DarkGray
        Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
        if (Wait-Port 11434 25 'Ollama') { Say "      started" Green }
        else { Say "      did not come up - local models will be unavailable" Yellow }
    } else {
        Say "      Ollama is not installed or not on PATH." Yellow
        Say "      The app will still run, but only cloud models will be offered." Yellow
    }
}

# ---- 3. Backend -----------------------------------------------------
Say "[3/4] Backend / FastAPI (port 8000)" White
if (Test-Port 8000) {
    $mine = $false
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -UseBasicParsing -TimeoutSec 4
        if ($r.StatusCode -eq 200) { $mine = $true }
    } catch { }
    if ($mine) {
        Say "      already running" Green
    } else {
        Say "      port 8000 is taken by something that is NOT this backend." Red
        Say "      Close it (another project's server?) and re-run. To force:" Yellow
        Say "      Get-NetTCPConnection -LocalPort 8000 -State Listen |" DarkGray
        Say "        ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force }" DarkGray
        Read-Host "  Press Enter to close"
        exit 1
    }
} else {
    Say "      launching (first start loads the embedding model - be patient)" DarkGray
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/k', "title RAG Backend && cd /d `"$root\backend`" && `".venv\Scripts\python.exe`" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
    if (Wait-Port 8000 120 'the backend') { Say "      up on http://127.0.0.1:8000" Green }
    else {
        Say "      backend did not start - check the 'RAG Backend' window for the error" Red
        Read-Host "  Press Enter to close"
        exit 1
    }
}

# ---- 4. Frontend ----------------------------------------------------
Say "[4/4] Frontend / Vite (port 5173)" White
if (Test-Port 5173) {
    Say "      already running" Green
} else {
    Say "      launching ..." DarkGray
    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/k', "title RAG Frontend && cd /d `"$root\frontend`" && npm run dev"
    if (Wait-Port 5173 60 'the frontend') { Say "      up on http://localhost:5173" Green }
    else {
        Say "      frontend did not start - check the 'RAG Frontend' window" Red
        Read-Host "  Press Enter to close"
        exit 1
    }
}

Write-Host ""
Say "==============================================================" Cyan
Say "  Ready - opening http://localhost:5173" Green
Say "==============================================================" Cyan
Write-Host ""
Say "  Sign in with the seeded admin account:" Gray
Say "    admin@example.com / admin1234" White
Write-Host ""
Say "  Two server windows are now open ('RAG Backend', 'RAG Frontend')." Gray
Say "  Leave them open while you use the app. Closing a window stops" Gray
Say "  that server. Or run stop-app.bat to shut everything down." Gray
Write-Host ""

Start-Sleep -Seconds 2
Start-Process 'http://localhost:5173'

Read-Host "  Press Enter to close this launcher window (servers keep running)"
